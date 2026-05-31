// Supabase Edge Function — revoke-ra
//
// Revokes / cancels a Referral Associate invite or membership.
//
//   • pending / verification / needs_changes:
//       Deletes the auth user entirely → invalidates the magic-link and
//       cascades FK deletes on profiles, ra_associates, organization_members.
//
//   • active / suspended:
//       Sets ra_associates.status → "terminated" and removes the row from
//       organization_members (preserves record for attribution history).
//
//   • declined / terminated:
//       No-op — already revoked, returns 200.
//
// Deploy:
//   supabase functions deploy revoke-ra --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

type RevokeRaPayload = {
  ra_id: string
}

const REVOCABLE_STATUSES = new Set(["pending", "verification", "needs_changes"])
const TERMINATE_STATUSES = new Set(["active", "suspended"])

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

  // Verify caller identity and role.
  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerJwt)
  if (callerErr || !callerData.user) return json(401, { error: "Invalid session" })

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  if (!["super_user", "owner", "admin"].includes(callerProfile?.role ?? "")) {
    return json(403, { error: "Admin or above required" })
  }

  let payload: RevokeRaPayload
  try {
    payload = (await req.json()) as RevokeRaPayload
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  const ra_id = payload.ra_id?.trim()
  if (!ra_id) return json(400, { error: "ra_id is required" })

  // Look up the RA record.
  const { data: ra, error: raErr } = await admin
    .from("ra_associates")
    .select("id, user_id, status, organization_id, display_name")
    .eq("id", ra_id)
    .maybeSingle()
  if (raErr) return json(500, { error: raErr.message })
  if (!ra) return json(404, { error: "RA not found" })

  const status = ra.status as string

  // Already revoked — nothing to do.
  if (status === "declined" || status === "terminated") {
    return json(200, { message: "Already revoked", status })
  }

  if (REVOCABLE_STATUSES.has(status)) {
    // Invite-stage: delete the auth user entirely.
    // This cascades: auth.users → profiles → ra_associates → organization_members.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(ra.user_id)
    if (deleteErr) return json(500, { error: deleteErr.message })
  } else if (TERMINATE_STATUSES.has(status)) {
    // Active RA: terminate status and remove from org members (preserve record).
    const { error: updateErr } = await admin
      .from("ra_associates")
      .update({ status: "terminated" })
      .eq("id", ra_id)
    if (updateErr) return json(500, { error: updateErr.message })

    const { error: memberErr } = await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", ra.organization_id)
      .eq("user_id", ra.user_id)
    if (memberErr) return json(500, { error: memberErr.message })
  }

  return json(200, { message: "Revoked", ra_id, previous_status: status })
})
