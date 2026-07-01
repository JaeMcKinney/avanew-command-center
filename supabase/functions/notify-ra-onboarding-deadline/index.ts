// Supabase Edge Function — notify-ra-onboarding-deadline
//
// Daily cron (same time slot as notify-ra-checkin-due). For every RA still in
// status='pending' who hasn't submitted onboarding for review yet
// (submitted_at IS NULL), sends reminders at 7 and 2 days before
// onboarding_deadline_at, and flips status → 'onboarding_expired' once the
// 21-day window has fully passed.
//
// Per the product decision that the 21-day deadline only gates *first*
// submission: this query is `status = 'pending'`, not `.in(['pending',
// 'needs_changes'])`. needs_changes can only be reached after a first
// submission (submitted_at gets set the moment status first becomes
// 'verification'), so submitted_at IS NULL and status = 'needs_changes'
// never co-occur in this codebase's state machine — a row can only be a
// candidate here while status is still 'pending'.
//
// Reminder dedup uses the same exact-day-match trick as
// notify-ra-checkin-due (daysRemaining === 7 / === 2) rather than an extra
// tracking column — a missed day-14 reminder still has day-19 as a natural
// second chance before the hard deadline, unlike the single-shot 72h
// invite-link reminder in notify-ra-invite-expiring.
//
// Deploy:
//   supabase functions deploy notify-ra-onboarding-deadline
//
// Schedule (daily 14:00 UTC, same slot as ra-checkin-due) via pg_cron +
// pg_net, or the Supabase dashboard "Schedules" tab. Example SQL:
//   select cron.schedule('ra-onboarding-deadline','0 14 * * *', $$
//     select net.http_post(
//       url := '<PROJECT_URL>/functions/v1/notify-ra-onboarding-deadline',
//       headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>','Content-Type','application/json'),
//       body := '{}'::jsonb) $$);
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENDGRID_API_KEY
// Optional: APP_BASE_URL

import { createClient } from "npm:@supabase/supabase-js@2"
import { wrap, escapeHtml, sendGridSend, DEFAULT_APP_URL } from "../_shared/email.ts"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } })
const DAY = 86_400_000

function buildReminderEmail(firstName: string, orgName: string, appUrl: string, daysLeft: number): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  const urgent = daysLeft <= 2
  return wrap(
    greeting, orgName,
    `${daysLeft} days left to finish your Referral Associate onboarding`,
    `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 14px">You have <strong style="color:#EAF2F9">${daysLeft} days</strong> left to complete and submit your onboarding application before it's automatically closed.</p>
     ${urgent
      ? `<div style="background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:14px 16px"><p style="margin:0;color:#fca5a5;font-size:.85rem;line-height:1.5">This is your final reminder — after ${daysLeft} more days without a submitted application, you'll need to reapply and be reconsidered for a new invite.</p></div>`
      : `<p style="margin:0;color:#A2B6C9;font-size:.85rem;line-height:1.5">Pick up right where you left off — your progress is saved.</p>`}`,
    "Continue onboarding",
    `${appUrl}/onboarding/steps`,
  )
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sendgrid = Deno.env.get("SENDGRID_API_KEY")
  const appUrl = Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL
  if (!sendgrid) console.warn("SENDGRID_API_KEY not set; will still expire stale onboarding, but skip reminder emails")

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const now = Date.now()

  const { data: candidates, error: candErr } = await admin
    .from("ra_associates")
    .select("id, display_name, organization_id, onboarding_deadline_at, invite_clicked_at, profiles!ra_associates_user_id_fkey(email)")
    .eq("status", "pending")
    .is("submitted_at", null)
    .not("onboarding_deadline_at", "is", null)
  if (candErr) return json(500, { error: candErr.message })

  let expired = 0
  let remindersSent = 0

  for (const ra of (candidates ?? []) as Array<Record<string, unknown>>) {
    const raId = ra.id as string
    const deadlineIso = ra.onboarding_deadline_at as string
    const daysRemaining = Math.floor((new Date(deadlineIso).getTime() - now) / DAY)

    if (daysRemaining < 0) {
      // status='pending' filter above self-excludes this row from ever
      // matching again — no dedup column needed for the expiry flip itself.
      await admin.from("ra_associates").update({ status: "onboarding_expired" }).eq("id", raId)
      expired++
      continue
    }

    if (daysRemaining !== 7 && daysRemaining !== 2) continue

    // Sanity check: any candidate here should have clicked their invite
    // already (they can't have progressed past 'pending' otherwise) — a row
    // with invite_clicked_at still null this deep into the 21-day window
    // would mean notify-ra-invite-expiring has been failing to run for over
    // two weeks. Surface it loudly rather than silently emailing someone who
    // never opened the app.
    if (!ra.invite_clicked_at) {
      console.warn(`RA ${raId} has daysRemaining=${daysRemaining} but invite_clicked_at is null — check notify-ra-invite-expiring's cron health`)
    }

    if (!sendgrid) continue
    const email = ((ra.profiles as { email?: string } | null)?.email) ?? null
    if (!email) continue

    const orgId = ra.organization_id as string
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle()
    const orgName = org?.name ?? "Divigner Group"
    const firstName = ((ra.display_name as string) || "").split(" ")[0] ?? ""

    const html = buildReminderEmail(firstName, orgName, appUrl, daysRemaining)
    const result = await sendGridSend(sendgrid, email, `${daysRemaining} days left to finish your Referral Associate onboarding`, html)
    if (result.ok) remindersSent++
  }

  return json(200, { ok: true, expired, remindersSent })
})
