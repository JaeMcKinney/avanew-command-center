// Supabase Edge Function — invite-ra
//
// What this does:
//   1. Verifies the caller is admin+ in their profile.
//   2. Validates the slug format and uniqueness.
//   3. Calls supabase.auth.admin.generateLink({type:"invite"}) — creates the
//      auth.users row (which triggers handle_new_user, creating the matching
//      profiles row synchronously) and returns a verifiable action_link,
//      WITHOUT sending Supabase's own invite email.
//   4. Inserts a row into ra_associates (status: pending, with invite_expires_at
//      = now+72h and onboarding_deadline_at = now+21d) and organization_members
//      (role: referral_associate).
//   5. Sends a branded SendGrid email (best-effort, non-blocking) containing
//      the action_link and stating both deadlines plainly — matching every
//      other RA-lifecycle email in this codebase instead of relying on
//      GoTrue's default mailer/template.
//
// Deploy:
//   supabase functions deploy invite-ra --no-verify-jwt
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   - SUPABASE_URL                (auto)
//   - SUPABASE_SERVICE_ROLE_KEY   (your project's service-role key — keep secret)
//   - SENDGRID_API_KEY            (same key used by every other RA notification)

import { createClient } from "npm:@supabase/supabase-js@2"
import { wrap, escapeHtml, sendGridSend } from "../_shared/email.ts"

type InviteRaPayload = {
  email: string
  first_name: string
  last_name: string
  slug: string
  ra_type?: "individual" | "company"
  organization_id: string
  redirect_to?: string
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    },
  })

function buildInviteEmail(firstName: string, orgName: string, actionLink: string): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  return wrap(
    greeting, orgName,
    "You're invited!",
    `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 14px">You've been invited to join <strong style="color:#EAF2F9">${escapeHtml(orgName)}</strong>'s Referral Associate Program. Click below to accept and set up your account.</p>
     <div style="background:rgba(244,178,58,.1);border:1px solid rgba(244,178,58,.3);border-radius:8px;padding:14px 16px">
       <p style="margin:0 0 8px;font-weight:600;color:#F4D58A;font-size:.9rem">Two deadlines to know</p>
       <p style="margin:0 0 6px;color:#A2B6C9;font-size:.85rem;line-height:1.5">This invite link expires in <strong style="color:#EAF2F9">72 hours</strong>.</p>
       <p style="margin:0;color:#A2B6C9;font-size:.85rem;line-height:1.5">You must complete and submit your onboarding within <strong style="color:#EAF2F9">3 weeks (21 days)</strong> of this invite, or your application will be automatically closed and you'll need to reapply.</p>
     </div>`,
    "Accept invite & set your password",
    actionLink,
  )
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
        "access-control-allow-methods": "POST, OPTIONS",
      },
    })
  }
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const callerJwt = authHeader.replace(/^Bearer\s+/i, "")
  if (!callerJwt) return json(401, { error: "Missing bearer token" })

  // Service-role client — bypasses RLS for admin operations.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify caller identity.
  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerJwt)
  if (callerErr || !callerData.user) return json(401, { error: "Invalid session" })

  // Verify caller has permission to invite RAs. Accept admin+ from EITHER
  // profiles.role OR organization_members.role for the target org — profile.role
  // has been observed drifting to 'referral_associate' on staff accounts that
  // also hold an RA row (e.g. zuirrae@divigner.com), which would otherwise
  // 403 the actual program admin out of inviting.
  const STAFF_ROLES = ["super_user", "owner", "admin"]
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  let isStaff = STAFF_ROLES.includes(callerProfile?.role ?? "")
  if (!isStaff) {
    // Fall back: check the caller's role inside the org they're inviting into.
    // Done as a separate query so the early-success path stays a single read.
    // organization_id from payload isn't trusted yet, so verify membership in
    // ANY org with a staff role — RA-program admins are admins in their org.
    const { data: memberships } = await admin
      .from("organization_members")
      .select("role")
      .eq("user_id", callerData.user.id)
    isStaff = (memberships ?? []).some((m: { role: string }) => STAFF_ROLES.includes(m.role))
  }
  if (!isStaff) {
    return json(403, { error: "Admin or above required" })
  }

  let payload: InviteRaPayload
  try {
    payload = (await req.json()) as InviteRaPayload
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  const email = payload.email?.trim().toLowerCase()
  const first_name = payload.first_name?.trim()
  const last_name = payload.last_name?.trim()
  const display_name = [first_name, last_name].filter(Boolean).join(" ")
  const slug = payload.slug?.trim().toLowerCase()
  const organization_id = payload.organization_id
  const ra_type = payload.ra_type === "company" ? "company" : "individual"

  if (!email) return json(400, { error: "email is required" })
  if (!first_name) return json(400, { error: "first_name is required" })
  if (!last_name) return json(400, { error: "last_name is required" })
  if (!slug || !SLUG_RE.test(slug) || slug.length < 2 || slug.length > 60) {
    return json(400, { error: "Slug must be 2–60 lowercase letters, numbers, or hyphens" })
  }
  if (!organization_id) return json(400, { error: "organization_id is required" })

  // Check slug uniqueness.
  const { data: existing } = await admin
    .from("ra_associates")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()
  if (existing) return json(409, { error: `Slug "${slug}" is already taken` })

  // generateLink({type:"invite"}) creates the auth.users row (synchronously
  // firing handle_new_user → profiles row) and returns a verifiable
  // action_link, WITHOUT sending Supabase's own invite email — we send our
  // own branded SendGrid email below instead.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: payload.redirect_to,
      data: { full_name: display_name, first_name, last_name },
    },
  })
  if (linkErr) return json(500, { error: linkErr.message })

  const userId = linkData?.user?.id
  if (!userId) return json(500, { error: "No user ID returned from generateLink" })
  const actionLink = linkData?.properties?.action_link
  if (!actionLink) return json(500, { error: "No action_link returned from generateLink" })

  // Force-set profile.role = 'referral_associate'. The handle_new_user trigger
  // runs synchronously inside generateLink and creates the profile row
  // with role='member' (because invite-ra bypasses the invitations table, so
  // the trigger has no role hint). Without overwriting here, profiles.role
  // stays 'member' → getRaPortalRedirect treats them as staff → the new RA
  // gets dropped into the staff CRM instead of /onboarding/steps. Don't pass
  // ignoreDuplicates — we WANT to overwrite the trigger's row.
  await admin.from("profiles").upsert(
    { id: userId, email, full_name: display_name, role: "referral_associate" },
    { onConflict: "id" }
  )

  // Both deadlines are computed from one shared `now` so they stay in sync
  // with created_at — 72h invite-link window, 21-day onboarding-submission
  // window. Enforced by the notify-ra-invite-expiring / notify-ra-onboarding-
  // deadline cron functions.
  const now = new Date()
  const inviteExpiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString()
  const onboardingDeadlineAt = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString()

  // Create the ra_associates row.
  const { data: raRow, error: raErr } = await admin
    .from("ra_associates")
    .insert({
      organization_id,
      user_id: userId,
      slug,
      display_name,
      status: "pending",
      ra_type,
      invite_expires_at: inviteExpiresAt,
      onboarding_deadline_at: onboardingDeadlineAt,
    })
    .select()
    .single()
  if (raErr) return json(500, { error: raErr.message })

  // Add to organization_members with the referral_associate role.
  const { error: memberErr } = await admin
    .from("organization_members")
    .upsert(
      { organization_id, user_id: userId, role: "referral_associate" },
      { onConflict: "organization_id,user_id" }
    )
  if (memberErr) return json(500, { error: memberErr.message })

  // Branded invite email — best-effort, non-blocking. A SendGrid hiccup
  // shouldn't fail an otherwise-successful invite; the admin can always
  // re-invite from the RA list.
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY")
  if (sendgridKey) {
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .maybeSingle()
    const orgName = org?.name ?? "Divigner Group"
    const html = buildInviteEmail(first_name, orgName, actionLink)
    void sendGridSend(sendgridKey, email, `You're invited to join ${orgName}'s Referral Associate Program`, html)
  } else {
    console.warn("SENDGRID_API_KEY not set; RA invited but no email sent")
  }

  return json(200, {
    id: raRow.id,
    user_id: userId,
    email,
    display_name,
    slug,
    status: "pending",
    organization_id,
    created_at: raRow.created_at,
    invite_expires_at: inviteExpiresAt,
    onboarding_deadline_at: onboardingDeadlineAt,
  })
})
