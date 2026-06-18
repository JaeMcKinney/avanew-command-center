// Supabase Edge Function — process-payout
//
// Skeleton for cron-driven payout processing. Picks scheduled payouts whose
// `period_end` is on or before today, marks them paid, and stamps `paid_at`.
// Actual ACH initiation is deferred — this only flips status, with hooks for
// future integration.
//
// Deploy:
//   supabase functions deploy process-payout
//
// Schedule (Supabase Dashboard → Edge Functions → Cron):
//   0 9 * * *   (daily 09:00 UTC)
//
// Required secrets:
//   - SUPABASE_URL              (auto)
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Optional:
//   - PROCESS_PAYOUT_TOKEN      shared secret expected as `x-cron-token` header
//                               when not invoked via the Supabase cron runner

import { createClient } from "npm:@supabase/supabase-js@2"

type PayoutRow = {
  id: string
  ra_associate_id: string
  type: "one_time" | "recurring"
  amount: number
  period_end: string | null
  status: "scheduled" | "paid" | "skipped" | "cancelled"
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return json(405, { error: "POST or GET" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  }

  const expectedToken = Deno.env.get("PROCESS_PAYOUT_TOKEN")
  if (expectedToken) {
    const got = req.headers.get("x-cron-token")
    if (got !== expectedToken) return json(401, { error: "Invalid cron token" })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const today = new Date().toISOString().slice(0, 10)

  // ── Step 1: skip due payouts whose client has gone stale on check-ins. ─────
  // Per agreement §7 the RA must touch each active client every
  // `checkin_suspension_days`. If they haven't, recurring payouts for that
  // client get status=skipped instead of paid. The threshold lives on the
  // org's ra_program_settings row.
  const { data: dueRows, error: dueErr } = await admin
    .from("commission_payouts")
    .select("id, ra_associate_id, lead_id, organization_id, type, amount, period_end, status")
    .eq("status", "scheduled")
    .eq("type", "recurring")
    .not("period_end", "is", null)
    .lte("period_end", today)
    .limit(1000)
  if (dueErr) return json(500, { error: dueErr.message })
  const due = (dueRows ?? []) as Array<PayoutRow & { lead_id: string | null; organization_id: string }>
  if (due.length === 0) return json(200, { processed: 0, skipped: 0, note: "Nothing due." })

  const skippedIds: string[] = []
  const keptIds: string[] = []
  for (const row of due) {
    if (!row.lead_id) { keptIds.push(row.id); continue }
    const { data: settings } = await admin
      .from("ra_program_settings")
      .select("checkin_suspension_days")
      .eq("organization_id", row.organization_id)
      .maybeSingle()
    const threshold = (settings as { checkin_suspension_days?: number } | null)?.checkin_suspension_days ?? 150
    const { data: lastCheckin } = await admin
      .from("client_checkins")
      .select("checkin_at")
      .eq("ra_associate_id", row.ra_associate_id)
      .eq("lead_id", row.lead_id)
      .order("checkin_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: leadRow } = await admin
      .from("leads")
      .select("closed_at")
      .eq("id", row.lead_id)
      .maybeSingle()
    const lastWhen =
      (lastCheckin as { checkin_at?: string } | null)?.checkin_at
      ?? (leadRow   as { closed_at?:  string } | null)?.closed_at
      ?? null
    if (!lastWhen) { keptIds.push(row.id); continue }
    const days = Math.floor((Date.now() - new Date(lastWhen).getTime()) / 86400_000)
    if (days >= threshold) skippedIds.push(row.id)
    else keptIds.push(row.id)
  }

  if (skippedIds.length > 0) {
    await admin
      .from("commission_payouts")
      .update({ status: "skipped" })
      .in("id", skippedIds)
  }

  const rows = due.filter((r) => keptIds.includes(r.id))
  if (rows.length === 0) {
    return json(200, { processed: 0, skipped: skippedIds.length, note: "Only skips this run." })
  }

  // ── Future ACH hook ────────────────────────────────────────────────────────
  // Per-RA grouping + Mercury / bank rail call would go here. We deliberately
  // skip the money movement and only flip status so the audit trail is clean.

  const ids = rows.map((r) => r.id)
  const nowIso = new Date().toISOString()
  const { error: updErr } = await admin
    .from("commission_payouts")
    .update({ status: "paid", paid_at: nowIso })
    .in("id", ids)
  if (updErr) return json(500, { error: updErr.message })

  return json(200, {
    processed: rows.length,
    skipped: skippedIds.length,
    total_amount: rows.reduce((s, r) => s + Number(r.amount), 0),
    paid_at: nowIso,
  })
})
