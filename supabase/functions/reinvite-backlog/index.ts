// Supabase Edge Function — reinvite-backlog
//
// Paced, self-draining re-invite of the expired RA backlog. Sends a fresh
// invite to a small batch of expired RAs per run, so a large backlog goes out
// as a gentle daily ramp (domain warm-up) instead of one reputation-torching
// blast.
//
// Each run:
//   1. Selects up to BATCH RAs in status invite_expired / onboarding_expired,
//      most-recent applicants first (likeliest to still be interested).
//   2. For each: signs a fresh 72h invite token, sends the branded invite
//      email, and ONLY on a successful send resets the row to status='pending'
//      with fresh invite (72h) + onboarding (14d) clocks and cleared
//      invite_clicked_at / invite_reminder_sent.
//   3. Re-invited rows leave the expired pool, so the batch is naturally
//      self-draining — no cursor/marker column needed. When the backlog is
//      empty, runs are no-ops.
//
// Send-first-then-flip ordering is deliberate: if SendGrid fails, the row stays
// expired and is retried next run, rather than being left as a pending RA who
// never actually got an email (which the invite-expiring cron would just
// re-expire in 72h).
//
// Everything the RA previously entered (agreement, photo, contact, banking,
// W-9) is preserved — this only resets status + deadline clocks.
//
// Batch size: BACKLOG_BATCH_SIZE env (default 10). Override per call with
// ?batch=N for a manual run.
//
// Deploy:
//   supabase functions deploy reinvite-backlog
//
// Schedule (daily) via pg_cron + pg_net, Bearer <SERVICE_ROLE_KEY>. Example:
//   select cron.schedule('ra-reinvite-backlog','30 15 * * *', $$
//     select net.http_post(
//       url := '<PROJECT_URL>/functions/v1/reinvite-backlog',
//       headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>','Content-Type','application/json'),
//       body := '{}'::jsonb) $$);
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENDGRID_API_KEY,
//   INVITE_TOKEN_SECRET. Optional: APP_BASE_URL, BACKLOG_BATCH_SIZE.

import { createClient } from "npm:@supabase/supabase-js@2"
import { sendGridSend, DEFAULT_APP_URL } from "../_shared/email.ts"
import { signInviteToken, buildAcceptUrl, inviteEmailHtml } from "../_shared/invite.ts"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } })

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sendgrid = Deno.env.get("SENDGRID_API_KEY")
  const inviteSecret = Deno.env.get("INVITE_TOKEN_SECRET")
  const appUrl = Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL
  if (!sendgrid || !inviteSecret) {
    return json(500, { error: "SENDGRID_API_KEY or INVITE_TOKEN_SECRET not set" })
  }

  // Batch size: ?batch=N overrides env (default 10). Clamp to a sane range so a
  // typo can't turn the drainer back into a blast.
  const qsBatch = Number(new URL(req.url).searchParams.get("batch"))
  const envBatch = Number(Deno.env.get("BACKLOG_BATCH_SIZE"))
  const batch = Math.max(1, Math.min(50, qsBatch || envBatch || 10))

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: candidates, error: candErr } = await admin
    .from("ra_associates")
    .select("id, display_name, organization_id, profiles!ra_associates_user_id_fkey(email)")
    .in("status", ["invite_expired", "onboarding_expired"])
    .order("created_at", { ascending: false })
    .limit(batch)
  if (candErr) return json(500, { error: candErr.message })

  const results: Array<{ ra_id: string; email: string | null; ok: boolean; error?: string }> = []
  let sent = 0

  for (const ra of (candidates ?? []) as Array<Record<string, unknown>>) {
    const raId = ra.id as string
    const email = ((ra.profiles as { email?: string } | null)?.email) ?? null
    if (!email) {
      results.push({ ra_id: raId, email: null, ok: false, error: "no email on file" })
      continue
    }

    const now = Date.now()
    const inviteExpiresAt = new Date(now + 72 * HOUR)
    const onboardingDeadlineAt = new Date(now + 14 * DAY)

    const orgId = ra.organization_id as string
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle()
    const orgName = org?.name ?? "Divigner Group"
    const firstName = ((ra.display_name as string) || "").split(" ")[0] ?? ""

    // exp === invite_expires_at so the emailed link is valid the full 72h.
    const token = await signInviteToken(
      { ra_id: raId, exp: Math.floor(inviteExpiresAt.getTime() / 1000) },
      inviteSecret,
    )
    const acceptUrl = buildAcceptUrl(appUrl, token)
    const html = inviteEmailHtml(firstName, orgName, acceptUrl)

    const r = await sendGridSend(
      sendgrid,
      email,
      `You're invited to join ${orgName}'s Referral Associate Program`,
      html,
    )
    if (!r.ok) {
      // Leave the row expired → retried next run. Surface the reason.
      let detail = r.error ?? ""
      try {
        const parsed = JSON.parse(detail) as { errors?: { message?: string }[] }
        detail = parsed.errors?.map((e) => e.message).filter(Boolean).join("; ") || detail
      } catch { /* keep raw */ }
      results.push({ ra_id: raId, email, ok: false, error: `SendGrid ${r.status ?? ""}: ${detail}`.trim() })
      continue
    }

    // Send succeeded → reset clocks + status. Preserves all entered onboarding data.
    const { error: updErr } = await admin
      .from("ra_associates")
      .update({
        status: "pending",
        invite_expires_at: inviteExpiresAt.toISOString(),
        onboarding_deadline_at: onboardingDeadlineAt.toISOString(),
        invite_clicked_at: null,
        invite_reminder_sent: false,
      })
      .eq("id", raId)
    if (updErr) {
      // Email went out but the flip failed — report so it can be reconciled.
      results.push({ ra_id: raId, email, ok: true, error: `sent but status flip failed: ${updErr.message}` })
      sent++
      continue
    }
    results.push({ ra_id: raId, email, ok: true })
    sent++
  }

  // How many remain expired after this run (for progress visibility).
  const { count: remaining } = await admin
    .from("ra_associates")
    .select("id", { count: "exact", head: true })
    .in("status", ["invite_expired", "onboarding_expired"])

  return json(200, { ok: true, batch, attempted: results.length, sent, remaining: remaining ?? null, results })
})
