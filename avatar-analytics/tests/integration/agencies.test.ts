// Agencies: Divigner creates them, each runs its own clients with its own
// staff, and nothing crosses between Divigner, one agency and another. Divigner
// sees what an agency uses as totals, never its clients' names.

import { execFileSync } from "node:child_process"
import { beforeAll, describe, expect, it } from "vitest"
import {
  admin, anonClient, callFunction, createClientRow, createUser, resetDatabase, resetMockTavus, seedAvatar, type TestUser,
} from "./helpers"

const MODE = { background: "#edf1f7", card: "#f8fafd", text: "#0b1f3a", action: "#1d3a66", action_text: "#ffffff", highlight: "#d4af4c", sidebar: "#0a1a30" }
const THEME = { motion: true, light: MODE, dark: { ...MODE, background: "#0b1828", card: "#10223a", text: "#e6ecf5", action: "#d9b95c", action_text: "#0b1f3a" } }

let owner: TestUser, analyst: TestUser
let avaOwner: TestUser, avaManager: TestUser, otherOwner: TestUser
let lakesideAdmin: TestUser, northlineAdmin: TestUser
let avanew: { id: string }, otherAgency: { id: string }
let northline: { id: string }, lakeside: { id: string }, hillcrest: { id: string }, rivalClient: { id: string }

const today = new Date().toISOString().slice(0, 10)
/** The rows of a query, failing loudly if the query itself was refused. */
async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}
const must = <T,>(res: { data: T; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data
}
const names = async (user: TestUser) => ((await user.client.from("clients").select("name").order("name")).data ?? []).map((c) => c.name)

beforeAll(async () => {
  resetDatabase()
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  northline = await createClientRow(owner, "Northline Realty", "northline")
  northlineAdmin = await createUser({ email: "dana@northline.test", role: "client_admin", clientId: northline.id })
})

describe("creating an agency", () => {
  it("is for Divigner's agency managers", async () => {
    const made = await owner.client.rpc("create_agency", { p_name: "Avanew", p_slug: "avanew", p_domain: "Avalytics.Apps.Avanew.test", p_theme: THEME, p_payment_model: "subscription", p_fee_cents: 12300 })
    expect(made.error).toBeNull()
    avanew = made.data
    expect(made.data.domain).toBe("avalytics.apps.avanew.test")
    expect((await analyst.client.rpc("create_agency", { p_name: "Nope", p_slug: "nope" })).error?.code).toBe("42501")
    expect((await northlineAdmin.client.rpc("create_agency", { p_name: "Nope", p_slug: "nope" })).error?.code).toBe("42501")
    const second = await owner.client.rpc("create_agency", { p_name: "Brightside Media", p_slug: "brightside" })
    otherAgency = second.data
  })

  it("refuses a look that is anything but colours", async () => {
    for (const bad of [
      { ...THEME, light: { ...MODE, action: "red; } body { display: none" } },
      { ...THEME, light: { ...MODE, extra: "#000000" } },
      { ...THEME, dark: { background: "#000000" } },
      { ...THEME, motion: "yes" },
      { ...THEME, script: "x" },
    ]) {
      const res = await owner.client.rpc("create_agency", { p_name: "Bad", p_slug: `bad-${Math.random().toString(36).slice(2, 8)}`, p_theme: bad })
      expect(res.error, JSON.stringify(bad)).not.toBeNull()
    }
  })

  it("gives the agency its first Owner by invitation, from Divigner", async () => {
    const ownerRole = (await admin.from("roles").select("id").eq("key", "owner").single()).data!.id
    const denied = await callFunction("user-invite", { email: "x@avanew.test", full_name: "X", role_id: ownerRole, agency_id: avanew.id }, { token: analyst.token })
    expect(denied.status).toBe(403)
    const res = await callFunction("user-invite", { email: "Ava@Avanew.test", full_name: "Ava Lead", role_id: ownerRole, agency_id: avanew.id }, { token: owner.token })
    expect(res.status).toBe(200)
    const profile = (await admin.from("profiles").select("side, agency_id").eq("email", "ava@avanew.test").single()).data
    expect(profile).toEqual({ side: "divigner", agency_id: avanew.id })
    // The invited person has no password yet in a test, so the rest of the file uses directly created users.
    await admin.auth.admin.deleteUser(res.body.user_id)
    avaOwner = await createUser({ email: "ava@avanew.test", role: "owner", agencyId: avanew.id })
    otherOwner = await createUser({ email: "bo@brightside.test", role: "owner", agencyId: otherAgency.id })
  })
})

describe("an agency's own staff", () => {
  it("create clients that belong to the agency", async () => {
    lakeside = await createClientRow(avaOwner, "Lakeside Family Practice", "lakeside")
    hillcrest = await createClientRow(avaOwner, "Hillcrest Pediatrics", "hillcrest")
    rivalClient = await createClientRow(otherOwner, "Rival Roofing", "rival-roofing")
    const row = (await admin.from("clients").select("agency_id").eq("id", lakeside.id).single()).data
    expect(row?.agency_id).toBe(avanew.id)
    expect((await admin.from("clients").select("agency_id").eq("id", northline.id).single()).data?.agency_id).toBeNull()
    lakesideAdmin = await createUser({ email: "lee@lakeside.test", role: "client_admin", clientId: lakeside.id })
  })

  it("see their own clients and nobody else's", async () => {
    expect(await names(avaOwner)).toEqual(["Hillcrest Pediatrics", "Lakeside Family Practice"])
    expect(await names(otherOwner)).toEqual(["Rival Roofing"])
    expect(await names(owner)).toEqual(["Northline Realty"])
    expect(await names(analyst)).toEqual(["Northline Realty"])
    const crm = async (user: TestUser) => ((await user.client.rpc("crm_clients")).data ?? []).map((c: { name: string }) => c.name)
    expect(await crm(avaOwner)).toEqual(["Hillcrest Pediatrics", "Lakeside Family Practice"])
    expect(await crm(owner)).toEqual(["Northline Realty"])
  })

  it("invite their own team, which joins the agency and no other", async () => {
    const managerRole = (await admin.from("roles").select("id").eq("key", "manager").single()).data!.id
    const res = await callFunction("user-invite", { email: "max@avanew.test", full_name: "Max", role_id: managerRole, assigned_client_ids: [lakeside.id, northline.id, rivalClient.id] }, { token: avaOwner.token })
    expect(res.status).toBe(200)
    expect((await admin.from("profiles").select("agency_id").eq("id", res.body.user_id).single()).data?.agency_id).toBe(avanew.id)
    // Only the agency's own client was assigned; Divigner's and the other agency's were dropped.
    expect(((await admin.from("staff_client_assignments").select("client_id").eq("user_id", res.body.user_id)).data ?? []).map((a) => a.client_id)).toEqual([lakeside.id])
    await admin.auth.admin.deleteUser(res.body.user_id)
    avaManager = await createUser({ email: "max@avanew.test", role: "manager", agencyId: avanew.id, assignedClientIds: [lakeside.id] })
    expect(await names(avaManager)).toEqual(["Lakeside Family Practice"])

    const cross = await callFunction("user-invite", { email: "spy@avanew.test", full_name: "Spy", role_id: managerRole, agency_id: otherAgency.id }, { token: avaOwner.token })
    expect(cross.status).toBe(403)
  })

  it("see their own team list only", async () => {
    const team = async (user: TestUser) => ((await user.client.from("profiles").select("email").eq("side", "divigner").order("email")).data ?? []).map((p) => p.email)
    expect(await team(avaOwner)).toEqual(["ava@avanew.test", "max@avanew.test"])
    expect(await team(owner)).toEqual(["analyst@divigner.test", "owner@divigner.test"])
    expect(await team(otherOwner)).toEqual(["bo@brightside.test"])
    // Client users: only those of clients you can open.
    const clientUsers = async (user: TestUser) => ((await user.client.from("profiles").select("email").eq("side", "client").order("email")).data ?? []).map((p) => p.email)
    expect(await clientUsers(avaOwner)).toEqual(["lee@lakeside.test"])
    expect(await clientUsers(owner)).toEqual(["dana@northline.test"])
  })

  it("cannot change people or assignments on another team", async () => {
    const analystRole = (await admin.from("roles").select("id").eq("key", "analyst").single()).data!.id
    expect((await avaOwner.client.rpc("set_user_role", { p_user_id: analyst.id, p_role_id: analystRole })).error?.code).toBe("42501")
    expect((await avaOwner.client.rpc("set_user_active", { p_user_id: owner.id, p_active: false })).error?.code).toBe("42501")
    expect((await owner.client.rpc("set_user_active", { p_user_id: avaManager.id, p_active: false })).error?.code).toBe("42501")
    expect((await avaOwner.client.rpc("set_staff_assignments", { p_user_id: analyst.id, p_client_ids: [lakeside.id] })).error).not.toBeNull()
    expect((await avaOwner.client.rpc("set_staff_assignments", { p_user_id: avaManager.id, p_client_ids: [northline.id] })).error?.code).toBe("42501")
    expect((await avaOwner.client.rpc("set_staff_assignments", { p_user_id: avaManager.id, p_client_ids: [lakeside.id, hillcrest.id] })).error).toBeNull()
    expect((await avaOwner.client.rpc("set_staff_assignments", { p_user_id: avaManager.id, p_client_ids: [lakeside.id] })).error).toBeNull()
  })

  it("keep an Owner of their own, whatever Divigner has", async () => {
    expect((await owner.client.rpc("set_user_active", { p_user_id: avaOwner.id, p_active: false })).error?.code).toBe("42501")
    // Ava is the agency's only Owner. Divigner having an Owner of its own does not make her replaceable.
    const check = (userId: string) =>
      execFileSync("docker", ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-c", `select app.assert_not_last_owner('${userId}')`], { stdio: "pipe" })
    expect(() => check(avaOwner.id)).toThrow(/at least one active Owner/)
    const second = await createUser({ email: "second@avanew.test", role: "owner", agencyId: avanew.id })
    expect(() => check(avaOwner.id)).not.toThrow()
    await admin.auth.admin.deleteUser(second.id)
  })

  it("cannot change the shared roles or Divigner's settings", async () => {
    const adminRole = (await admin.from("roles").select("id").eq("key", "admin").single()).data!.id
    await avaOwner.client.from("role_permissions").delete().eq("role_id", adminRole).eq("permission", "clients.manage")
    expect((await admin.from("role_permissions").select("permission").eq("role_id", adminRole).eq("permission", "clients.manage")).data).toHaveLength(1)
    expect((await avaOwner.client.from("roles").insert({ key: "sneaky", name: "Sneaky", side: "divigner" })).error).not.toBeNull()
    expect((await avaOwner.client.from("settings").select("key")).data).toEqual([])
    expect(((await owner.client.from("settings").select("key")).data ?? []).length).toBeGreaterThan(0)
  })
})

describe("what Divigner can and cannot see of an agency", () => {
  beforeAll(async () => {
    const avatar = await seedAvatar(lakeside.id, "pl00c0de0001", "Dr. Lake")
    await admin.from("tavus_pals").update({ agency_id: avanew.id }).eq("pal_id", "pl00c0de0001")
    must(await admin.from("usage_daily").insert({ avatar_id: avatar.id, client_id: lakeside.id, usage_date: today, conversations: 3, talk_seconds: 1200, billable_seconds: 1200 }))
    must(await admin.from("conversations").insert({ client_id: lakeside.id, avatar_id: avatar.id, conversation_id: "c-lake-1", started_at: new Date().toISOString(), usage_date: today }))
    const own = await seedAvatar(northline.id, "pn00c0de0002", "Nora")
    must(await admin.from("usage_daily").insert({ avatar_id: own.id, client_id: northline.id, usage_date: today, conversations: 1, talk_seconds: 600, billable_seconds: 600 }))
  })

  it("cannot open an agency's client, its people, its usage or its conversations", async () => {
    expect(await rows(owner.client.from("clients").select("id").eq("id", lakeside.id))).toEqual([])
    expect(await rows(owner.client.from("profiles").select("id").eq("client_id", lakeside.id))).toEqual([])
    expect(await rows(owner.client.from("usage_daily").select("client_id").eq("client_id", lakeside.id))).toEqual([])
    expect(await rows(owner.client.from("conversations").select("conversation_id").eq("client_id", lakeside.id))).toEqual([])
    expect(await rows(owner.client.from("avatars").select("id").eq("client_id", lakeside.id))).toEqual([])
    expect((await owner.client.rpc("check_access", { p_permission: "analytics.view", p_client_id: lakeside.id })).data).toBe(false)
    expect((await owner.client.rpc("glass_enable", { p_client_id: lakeside.id, p_enabled: true })).error?.code).toBe("42501")
    expect(await rows(owner.client.from("clients").update({ name: "Taken" }).eq("id", lakeside.id).select("id"))).toEqual([])
    // The agency itself sees all of it.
    expect(await rows(avaOwner.client.from("usage_daily").select("client_id").eq("client_id", lakeside.id))).toHaveLength(1)
    expect(await rows(avaOwner.client.from("conversations").select("conversation_id").eq("client_id", lakeside.id))).toHaveLength(1)
    expect(await rows(owner.client.from("usage_daily").select("client_id"))).toEqual([{ client_id: northline.id }])
  })

  it("and the agency cannot open Divigner's clients either", async () => {
    expect((await avaOwner.client.from("clients").select("id").eq("id", northline.id)).data).toEqual([])
    expect((await avaOwner.client.from("usage_daily").select("client_id").eq("client_id", northline.id)).data).toEqual([])
    expect((await avaOwner.client.rpc("check_access", { p_permission: "analytics.view", p_client_id: northline.id })).data).toBe(false)
    expect((await otherOwner.client.from("clients").select("id").eq("id", lakeside.id)).data).toEqual([])
    expect((await lakesideAdmin.client.from("clients").select("name")).data).toEqual([{ name: "Lakeside Family Practice" }])
  })

  it("sees each agency's totals, with no client or avatar names in them", async () => {
    const res = await owner.client.rpc("agency_usage", { p_from: today, p_to: today })
    expect(res.error).toBeNull()
    const row = (res.data as Record<string, unknown>[]).find((a) => a.slug === "avanew")!
    expect(row, JSON.stringify(row)).toMatchObject({ name: "Avanew", clients: 2, avatars: 1, staff: 2, minutes: 20, conversations: 1, payment_model: "subscription", fee_cents: 12300, has_brand: true })
    const text = JSON.stringify(res.data)
    for (const secret of ["Lakeside", "Hillcrest", "Rival Roofing", "Dr. Lake", "lee@lakeside.test"]) expect(text).not.toContain(secret)
    const days = await owner.client.rpc("agency_usage_by_day", { p_agency_id: avanew.id, p_from: today, p_to: today })
    expect(days.data).toEqual([{ usage_date: today, minutes: 20, conversations: 3 }])
  })

  it("keeps those totals to Divigner's agency managers", async () => {
    for (const user of [analyst, avaOwner, lakesideAdmin, northlineAdmin]) {
      expect((await user.client.rpc("agency_usage", { p_from: today, p_to: today })).error?.code).toBe("42501")
      expect((await user.client.rpc("agency_usage_by_day", { p_agency_id: avanew.id, p_from: today, p_to: today })).error?.code).toBe("42501")
    }
    // An agency's staff can read their own agency's row, and no other.
    expect(((await avaOwner.client.from("agencies").select("slug")).data ?? []).map((a) => a.slug)).toEqual(["avanew"])
    expect((await lakesideAdmin.client.from("agencies").select("slug")).data).toEqual([])
    expect(((await owner.client.from("agencies").select("slug").order("slug")).data ?? []).map((a) => a.slug)).toEqual(["avanew", "brightside"])
    expect((await analyst.client.from("agencies").select("slug")).data).toEqual([])
  })

  it("keeps the Tavus list, packages, money and activity log apart", async () => {
    expect(((await avaOwner.client.from("tavus_pals").select("pal_id")).data ?? []).map((p) => p.pal_id)).toEqual(["pl00c0de0001"])
    expect(((await owner.client.from("tavus_pals").select("pal_id")).data ?? []).map((p) => p.pal_id)).toEqual(["pn00c0de0002"])
    expect(((await avaOwner.client.rpc("search_tavus_pals", { p_query: "" })).data ?? []).map((p: { pal_id: string }) => p.pal_id)).toEqual(["pl00c0de0001"])

    const mine = await avaOwner.client.from("plans").insert({ name: "Avanew Basic", included_minutes: 100, monthly_price_cents: 1000 }).select("agency_id").single()
    expect(mine.error).toBeNull()
    expect(mine.data?.agency_id).toBe(avanew.id)
    await owner.client.from("plans").insert({ name: "Divigner Basic", included_minutes: 100, monthly_price_cents: 1000 })
    const plans = async (user: TestUser) => ((await user.client.from("plans").select("name").order("name")).data ?? []).map((p) => p.name)
    expect(await plans(avaOwner)).toEqual(["Avanew Basic"])
    expect(await plans(lakesideAdmin)).toEqual(["Avanew Basic"])
    expect(await plans(owner)).toEqual(["Divigner Basic"])
    expect(await plans(northlineAdmin)).toEqual(["Divigner Basic"])
    expect((await avaOwner.client.from("plans").insert({ name: "Sneak", included_minutes: 1, monthly_price_cents: 1, agency_id: null })).error).not.toBeNull()

    const finance = (await avaOwner.client.rpc("finance_summary", { p_from: today, p_to: today })).data
    expect(finance.cost_per_minute_cents).toBe(0)
    expect(finance.clients.map((c: { name: string }) => c.name)).toEqual(["Lakeside Family Practice"])
    expect((await owner.client.rpc("finance_summary", { p_from: today, p_to: today })).data.clients.map((c: { name: string }) => c.name)).toEqual(["Northline Realty"])

    const log = async (user: TestUser) => ((await user.client.from("audit_log").select("action, detail")).data ?? [])
    expect(JSON.stringify(await log(owner))).not.toContain("Lakeside")
    expect((await log(avaOwner)).some((e) => e.action === "client.created" && e.detail.name === "Lakeside Family Practice")).toBe(true)
    expect(JSON.stringify(await log(avaOwner))).not.toContain("Northline")
  })

  it("answers an agency client's support tickets from the agency, not from Divigner", async () => {
    const staff = async (user: TestUser, clientId: string) => ((await user.client.rpc("support_staff", { p_client_id: clientId })).data ?? []).map((p: { email: string }) => p.email)
    expect(await staff(avaOwner, lakeside.id)).toEqual(["ava@avanew.test", "max@avanew.test"])
    expect(await staff(owner, lakeside.id)).toEqual([])
    expect(await staff(owner, northline.id)).toEqual(["owner@divigner.test"])
  })

  it("does not run an agency's work on Divigner's Tavus or Stripe account", async () => {
    expect((await callFunction("tavus-sync", {}, { token: avaOwner.token })).status).toBe(409)
    expect((await callFunction("tavus-pal", { pal_id: "pn00c0de0002" }, { token: avaOwner.token })).status).toBe(409)
    expect((await callFunction("billing", { action: "portal", client_id: lakeside.id }, { token: lakesideAdmin.token })).status).toBe(409)
  })
})

describe("an agency's look", () => {
  it("is set by Divigner or by the agency itself, and by nobody else", async () => {
    const next = { ...THEME, motion: false }
    expect((await avaOwner.client.rpc("agency_set_brand", { p_agency_id: avanew.id, p_theme: next, p_logo_dark_url: "https://example.test/dark.png" })).error).toBeNull()
    expect((await owner.client.rpc("agency_set_brand", { p_agency_id: avanew.id, p_theme: THEME })).error).toBeNull()
    for (const user of [otherOwner, avaManager, analyst, lakesideAdmin]) {
      expect((await user.client.rpc("agency_set_brand", { p_agency_id: avanew.id, p_theme: next })).error?.code).toBe("42501")
    }
    expect((await avaOwner.client.rpc("agency_set_brand", { p_agency_id: avanew.id, p_theme: { ...THEME, light: { ...MODE, text: "javascript:1" } } })).error).not.toBeNull()
    expect((await avaOwner.client.rpc("update_agency", { p_agency_id: avanew.id, p_name: "Free", p_domain: null, p_status: "active", p_payment_model: null, p_fee_cents: 0 })).error?.code).toBe("42501")
  })

  it("reaches the agency's staff and the agency's clients, and not Divigner's", async () => {
    const access = async (user: TestUser) => (await user.client.rpc("my_access")).data
    expect((await access(avaOwner)).agency).toMatchObject({ name: "Avanew", slug: "avanew", theme: THEME })
    expect((await access(lakesideAdmin)).agency).toMatchObject({ name: "Avanew" })
    expect((await access(owner)).agency).toBeNull()
    expect((await access(northlineAdmin)).agency).toBeNull()
    expect(JSON.stringify(await access(lakesideAdmin))).not.toContain("fee_cents")
  })

  it("is shown on the sign-in page by address, with nothing private", async () => {
    const anon = anonClient()
    const byHost = (await anon.rpc("brand_for_host", { p_host: "avalytics.apps.avanew.test:443" })).data
    expect(byHost).toMatchObject({ name: "Avanew", theme: THEME })
    expect(Object.keys(byHost).sort()).toEqual(["domain", "icon_url", "id", "logo_dark_url", "logo_light_url", "name", "slug", "theme"])
    expect((await anon.rpc("brand_for_host", { p_slug: "avanew" })).data).toMatchObject({ name: "Avanew" })
    expect((await anon.rpc("brand_for_host", { p_host: "elsewhere.test" })).data).toBeNull()
    expect((await anon.from("agencies").select("id")).data ?? []).toEqual([])
  })
})
