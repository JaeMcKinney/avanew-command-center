// Supabase Edge Function — invite-user
//
// What this does:
//   1. Verifies the caller is an admin (reads their JWT from the request).
//   2. Calls supabase.auth.admin.inviteUserByEmail() — sends the magic-link
//      invite email and creates the auth.users row.
//   3. Inserts a row into public.invitations so the new user picks up the
//      role + name when their profile is auto-created on first sign-in
//      (the handle_new_user trigger consumes the invitation).
//
// Deploy:
//   supabase functions deploy invite-user --no-verify-jwt
//
// Required secrets (set with `supabase secrets set NAME=value`):
//   - SUPABASE_URL                (auto)
//   - SUPABASE_SERVICE_ROLE_KEY   (your project's service-role key — keep secret)
//
// Why a function and not the React app:
//   The service-role key bypasses RLS. Putting it in the React bundle would
//   let any visitor read/write everything in your database. The function runs
//   on Supabase's edge servers; the key never leaves the server.

import { createClient } from "npm:@supabase/supabase-js@2"

type InvitePayload = {
  email: string
  full_name?: string | null
  role: "super_user" | "owner" | "admin" | "bd" | "partner"
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

  // Service-role client — used to verify the caller and to write data.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify caller and check role
  const { data: callerData, error: callerErr } = await admin.auth.getUser(
    callerJwt
  )
  if (callerErr || !callerData.user) {
    return json(401, { error: "Invalid session" })
  }
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  const allowedCallerRoles = ["super_user", "owner", "admin"]
  if (!allowedCallerRoles.includes(callerProfile?.role ?? "")) {
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
  if (!email || !["super_user", "owner", "admin", "bd", "partner"].includes(role)) {
    return json(400, { error: "email and valid role are required" })
  }

  // Record the invitation first so the trigger picks up role + name on signup.
  const { error: invErr } = await admin.from("invitations").upsert(
    { email, full_name, role, invited_by: callerData.user.id },
    { onConflict: "email" }
  )
  if (invErr) return json(500, { error: invErr.message })

  // Send the magic-link invite (creates the auth.users row).
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    options: payload.redirect_to ? { redirectTo: payload.redirect_to } : undefined,
  })
  if (inviteErr) return json(500, { error: inviteErr.message })

  return json(200, {
    id: email, // pending invites have no profile id yet — use email as a stable handle
    email,
    full_name,
    role,
    status: "invited",
    created_at: new Date().toISOString(),
  })
})
