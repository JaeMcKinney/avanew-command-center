// Supabase Edge Function — invite-user
//
// What this does:
//   1. Verifies the caller is an admin (reads their JWT from the request).
//   2. Calls supabase.auth.admin.inviteUserByEmail() — sends the magic-link
//      invite email and creates the auth.users row.
//   3. Inserts a row into public.invitations (with organization_id) so the
//      new user picks up role + org membership when their profile is
//      auto-created on first sign-in (handle_new_user trigger consumes it).
//   4. For already-existing users (re-invites), directly inserts into
//      organization_members so they appear in the team list immediately.
//
// Deploy:
//   supabase functions deploy invite-user --no-verify-jwt
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   - SUPABASE_URL                (auto)
//   - SUPABASE_SERVICE_ROLE_KEY   (your project's service-role key — keep secret)

import { createClient } from "npm:@supabase/supabase-js@2"

type InvitePayload = {
  email: string
  full_name?: string | null
  role: "super_user" | "owner" | "admin" | "bd" | "partner"
  organization_id: string
  redirect_to?: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
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

  // Verify caller has permission to invite (must be admin+ in their profile).
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  if (!["super_user", "owner", "admin"].includes(callerProfile?.role ?? "")) {
    return json(403, { error: "Admin or above required" })
  }

  let payload: InvitePayload
  try {
    payload = (await req.json()) as InvitePayload
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  const email = payload.email?.trim().toLowerCase()
  const role = payload.role
  const full_name = payload.full_name?.trim() || null
  const organization_id = payload.organization_id

  if (!email || !["super_user", "owner", "admin", "bd", "partner"].includes(role)) {
    return json(400, { error: "email and valid role are required" })
  }
  if (!organization_id) {
    return json(400, { error: "organization_id is required" })
  }

  // Write the invitation row with organization_id.
  // onConflict targets the new (email, organization_id) unique constraint.
  const { error: invErr } = await admin.from("invitations").upsert(
    { email, full_name, role, organization_id, invited_by: callerData.user.id },
    { onConflict: "email,organization_id" }
  )
  if (invErr) return json(500, { error: invErr.message })

  // Send the magic-link invite email.
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: payload.redirect_to ?? undefined,
  })
  if (inviteErr) return json(500, { error: inviteErr.message })

  // For users who already have a Supabase account (re-invite / existing user):
  // the handle_new_user trigger won't fire again, so we add them to
  // organization_members directly and clean up the invitation row.
  const invitedUserId = inviteData?.user?.id
  if (invitedUserId && invitedUserId !== callerData.user.id) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", invitedUserId)
      .maybeSingle()

    if (existingProfile?.id) {
      // Add directly to org — they're already signed up.
      const { error: memberErr } = await admin
        .from("organization_members")
        .upsert(
          { organization_id, user_id: invitedUserId, role },
          { onConflict: "organization_id,user_id" }
        )
      if (memberErr) return json(500, { error: memberErr.message })

      // Clean up the invitation since it's been consumed.
      await admin
        .from("invitations")
        .delete()
        .eq("email", email)
        .eq("organization_id", organization_id)
    }
  }

  return json(200, {
    id: email, // pending invites have no profile id yet — use email as a stable handle
    email,
    full_name,
    role,
    status: "invited",
    created_at: new Date().toISOString(),
  })
})
