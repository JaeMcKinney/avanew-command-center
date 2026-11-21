// Receives email sent to the support address and files it on a ticket, so the
// whole thread stays in Avalytics.
//
// Resend calls this address when an email arrives (webhook event
// "email.received"). The event names the email; its text is then read from
// Resend. A reply to a ticket email carries the ticket in the address it was
// sent to (support+t1001-<token>@…); mail to the plain support address opens
// a new ticket. Mail is accepted only from the address of someone who could
// have written the same thing in the app.
//
// Settings: RESEND_WEBHOOK_SECRET (the webhook's signing secret),
// SUPPORT_INBOUND_ADDRESS (the support address) and RESEND_API_KEY.

import { serviceClient } from "../_shared/clients.ts"
import { emailSettings } from "../_shared/email.ts"
import { corsHeaders, json } from "../_shared/http.ts"
import { verifySvixSignature } from "../_shared/signature.ts"
import { emailAddress, htmlToText, stripQuotedReply, ticketReference } from "../_shared/support.ts"

type ReceivedEmail = { from?: string; to?: string[] | string; subject?: string; text?: string | null; html?: string | null; message_id?: string }

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json(405, { error: "Use POST" })

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET")
  const inbox = Deno.env.get("SUPPORT_INBOUND_ADDRESS")
  const settings = emailSettings()
  if (!secret || !inbox || !settings) return json(503, { error: "Support email is not set up" })

  const raw = await req.text()
  const signed = await verifySvixSignature(secret, raw, {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  })
  if (!signed) return json(401, { error: "The signature does not match" })

  let event: { type?: string; data?: { email_id?: string } }
  try {
    event = JSON.parse(raw)
  } catch {
    return json(400, { error: "The request body must be JSON" })
  }
  if (event.type !== "email.received" || !event.data?.email_id) return json(200, { status: "ignored" })

  // The event carries no text, so read the email itself.
  let email: ReceivedEmail
  try {
    const res = await fetch(`${settings.base}/emails/receiving/${encodeURIComponent(event.data.email_id)}`, {
      headers: { Authorization: `Bearer ${settings.key}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      console.error("support-inbound: could not read the email", res.status)
      return json(502, { error: "The email could not be read from the email service" })
    }
    email = (await res.json()) as ReceivedEmail
  } catch (err) {
    console.error("support-inbound:", (err as Error).message)
    return json(502, { error: "The email service could not be reached" })
  }

  const recipients = Array.isArray(email.to) ? email.to : email.to ? [email.to] : []
  const reference = ticketReference(recipients, inbox)
  const from = emailAddress(email.from)
  if (reference === null || !from) return json(200, { status: "ignored" })

  const body = stripQuotedReply(email.text?.trim() ? email.text : htmlToText(email.html ?? ""))
  const { data, error } = await serviceClient().rpc("support_ingest_email", {
    p_from: from,
    p_reference: reference,
    p_subject: email.subject ?? "",
    p_body: body,
    p_message_id: email.message_id ?? event.data.email_id,
  })
  if (error) {
    console.error("support-inbound: ingest failed", error.message)
    return json(500, { error: "The email could not be filed" })
  }
  // Always 200 once the email is handled, so a rejected sender is not retried.
  return json(200, data)
}
