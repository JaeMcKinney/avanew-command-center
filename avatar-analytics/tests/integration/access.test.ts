// Who can see and change what. Every check goes through the same API the
// browser uses, signed in as a real user, so it exercises row-level security.

import { beforeAll, describe, expect, it } from "vitest"
import { admin, anonClient, createClientRow, createUser, PASSWORD, resetDatabase, signIn, type TestUser } from "./helpers"

let owner: TestUser, adminUser: TestUser, manager: TestUser, analyst: TestUser
let clientAdminA: TestUser, clientMemberA: TestUser, clientAdminB: TestUser
let clientA: { id: string }, clientB: { id: string }
let earlyBirdId: string

beforeAll(async () => {
  resetDatabase()
  // A fresh install names its Owner by email. Only that address is promoted.
  await admin.from("settings").upsert({ key: "bootstrap.owner_email", value: "Owner@Divigner.test" })
  const early = await admin.auth.admin.createUser({ email: "early-bird@example.test", password: PASSWORD, email_confirm: true })
  earlyBirdId = early.data.user!.id
  const { data } = await admin.auth.admin.createUser({ email: "owner@divigner.test", password: PASSWORD, email_confirm: true })
  owner = await signIn("owner@divigner.test", data.user!.id)

  clientA = await createClientRow(owner, "Northline Realty", "northline")
  clientB = await createClientRow(owner, "Harbor Dental", "harbor-dental")

  adminUser = await createUser({ email: "admin@divigner.test", role: "admin" })
  manager = await createUser({ email: "manager@divigner.test", role: "manager", assignedClientIds: [clientA.id] })
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  clientAdminA = await createUser({ email: "admin@northline.test", role: "client_admin", clientId: clientA.id })
  clientMemberA = await createUser({ email: "member@northline.test", role: "client_member", clientId: clientA.id })
  clientAdminB = await createUser({ email: "admin@harbor.test", role: "client_admin", clientId: clientB.id })
})

async function visibleClients(user: TestUser) {
  const { data, error } = await user.client.from("clients").select("slug").order("slug")
  expect(error).toBeNull()
  return data!.map((c) => c.slug)
}

describe("the first Owner", () => {
  it("is the person named when the project was set up", async () => {
    const { data } = await owner.client.rpc("my_access")
    expect(data.role.key).toBe("owner")
    expect(data.side).toBe("divigner")
    expect(data.permissions).toEqual(expect.arrayContaining(["team.manage", "clients.manage", "avatars.link", "audit.view"]))
    // The one-time setting is gone, so it cannot be used again.
    expect((await admin.from("settings").select("key").eq("key", "bootstrap.owner_email")).data).toEqual([])
  })

  it("is nobody else: signing up, before or after, gives no access", async () => {
    const before = await admin.from("profiles").select("id").eq("id", earlyBirdId).maybeSingle()
    expect(before.data).toBeNull()

    const { data } = await admin.auth.admin.createUser({ email: "stranger@example.test", password: PASSWORD, email_confirm: true })
    const { data: profile } = await admin.from("profiles").select("id").eq("id", data.user!.id).maybeSingle()
    expect(profile).toBeNull()
    const stranger = await signIn("stranger@example.test")
    expect(await visibleClients(stranger)).toEqual([])
    expect((await stranger.client.rpc("my_access")).data).toBeNull()
  })
})

describe("clients", () => {
  it("are visible only to the right people", async () => {
    expect(await visibleClients(owner)).toEqual(["harbor-dental", "northline"])
    expect(await visibleClients(adminUser)).toEqual(["harbor-dental", "northline"])
    expect(await visibleClients(analyst)).toEqual(["harbor-dental", "northline"])
    expect(await visibleClients(manager)).toEqual(["northline"])
    expect(await visibleClients(clientAdminA)).toEqual(["northline"])
    expect(await visibleClients(clientMemberA)).toEqual(["northline"])
    expect(await visibleClients(clientAdminB)).toEqual(["harbor-dental"])
  })

  it("are invisible to signed-out visitors", async () => {
    const { data, error } = await anonClient().from("clients").select("slug")
    expect(data ?? []).toEqual([])
    expect(error).not.toBeNull()
  })

  it("can only be created by staff who manage clients", async () => {
    for (const user of [analyst, clientAdminA]) {
      const { error } = await user.client.rpc("create_client", { p_name: "Nope", p_slug: "nope" })
      expect(error?.message).toMatch(/permission/i)
    }
  })

  it("a manager is assigned to the client they create", async () => {
    const { data, error } = await manager.client.rpc("create_client", { p_name: "Cedar Law", p_slug: "cedar-law" })
    expect(error).toBeNull()
    expect(await visibleClients(manager)).toEqual(["cedar-law", "northline"])
    await admin.from("clients").delete().eq("id", data.id)
  })

  it("reject an unknown time zone and a bad slug", async () => {
    const tz = await owner.client.rpc("create_client", { p_name: "X", p_slug: "x-co", p_timezone: "Mars/Olympus" })
    expect(tz.error?.message).toMatch(/time zone/i)
    const slug = await owner.client.rpc("create_client", { p_name: "X", p_slug: "Not A Slug" })
    expect(slug.error).not.toBeNull()
  })

  it("cannot be edited by client users or by staff outside their scope", async () => {
    const byClient = await clientAdminA.client.from("clients").update({ name: "Hacked" }).eq("id", clientA.id).select()
    expect(byClient.data ?? []).toEqual([])
    const byManager = await manager.client.from("clients").update({ name: "Hacked" }).eq("id", clientB.id).select()
    expect(byManager.data ?? []).toEqual([])
    const ok = await manager.client.from("clients").update({ brand_color: "#0F766E" }).eq("id", clientA.id).select()
    expect(ok.data).toHaveLength(1)
    const { data } = await admin.from("clients").select("name").in("id", [clientA.id, clientB.id])
    expect(data!.map((c) => c.name).sort()).toEqual(["Harbor Dental", "Northline Realty"])
  })
})

describe("users", () => {
  async function visibleEmails(user: TestUser) {
    const { data } = await user.client.from("profiles").select("email").order("email")
    return data!.map((p) => p.email)
  }

  it("see only the profiles they should", async () => {
    expect(await visibleEmails(clientMemberA)).toEqual(["member@northline.test"])
    expect(await visibleEmails(clientAdminA)).toEqual(["admin@northline.test", "member@northline.test"])
    expect(await visibleEmails(clientAdminB)).toEqual(["admin@harbor.test"])
    const managerSees = await visibleEmails(manager)
    expect(managerSees).toContain("admin@northline.test")
    expect(managerSees).toContain("owner@divigner.test")
    expect(managerSees).not.toContain("admin@harbor.test")
  })

  it("cannot edit profiles directly, including their own role", async () => {
    const ownerRole = await admin.from("roles").select("id").eq("key", "owner").single()
    const update = await clientAdminA.client.from("profiles").update({ role_id: ownerRole.data!.id, side: "divigner" }).eq("id", clientAdminA.id).select()
    expect(update.error).not.toBeNull()
    const insert = await clientAdminA.client.from("profiles").insert({ id: clientAdminA.id, email: "x@x.test", side: "divigner", role_id: ownerRole.data!.id })
    expect(insert.error).not.toBeNull()
  })

  it("a client admin can change roles inside their own client only", async () => {
    const roles = await admin.from("roles").select("id, key")
    const id = (key: string) => roles.data!.find((r) => r.key === key)!.id

    const promote = await clientAdminA.client.rpc("set_user_role", { p_user_id: clientMemberA.id, p_role_id: id("client_admin") })
    expect(promote.error).toBeNull()
    await clientAdminA.client.rpc("set_user_role", { p_user_id: clientMemberA.id, p_role_id: id("client_member") })

    const crossClient = await clientAdminA.client.rpc("set_user_role", { p_user_id: clientAdminB.id, p_role_id: id("client_member") })
    expect(crossClient.error?.message).toMatch(/permission/i)

    const escalate = await clientAdminA.client.rpc("set_user_role", { p_user_id: clientMemberA.id, p_role_id: id("admin") })
    expect(escalate.error?.message).toMatch(/side/i)

    const staff = await clientAdminA.client.rpc("set_user_active", { p_user_id: analyst.id, p_active: false })
    expect(staff.error?.message).toMatch(/permission/i)
  })

  it("an Owner cannot demote or deactivate themselves, so one always remains", async () => {
    const adminRole = await admin.from("roles").select("id").eq("key", "admin").single()
    const demote = await owner.client.rpc("set_user_role", { p_user_id: owner.id, p_role_id: adminRole.data!.id })
    expect(demote.error?.message).toMatch(/own role/i)
    const deactivate = await owner.client.rpc("set_user_active", { p_user_id: owner.id, p_active: false })
    expect(deactivate.error?.message).toMatch(/own account/i)

    // A second Owner can deactivate the first, and bring them back.
    const second = await createUser({ email: "second-owner@divigner.test", role: "owner" })
    expect((await second.client.rpc("set_user_active", { p_user_id: owner.id, p_active: false })).error).toBeNull()
    expect((await owner.client.rpc("my_access")).data.is_active).toBe(false)
    expect((await second.client.rpc("set_user_active", { p_user_id: owner.id, p_active: true })).error).toBeNull()
    await admin.auth.admin.deleteUser(second.id)
  })

  it("a deactivated user loses access at once", async () => {
    await owner.client.rpc("set_user_active", { p_user_id: clientMemberA.id, p_active: false })
    expect(await visibleClients(clientMemberA)).toEqual([])
    await owner.client.rpc("set_user_active", { p_user_id: clientMemberA.id, p_active: true })
    expect(await visibleClients(clientMemberA)).toEqual(["northline"])
  })
})

describe("roles and permissions", () => {
  it("only team managers can change what a role may do", async () => {
    const analystRole = await admin.from("roles").select("id").eq("key", "analyst").single()
    const row = { role_id: analystRole.data!.id, permission: "audit.view" }

    const denied = await adminUser.client.from("role_permissions").insert(row)
    expect(denied.error).not.toBeNull()

    const allowed = await owner.client.from("role_permissions").insert(row)
    expect(allowed.error).toBeNull()
    expect((await analyst.client.rpc("my_access")).data.permissions).toContain("audit.view")
    await owner.client.from("role_permissions").delete().match(row)
  })

  it("a client role cannot be given a Divigner-only permission", async () => {
    const clientRole = await admin.from("roles").select("id").eq("key", "client_admin").single()
    const { error } = await owner.client.from("role_permissions").insert({ role_id: clientRole.data!.id, permission: "team.manage" })
    expect(error?.message).toMatch(/cannot be given/i)
  })

  it("the Owner role cannot lose permissions", async () => {
    const ownerRole = await admin.from("roles").select("id").eq("key", "owner").single()
    const { error } = await owner.client.from("role_permissions").delete().match({ role_id: ownerRole.data!.id, permission: "team.manage" })
    expect(error?.message).toMatch(/Owner role/i)
  })

  it("custom roles can be created and removed; built-in ones cannot be removed", async () => {
    const created = await owner.client.from("roles").insert({ key: "support", name: "Support", side: "divigner" }).select().single()
    expect(created.error).toBeNull()
    expect((await owner.client.from("roles").delete().eq("id", created.data!.id)).error).toBeNull()
    const builtin = await owner.client.from("roles").delete().eq("key", "analyst")
    expect(builtin.error?.message).toMatch(/Built-in/i)
  })
})

describe("settings and audit log", () => {
  it("clients cannot read settings or the audit log", async () => {
    expect((await clientAdminA.client.from("settings").select("key")).data).toEqual([])
    expect((await clientAdminA.client.from("audit_log").select("id")).data).toEqual([])
  })

  it("the audit log records client creation and is read-only", async () => {
    const { data } = await owner.client.from("audit_log").select("action, target_id").eq("action", "client.created")
    expect(data!.map((r) => r.target_id)).toEqual(expect.arrayContaining([clientA.id, clientB.id]))
    const tamper = await owner.client.from("audit_log").delete().eq("action", "client.created")
    expect(tamper.error).not.toBeNull()
  })

  it("only people with settings.manage can change a setting", async () => {
    const denied = await analyst.client.from("settings").update({ value: 60 }).eq("key", "usage.minimum_seconds").select()
    expect(denied.data ?? []).toEqual([])
    const ok = await adminUser.client.from("settings").update({ value: 30 }).eq("key", "usage.minimum_seconds").select()
    expect(ok.data).toHaveLength(1)
  })
})
