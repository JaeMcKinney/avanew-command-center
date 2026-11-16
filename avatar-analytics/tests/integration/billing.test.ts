// Packages, subscriptions through Stripe, usage warnings, pause and resume,
// cancelling, invoices, and who may see or change any of it.

import { createHmac } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import {
  admin, callFunction, createClientRow, createUser, event, FUNCTIONS_URL, ingest, mockTavusState, resetDatabase, resetMockTavus, type TestUser,
} from "./helpers"

let owner: TestUser, dana: TestUser, lee: TestUser, pat: TestUser
let northline: { id: string }, harbor: { id: string }
let small: string, large: string, maya: string
const CRON = { headers: { "x-cron-secret": "local-cron-secret" } }
const NOW = Math.floor(Date.now() / 1000)
const DAY = 86_400
const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_1", customer: "cus_mock1", status: "active", cancel_at_period_end: false, metadata: {},
  items: { data: [{ id: "si_1", price: { id: "price_small" }, current_period_start: NOW - 10 * DAY, current_period_end: NOW + 20 * DAY }] },
  ...overrides,
})
const stripeState = (subs: Record<string, unknown>) => ({ customers: [{ id: "cus_mock1" }], sessions: [], portals: [], subscriptions: subs, calls: [], failNext: 0 })

async function stripeEvent(type: string, object: unknown, options: { id?: string; secret?: string; at?: number } = {}) {
  const body = JSON.stringify({ id: options.id ?? `evt_${Math.random().toString(36).slice(2)}`, type, data: { object } })
  const t = options.at ?? Math.floor(Date.now() / 1000)
  const v1 = createHmac("sha256", options.secret ?? "whsec_local_test").update(`${t}.${body}`).digest("hex")
  const res = await fetch(`${FUNCTIONS_URL}/stripe-webhook`, { method: "POST", headers: { "Stripe-Signature": `t=${t},v1=${v1}`, "Content-Type": "application/json" }, body })
  return { status: res.status, body: await res.json() }
}
const billingOf = async (clientId: string) => (await admin.from("client_billing").select("*").eq("client_id", clientId).single()).data!
const clientStatus = async (clientId: string) => (await admin.from("clients").select("status").eq("id", clientId).single()).data!.status
const summary = async (user: TestUser, clientId = northline.id) => user.client.rpc("billing_summary", { p_client_id: clientId })
const emailsTo = async (address: string) => (await mockTavusState()).emails.filter((e) => e.to.includes(address))
let callNumber = 0
async function talk(seconds: number) {
  const id = `bill-${++callNumber}`
  const start = Date.now() - 3_600_000 + callNumber * 1000
  await ingest(maya, event(id, "system.pal_joined", new Date(start).toISOString()))
  await ingest(maya, event(id, "system.shutdown", new Date(start + seconds * 1000).toISOString()))
}

beforeAll(async () => {
  resetDatabase()
  await admin.from("settings").delete().eq("key", "billing.setup_fee_price_id")
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  northline = await createClientRow(owner, "Northline Realty", "northline")
  harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental")
  dana = await createUser({ email: "dana@northline.test", role: "client_admin", clientId: northline.id })
  lee = await createUser({ email: "lee@northline.test", role: "client_member", clientId: northline.id })
  pat = await createUser({ email: "pat@harbor.test", role: "client_admin", clientId: harbor.id })
  await callFunction("tavus-sync", {}, { token: owner.token })
  const linked = await callFunction("avatar-link", { action: "link", client_id: northline.id, pals: [{ pal_id: "p3a91c0de01", display_name: "Maya" }, { pal_id: "p7c20c0de02", display_name: "Theo" }] }, { token: owner.token })
  maya = linked.body.results[0].avatar_id
})

describe("packages", () => {
  it("are created by staff who may manage them, and nobody else", async () => {
    const created = await owner.client.from("plans").insert([
      { name: "Small", monthly_price_cents: 10000, included_minutes: 10, max_concurrent: 1, stripe_price_id: "price_small", is_active: true, sort: 1 },
      { name: "Large", monthly_price_cents: 30000, included_minutes: 100, max_concurrent: 3, stripe_price_id: "price_large", is_active: true, sort: 2 },
      { name: "Retired", monthly_price_cents: 5000, included_minutes: 5, max_concurrent: null, stripe_price_id: null, is_active: false, sort: 3 },
      { name: "Not connected", monthly_price_cents: 5000, included_minutes: 5, max_concurrent: null, stripe_price_id: null, is_active: true, sort: 4 },
    ]).select("id, name")
    expect(created.error).toBeNull()
    small = created.data!.find((p) => p.name === "Small")!.id
    large = created.data!.find((p) => p.name === "Large")!.id
    expect((await dana.client.from("plans").insert({ name: "Free", monthly_price_cents: 0, included_minutes: 99999 })).error).not.toBeNull()
    expect((await dana.client.from("plans").update({ monthly_price_cents: 1 }).eq("id", small).select()).data).toEqual([])
  })

  it("clients see the packages on offer, but not retired ones", async () => {
    const { data } = await dana.client.from("plans").select("name").order("sort")
    expect(data!.map((p) => p.name)).toEqual(["Small", "Large", "Not connected"])
    expect((await owner.client.from("plans").select("name")).data).toHaveLength(4)
  })
})

describe("starting a subscription", () => {
  it("sends the client to Stripe's checkout for the package they chose", async () => {
    const res = await callFunction("billing", { action: "checkout", client_id: northline.id, plan_id: small }, { token: dana.token })
    expect(res.status).toBe(200)
    expect(res.body.url).toMatch(/^https:\/\/checkout\.stripe\.test\/pay\//)
    const { stripe } = await mockTavusState()
    expect(stripe.customers[0]).toMatchObject({ name: "Northline Realty", email: "dana@northline.test", metadata: { client_id: northline.id } })
    const form = stripe.sessions[0].form
    expect(form).toMatchObject({ mode: "subscription", customer: "cus_mock1", "line_items[0][price]": "price_small", "line_items[0][quantity]": "1", "metadata[client_id]": northline.id, "metadata[plan_id]": small })
    expect(form.success_url).toBe("http://127.0.0.1:5180/c/northline/billing?checkout=done")
    expect(form["line_items[1][price]"]).toBeUndefined() // no setup fee configured
    expect(await billingOf(northline.id)).toMatchObject({ status: "incomplete", stripe_customer_id: "cus_mock1", plan_id: small })
  })

  it("adds the one-time setup fee when one is configured", async () => {
    await admin.from("settings").insert({ key: "billing.setup_fee_price_id", value: "price_setup", description: "test" })
    await callFunction("billing", { action: "checkout", client_id: northline.id, plan_id: small }, { token: dana.token })
    const { stripe } = await mockTavusState()
    expect(stripe.sessions[1].form["line_items[1][price]"]).toBe("price_setup")
    expect(stripe.customers).toHaveLength(1) // the same customer is reused
    await admin.from("settings").delete().eq("key", "billing.setup_fee_price_id")
  })

  it("refuses packages that are retired or not connected to Stripe", async () => {
    const { data: plans } = await admin.from("plans").select("id, name")
    const id = (name: string) => plans!.find((p) => p.name === name)!.id
    expect((await callFunction("billing", { action: "checkout", client_id: northline.id, plan_id: id("Retired") }, { token: dana.token })).status).toBe(404)
    expect((await callFunction("billing", { action: "checkout", client_id: northline.id, plan_id: id("Not connected") }, { token: dana.token })).status).toBe(409)
  })

  it("becomes active when Stripe confirms the payment", async () => {
    await resetMockTavus({ stripe: stripeState({ sub_1: subscription() }), deployments: (await mockTavusState()).deployments })
    const res = await stripeEvent("checkout.session.completed", { id: "cs_mock1", customer: "cus_mock1", subscription: "sub_1", metadata: { client_id: northline.id, plan_id: small } }, { id: "evt_checkout" })
    expect(res).toMatchObject({ status: 200, body: { ok: true } })
    const billing = await billingOf(northline.id)
    expect(billing).toMatchObject({ status: "active", stripe_subscription_id: "sub_1", plan_id: small, cancel_at_period_end: false })
    expect(Date.parse(billing.current_period_end)).toBe((NOW + 20 * DAY) * 1000)
    expect(await clientStatus(northline.id)).toBe("active")
  })

  it("ignores events that are not signed by Stripe, are stale, or were already handled", async () => {
    const object = subscription({ status: "past_due" })
    expect((await stripeEvent("customer.subscription.updated", object, { secret: "wrong" })).status).toBe(401)
    expect((await stripeEvent("customer.subscription.updated", object, { at: NOW - 3600 })).status).toBe(401)
    expect((await billingOf(northline.id)).status).toBe("active")
    expect((await stripeEvent("checkout.session.completed", {}, { id: "evt_checkout" })).body).toMatchObject({ duplicate: true })
  })
})

describe("who can see and change billing", () => {
  it("shows the summary to people with the billing permission for that client only", async () => {
    const mine = await summary(dana)
    expect(mine.data).toMatchObject({ status: "active", plan: { name: "Small", monthly_price_cents: 10000, included_minutes: 10 }, used_seconds: 0, included_seconds: 600, used_percent: 0, cancel_at_period_end: false, paused_for_usage: false })
    expect((await summary(lee)).error?.message).toMatch(/permission/)
    expect((await summary(pat)).error?.message).toMatch(/permission/)
    expect((await summary(owner)).data).toMatchObject({ status: "active" })
    expect((await lee.client.from("client_billing").select("client_id")).data).toEqual([])
    expect((await pat.client.from("client_billing").select("client_id")).data).toEqual([])
    expect((await dana.client.from("client_billing").select("client_id")).data).toEqual([{ client_id: northline.id }])
  })

  it("lets only people who manage billing act, and never for another client", async () => {
    for (const action of ["checkout", "portal", "change_plan", "cancel", "resume"]) {
      expect((await callFunction("billing", { action, client_id: northline.id, plan_id: large }, { token: lee.token })).status).toBe(403)
      expect((await callFunction("billing", { action, client_id: northline.id, plan_id: large }, { token: pat.token })).status).toBe(403)
    }
    expect((await callFunction("billing", { action: "cancel", client_id: northline.id })).status).toBe(401)
    expect((await dana.client.from("client_billing").update({ status: "active", plan_id: large }).eq("client_id", northline.id).select()).error).not.toBeNull()
  })

  it("can be given to another role: a client member allowed to see billing", async () => {
    const { data: role } = await admin.from("roles").select("id").eq("key", "client_member").single()
    await admin.from("role_permissions").insert({ role_id: role!.id, permission: "billing.view" })
    expect((await summary(lee)).data).toMatchObject({ status: "active" })
    expect((await callFunction("billing", { action: "cancel", client_id: northline.id }, { token: lee.token })).status).toBe(403)
    await admin.from("role_permissions").delete().match({ role_id: role!.id, permission: "billing.view" })
  })

  it("opens Stripe's page for the payment method and invoices", async () => {
    const res = await callFunction("billing", { action: "portal", client_id: northline.id }, { token: dana.token })
    expect(res.body.url).toMatch(/^https:\/\/billing\.stripe\.test\//)
    expect((await mockTavusState()).stripe.portals[0]).toMatchObject({ customer: "cus_mock1", return_url: "http://127.0.0.1:5180/c/northline/billing" })
    expect((await callFunction("billing", { action: "portal", client_id: harbor.id }, { token: pat.token })).status).toBe(409)
  })
})

describe("usage against the allowance", () => {
  it("does nothing below the alert level", async () => {
    await talk(300) // 5 of 10 minutes
    expect((await callFunction("usage-check", {}, CRON)).body).toMatchObject({ checked: 1, alerted: 0, paused: 0, resumed: 0 })
    expect((await mockTavusState()).emails).toEqual([])
  })

  it("emails one warning at 90%, to the client's billing contacts and the Owner, and never repeats it", async () => {
    await admin.from("profiles").update({ phone: "+15555550123" }).eq("id", dana.id)
    await talk(252) // 9.2 of 10 minutes
    expect((await summary(dana)).data).toMatchObject({ used_seconds: 552, used_percent: 92 })
    expect((await callFunction("usage-check", {}, CRON)).body).toMatchObject({ alerted: 1, paused: 0 })
    const toDana = await emailsTo("dana@northline.test")
    expect(toDana).toHaveLength(1)
    expect(toDana[0].subject).toBe("You have used 92% of this period's minutes (Northline Realty)")
    expect(toDana[0].text).toContain("9 of the 10 minutes included in your Small package")
    expect(toDana[0].text).toContain("http://127.0.0.1:5180/c/northline/billing")
    expect((await emailsTo("owner@divigner.test"))[0].text).toContain("Northline Realty has used 9 of 10 minutes (92%)")
    expect(await emailsTo("lee@northline.test")).toEqual([]) // not a billing contact
    expect(await emailsTo("pat@harbor.test")).toEqual([])

    expect((await callFunction("usage-check", {}, CRON)).body).toMatchObject({ alerted: 0 })
    expect((await mockTavusState()).emails).toHaveLength(2)
    expect(await clientStatus(northline.id)).toBe("active")
  })

  it("records the text message as not sent, until a text provider is connected", async () => {
    const { data } = await admin.from("notifications").select("channel, recipient, status, detail").eq("kind", "usage_alert").order("channel")
    expect(data).toContainEqual({ channel: "sms", recipient: "+15555550123", status: "skipped", detail: "Text messages are not set up yet" })
    expect(data!.filter((n) => n.channel === "email").every((n) => n.status === "sent")).toBe(true)
  })

  it("pauses the avatars when the minutes run out, and says so", async () => {
    await talk(60) // 10.2 of 10 minutes
    expect((await callFunction("usage-check", {}, CRON)).body).toMatchObject({ paused: 1 })
    expect(await clientStatus(northline.id)).toBe("paused")
    const tavus = await mockTavusState()
    expect(tavus.deploymentPatches.map((p) => p.deployment_id).sort()).toEqual(["d-maya-embed", "d-maya-widget", "d-theo-embed"])
    expect(tavus.deploymentPatches[0].ops).toEqual([{ op: "replace", path: "/status", value: "inactive" }])
    expect(tavus.deployments.find((d) => d.deployment_id === "d-harbor-embed")!.status).toBe("active") // another client's avatar
    expect((await summary(dana)).data).toMatchObject({ paused_for_usage: true })
    const mail = (await emailsTo("dana@northline.test")).at(-1)!
    expect(mail.subject).toContain("Your avatars are paused")
    expect(mail.text).toContain("choose a larger package")
    // Running it again does not pause or email twice.
    expect((await callFunction("usage-check", {}, CRON)).body).toMatchObject({ paused: 0, alerted: 0 })
    expect((await mockTavusState()).deploymentPatches).toHaveLength(3)
  })

  it("can only be run by the schedule or by staff who manage packages", async () => {
    expect((await callFunction("usage-check", {})).status).toBe(401)
    expect((await callFunction("usage-check", {}, { token: dana.token })).status).toBe(403)
    expect((await callFunction("usage-check", {}, { token: owner.token })).status).toBe(200)
  })
})

describe("changing package and cancelling", () => {
  it("moving to a larger package takes effect at once and turns the avatars back on", async () => {
    const res = await callFunction("billing", { action: "change_plan", client_id: northline.id, plan_id: large }, { token: dana.token })
    expect(res).toMatchObject({ status: 200, body: { resumed: true } })
    const tavus = await mockTavusState()
    const call = tavus.stripe.calls.find((c) => c.method === "POST" && c.path === "/subscriptions/sub_1")!
    expect(call.form).toMatchObject({ "items[0][id]": "si_1", "items[0][price]": "price_large", proration_behavior: "create_prorations" })
    expect(tavus.deployments.filter((d) => ["d-maya-embed", "d-maya-widget", "d-theo-embed"].includes(d.deployment_id)).every((d) => d.status === "active")).toBe(true)
    expect(await clientStatus(northline.id)).toBe("active")
    expect((await summary(dana)).data).toMatchObject({ plan: { name: "Large" }, paused_for_usage: false, used_percent: 10.2 })
    const subjects = (await emailsTo("dana@northline.test")).map((e) => e.subject)
    expect(subjects).toContain("Your package is now Large (Northline Realty)")
    expect(subjects).toContain("Your avatars are back on (Northline Realty)")
    expect((await emailsTo("owner@divigner.test")).some((e) => e.text.includes("changed package from Small to Large"))).toBe(true)
    expect((await callFunction("billing", { action: "change_plan", client_id: northline.id, plan_id: large }, { token: dana.token })).status).toBe(409)
  })

  it("cancelling keeps the service to the end of the paid period and tells the Owner why", async () => {
    const res = await callFunction("billing", { action: "cancel", client_id: northline.id, reason: "We are closing the downtown office." }, { token: dana.token })
    expect(res.status).toBe(200)
    expect(Date.parse(res.body.ends_at)).toBe((NOW + 20 * DAY) * 1000)
    expect((await mockTavusState()).stripe.calls.at(-1)!.form).toMatchObject({ cancel_at_period_end: "true" })
    expect(await billingOf(northline.id)).toMatchObject({ status: "active", cancel_at_period_end: true, cancel_reason: "We are closing the downtown office." })
    expect(await clientStatus(northline.id)).toBe("active") // still running
    const toOwner = (await emailsTo("owner@divigner.test")).at(-1)!
    expect(toOwner.text).toContain("Northline Realty cancelled their subscription")
    expect(toOwner.text).toContain("Cancelled by: dana@northline.test")
    expect(toOwner.text).toContain("We are closing the downtown office.")
    expect((await emailsTo("dana@northline.test")).at(-1)!.text).toContain("you will not be charged again")
    const { data: log } = await admin.from("audit_log").select("actor_id").eq("action", "subscription.cancel_requested")
    expect(log).toEqual([{ actor_id: dana.id }])
  })

  it("a cancellation can be undone before it takes effect", async () => {
    expect((await callFunction("billing", { action: "resume", client_id: northline.id }, { token: dana.token })).status).toBe(200)
    expect(await billingOf(northline.id)).toMatchObject({ cancel_at_period_end: false, cancel_reason: null, cancel_requested_at: null })
    expect((await callFunction("billing", { action: "resume", client_id: northline.id }, { token: dana.token })).status).toBe(409)
  })

  it("changes nothing when Stripe fails", async () => {
    const state = await mockTavusState()
    await resetMockTavus({ deployments: state.deployments, stripe: { ...state.stripe, failNext: 1 } })
    const res = await callFunction("billing", { action: "cancel", client_id: northline.id }, { token: dana.token })
    expect(res.status).toBe(502)
    expect(res.body.error).toMatch(/Nothing was changed/)
    expect((await billingOf(northline.id)).cancel_at_period_end).toBe(false)
  })
})

describe("invoices and the end of a subscription", () => {
  const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: "in_1", customer: "cus_mock1", number: "DIV-0001", status: "paid", amount_due: 10000, amount_paid: 10000, currency: "usd",
    hosted_invoice_url: "https://invoice.stripe.test/i/in_1", invoice_pdf: "https://invoice.stripe.test/i/in_1/pdf", period_start: NOW - 10 * DAY, period_end: NOW + 20 * DAY, created: NOW - 10 * DAY, ...overrides,
  })

  it("keeps a copy of each invoice, visible only to that client's billing people", async () => {
    await stripeEvent("invoice.finalized", invoice({ status: "open", amount_paid: 0 }))
    await stripeEvent("invoice.paid", invoice())
    await stripeEvent("invoice.created", invoice({ id: "in_draft", status: "draft", number: null }))
    const mine = await dana.client.from("invoices").select("id, number, status, amount_paid_cents, hosted_invoice_url")
    expect(mine.data).toEqual([{ id: "in_1", number: "DIV-0001", status: "paid", amount_paid_cents: 10000, hosted_invoice_url: "https://invoice.stripe.test/i/in_1" }])
    expect((await lee.client.from("invoices").select("id")).data).toEqual([])
    expect((await pat.client.from("invoices").select("id")).data).toEqual([])
  })

  it("emails the client and the Owner when a payment fails", async () => {
    await stripeEvent("invoice.payment_failed", invoice({ id: "in_2", number: "DIV-0002", status: "open", amount_paid: 0 }))
    expect((await emailsTo("dana@northline.test")).at(-1)!.subject).toBe("A payment did not go through (Northline Realty)")
    expect((await emailsTo("owner@divigner.test")).at(-1)!.text).toContain("A payment failed for Northline Realty (invoice DIV-0002)")
  })

  it("a new billing period starts the allowance again", async () => {
    await stripeEvent("customer.subscription.updated", subscription({ items: { data: [{ id: "si_1", price: { id: "price_large" }, current_period_start: NOW + 1, current_period_end: NOW + 30 * DAY }] } }))
    // The calls above were before this period began, so nothing is used yet.
    expect((await summary(dana)).data).toMatchObject({ used_seconds: 0, used_percent: 0, plan: { name: "Large" } })
  })

  it("when the subscription ends, the avatars are turned off and the client is marked cancelled", async () => {
    const res = await stripeEvent("customer.subscription.deleted", subscription({ status: "canceled" }))
    expect(res.status).toBe(200)
    expect(await billingOf(northline.id)).toMatchObject({ status: "cancelled" })
    expect(await clientStatus(northline.id)).toBe("cancelled")
    const tavus = await mockTavusState()
    expect(tavus.deployments.filter((d) => ["d-maya-embed", "d-maya-widget", "d-theo-embed"].includes(d.deployment_id)).every((d) => d.status === "inactive")).toBe(true)
    expect((await emailsTo("dana@northline.test")).at(-1)!.subject).toBe("Your subscription has ended (Northline Realty)")
    expect((await summary(dana)).data).toMatchObject({ status: "cancelled", has_subscription: false })
    // They can subscribe again.
    expect((await callFunction("billing", { action: "checkout", client_id: northline.id, plan_id: small }, { token: dana.token })).status).toBe(200)
  })
})
