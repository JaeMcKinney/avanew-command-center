// A small Stripe client: only the calls this app makes. Card details never
// touch this app; payment pages are Stripe's own.
//
// Settings: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

import { HttpError } from "./http.ts"
import { timingSafeEqual } from "./signature.ts"

function config() {
  const key = Deno.env.get("STRIPE_SECRET_KEY")
  if (!key) throw new HttpError(503, "Payments are not set up yet. Ask Divigner to connect Stripe.")
  return { key, base: (Deno.env.get("STRIPE_API_BASE") ?? "https://api.stripe.com").replace(/\/+$/, "") }
}

export const stripeConfigured = () => Boolean(Deno.env.get("STRIPE_SECRET_KEY"))

type Params = { [key: string]: string | number | boolean | null | undefined | Params | Params[] | string[] }

/** Stripe takes form fields: { items: [{ price: "x" }] } becomes items[0][price]=x. */
export function encodeForm(params: Params, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const name = prefix ? `${prefix}[${key}]` : key
    if (Array.isArray(value)) {
      value.forEach((item, i) => typeof item === "object" ? encodeForm(item, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(item)))
    } else if (typeof value === "object") {
      encodeForm(value, name, out)
    } else {
      out.append(name, String(value))
    }
  }
  return out
}

export class StripeError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: "GET" | "POST", path: string, params?: Params, idempotencyKey?: string): Promise<T> {
  const { key, base } = config()
  let res: Response
  try {
    res = await fetch(`${base}/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: method === "POST" ? encodeForm(params ?? {}) : undefined,
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    throw new StripeError(0, `Could not reach Stripe: ${(err as Error).message}`)
  }
  const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
  if (!res.ok) throw new StripeError(res.status, body?.error?.message ?? `Stripe answered ${res.status}`)
  return body as T
}

export type StripeSubscription = {
  id: string
  customer: string
  status: string
  cancel_at_period_end?: boolean
  canceled_at?: number | null
  // Older API versions put the period on the subscription; newer ones on each item.
  current_period_start?: number
  current_period_end?: number
  items?: { data?: Array<{ id: string; price?: { id: string }; current_period_start?: number; current_period_end?: number }> }
  metadata?: Record<string, string>
}

export type StripeInvoice = {
  id: string
  customer: string
  number?: string | null
  status?: string | null
  amount_due?: number
  amount_paid?: number
  currency?: string
  hosted_invoice_url?: string | null
  invoice_pdf?: string | null
  period_start?: number
  period_end?: number
  created?: number
}

export const createCustomer = (params: { name: string; email?: string; clientId: string }) =>
  request<{ id: string }>("POST", "/customers", { name: params.name, email: params.email, metadata: { client_id: params.clientId } }, `customer-${params.clientId}`)

export const createCheckoutSession = (params: {
  customer: string; priceId: string; setupFeePriceId?: string | null; clientId: string; planId: string; successUrl: string; cancelUrl: string
}) =>
  request<{ id: string; url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: params.customer,
    line_items: [{ price: params.priceId, quantity: 1 }, ...(params.setupFeePriceId ? [{ price: params.setupFeePriceId, quantity: 1 }] : [])],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.clientId,
    metadata: { client_id: params.clientId, plan_id: params.planId },
    subscription_data: { metadata: { client_id: params.clientId, plan_id: params.planId } },
  })

/** A one-off payment on Stripe's checkout page, priced here rather than from a saved Stripe price. */
export const createPaymentSession = (params: {
  customer: string; amountCents: number; currency: string; description: string; metadata: Record<string, string>; successUrl: string; cancelUrl: string
}) =>
  request<{ id: string; url: string }>("POST", "/checkout/sessions", {
    mode: "payment",
    customer: params.customer,
    line_items: [{ quantity: 1, price_data: { currency: params.currency, unit_amount: params.amountCents, product_data: { name: params.description } } }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    payment_intent_data: { metadata: params.metadata },
  })

export const createPortalSession = (customer: string, returnUrl: string) =>
  request<{ url: string }>("POST", "/billing_portal/sessions", { customer, return_url: returnUrl })

export const getSubscription = (id: string) => request<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`)

/** Moves the subscription to another price now, charging or crediting the difference for the rest of the period. */
export const changeSubscriptionPrice = (id: string, itemId: string, priceId: string, planId: string) =>
  request<StripeSubscription>("POST", `/subscriptions/${encodeURIComponent(id)}`, {
    items: [{ id: itemId, price: priceId }], proration_behavior: "create_prorations", cancel_at_period_end: false, metadata: { plan_id: planId },
  })

export const setCancelAtPeriodEnd = (id: string, cancel: boolean) =>
  request<StripeSubscription>("POST", `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: cancel })

export function periodOf(sub: StripeSubscription): { start: string | null; end: string | null } {
  const item = sub.items?.data?.[0]
  const start = sub.current_period_start ?? item?.current_period_start
  const end = sub.current_period_end ?? item?.current_period_end
  return { start: start ? new Date(start * 1000).toISOString() : null, end: end ? new Date(end * 1000).toISOString() : null }
}

/** Checks the Stripe-Signature header: "t=<unix time>,v1=<hex hmac of `t.body`>". */
export async function verifyStripeSignature(rawBody: string, header: string | null, toleranceSeconds = 300): Promise<boolean> {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  if (!secret || !header) return false
  const parts = header.split(",").map((p) => p.trim().split("="))
  const t = parts.find(([k]) => k === "t")?.[1]
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v)
  if (!t || !/^\d+$/.test(t) || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`)))
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("")
  return signatures.some((s) => timingSafeEqual(expected, s))
}
