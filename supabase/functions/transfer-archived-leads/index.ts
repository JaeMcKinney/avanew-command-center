// Supabase Edge Function — transfer-archived-leads
//
// Re-assigns every live lead/deal that was originally attributed to an
// archived (permanently-deleted) RA to a different, active RA in the same
// organization. The archive snapshot stays in place (so the original
// attribution is auditable forever); only the live referred_by_ra_id column
// is rewritten.
//
// Gating: super_user OR program_admin in the archived RA's org.
//
// Deploy:
//   supabase functions deploy transfer-archived-leads --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

type Payload = {
  archive_id: string
  target_user_id: string
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })

  const callerJwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!callerJwt) return json(401, { error: "Missing bearer token" })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerJwt)
  if (callerErr || !callerData.user) return json(401, { error: "Invalid session" })

  let payload: Payload
  try { payload = (await req.json()) as Payload } catch { return json(400, { error: "Invalid JSON" }) }
  const archive_id = payload.archive_id?.trim()
  const target_user_id = payload.target_user_id?.trim()
  if (!archive_id || !target_user_id) return json(400, { error: "archive_id and target_user_id are required" })

  const { data: arc, error: arcErr } = await admin
    .from("archived_ra_associates")
    .select("id, organization_id, display_name")
    .eq("id", archive_id)
    .maybeSingle()
  if (arcErr) return json(500, { error: arcErr.message })
  if (!arc) return json(404, { error: "Archive entry not found" })

  // Permission gate: super_user OR program_admin in the archive's org.
  const { data: callerProfile } = await admin
    .from("profiles").select("role").eq("id", callerData.user.id).maybeSingle()
  const isSuperUser = callerProfile?.role === "super_user"
  let isProgramAdmin = false
  if (!isSuperUser) {
    const { data: m } = await admin
      .from("organization_members")
      .select("role, is_program_admin")
      .eq("organization_id", arc.organization_id)
      .eq("user_id", callerData.user.id)
      .maybeSingle()
    isProgramAdmin = m?.role === "admin" && m?.is_program_admin === true
  }
  if (!isSuperUser && !isProgramAdmin) {
    return json(403, { error: "Super User or Program Admin required" })
  }

  // Resolve target RA's display name for the response (also catches a
  // wrong-org target before the RPC bails out, so we can surface a friendlier
  // error message).
  const { data: target } = await admin
    .from("ra_associates")
    .select("user_id, display_name, organization_id, status")
    .eq("user_id", target_user_id)
    .eq("organization_id", arc.organization_id)
    .maybeSingle()
  if (!target) return json(404, { error: "Target RA not found in this organization" })

  const { data: result, error: rpcErr } = await admin.rpc("transfer_archived_ra_leads", {
    p_archive_id: archive_id,
    p_target_user_id: target_user_id,
  })
  if (rpcErr) return json(500, { error: `transfer_archived_ra_leads failed: ${rpcErr.message}` })

  const row = Array.isArray(result) ? result[0] : result
  return json(200, {
    transferred: true,
    archive_id,
    target_user_id,
    target_display_name: target.display_name,
    leads_transferred: row?.leads_transferred ?? 0,
    deals_transferred: row?.deals_transferred ?? 0,
  })
})
