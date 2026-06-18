// Supabase Edge Function — notify-ra-status
//
// Emails a Referral Associate when a Program Admin approves, declines, or
// requests changes on their application. Called best-effort from data.ts after
// the ra_associates status update succeeds.
//
// Deploy:
//   supabase functions deploy notify-ra-status
//
// Required secrets:
//   - SUPABASE_URL              (auto)
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SENDGRID_API_KEY          (same key used by ra-lead-submit)
// Optional:
//   - APP_BASE_URL              (defaults to the production Vercel URL)

import { createClient } from "npm:@supabase/supabase-js@2"

type Kind = "approved" | "declined" | "changes_requested"

type Payload = {
  ra_associate_id: string
  kind: Kind
  notes?: string | null
}

const FROM = { email: "zuirrae@divigner.com", name: "Divigner Group" }
const DEFAULT_APP_URL = "https://avanew-command-center.vercel.app"

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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c))
}

function buildEmail(
  kind: Kind,
  firstName: string,
  orgName: string,
  appUrl: string,
  notes?: string | null,
): { subject: string; html: string } {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  const wrap = (heading: string, bodyHtml: string, ctaLabel: string, ctaHref: string) => `
<!doctype html><html><body style="margin:0;background:#06101D;font-family:'Manrope',Arial,sans-serif;padding:32px 0">
  <div style="max-width:520px;margin:0 auto;background:#0E2741;border:1px solid rgba(160,190,215,.14);border-radius:16px;padding:32px">
    <h1 style="color:#EAF2F9;font-size:1.4rem;margin:0 0 16px">${heading}</h1>
    <p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 12px">${greeting}</p>
    ${bodyHtml}
    <a href="${ctaHref}" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#18B9A6,#34D6C2);color:#06101D;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:.9rem">${ctaLabel}</a>
    <p style="color:rgba(162,182,201,.4);font-size:.75rem;margin:28px 0 0">${escapeHtml(orgName)} · Referral Associate Program</p>
  </div>
</body></html>`

  switch (kind) {
    case "approved":
      return {
        subject: `You're approved — welcome to the ${orgName} Referral Program`,
        html: wrap(
          "Your application is approved 🎉",
          `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0">Your Referral Associate account is now active. Sign in to access your portal, grab your referral link, and start tracking leads.</p>`,
          "Open my portal",
          `${appUrl}/ra/dashboard`,
        ),
      }
    case "changes_requested":
      return {
        subject: `Action needed on your ${orgName} Referral application`,
        html: wrap(
          "A few changes are needed",
          `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 12px">Our team reviewed your application and needs a couple of updates before we can activate your account.</p>${
            notes ? `<div style="background:rgba(244,178,58,.1);border:1px solid rgba(244,178,58,.3);border-radius:8px;padding:12px 14px;color:#F4D58A;font-size:.9rem;line-height:1.5">${escapeHtml(notes)}</div>` : ""
          }`,
          "Update my application",
          `${appUrl}/onboarding/steps`,
        ),
      }
    case "declined":
      return {
        subject: `Update on your ${orgName} Referral application`,
        html: wrap(
          "Application update",
          `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0">Thank you for your interest in the ${escapeHtml(orgName)} Referral Associate Program. After review, we're unable to approve your application at this time. If you believe this was in error, please reply to this email.</p>`,
          "Contact the team",
          `mailto:${FROM.email}`,
        ),
      }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })

  let payload: Payload
  try { payload = await req.json() as Payload } catch { return json(400, { error: "Invalid JSON" }) }
  if (!payload.ra_associate_id) return json(400, { error: "ra_associate_id required" })
  if (!["approved", "declined", "changes_requested"].includes(payload.kind)) {
    return json(400, { error: "Invalid kind" })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Look up the RA + their email + org name.
  const { data: ra, error: raErr } = await admin
    .from("ra_associates")
    .select("id, user_id, display_name, organization_id")
    .eq("id", payload.ra_associate_id)
    .maybeSingle()
  if (raErr) return json(500, { error: raErr.message })
  if (!ra) return json(404, { error: "RA not found" })

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", ra.user_id)
    .maybeSingle()
  const toEmail = profile?.email
  if (!toEmail) return json(422, { error: "RA has no email on file" })

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", ra.organization_id)
    .maybeSingle()
  const orgName = org?.name ?? "Divigner Group"

  const firstName = (ra.display_name ?? profile?.full_name ?? "").split(" ")[0] ?? ""
  const appUrl = Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL
  const { subject, html } = buildEmail(payload.kind, firstName, orgName, appUrl, payload.notes)

  const sendgridKey = Deno.env.get("SENDGRID_API_KEY")
  if (!sendgridKey) {
    // No email provider configured — succeed quietly so the admin action isn't blocked.
    console.warn("SENDGRID_API_KEY not set; skipping RA notification email")
    return json(200, { sent: false, reason: "no_sendgrid_key" })
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${sendgridKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: FROM,
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error("SendGrid error:", res.status, body)
      return json(502, { sent: false, status: res.status })
    }
  } catch (err) {
    console.error("SendGrid fetch failed:", err)
    return json(502, { sent: false, error: String(err) })
  }

  return json(200, { sent: true, to: toEmail, kind: payload.kind })
})
