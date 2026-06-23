// Supabase Edge Function — hard-delete-archive
//
// Permanently removes a single archived_ra_associates row (and every
// archived_* child row via ON DELETE CASCADE). After this runs, the RA's
// prospect/client history is gone — only external DB backups can recover it.
//
// Live leads/deals are NOT touched here. If you want to keep their
// attribution, call transfer-archived-leads first.
//
// Gating: super_user OR program_admin in the archive's org.
//
// Deploy:
//   supabase functions deploy hard-delete-archive --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

type Payload = {
  archive_id: string
  // Caller types this to confirm — must match the archived display_name
  // exactly. Mirrors the typed-confirmation pattern from delete-ra.
  confirm_name?: string | null
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
  if (!archive_id) return json(400, { error: "archive_id is required" })

  const { data: arc, error: arcErr } = await admin
    .from("archived_ra_associates")
    .select("id, organization_id, display_name")
    .eq("id", archive_id)
    .maybeSingle()
  if (arcErr) return json(500, { error: arcErr.message })
  if (!arc) return json(404, { error: "Archive entry not found" })

  if (payload.confirm_name && payload.confirm_name.trim() !== arc.display_name) {
    return json(400, { error: "confirm_name does not match display_name" })
  }

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

  const { error: rpcErr } = await admin.rpc("hard_delete_archived_ra", { p_archive_id: archive_id })
  if (rpcErr) return json(500, { error: `hard_delete_archived_ra failed: ${rpcErr.message}` })

  return json(200, {
    deleted: true,
    archive_id,
    display_name: arc.display_name,
  })
})
