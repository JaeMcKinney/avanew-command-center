/**
 * Shared SendGrid HTML-email helpers for RA-lifecycle Edge Functions.
 *
 * Factored out of notify-ra-status/index.ts's original wrap()/escapeHtml()/
 * sendOne() trio so invite-ra and the invite/onboarding-deadline cron
 * functions don't each carry their own copy. notify-ra-status and
 * notify-ra-checkin-due predate this file and keep their own inline wrap()
 * copies (not worth the regression risk of a full swap) but import LOGO_IMG
 * from here so the header logo stays single-sourced.
 */

export const FROM = { email: "zuirrae@divigner.com", name: "Divigner Group" }
export const DEFAULT_APP_URL = "https://avanew-command-center.vercel.app"

// Hosted PNG for email headers — email clients don't render SVG or data-URIs.
// divigner-logo-dark is the for-dark-backgrounds variant (white lettering):
// the same asset the RA portal sidebar shows in dark mode and that
// ra-lead-submit already embeds in its notification emails.
export const LOGO_URL =
  `${Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL}/logos/divigner-logo-dark.png`
export const LOGO_IMG =
  `<img src="${LOGO_URL}" alt="Divigner Group" width="150" style="display:block;width:150px;max-width:150px;height:auto;margin:0 0 22px">`

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c))
}

export function wrap(
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
    ${LOGO_IMG}
    <h1 style="color:#EAF2F9;font-size:1.4rem;margin:0 0 16px">${heading}</h1>
    <p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 12px">${greeting}</p>
    ${bodyHtml}
    <a href="${ctaHref}" style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#18B9A6,#34D6C2);color:#06101D;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:.9rem">${ctaLabel}</a>
    <p style="color:rgba(162,182,201,.4);font-size:.75rem;margin:28px 0 0">${escapeHtml(orgName)} · Referral Associate Program</p>
  </div>
</body></html>`
}

export async function sendGridSend(
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
