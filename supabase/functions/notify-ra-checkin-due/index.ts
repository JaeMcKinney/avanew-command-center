// Supabase Edge Function — notify-ra-checkin-due
//
// Daily cron job. For every active RA, computes each closed-won client's next
// quarterly check-in due date (anchored to the deal's closed_at date, or the
// last logged check-in if more recent) and emails the RA a reminder one week
// before a check-in comes due — including the full list of clients that need
// checking in soon or are overdue.
//
// Firing once per cycle: a client is included in the "due soon" trigger only on
// the day it is exactly 7 days out, so no per-send dedupe table is required.
//
// Deploy:
//   supabase functions deploy notify-ra-checkin-due
//
// Schedule (daily 14:00 UTC) via pg_cron + pg_net, or the Supabase dashboard
// "Schedules" tab pointing at this function. Example SQL:
//   select cron.schedule('ra-checkin-due','0 14 * * *', $$
//     select net.http_post(
//       url := '<PROJECT_URL>/functions/v1/notify-ra-checkin-due',
//       headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>','Content-Type','application/json'),
//       body := '{}'::jsonb) $$);
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENDGRID_API_KEY
// Optional: APP_BASE_URL, RA_CHECKIN_INTERVAL_DAYS (default 90), RA_CHECKIN_LEAD_DAYS (default 7)

import { createClient } from "npm:@supabase/supabase-js@2"

const FROM = { email: "zuirrae@divigner.com", name: "Divigner Group" }
const DEFAULT_APP_URL = "https://avanew-command-center.vercel.app"
const DAY = 86_400_000

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } })

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c))
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: FROM,
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  })
  if (!res.ok) console.error("sendgrid", to, res.status, await res.text())
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sendgrid = Deno.env.get("SENDGRID_API_KEY")
  const appUrl = Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL
  const interval = Number(Deno.env.get("RA_CHECKIN_INTERVAL_DAYS") ?? "90")
  const leadDays = Number(Deno.env.get("RA_CHECKIN_LEAD_DAYS") ?? "7")
  if (!sendgrid) return json(500, { error: "SENDGRID_API_KEY not set" })

  const sb = createClient(url, serviceKey)
  const now = Date.now()

  // Active RAs with their login email.
  const { data: ras, error: raErr } = await sb
    .from("ra_associates")
    .select("id, slug, display_name, user_id, status, profiles!ra_associates_user_id_fkey(email)")
    .eq("status", "active")
  if (raErr) return json(500, { error: raErr.message })

  let emailsSent = 0

  for (const ra of (ras ?? []) as Array<Record<string, unknown>>) {
    const raId = ra.id as string
    const email = ((ra.profiles as { email?: string } | null)?.email) ?? null
    if (!email) continue

    // Closed-won leads for this RA.
    const { data: leads } = await sb
      .from("leads")
      .select("id, first_name, last_name, company, closed_at, updated_at, stage")
      .eq("referred_by_ra_id", raId)
      .eq("stage", "closed_won")
    if (!leads || leads.length === 0) continue

    // Latest check-in per lead.
    const { data: checkins } = await sb
      .from("client_checkins")
      .select("lead_id, checkin_at")
      .eq("ra_associate_id", raId)
      .order("checkin_at", { ascending: false })
    const lastByLead = new Map<string, string>()
    for (const c of (checkins ?? []) as Array<{ lead_id: string; checkin_at: string }>) {
      if (c.lead_id && !lastByLead.has(c.lead_id)) lastByLead.set(c.lead_id, c.checkin_at)
    }

    const dueSoon: { name: string; dueInDays: number }[] = []
    let triggerThisRun = false
    for (const l of leads as Array<Record<string, unknown>>) {
      const anchorIso = lastByLead.get(l.id as string) ?? (l.closed_at as string) ?? (l.updated_at as string)
      if (!anchorIso) continue
      const due = new Date(anchorIso).getTime() + interval * DAY
      const dueInDays = Math.floor((due - now) / DAY)
      const name = (l.company as string) || `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Client"
      if (dueInDays <= leadDays) dueSoon.push({ name, dueInDays })
      if (dueInDays === leadDays) triggerThisRun = true
    }

    if (!triggerThisRun || dueSoon.length === 0) continue

    dueSoon.sort((a, b) => a.dueInDays - b.dueInDays)
    const rows = dueSoon.map((d) => {
      const label = d.dueInDays < 0 ? `${Math.abs(d.dueInDays)} days overdue` : d.dueInDays === 0 ? "due today" : `due in ${d.dueInDays} days`
      return `<tr><td style="padding:8px 0;color:#EAF2F9">${esc(d.name)}</td><td style="padding:8px 0;color:#A2B6C9;text-align:right">${label}</td></tr>`
    }).join("")

    const html = `
<!doctype html><html><body style="margin:0;background:#06101D;font-family:'Manrope',Arial,sans-serif;padding:32px 0">
  <div style="max-width:520px;margin:0 auto;background:#0E2741;border:1px solid rgba(160,190,215,.14);border-radius:16px;padding:32px">
    <h1 style="color:#EAF2F9;font-size:1.3rem;margin:0 0 14px">Client check-ins coming due</h1>
    <p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 16px">Hi ${esc((ra.display_name as string)?.split(" ")[0] ?? "there")}, a quarterly check-in is due soon for these clients. Staying current keeps your recurring commissions active.</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(160,190,215,.14)">${rows}</table>
    <a href="${appUrl}/ra/dashboard" style="display:inline-block;margin-top:22px;background:linear-gradient(135deg,#18B9A6,#34D6C2);color:#06101D;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:.9rem">Open your portal</a>
    <p style="color:rgba(162,182,201,.4);font-size:.75rem;margin:28px 0 0">Divigner Group · Referral Associate Program</p>
  </div>
</body></html>`

    await sendEmail(sendgrid, email, "Client check-ins coming due", html)
    emailsSent++
  }

  return json(200, { ok: true, emailsSent })
})
