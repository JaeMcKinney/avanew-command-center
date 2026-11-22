// Emails the other side when someone replies on a support ticket.
//
// The thread itself lives in Avalytics; the email is only a heads-up that
// carries the reply and a link back to the ticket. When an inbound address is
// set (SUPPORT_INBOUND_ADDRESS), the email can also be answered directly and
// the answer is filed on the ticket by support-inbound.
//
// Called by the app straight after a reply is saved, and by the schedule to
// catch anything that was missed. Body: {}

import { isScheduledCall, requireUser, serviceClient } from "../_shared/clients.ts"
import { sendEmail } from "../_shared/email.ts"
import { endpoint, HttpError, json } from "../_shared/http.ts"
import { replyAddress, REPLY_MARKER } from "../_shared/support.ts"
import { brandName } from "../_shared/brand.ts"

type Pending = {
  message_id: string
  ticket_number: number
  subject: string
  priority: string
  body: string
  author_name: string
  author_side: "client" | "divigner"
  client_name: string
  client_slug: string
  reply_token: string
  attachment_count: number
  recipients: string[]
}

export const handler = endpoint(async (req) => {
  if (!isScheduledCall(req)) await requireUser(req)
  const admin = serviceClient()
  const { data, error } = await admin.rpc("support_claim_notifications", { p_limit: 50 })
  if (error) throw new HttpError(500, "Could not read the replies waiting to be emailed")

  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")
  const inbox = Deno.env.get("SUPPORT_INBOUND_ADDRESS") ?? ""
  const tally = { messages: 0, sent: 0, skipped: 0, failed: 0 }

  for (const item of (data ?? []) as Pending[]) {
    tally.messages++
    const toStaff = item.author_side === "client"
    const link = toStaff ? `${appUrl}/admin/support/${item.ticket_number}` : `${appUrl}/c/${item.client_slug}/support/${item.ticket_number}`
    const replyTo = inbox ? replyAddress(inbox, item.ticket_number, item.reply_token) : null
    const who = toStaff ? `${item.author_name || "Someone"} at ${item.client_name}` : `${item.author_name || brandName()} at ${brandName()}`
    const files = item.attachment_count > 0 ? `\n\n${item.attachment_count} file${item.attachment_count === 1 ? " is" : "s are"} attached to this reply in Avalytics.` : ""
    const text = [
      ...(replyTo ? [`— ${REPLY_MARKER} —`] : []),
      `${who} wrote on support ticket #${item.ticket_number}, "${item.subject}"${toStaff && item.priority === "urgent" ? " (urgent)" : ""}:`,
      `${item.body}${files}`,
      `${replyTo ? "Reply to this email, or open" : "Open"} the ticket in Avalytics:\n${link}`,
    ].join("\n\n")

    const results = { sent: 0, skipped: 0, failed: 0 }
    let detail = ""
    for (const to of item.recipients) {
      const result = await sendEmail({ to, subject: `[Ticket #${item.ticket_number}] ${item.subject}`, text, replyTo: replyTo ?? undefined })
      results[result.status]++
      tally[result.status]++
      if (result.detail) detail = result.detail
    }
    const summary = item.recipients.length === 0
      ? "nobody to email"
      : `sent ${results.sent}, skipped ${results.skipped}, failed ${results.failed}${detail ? `: ${detail}` : ""}`
    // Try again later only when every send failed.
    const done = !(results.failed > 0 && results.sent === 0 && results.skipped === 0)
    await admin.rpc("support_mark_notified", { p_message_id: item.message_id, p_done: done, p_result: summary })
  }
  return json(200, tally)
})
