// Sends email through Resend. Settings: RESEND_API_KEY and EMAIL_FROM (both needed).

export type EmailMessage = { to: string; subject: string; text: string; html?: string }

export function emailSettings(): { key: string; from: string; base: string } | null {
  const key = Deno.env.get("RESEND_API_KEY")
  const from = Deno.env.get("EMAIL_FROM")
  return key && from ? { key, from, base: (Deno.env.get("RESEND_API_BASE") ?? "https://api.resend.com").replace(/\/+$/, "") } : null
}

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/** Plain paragraphs to simple HTML, with bare links made clickable. */
export function textToHtml(text: string): string {
  return text.split(/\n{2,}/).map((p) =>
    `<p>${escapeHtml(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join("")
}

export type SendResult = { status: "sent" | "failed" | "skipped"; detail?: string }

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const settings = emailSettings()
  if (!settings) return { status: "skipped", detail: "Email is not set up" }
  try {
    const res = await fetch(`${settings.base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: settings.from, to: [message.to], subject: message.subject, text: message.text, html: message.html ?? textToHtml(message.text) }),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.ok) return { status: "sent" }
    console.error("email send failed", res.status, (await res.text()).slice(0, 300))
    return { status: "failed", detail: `The email service answered ${res.status}` }
  } catch (err) {
    return { status: "failed", detail: `Could not reach the email service: ${(err as Error).message}` }
  }
}
