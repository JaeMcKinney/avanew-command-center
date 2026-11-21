// Tells a client's billing contacts (and Divigner's Owners) about something,
// by email, and records every notice. Text messages are a placeholder: the
// notice is recorded as skipped until a text provider is connected.

import type { SupabaseClient } from "./clients.ts"
import { sendEmail, type SendResult } from "./email.ts"

export type Notice = {
  clientId: string
  /** Short machine name, e.g. "usage_alert". */
  kind: string
  /** Set for once-per-period notices so they cannot be sent twice. */
  periodStart?: string | null
  subject: string
  /** Body for the client's own people. */
  text: string
  /** Body for Divigner's Owners, when it should differ. Omit to send them nothing. */
  staffText?: string
  /** One or two sentences for a text message. */
  sms: string
}

/** Placeholder until a text provider (for example Twilio) is connected. */
function sendSms(_to: string, _body: string): Promise<SendResult> {
  return Promise.resolve({ status: "skipped", detail: "Text messages are not set up yet" })
}

export async function notify(admin: SupabaseClient, notice: Notice): Promise<{ sent: number; skipped: number; failed: number }> {
  const { data: contacts, error } = await admin.rpc("billing_contacts", { p_client_id: notice.clientId })
  if (error) throw new Error(error.message)
  const period = notice.periodStart ?? "1970-01-01"
  const tally = { sent: 0, skipped: 0, failed: 0 }

  for (const contact of (contacts ?? []) as Array<{ email: string; phone: string | null; side: string }>) {
    const body = contact.side === "divigner" ? notice.staffText : notice.text
    if (!body) continue
    const channels: Array<{ channel: "email" | "sms"; recipient: string; send: () => Promise<SendResult> }> = [
      { channel: "email", recipient: contact.email, send: () => sendEmail({ to: contact.email, subject: notice.subject, text: body }) },
    ]
    if (contact.phone && contact.side === "client") channels.push({ channel: "sms", recipient: contact.phone, send: () => sendSms(contact.phone!, notice.sms) })

    for (const c of channels) {
      // Claim the notice first; if the row already exists it has been handled.
      const { data: claimed, error: claimError } = await admin.from("notifications")
        .upsert({ client_id: notice.clientId, kind: notice.kind, channel: c.channel, recipient: c.recipient, status: "skipped", detail: "Sending", period_start: period },
          { onConflict: "client_id,kind,channel,recipient,period_start", ignoreDuplicates: true })
        .select("id")
      if (claimError) throw new Error(claimError.message)
      if (!claimed?.length && notice.periodStart) continue
      const result = await c.send()
      tally[result.status]++
      await admin.from("notifications").update({ status: result.status, detail: result.detail ?? null, created_at: new Date().toISOString() })
        .match({ client_id: notice.clientId, kind: notice.kind, channel: c.channel, recipient: c.recipient, period_start: period })
    }
  }
  return tally
}
