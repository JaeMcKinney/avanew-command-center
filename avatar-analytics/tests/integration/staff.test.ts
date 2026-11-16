// The staff side added for Divigner: the avatar detail read from Tavus, the
// client file (contacts and notes), the finance summary, logo uploads, the
// invoice download, and custom amounts for extra minutes.

import { unzipSync, strFromU8 } from "fflate"
import { beforeAll, describe, expect, it } from "vitest"
import {
  admin, ANON_KEY, callFunction, createClientRow, createUser, FUNCTIONS_URL, resetDatabase, resetMockTavus, type TestUser,
} from "./helpers"

let owner: TestUser, manager: TestUser, analyst: TestUser, dana: TestUser, pat: TestUser
let northline: { id: string }, harbor: { id: string }
let plan: string
const today = new Date().toISOString().slice(0, 10)
const monthStart = `${today.slice(0, 8)}01`

beforeAll(async () => {
  resetDatabase()
  await admin.storage.emptyBucket("logos")
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  northline = await createClientRow(owner, "Northline Realty", "northline")
  harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental")
  manager = await createUser({ email: "manager@divigner.test", role: "manager" })
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  dana = await createUser({ email: "dana@northline.test", role: "client_admin", clientId: northline.id })
  pat = await createUser({ email: "pat@harbor.test", role: "client_admin", clientId: harbor.id })
  await admin.from("staff_client_assignments").insert({ user_id: manager.id, client_id: northline.id })
  await callFunction("tavus-sync", {}, { token: owner.token })
  await callFunction("avatar-link", { action: "link", client_id: northline.id, pals: [{ pal_id: "p3a91c0de01", display_name: "Maya" }] }, { token: owner.token })
  const created = await owner.client.from("plans").insert({ name: "Growth", monthly_price_cents: 40000, included_minutes: 1000, max_concurrent: 3, stripe_price_id: "price_growth", is_active: true, sort: 1 }).select("id").single()
  plan = created.data!.id
  await admin.from("client_billing").insert({ client_id: northline.id, plan_id: plan, status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", current_period_start: `${monthStart}T00:00:00Z`, current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString() })
})

describe("an avatar's details, read from Tavus", () => {
  it("returns the prompt, face, knowledge, guardrails, objectives, tools and skills", async () => {
    const res = await callFunction("tavus-pal", { pal_id: "p3a91c0de01" }, { token: owner.token })
    expect(res.status).toBe(200)
    const b = res.body
    expect(b.pal).toMatchObject({ pal_id: "p3a91c0de01", default_face_id: "r3a91c0de01", greeting: "Hi, how can I help today?" })
    expect(b.pal.system_prompt).toContain("You are Maya")
    expect(b.face).toMatchObject({ ok: true, data: { face_id: "r3a91c0de01", model_name: "phoenix-4.5" } })
    expect(b.tools.data.map((t: { name: string }) => t.name)).toEqual(["book_tour", "end_call"])
    expect(b.skills.data).toHaveProperty("web_search")
    expect(b.objectives.data.data).toMatchObject({ objective_name: "book_a_tour" })
    expect(b.guardrails).toEqual([expect.objectContaining({ id: "g-no-legal", ok: true, data: expect.objectContaining({ guardrail_prompt: "Never give legal or financial advice." }) })])
    expect(b.guardrail_tags).toEqual(["compliance"])
    expect(b.linked).toMatchObject({ display_name: "Maya", clients: { slug: "northline" } })
    expect(b.deployments.map((d: { deployment_id: string }) => d.deployment_id).sort()).toEqual(["d-maya-embed", "d-maya-widget"])
  })

  it("shows a missing piece as missing, without failing the rest", async () => {
    const { body } = await callFunction("tavus-pal", { pal_id: "p3a91c0de01" }, { token: owner.token })
    expect(body.documents).toEqual([
      expect.objectContaining({ id: "d-kb-hours", ok: true, data: expect.objectContaining({ document_name: "Office hours and policies", status: "ready" }) }),
      expect.objectContaining({ id: "d-kb-gone", ok: false }),
    ])
  })

  it("never sends keys, tokens or header values to the browser", async () => {
    const res = await callFunction("tavus-pal", { pal_id: "p3a91c0de01" }, { token: owner.token })
    const text = JSON.stringify(res.body)
    for (const secret of ["sk-should-never-be-shown", "hidden-header-value", "tts-secret-value", "tool-secret-value"]) expect(text).not.toContain(secret)
    expect(res.body.pal.layers.llm).toMatchObject({ model: "tavus-auto", api_key: "(hidden)", headers: { Authorization: "(hidden)" } })
  })

  it("is for staff who work with avatars only", async () => {
    expect((await callFunction("tavus-pal", { pal_id: "p3a91c0de01" }, { token: dana.token })).status).toBe(403)
    expect((await callFunction("tavus-pal", { pal_id: "p3a91c0de01" }, { token: analyst.token })).status).toBe(403)
    expect((await callFunction("tavus-pal", { pal_id: "p3a91c0de01" })).status).toBe(401)
    expect((await callFunction("tavus-pal", { pal_id: "pdoesnotexist" }, { token: owner.token })).status).toBe(404)
    expect((await callFunction("tavus-pal", { pal_id: "../faces/x" }, { token: owner.token })).status).toBe(400)
  })
})

describe("the client file", () => {
  it("lets staff keep contacts and notes, and clients never see them", async () => {
    const contact = await owner.client.from("client_contacts").insert({ client_id: northline.id, full_name: "Morgan Hale", title: "Operations lead", email: "morgan@northline.test", phone: "555-0100", is_primary: true, created_by: owner.id }).select("id").single()
    expect(contact.error).toBeNull()
    const note = await owner.client.from("client_notes").insert({ client_id: northline.id, body: "Kick-off call went well. Wants a second avatar in Q1.", kind: "call", author_id: owner.id }).select("id").single()
    expect(note.error).toBeNull()
    expect((await dana.client.from("client_contacts").select("id")).data).toEqual([])
    expect((await dana.client.from("client_notes").select("id")).data).toEqual([])
    expect((await dana.client.from("client_notes").insert({ client_id: northline.id, body: "x", author_id: dana.id })).error).not.toBeNull()
    expect((await dana.client.rpc("crm_clients")).data).toEqual([])
  })

  it("managers work only on the clients assigned to them, and analysts can read but not write", async () => {
    expect((await manager.client.from("client_notes").insert({ client_id: northline.id, body: "Follow up on the logo.", author_id: manager.id })).error).toBeNull()
    expect((await manager.client.from("client_notes").insert({ client_id: harbor.id, body: "x", author_id: manager.id })).error).not.toBeNull()
    expect((await manager.client.from("client_notes").select("id")).data).toHaveLength(2)
    expect((await analyst.client.from("client_notes").select("id")).data).toHaveLength(2)
    expect((await analyst.client.from("client_notes").insert({ client_id: northline.id, body: "x", author_id: analyst.id })).error).not.toBeNull()
    // Nobody can sign a note as someone else.
    expect((await manager.client.from("client_notes").insert({ client_id: northline.id, body: "x", author_id: owner.id })).error).not.toBeNull()
    // A manager can change their own note but not the Owner's.
    const { data: notes } = await admin.from("client_notes").select("id, author_id")
    const ownersNote = notes!.find((n) => n.author_id === owner.id)!.id
    expect((await manager.client.from("client_notes").update({ body: "edited" }).eq("id", ownersNote).select()).data).toEqual([])
    expect((await manager.client.from("client_notes").delete().eq("id", ownersNote).select()).data).toEqual([])
  })

  it("gives one row per client for the CRM list", async () => {
    const { data } = await owner.client.rpc("crm_clients")
    const rows = data as Array<Record<string, unknown>>
    expect(rows.map((r) => r.name)).toEqual(["Harbor Dental", "Northline Realty"])
    expect(rows[1]).toMatchObject({ plan: "Growth", monthly_price_cents: 40000, billing_status: "active", avatars: 1, users: 1, contacts: 1, notes: 2, primary_contact: { full_name: "Morgan Hale", email: "morgan@northline.test" } })
    expect(rows[0]).toMatchObject({ plan: null, monthly_price_cents: 0, billing_status: "none", contacts: 0, primary_contact: null })
    expect(((await manager.client.rpc("crm_clients")).data as unknown[]).length).toBe(1)
  })

  it("lets staff with the permission edit account details, and nobody else", async () => {
    expect((await owner.client.from("clients").update({ website: "https://northlinerealty.example", industry: "Real estate", account_manager_id: manager.id }).eq("id", northline.id).select("website")).data).toEqual([{ website: "https://northlinerealty.example" }])
    expect((await dana.client.from("clients").update({ industry: "x" }).eq("id", northline.id).select()).data ?? []).toEqual([])
  })
})

describe("uploaded logos", () => {
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" })
  it("can be added by staff who manage clients, are public to read, and must be PNG", async () => {
    const path = `${northline.id}/logo-test.png`
    expect((await owner.client.storage.from("logos").upload(path, png, { contentType: "image/png" })).error).toBeNull()
    const url = owner.client.storage.from("logos").getPublicUrl(path).data.publicUrl
    expect((await fetch(url)).status).toBe(200)
    expect((await owner.client.from("clients").update({ logo_url: url }).eq("id", northline.id).select("id")).data).toHaveLength(1)
    expect((await owner.client.storage.from("logos").upload(`${northline.id}/x.svg`, new Blob(["<svg/>"], { type: "image/svg+xml" }), { contentType: "image/svg+xml" })).error).not.toBeNull()
  })
  it("cannot be added by clients, or by a manager for a client that is not theirs", async () => {
    expect((await dana.client.storage.from("logos").upload(`${northline.id}/mine.png`, png, { contentType: "image/png" })).error).not.toBeNull()
    expect((await manager.client.storage.from("logos").upload(`${harbor.id}/theirs.png`, png, { contentType: "image/png" })).error).not.toBeNull()
  })
})

describe("extra minutes for a custom amount", () => {
  it("accepts any whole-dollar amount in the allowed range, priced from the package", async () => {
    // Growth: $400 for 1,000 minutes, so 2.5 minutes a dollar.
    expect((await dana.client.rpc("topup_custom_rule", { p_client_id: northline.id })).data).toMatchObject({ min_cents: 500, max_cents: 50000, minutes_per_dollar: 2.5 })
    const res = await callFunction("billing", { action: "topup", client_id: northline.id, amount_cents: 3700 }, { token: dana.token })
    expect(res).toMatchObject({ status: 200, body: { minutes: 92 } })
  })
  it("refuses amounts outside the range or with cents, and can be turned off", async () => {
    for (const amount of [400, 50100, 3750, -1000]) {
      expect((await callFunction("billing", { action: "topup", client_id: northline.id, amount_cents: amount }, { token: dana.token })).status).toBe(400)
    }
    await admin.from("settings").update({ value: 0 }).eq("key", "billing.topup_custom_min_cents")
    expect((await callFunction("billing", { action: "topup", client_id: northline.id, amount_cents: 3700 }, { token: dana.token })).status).toBe(400)
    expect((await callFunction("billing", { action: "topup", client_id: northline.id, amount_cents: 2000 }, { token: dana.token })).status).toBe(200) // listed amounts still work
    expect((await dana.client.rpc("topup_custom_rule", { p_client_id: northline.id })).data).toBeNull()
    await admin.from("settings").update({ value: 500 }).eq("key", "billing.topup_custom_min_cents")
    expect((await pat.client.rpc("topup_custom_rule", { p_client_id: northline.id })).data).toBeNull()
  })
})

describe("money", () => {
  beforeAll(async () => {
    await admin.from("invoices").insert([
      { id: "in_a", client_id: northline.id, number: "A-1", status: "paid", amount_due_cents: 40000, amount_paid_cents: 40000, invoice_pdf: "https://invoice.stripe.test/i/in_a/pdf", hosted_invoice_url: "https://invoice.stripe.test/i/in_a", issued_at: `${monthStart}T12:00:00Z` },
      { id: "in_b", client_id: northline.id, number: "A-2", status: "open", amount_due_cents: 40000, amount_paid_cents: 0, invoice_pdf: "https://evil.example/steal.pdf", issued_at: `${today}T01:00:00Z` },
      { id: "in_c", client_id: harbor.id, number: "H-1", status: "paid", amount_due_cents: 10000, amount_paid_cents: 10000, issued_at: `${monthStart}T12:00:00Z` },
    ])
    await admin.from("usage_topups").insert({ client_id: northline.id, amount_cents: 5000, minutes: 125, status: "paid", period_start: `${monthStart}T00:00:00Z`, period_end: new Date(Date.now() + 86_400_000).toISOString(), paid_at: `${monthStart}T15:00:00Z` })
    await admin.from("usage_daily").insert({ client_id: northline.id, avatar_id: (await admin.from("avatars").select("id").single()).data!.id, usage_date: monthStart, conversations: 4, talk_seconds: 12000, billable_seconds: 12000 })
    await admin.from("settings").update({ value: 30 }).eq("key", "finance.cost_per_minute_cents")
    await admin.from("settings").update({ value: 5000 }).eq("key", "finance.fixed_monthly_cost_cents")
  })

  it("adds up recurring revenue, extra-minute sales, usage cost and what recurs monthly", async () => {
    const { data, error } = await owner.client.rpc("finance_summary", { p_from: monthStart, p_to: today })
    expect(error).toBeNull()
    const f = data as any
    expect(f).toMatchObject({ mrr_cents: 40000, subscribers: 1, cost_per_minute_cents: 30, fixed_monthly_cost_cents: 5000 })
    expect(f.months).toEqual([{ month: monthStart, subscription_cents: 50000, extra_cents: 5000, addon_cents: 0, minutes: 200, usage_cost_cents: 6000, fixed_cost_cents: 5000 }])
    expect(f.clients).toEqual([
      { id: northline.id, name: "Northline Realty", slug: "northline", subscription_cents: 40000, extra_cents: 5000, minutes: 200, usage_cost_cents: 6000 },
      { id: harbor.id, name: "Harbor Dental", slug: "harbor-dental", subscription_cents: 10000, extra_cents: 0, minutes: 0, usage_cost_cents: 0 },
    ])
  })

  it("is only for people allowed to see finances, and a manager sees only their clients", async () => {
    expect((await dana.client.rpc("finance_summary", { p_from: monthStart, p_to: today })).error?.message).toMatch(/permission/)
    expect((await analyst.client.rpc("finance_summary", { p_from: monthStart, p_to: today })).error?.message).toMatch(/permission/)
    const { data: role } = await admin.from("roles").select("id").eq("key", "manager").single()
    await admin.from("role_permissions").insert({ role_id: role!.id, permission: "finance.view" })
    const mine = (await manager.client.rpc("finance_summary", { p_from: monthStart, p_to: today })).data as any
    expect(mine.clients.map((c: { name: string }) => c.name)).toEqual(["Northline Realty"])
    await admin.from("role_permissions").delete().match({ role_id: role!.id, permission: "finance.view" })
  })

  const exportInvoices = (user: TestUser | null, clientId: string, from = monthStart, to = today) =>
    fetch(`${FUNCTIONS_URL}/invoice-export`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON_KEY, ...(user ? { Authorization: `Bearer ${user.token}` } : {}) }, body: JSON.stringify({ client_id: clientId, from, to }) })

  it("downloads a period's invoices as one ZIP with a summary", async () => {
    await fetch("http://127.0.0.1:54398/__control/reset", { method: "POST" })
    const res = await exportInvoices(dana, northline.id)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-disposition")).toContain(`northline-invoices-${monthStart}-to-${today}.zip`)
    expect(res.headers.get("x-invoices")).toBe("2")
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    expect(Object.keys(files).sort()).toContain("invoices-summary.csv")
    const csv = strFromU8(files["invoices-summary.csv"])
    expect(csv).toContain("A-1,")
    expect(csv).toContain("A-2,")
    expect(csv).not.toContain("H-1")
    // A PDF address that is not Stripe's is never fetched.
    expect(Object.keys(files)).not.toContain("A-2.pdf")
  })

  it("refuses other clients, people without the billing permission, and empty periods", async () => {
    expect((await exportInvoices(pat, northline.id)).status).toBe(403)
    expect((await exportInvoices(null, northline.id)).status).toBe(401)
    expect((await exportInvoices(dana, northline.id, "2020-01-01", "2020-01-31")).status).toBe(404)
    expect((await exportInvoices(dana, northline.id, today, monthStart === today ? "2020-01-01" : monthStart)).status).toBe(400)
  })
})
