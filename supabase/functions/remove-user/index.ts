// Supabase Edge Function — remove-user
//
// Deletes an active team member from auth.users (which cascades to profiles).
// Pending invites should be deleted directly via the invitations table — this
// function is only for active users.
//
// Deploy:
//   supabase functions deploy remove-user --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

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
  if (req.method === "OPTIONS") return json(204, null)
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  }

  const callerJwt = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  )
  if (!callerJwt) return json(401, { error: "Missing bearer token" })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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
  if (callerProfile?.role !== "admin") {
    return json(403, { error: "Admins only" })
  }

  let body: { user_id?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "Invalid JSON" })
  }
  const userId = body.user_id
  if (!userId) return json(400, { error: "user_id required" })
  if (userId === callerData.user.id) {
    return json(400, { error: "Can't remove yourself" })
  }

  // Block removing the last admin.
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  if (target?.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
    if ((count ?? 0) <= 1) {
      return json(400, { error: "Need at least one admin" })
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return json(500, { error: error.message })
  return json(200, { ok: true })
})
