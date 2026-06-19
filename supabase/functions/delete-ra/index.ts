// Supabase Edge Function — delete-ra
//
// Permanently deletes a Referral Associate with full prospect/client retention.
//
// Flow:
//   1. Verify caller is super_user OR is_program_admin in the RA's org.
//   2. Call public.archive_ra(ra_id, archived_by, reason) RPC. This snapshots
//      the RA + every related row (leads, deals, check-ins, payouts, agreement
//      audit, page views) into archived_* tables in a single transaction.
//   3. Delete the underlying auth.user. Cascades through profiles →
//      ra_associates → ra_page_views / client_checkins / commission_payouts /
//      agreement_acceptances. leads/deals stay in place; their
//      referred_by_ra_id is SET NULL by FK (attribution is preserved in the
//      archive).
//
// This sits ALONGSIDE revoke-ra, which keeps its current behavior (soft
// termination → status=terminated). delete-ra is the only path that ever
// destroys data. The admin UI exposes both: trash icon = delete, separate
// "Terminate" = revoke.
//
// Deploy:
//   supabase functions deploy delete-ra --no-verify-jwt
//
// Required secrets:
//   - SUPABASE_URL              (auto)
//   - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2"

type DeleteRaPayload = {
  ra_id: string
  reason?: string | null
  // Caller types this to confirm — must match the RA display_name exactly.
  // We accept it for audit context and to mirror the UI confirmation; the
  // actual gate is the role check below.
  confirm_name?: string | null
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  }

  const callerJwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!callerJwt) return json(401, { error: "Missing bearer token" })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify caller identity
  const { data: callerData, error: callerErr } = await admin.auth.getUser(callerJwt)
  if (callerErr || !callerData.user) return json(401, { error: "Invalid session" })

  let payload: DeleteRaPayload
  try {
    payload = (await req.json()) as DeleteRaPayload
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  const ra_id = payload.ra_id?.trim()
  if (!ra_id) return json(400, { error: "ra_id is required" })

  // Look up the RA and its organization
  const { data: ra, error: raErr } = await admin
    .from("ra_associates")
    .select("id, user_id, organization_id, display_name")
    .eq("id", ra_id)
    .maybeSingle()
  if (raErr) return json(500, { error: raErr.message })
  if (!ra) return json(404, { error: "RA not found" })

  // Optional name-confirmation guard (mirrors the UI typed-confirmation)
  if (payload.confirm_name && payload.confirm_name.trim() !== ra.display_name) {
    return json(400, { error: "confirm_name does not match display_name" })
  }

  // Permission gate: super_user OR program_admin in the RA's org
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle()
  const isSuperUser = callerProfile?.role === "super_user"

  let isProgramAdmin = false
  if (!isSuperUser) {
    const { data: callerMember } = await admin
      .from("organization_members")
      .select("role, is_program_admin")
      .eq("organization_id", ra.organization_id)
      .eq("user_id", callerData.user.id)
      .maybeSingle()
    isProgramAdmin =
      callerMember?.role === "admin" && callerMember?.is_program_admin === true
  }
  if (!isSuperUser && !isProgramAdmin) {
    return json(403, { error: "Super User or Program Admin required" })
  }

  // Step 1: Atomic archive of RA + every related row
  const { data: archiveId, error: archiveErr } = await admin.rpc("archive_ra", {
    p_ra_id: ra_id,
    p_archived_by: callerData.user.id,
    p_reason: payload.reason ?? null,
  })
  if (archiveErr) return json(500, { error: `archive_ra failed: ${archiveErr.message}` })

  // Step 2: Delete the auth user. This cascades through profiles →
  // ra_associates → all RA-keyed child tables. leads/deals stay; their
  // referred_by_ra_id is SET NULL (attribution is preserved in the archive).
  if (ra.user_id) {
    const { error: deleteErr } = await admin.auth.admin.deleteUser(ra.user_id)
    if (deleteErr) {
      // The archive succeeded but the auth delete didn't. The RA row is gone
      // (cascaded? no — auth.users wasn't deleted yet). Actually: the archive
      // is in place, but the source RA still exists. Surface the partial
      // state to the caller for retry / manual cleanup.
      return json(500, {
        error: `Archive saved (id=${archiveId}) but auth delete failed: ${deleteErr.message}`,
        archive_id: archiveId,
        partial: true,
      })
    }
  }

  return json(200, {
    deleted: true,
    archive_id: archiveId,
    ra_id,
    display_name: ra.display_name,
  })
})
