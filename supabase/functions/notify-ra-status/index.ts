// Supabase Edge Function — notify-ra-status
//
// Two notification flows in one function:
//
//   1. RA-bound emails (approved / declined / changes_requested):
//      Sent to the RA themselves when a Program Admin acts on their application.
//
//   2. Program-Admin-bound emails (submitted):
//      Sent to every Program Admin in the RA's org when an RA hits the
//      "verification" state by submitting their onboarding application.
//      Recipients are resolved from organization_members.is_program_admin = true.
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

type Kind = "approved" | "declined" | "changes_requested" | "submitted"

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

function wrap(
  greeting: string,
  orgName: string,
  heading: string,
  bodyHtml: string,
  ctaLabel: string,
  ctaHref: string,
): string {
  return `
<!doctype html><html><body style="margin:0;background:#06101D;font-family:'Manrope',Arial,sans-serif;padding:32px 0">
  <div style="max-width:520px;margin:0 auto;background:#0E2741;border:1px solid rgba(160,190,215,.14);border-radius:16px;padding:32px">
    <h1 style="color:#EAF2F9;font-size:1.4rem;margin:0 0 16px">${heading}</h1>
    <p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 12px">${greeting}</p>
    ${bodyHtml}
    <a href="${ctaHref}" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#18B9A6,#34D6C2);color:#06101D;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:.9rem">${ctaLabel}</a>
    <p style="color:rgba(162,182,201,.4);font-size:.75rem;margin:28px 0 0">${escapeHtml(orgName)} · Referral Associate Program</p>
  </div>
</body></html>`
}

function buildRaEmail(
  kind: Exclude<Kind, "submitted">,
  firstName: string,
  orgName: string,
  appUrl: string,
  notes?: string | null,
): { subject: string; html: string } {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"

  switch (kind) {
    case "approved":
      return {
        subject: `You're approved — welcome to the ${orgName} Referral Program`,
        html: wrap(
          greeting, orgName,
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
          greeting, orgName,
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
          greeting, orgName,
          "Application update",
          `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0">Thank you for your interest in the ${escapeHtml(orgName)} Referral Associate Program. After review, we're unable to approve your application at this time. If you believe this was in error, please reply to this email.</p>`,
          "Contact the team",
          `mailto:${FROM.email}`,
        ),
      }
  }
}

function buildProgramAdminEmail(
  raDisplayName: string,
  raEmail: string,
  orgName: string,
  appUrl: string,
  raSlug: string,
): { subject: string; html: string } {
  return {
    subject: `New RA application ready for review — ${raDisplayName}`,
    html: wrap(
      "Hi,",
      orgName,
      "A new RA application is ready for review",
      `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 12px"><strong style="color:#EAF2F9">${escapeHtml(raDisplayName)}</strong> (${escapeHtml(raEmail)}) has submitted their onboarding application and is waiting on your decision.</p>
       <p style="color:#A2B6C9;font-size:.9rem;line-height:1.5;margin:0">Open the review page to approve, request changes, or decline.</p>`,
      "Review application",
      `${appUrl}/settings/ra/${encodeURIComponent(raSlug)}/review`,
    ),
  }
}

async function sendOne(
  sendgridKey: string,
  toEmail: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
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
      return { ok: false, status: res.status, error: body }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    console.error("SendGrid fetch failed:", err)
    return { ok: false, error: String(err) }
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
  if (!["approved", "declined", "changes_requested", "submitted"].includes(payload.kind)) {
    return json(400, { error: "Invalid kind" })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Look up the RA + their email + org name.
  const { data: ra, error: raErr } = await admin
    .from("ra_associates")
    .select("id, user_id, display_name, slug, organization_id")
    .eq("id", payload.ra_associate_id)
    .maybeSingle()
  if (raErr) return json(500, { error: raErr.message })
  if (!ra) return json(404, { error: "RA not found" })

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", ra.user_id)
    .maybeSingle()
  const raEmail = profile?.email ?? ""

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", ra.organization_id)
    .maybeSingle()
  const orgName = org?.name ?? "Divigner Group"

  const firstName = (ra.display_name ?? profile?.full_name ?? "").split(" ")[0] ?? ""
  const appUrl = Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL

  const sendgridKey = Deno.env.get("SENDGRID_API_KEY")
  if (!sendgridKey) {
    console.warn("SENDGRID_API_KEY not set; skipping notification email")
    return json(200, { sent: false, reason: "no_sendgrid_key" })
  }

  // ── submitted: fan out to all Program Admins in the org ─────────────────────
  if (payload.kind === "submitted") {
    // Find all admins in this org with is_program_admin = true.
    // We need their auth.users(id) to look up emails from profiles.
    const { data: members, error: memErr } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", ra.organization_id)
      .eq("is_program_admin", true)
      .eq("role", "admin")
    if (memErr) return json(500, { error: memErr.message })

    const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
    if (userIds.length === 0) {
      // Fallback: still notify SUPER_USER_FALLBACK_EMAIL if configured, or just
      // succeed silently so the RA action isn't blocked. The admin can read the
      // RA list to find the pending application.
      const fallback = Deno.env.get("PROGRAM_ADMIN_FALLBACK_EMAIL")
      if (!fallback) {
        return json(200, { sent: false, reason: "no_program_admins_configured" })
      }
      const { subject, html } = buildProgramAdminEmail(ra.display_name, raEmail, orgName, appUrl, ra.slug)
      const r = await sendOne(sendgridKey, fallback, subject, html)
      return json(r.ok ? 200 : 502, { sent: r.ok, to: [fallback], fallback: true })
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds)
    const recipientEmails = (profiles ?? [])
      .map((p: { email: string | null }) => p.email)
      .filter((e: string | null): e is string => Boolean(e))

    const { subject, html } = buildProgramAdminEmail(ra.display_name, raEmail, orgName, appUrl, ra.slug)
    const results = await Promise.all(
      recipientEmails.map((email) => sendOne(sendgridKey, email, subject, html))
    )
    const anyOk = results.some((r) => r.ok)
    return json(anyOk ? 200 : 502, {
      sent: anyOk,
      to: recipientEmails,
      results: results.map((r, i) => ({ to: recipientEmails[i], ok: r.ok, status: r.status })),
    })
  }

  // ── RA-bound emails (approved / declined / changes_requested) ──────────────
  if (!raEmail) return json(422, { error: "RA has no email on file" })
  const { subject, html } = buildRaEmail(payload.kind, firstName, orgName, appUrl, payload.notes)
  const r = await sendOne(sendgridKey, raEmail, subject, html)
  if (!r.ok) return json(502, { sent: false, status: r.status })
  return json(200, { sent: true, to: raEmail, kind: payload.kind })
})
