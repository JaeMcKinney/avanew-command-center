// Supabase Edge Function — notify-ra-invite-expiring
//
// Hourly cron. For every RA still in status='pending' who has not yet clicked
// their invite link, flips status → 'invite_expired' once the 72h window
// (invite_expires_at) has passed, and — before that — sends a one-time
// reminder email at the 24-hours-remaining mark.
//
// The reminder link is a FRESH magiclink token minted at send-time, not the
// original invite's action_link (which isn't persisted anywhere and may
// already be stale/consumed). Deliberately type:"magiclink" rather than
// type:"invite" here: generateLink({type:"invite"}) can error "already
// registered" for a user that already exists but hasn't confirmed yet — the
// exact failure mode reinvite-ra's own inviteUserByEmail-first logic already
// has to work around. magiclink has no such restriction and authenticates
// any existing user regardless of confirmation state.
//
// Expiring an invite happens even if SENDGRID_API_KEY is missing/broken —
// that's a data-integrity concern (stale pending invites must still close)
// independent of email deliverability. Only the reminder send is skipped
// (and left un-flagged, so it retries next hour) in that case.
//
// Deploy:
//   supabase functions deploy notify-ra-invite-expiring
//
// Schedule (hourly) via pg_cron + pg_net, or the Supabase dashboard
// "Schedules" tab pointing at this function. Example SQL:
//   select cron.schedule('ra-invite-expiring','0 * * * *', $$
//     select net.http_post(
//       url := '<PROJECT_URL>/functions/v1/notify-ra-invite-expiring',
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

function buildReminderEmail(firstName: string, orgName: string, actionLink: string): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  return wrap(
    greeting, orgName,
    "Your invite link expires in 24 hours",
    `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 14px">Your invite to join <strong style="color:#EAF2F9">${escapeHtml(orgName)}</strong>'s Referral Associate Program expires in about 24 hours. Click below before then to get started.</p>
     <div style="background:rgba(244,178,58,.1);border:1px solid rgba(244,178,58,.3);border-radius:8px;padding:14px 16px">
       <p style="margin:0;color:#A2B6C9;font-size:.85rem;line-height:1.5">Once you're in, you'll also have <strong style="color:#EAF2F9">21 days</strong> from your original invite to complete and submit onboarding, or your application will auto-close.</p>
     </div>`,
    "Accept invite",
    actionLink,
  )
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const sendgrid = Deno.env.get("SENDGRID_API_KEY")
  const appUrl = Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL
  if (!sendgrid) console.warn("SENDGRID_API_KEY not set; will still expire invites, but skip reminder emails")

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const now = Date.now()

  const { data: candidates, error: candErr } = await admin
    .from("ra_associates")
    .select("id, display_name, organization_id, invite_expires_at, invite_reminder_sent, profiles!ra_associates_user_id_fkey(email)")
    .eq("status", "pending")
    .is("invite_clicked_at", null)
    .not("invite_expires_at", "is", null)
  if (candErr) return json(500, { error: candErr.message })

  let expired = 0
  let remindersSent = 0

  for (const ra of (candidates ?? []) as Array<Record<string, unknown>>) {
    const raId = ra.id as string
    const expiresAtIso = ra.invite_expires_at as string
    const hoursRemaining = (new Date(expiresAtIso).getTime() - now) / (60 * 60 * 1000)

    if (hoursRemaining <= 0) {
      // status='pending' filter above self-excludes this row from ever
      // matching again — no dedup column needed for the expiry flip itself.
      await admin.from("ra_associates").update({ status: "invite_expired" }).eq("id", raId)
      expired++
      continue
    }

    const alreadyReminded = ra.invite_reminder_sent as boolean
    if (hoursRemaining > 24 || alreadyReminded) continue

    const email = ((ra.profiles as { email?: string } | null)?.email) ?? null
    if (!email) {
      // No email on file — retrying won't help, mark done so we don't loop forever.
      await admin.from("ra_associates").update({ invite_reminder_sent: true }).eq("id", raId)
      continue
    }
    if (!sendgrid) continue // leave invite_reminder_sent false — retry next hour once configured

    const orgId = ra.organization_id as string
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle()
    const orgName = org?.name ?? "Divigner Group"
    const firstName = ((ra.display_name as string) || "").split(" ")[0] ?? ""

    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${appUrl}/onboarding` },
    })
    const actionLink = linkData?.properties?.action_link
    if (!actionLink) continue // generateLink failed — leave un-flagged, retry next hour

    const html = buildReminderEmail(firstName, orgName, actionLink)
    const result = await sendGridSend(sendgrid, email, "Your invite link expires in 24 hours", html)
    if (result.ok) remindersSent++
    // Mark sent once a genuine attempt was made with a valid link — avoids
    // hammering SendGrid hourly on a persistent delivery failure.
    await admin.from("ra_associates").update({ invite_reminder_sent: true }).eq("id", raId)
  }

  return json(200, { ok: true, expired, remindersSent })
})
