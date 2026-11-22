// Receives events from Stripe and keeps subscriptions and invoices up to date.
// Every event is checked against Stripe's signature and handled once.

import { checkUsage, syncSubscription } from "../_shared/billing.ts"
import { serviceClient, writeAudit } from "../_shared/clients.ts"
import { json } from "../_shared/http.ts"
import { notify } from "../_shared/notify.ts"
import { getSubscription, type StripeInvoice, type StripeSubscription, verifyStripeSignature } from "../_shared/stripe.ts"
import { brandName } from "../_shared/brand.ts"

type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } }
const at = (seconds: number | undefined) => seconds ? new Date(seconds * 1000).toISOString() : null

export const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "Use POST" })
  const raw = await req.text()
  if (!(await verifyStripeSignature(raw, req.headers.get("Stripe-Signature")))) return json(401, { error: "Signature check failed" })
  let event: StripeEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return json(400, { error: "The body must be JSON" })
  }
  if (!event?.id || !event.type || !event.data?.object) return json(400, { error: "Not a Stripe event" })

  const admin = serviceClient()
  const { data: fresh, error } = await admin.from("stripe_events").upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true }).select("id")
  if (error) return json(500, { error: "Could not record the event" })
  if (!fresh?.length) return json(200, { ok: true, duplicate: true })

  try {
    const object = event.data.object
    const sessionMeta = (object.metadata ?? {}) as Record<string, string>
    if (event.type.startsWith("checkout.session.") && sessionMeta.topup_id) {
      // Extra minutes. They count only once Stripe says the money has arrived.
      const paid = (event.type === "checkout.session.completed" && object.payment_status === "paid") || event.type === "checkout.session.async_payment_succeeded"
      const gone = event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed"
      if (paid) {
        const { data: done } = await admin.from("usage_topups").update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", sessionMeta.topup_id).eq("status", "pending").select("client_id, minutes, amount_cents, currency").maybeSingle()
        if (done) {
          const { data: client } = await admin.from("clients").select("name, slug").eq("id", done.client_id).single()
          const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: done.currency.toUpperCase() }).format(done.amount_cents / 100)
          const link = `${(Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")}/c/${client?.slug}/billing`
          await writeAudit(admin, { actorId: null, action: "usage.topup_paid", targetType: "client", targetId: done.client_id, clientId: done.client_id, detail: { minutes: done.minutes, amount_cents: done.amount_cents } })
          await notify(admin, {
            clientId: done.client_id, kind: `topup_paid:${sessionMeta.topup_id}`,
            subject: `${done.minutes} extra minutes added (${client?.name})`,
            text: `Thank you. Your payment of ${amount} added ${done.minutes} minutes of talk time to the current period. Stripe has emailed your receipt.\n\n${link}\n\n${brandName()}`,
            staffText: `${client?.name} bought ${done.minutes} extra minutes for ${amount}.`,
            sms: `${brandName()}: ${done.minutes} extra minutes added.`,
          })
          // More room may turn paused avatars back on.
          await checkUsage(admin, done.client_id)
        }
      } else if (gone) {
        await admin.from("usage_topups").update({ status: "expired" }).eq("id", sessionMeta.topup_id).eq("status", "pending")
      }
    } else if (event.type === "checkout.session.completed") {
      const metadata = sessionMeta
      const subscriptionId = object.subscription as string | undefined
      if (metadata.client_id && subscriptionId) {
        await admin.from("client_billing").update({ stripe_subscription_id: subscriptionId, stripe_customer_id: object.customer as string, ...(metadata.plan_id ? { plan_id: metadata.plan_id } : {}) })
          .eq("client_id", metadata.client_id)
        await syncSubscription(admin, await getSubscription(subscriptionId))
        await checkUsage(admin, metadata.client_id)
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const clientId = await syncSubscription(admin, object as unknown as StripeSubscription)
      // A new period or a different package changes the allowance.
      if (clientId) await checkUsage(admin, clientId)
    } else if (event.type.startsWith("invoice.")) {
      const invoice = object as unknown as StripeInvoice
      const { data: billing } = await admin.from("client_billing").select("client_id").eq("stripe_customer_id", invoice.customer).maybeSingle()
      // Drafts have no number yet and are not something to show a client.
      if (billing && invoice.status && invoice.status !== "draft") {
        await admin.from("invoices").upsert({
          id: invoice.id, client_id: billing.client_id, number: invoice.number ?? null, status: invoice.status,
          amount_due_cents: invoice.amount_due ?? 0, amount_paid_cents: invoice.amount_paid ?? 0, currency: invoice.currency ?? "usd",
          hosted_invoice_url: invoice.hosted_invoice_url ?? null, invoice_pdf: invoice.invoice_pdf ?? null,
          period_start: at(invoice.period_start), period_end: at(invoice.period_end), issued_at: at(invoice.created) ?? new Date().toISOString(),
        })
        if (event.type === "invoice.payment_failed") {
          const { data: client } = await admin.from("clients").select("name, slug").eq("id", billing.client_id).single()
          const link = `${(Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")}/c/${client?.slug}/billing`
          await notify(admin, {
            clientId: billing.client_id, kind: `payment_failed:${invoice.id}`,
            subject: `A payment did not go through (${client?.name})`,
            text: `We could not take payment for your latest invoice${invoice.number ? ` (${invoice.number})` : ""}. Please update your payment method so your avatars keep running:\n\n${link}\n\n${brandName()}`,
            staffText: `A payment failed for ${client?.name}${invoice.number ? ` (invoice ${invoice.number})` : ""}.`,
            sms: `${brandName()}: a payment did not go through. Update your payment method: ${link}`,
          })
        }
      }
    }
    return json(200, { ok: true })
  } catch (err) {
    console.error("stripe webhook:", event.type, (err as Error).message)
    // Forget the event so Stripe's retry is handled.
    await admin.from("stripe_events").delete().eq("id", event.id)
    return json(500, { error: "The event could not be handled" })
  }
}
