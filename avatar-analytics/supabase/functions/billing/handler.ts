// What a client (or staff on their behalf) can do about their subscription.
//
// Body: { action, client_id, ... }
//   "checkout"    { plan_id }  → { url }  Stripe's page to start a subscription
//   "portal"                   → { url }  Stripe's page for payment method and invoices
//   "change_plan" { plan_id }  → moves to another package now, prorated
//   "cancel"      { reason? }  → ends at the end of the paid period; the Owner is told
//   "resume"                   → undoes a cancellation that has not taken effect yet
//   "topup"       { amount_cents } → { url }  Stripe's page to pay for extra minutes this period

import { checkUsage, syncSubscription } from "../_shared/billing.ts"
import { requireAccess, requireUser, serviceClient, writeAudit } from "../_shared/clients.ts"
import { endpoint, HttpError, json, readJson } from "../_shared/http.ts"
import { notify } from "../_shared/notify.ts"
import {
  changeSubscriptionPrice, createCheckoutSession, createCustomer, createPaymentSession, createPortalSession, getSubscription, periodOf, setCancelAtPeriodEnd, StripeError,
} from "../_shared/stripe.ts"

type Body = { action?: string; client_id?: string; plan_id?: string; reason?: string; amount_cents?: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100)
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "the end of the current period"

export const handler = endpoint(async (req) => {
  const caller = await requireUser(req)
  const body = await readJson<Body>(req)
  if (!body.client_id || !UUID.test(body.client_id)) throw new HttpError(400, "Choose a client")
  await requireAccess(caller, "billing.manage", body.client_id)

  const admin = serviceClient()
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")
  const { data: client } = await admin.from("clients").select("id, name, slug, status").eq("id", body.client_id).single()
  if (!client) throw new HttpError(404, "Client not found")
  const page = `${appUrl}/c/${client.slug}/billing`
  await admin.from("client_billing").upsert({ client_id: client.id }, { onConflict: "client_id", ignoreDuplicates: true })
  const { data: billing } = await admin.from("client_billing").select("*").eq("client_id", client.id).single()
  if (!billing) throw new Error("billing row missing")
  const subscribed = Boolean(billing.stripe_subscription_id) && !["none", "cancelled"].includes(billing.status)

  const planFor = async (id: string | undefined) => {
    if (!id || !UUID.test(id)) throw new HttpError(400, "Choose a package")
    const { data: plan } = await admin.from("plans").select("*").eq("id", id).eq("is_active", true).maybeSingle()
    if (!plan) throw new HttpError(404, "That package is not available")
    if (!plan.stripe_price_id) throw new HttpError(409, "That package is not connected to Stripe yet. Ask Divigner to finish setting it up.")
    return plan
  }

  try {
    switch (body.action) {
      case "checkout": {
        if (subscribed) throw new HttpError(409, "There is already a subscription. Change the package instead.")
        const plan = await planFor(body.plan_id)
        let customer = billing.stripe_customer_id
        if (!customer) {
          const { data: user } = await admin.auth.admin.getUserById(caller.userId)
          customer = (await createCustomer({ name: client.name, email: user.user?.email, clientId: client.id })).id
          await admin.from("client_billing").update({ stripe_customer_id: customer }).eq("client_id", client.id)
        }
        // The one-time setup fee is added the first time only.
        const { data: fee } = billing.stripe_subscription_id ? { data: null }
          : await admin.from("settings").select("value").eq("key", "billing.setup_fee_price_id").maybeSingle()
        const session = await createCheckoutSession({
          customer, priceId: plan.stripe_price_id, setupFeePriceId: typeof fee?.value === "string" && fee.value ? fee.value : null,
          clientId: client.id, planId: plan.id, successUrl: `${page}?checkout=done`, cancelUrl: page,
        })
        await admin.from("client_billing").update({ plan_id: plan.id, status: billing.status === "cancelled" ? "cancelled" : "incomplete" }).eq("client_id", client.id)
        return json(200, { ok: true, url: session.url })
      }

      case "portal": {
        if (!billing.stripe_customer_id) throw new HttpError(409, "There is no payment account yet. Choose a package first.")
        return json(200, { ok: true, url: (await createPortalSession(billing.stripe_customer_id, page)).url })
      }

      case "change_plan": {
        if (!subscribed) throw new HttpError(409, "There is no subscription to change. Choose a package first.")
        const plan = await planFor(body.plan_id)
        if (plan.id === billing.plan_id) throw new HttpError(409, "That is already the current package")
        const { data: old } = billing.plan_id ? await admin.from("plans").select("name").eq("id", billing.plan_id).maybeSingle() : { data: null }
        const current = await getSubscription(billing.stripe_subscription_id)
        const itemId = current.items?.data?.[0]?.id
        if (!itemId) throw new HttpError(502, "Stripe did not return the subscription's details. Try again.")
        const updated = await changeSubscriptionPrice(billing.stripe_subscription_id, itemId, plan.stripe_price_id, plan.id)
        await admin.from("client_billing").update({ plan_id: plan.id }).eq("client_id", client.id)
        await syncSubscription(admin, updated)
        await writeAudit(admin, { actorId: caller.userId, action: "subscription.plan_changed", targetType: "client", targetId: client.id, clientId: client.id, detail: { from: old?.name ?? null, to: plan.name } })
        const price = `${money(plan.monthly_price_cents, plan.currency)} a month`
        await notify(admin, {
          clientId: client.id, kind: "plan_changed",
          subject: `Your package is now ${plan.name} (${client.name})`,
          text: `Your package has changed${old?.name ? ` from ${old.name}` : ""} to ${plan.name}: ${plan.included_minutes.toLocaleString("en-US")} minutes for ${price}. The change is in effect now, and your next invoice adjusts for the part of this period already paid.\n\n${page}\n\nDivigner`,
          staffText: `${client.name} changed package${old?.name ? ` from ${old.name}` : ""} to ${plan.name} (${price}).`,
          sms: `Divigner: your package is now ${plan.name}.`,
        })
        // A bigger allowance may turn paused avatars back on straight away.
        const usage = await checkUsage(admin, client.id)
        return json(200, { ok: true, resumed: usage.resumed > 0 })
      }

      case "cancel": {
        if (!subscribed) throw new HttpError(409, "There is no subscription to cancel")
        const reason = (body.reason ?? "").trim().slice(0, 1000) || null
        const updated = await setCancelAtPeriodEnd(billing.stripe_subscription_id, true)
        const ends = periodOf(updated).end ?? billing.current_period_end
        await syncSubscription(admin, updated)
        await admin.from("client_billing").update({ cancel_at_period_end: true, cancel_requested_at: new Date().toISOString(), cancel_reason: reason }).eq("client_id", client.id)
        await writeAudit(admin, { actorId: caller.userId, action: "subscription.cancel_requested", targetType: "client", targetId: client.id, clientId: client.id, detail: { ends_at: ends, reason } })
        const { data: user } = await admin.auth.admin.getUserById(caller.userId)
        await notify(admin, {
          clientId: client.id, kind: "subscription_cancel_requested",
          subject: `Your subscription will end on ${day(ends)} (${client.name})`,
          text: `Your subscription has been cancelled. Your avatars keep working until ${day(ends)}, and you will not be charged again.\n\nChanged your mind? You can keep the subscription any time before then:\n\n${page}\n\nDivigner`,
          staffText: `${client.name} cancelled their subscription. It ends on ${day(ends)}.\n\nCancelled by: ${user.user?.email ?? "unknown"}\nReason given: ${reason ?? "none"}`,
          sms: `Divigner: your subscription is cancelled and ends on ${day(ends)}.`,
        })
        return json(200, { ok: true, ends_at: ends })
      }

      case "resume": {
        if (!subscribed || !billing.cancel_at_period_end) throw new HttpError(409, "There is no cancellation to undo")
        await syncSubscription(admin, await setCancelAtPeriodEnd(billing.stripe_subscription_id, false))
        await writeAudit(admin, { actorId: caller.userId, action: "subscription.cancel_undone", targetType: "client", targetId: client.id, clientId: client.id })
        await notify(admin, {
          clientId: client.id, kind: "subscription_cancel_undone",
          subject: `Your subscription continues (${client.name})`,
          text: `Your cancellation has been undone. Your subscription continues as before.\n\n${page}\n\nDivigner`,
          staffText: `${client.name} undid their cancellation. The subscription continues.`,
          sms: `Divigner: your subscription continues.`,
        })
        return json(200, { ok: true })
      }

      case "topup": {
        if (!subscribed || !billing.stripe_customer_id) throw new HttpError(409, "Extra minutes are for clients with a subscription. Choose a package first.")
        const amount = Number(body.amount_cents)
        const { data: offers, error: offerError } = await admin.rpc("topup_offer", { p_client_id: client.id, p_amount_cents: Number.isInteger(amount) ? amount : 0 })
        if (offerError) throw new Error(offerError.message)
        const offer = (offers ?? [])[0] as { minutes: number; period_start: string; period_end: string; currency: string } | undefined
        if (!offer) throw new HttpError(400, "That amount cannot be used. Choose one of the amounts offered, or a whole-dollar amount in the range shown.")
        const { data: topup, error: insertError } = await admin.from("usage_topups").insert({
          client_id: client.id, amount_cents: amount, currency: offer.currency, minutes: offer.minutes,
          period_start: offer.period_start, period_end: offer.period_end, created_by: caller.userId,
        }).select("id").single()
        if (insertError || !topup) throw new Error(insertError?.message ?? "could not record the top-up")
        const session = await createPaymentSession({
          customer: billing.stripe_customer_id, amountCents: amount, currency: offer.currency,
          description: `${offer.minutes} extra minutes of avatar talk time (until ${day(offer.period_end)})`,
          metadata: { client_id: client.id, topup_id: topup.id }, successUrl: `${page}?topup=done`, cancelUrl: page,
        })
        await admin.from("usage_topups").update({ stripe_session_id: session.id }).eq("id", topup.id)
        return json(200, { ok: true, url: session.url, minutes: offer.minutes })
      }

      default:
        throw new HttpError(400, "Unknown action")
    }
  } catch (err) {
    if (err instanceof StripeError) {
      console.error("stripe:", err.status, err.message)
      throw new HttpError(502, "The payment service could not complete that. Nothing was changed. Try again in a moment.")
    }
    throw err
  }
})
