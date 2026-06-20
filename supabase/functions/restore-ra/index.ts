// Supabase Edge Function — restore-ra
//
// One-click undo of a permanent RA delete. Reverses delete-ra:
//   1. Verify caller is super_user OR program_admin in the archived RA's org.
//   2. Resolve the auth user for the archived email — reuse if it still exists,
//      otherwise re-create it (email-confirmed, no password; the RA regains
//      access via "forgot password"). Ensure profiles(role=referral_associate)
//      + organization_members exist.
//   3. Call public.restore_ra(archive_id, user_id) — re-creates the RA row,
//      re-links leads/deals, restores payouts/checkins/agreements, drops the
//      archive entry.
//
// Deploy:
//   supabase functions deploy restore-ra --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

type Payload = { archive_id: string }

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

  // Load the archive entry (snapshot holds the original row + identity).
  const { data: arc, error: arcErr } = await admin
    .from("archived_ra_associates")
    .select("id, organization_id, original_user_id, slug, display_name, email, snapshot")
    .eq("id", archive_id)
    .maybeSingle()
  if (arcErr) return json(500, { error: arcErr.message })
  if (!arc) return json(404, { error: "Archive entry not found" })

  // Permission gate: super_user OR program_admin in the RA's org.
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

  // Guard: slug must be free before we do anything.
  const { data: slugTaken } = await admin
    .from("ra_associates").select("id").eq("slug", arc.slug).maybeSingle()
  if (slugTaken) {
    return json(409, { error: `Slug "${arc.slug}" is already in use. Rename or remove that RA before restoring.` })
  }

  // ── Resolve the auth user for the archived email ──────────────────────────
  const snap = (arc.snapshot ?? {}) as Record<string, unknown>
  const email = (arc.email
    ?? (snap.contact_email as string | undefined)
    ?? "").trim().toLowerCase()
  if (!email) return json(422, { error: "Archived RA has no email on file — cannot restore a login" })

  let userId: string | null = null

  // Reuse an existing auth user with this email if present.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email)
  if (existing) {
    userId = existing.id
  } else {
    const fullName = (snap.display_name as string | undefined) ?? arc.display_name ?? ""
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr || !created?.user) {
      return json(500, { error: `Failed to re-create login: ${createErr?.message ?? "unknown"}` })
    }
    userId = created.user.id
  }

  // Ensure profile (RA role) + org membership exist for the resolved user.
  await admin.from("profiles").upsert(
    { id: userId, email, full_name: (snap.display_name as string | undefined) ?? arc.display_name, role: "referral_associate" },
    { onConflict: "id" }
  )
  await admin.from("organization_members").upsert(
    { organization_id: arc.organization_id, user_id: userId, role: "referral_associate" },
    { onConflict: "organization_id,user_id", ignoreDuplicates: true }
  )

  // ── Atomic DB restore ─────────────────────────────────────────────────────
  const { data: result, error: rpcErr } = await admin.rpc("restore_ra", {
    p_archive_id: archive_id,
    p_user_id: userId,
  })
  if (rpcErr) return json(500, { error: `restore_ra failed: ${rpcErr.message}` })

  const row = Array.isArray(result) ? result[0] : result
  return json(200, {
    restored: true,
    ra_id: row?.ra_id,
    slug: arc.slug,
    display_name: arc.display_name,
    leads_relinked: row?.leads_relinked ?? 0,
    deals_relinked: row?.deals_relinked ?? 0,
    payouts_restored: row?.payouts_restored ?? 0,
    checkins_restored: row?.checkins_restored ?? 0,
  })
})
