// Supabase Edge Function — reinvite-ra
//
// Resends a sign-in link to an existing RA. Optionally updates the RA's email
// first (admin entered a corrected/different address in the modal).
//
// Flow:
//   1. Verify caller is admin+ in profiles or any org_members row.
//   2. Look up the RA by id; pull current email + user_id.
//   3. If new_email differs from current: update auth.users, profiles.email,
//      and ra_associates.email.
//   4. Re-send the invite. We try inviteUserByEmail first (works in some
//      Supabase versions for existing pending users); on "already registered"
//      we fall back to generateLink + resetPasswordForEmail so the RA still
//      gets a usable email.
//
// Deploy:
//   supabase functions deploy reinvite-ra --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

type ReinvitePayload = {
  ra_id: string
  new_email?: string | null
  redirect_to?: string
}

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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerJwt)
  if (callerErr || !callerData.user) return json(401, { error: "Invalid session" })

  // Admin+ check (mirrors invite-ra: accept staff role from profile OR org_members)
  const STAFF_ROLES = ["super_user", "owner", "admin"]
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  let isStaff = STAFF_ROLES.includes(callerProfile?.role ?? "")
  if (!isStaff) {
    const { data: memberships } = await admin
      .from("organization_members")
      .select("role")
      .eq("user_id", callerData.user.id)
    isStaff = (memberships ?? []).some((m: { role: string }) => STAFF_ROLES.includes(m.role))
  }
  if (!isStaff) return json(403, { error: "Admin or above required" })

  let payload: ReinvitePayload
  try {
    payload = (await req.json()) as ReinvitePayload
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  if (!payload.ra_id) return json(400, { error: "ra_id is required" })

  // Look up the RA — need user_id + current email. Email lives on profiles,
  // not ra_associates (the only email-shaped column on ra_associates is
  // contact_email, which is the RA-editable display address, NOT the auth
  // login email). Mirrors listRaAssociates() in src/lib/data.ts which joins
  // profiles for the email field.
  const { data: ra, error: raErr } = await admin
    .from("ra_associates")
    .select("id, user_id, display_name, profiles:profiles!ra_associates_user_id_fkey(email)")
    .eq("id", payload.ra_id)
    .maybeSingle<{
      id: string
      user_id: string
      display_name: string
      profiles: { email: string | null } | null
    }>()
  if (raErr) return json(500, { error: raErr.message })
  if (!ra) return json(404, { error: "RA not found" })

  const currentEmail = (ra.profiles?.email ?? "").toLowerCase()
  const newEmail = payload.new_email?.trim().toLowerCase() || currentEmail
  if (!newEmail) return json(400, { error: "No email available for this RA" })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return json(400, { error: "Invalid email" })
  }

  // Update the auth user's email if it changed. profiles.email is the source
  // of truth — ra_associates has no email column.
  const emailChanged = newEmail !== currentEmail
  if (emailChanged) {
    const { error: updErr } = await admin.auth.admin.updateUserById(ra.user_id, {
      email: newEmail,
      email_confirm: true,
    })
    if (updErr) return json(500, { error: `Email update failed: ${updErr.message}` })

    await admin.from("profiles").update({ email: newEmail }).eq("id", ra.user_id)
  }

  // Try inviteUserByEmail first. For existing users this returns an error like
  // "User already registered" — fall back to a recovery (password reset) email
  // which always works and lands the RA in the onboarding flow after they set
  // a password.
  const redirectTo = payload.redirect_to
  let mode: "invite" | "recovery" = "invite"
  let inviteOk = false
  let firstErr: string | null = null

  try {
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(newEmail, {
      redirectTo,
    })
    if (!invErr) {
      inviteOk = true
    } else {
      firstErr = invErr.message
    }
  } catch (e) {
    firstErr = e instanceof Error ? e.message : "invite failed"
  }

  if (!inviteOk) {
    // Recovery email always works for existing users. The RA gets a "reset
    // password" message, clicks it, sets a password, lands in onboarding.
    mode = "recovery"
    const { error: recErr } = await admin.auth.resetPasswordForEmail(newEmail, {
      redirectTo,
    })
    if (recErr) {
      return json(500, { error: `Both invite and recovery failed. Invite: ${firstErr ?? "unknown"}. Recovery: ${recErr.message}` })
    }
  }

  return json(200, {
    ra_id: ra.id,
    email: newEmail,
    email_changed: emailChanged,
    mode, // "invite" or "recovery"
  })
})
