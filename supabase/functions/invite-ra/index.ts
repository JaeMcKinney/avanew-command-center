// Supabase Edge Function — invite-ra
//
// What this does:
//   1. Verifies the caller is admin+ in their profile.
//   2. Validates the slug format and uniqueness.
//   3. Calls supabase.auth.admin.inviteUserByEmail() — sends a magic-link
//      invite and creates the auth.users row (which triggers handle_new_user,
//      creating the matching profiles row synchronously).
//   4. Inserts a row into ra_associates (status: pending) and
//      organization_members (role: referral_associate).
//
// Deploy:
//   supabase functions deploy invite-ra --no-verify-jwt
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   - SUPABASE_URL                (auto)
//   - SUPABASE_SERVICE_ROLE_KEY   (your project's service-role key — keep secret)

import { createClient } from "npm:@supabase/supabase-js@2"

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

  // Verify caller has permission to invite RAs (admin+ in their profile).
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  if (!["super_user", "owner", "admin"].includes(callerProfile?.role ?? "")) {
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

  // Send the magic-link invite. This creates the auth.users row, which
  // synchronously fires the handle_new_user trigger → creates profiles row.
  const redirectTo = payload.redirect_to ?? `${supabaseUrl.replace(".supabase.co", "").replace("https://", "https://")}/onboarding`
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: display_name, first_name, last_name },
    redirectTo: payload.redirect_to,
  })
  if (inviteErr) return json(500, { error: inviteErr.message })

  const userId = inviteData?.user?.id
  if (!userId) return json(500, { error: "No user ID returned from invite" })

  // Ensure the profile row exists (created by handle_new_user trigger).
  // Upsert is safe here — if trigger already ran it's a no-op.
  await admin.from("profiles").upsert(
    { id: userId, email, full_name: display_name, role: "referral_associate" },
    { onConflict: "id", ignoreDuplicates: true }
  )

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

  return json(200, {
    id: raRow.id,
    user_id: userId,
    email,
    display_name,
    slug,
    status: "pending",
    organization_id,
    created_at: raRow.created_at,
  })
})
