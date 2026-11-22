// The server functions, run for real (with Deno) against the local database
// and a mock Tavus API.

import { createHmac } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import {
  admin, callFunction, createClientRow, createUser, event, FUNCTIONS_URL, mockTavusState,
  resetDatabase, resetMockTavus, type TestUser,
} from "./helpers"

let owner: TestUser, manager: TestUser, analyst: TestUser, clientAdminA: TestUser
let northline: { id: string }, harbor: { id: string }

const MAYA = "p3a91c0de01", THEO = "p7c20c0de02", IVY = "pe551c0de03", HARBOR_PAL = "pb00c0de0006"

beforeAll(async () => {
  resetDatabase()
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  northline = await createClientRow(owner, "Northline Realty", "northline")
  harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental")
  manager = await createUser({ email: "manager@divigner.test", role: "manager", assignedClientIds: [northline.id] })
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  clientAdminA = await createUser({ email: "admin@northline.test", role: "client_admin", clientId: northline.id })
})

describe("tavus-sync", () => {
  it("refuses people who may not link avatars", async () => {
    expect((await callFunction("tavus-sync", {})).status).toBe(401)
    expect((await callFunction("tavus-sync", {}, { token: analyst.token })).status).toBe(403)
    expect((await callFunction("tavus-sync", {}, { token: clientAdminA.token })).status).toBe(403)
  })

  it("copies PALs and deployments from Tavus", async () => {
    const res = await callFunction("tavus-sync", {}, { token: owner.token })
    expect(res).toMatchObject({ status: 200, body: { ok: true, pals: 8, deployments: 6 } })

    const { data: maya } = await admin.from("tavus_pals").select("*").eq("pal_id", MAYA).single()
    expect(maya).toMatchObject({ name: "Maya · Northline Leasing Concierge", removed_at: null })
    expect(maya!.thumbnail_image_url).toContain(MAYA)
    // An avatar with no deployment still gets its photo, from its face.
    const { data: guide } = await admin.from("tavus_pals").select("thumbnail_image_url").eq("pal_id", "pf00c0de0005").single()
    expect(guide!.thumbnail_image_url).toContain("pf00c0de0005")
    // Tavus's odd timestamp formats are understood.
    expect(maya!.tavus_created_at).toBe("2026-09-01T10:00:00+00:00")
    const { data: dep } = await admin.from("tavus_deployments").select("*").eq("deployment_id", "d-maya-embed").single()
    expect(dep).toMatchObject({ channel: "embed", status: "active", allowed_origins: ["https://northlinerealty.com"] })
    expect(dep!.tavus_updated_at).toBe("2026-10-17T11:55:10.643+00:00")

    const { data: harborPal } = await admin.from("tavus_pals").select("callback_host").eq("pal_id", HARBOR_PAL).single()
    expect(harborPal!.callback_host).toBe("hooks.harbor-dental.example")

    const { data: runs } = await owner.client.from("tavus_sync_runs").select("status, pals_count").order("id", { ascending: false }).limit(1)
    expect(runs).toEqual([{ status: "ok", pals_count: 8 }])
  })

  it("runs on a schedule with the shared secret, and rejects a wrong one", async () => {
    expect((await callFunction("tavus-sync", {}, { headers: { "x-cron-secret": "wrong" } })).status).toBe(401)
    expect((await callFunction("tavus-sync", {}, { headers: { "x-cron-secret": "local-cron-secret" } })).status).toBe(200)
  })

  it("flags a PAL deleted in Tavus instead of dropping it", async () => {
    const state = await mockTavusState()
    await resetMockTavus({ pals: state.pals.filter((p) => p.pal_id !== "pd00c0de0008") })
    await callFunction("tavus-sync", {}, { token: owner.token })
    const { data } = await admin.from("tavus_pals").select("removed_at").eq("pal_id", "pd00c0de0008").single()
    expect(data!.removed_at).not.toBeNull()
    await resetMockTavus()
    await callFunction("tavus-sync", {}, { token: owner.token })
    const { data: back } = await admin.from("tavus_pals").select("removed_at").eq("pal_id", "pd00c0de0008").single()
    expect(back!.removed_at).toBeNull()
  })

  it("changes nothing if Tavus suddenly returns an empty list", async () => {
    await resetMockTavus({ emptyLists: true })
    const res = await callFunction("tavus-sync", {}, { token: owner.token })
    expect(res.status).toBe(502)
    expect(res.body.error).toMatch(/nothing was changed/i)
    const { count } = await admin.from("tavus_pals").select("pal_id", { count: "exact", head: true }).is("removed_at", null)
    expect(count).toBe(8)
    const { data: runs } = await admin.from("tavus_sync_runs").select("status").order("id", { ascending: false }).limit(1)
    expect(runs![0].status).toBe("error")
    await resetMockTavus()
  })
})

describe("searching the Tavus list", () => {
  const search = async (user: TestUser, q: string) => {
    const { data, error } = await user.client.rpc("search_tavus_pals", { p_query: q })
    if (error) throw new Error(error.message)
    return data as Array<{ pal_id: string; name: string; deployments: unknown[]; linked_client_name: string | null }>
  }

  it("finds avatars by part of their name", async () => {
    const hits = await search(owner, "northline")
    expect(hits.map((h) => h.pal_id).sort()).toEqual([MAYA, THEO, IVY].sort())
    expect(hits.find((h) => h.pal_id === MAYA)!.deployments).toHaveLength(2)
  })

  it("tolerates typos and different capitals", async () => {
    expect((await search(owner, "Nortline")).map((h) => h.pal_id).sort()).toEqual([MAYA, THEO, IVY].sort())
    expect((await search(owner, "  MAYA ")).map((h) => h.pal_id)).toEqual([MAYA])
  })

  it("finds an avatar by the website its deployment is on, or by its id", async () => {
    expect((await search(owner, "willowcare")).map((h) => h.name)).toEqual(["Zoey Care Concierge"])
    expect((await search(owner, MAYA)).map((h) => h.pal_id)).toEqual([MAYA])
  })

  it("lists everything, newest first, when the search is empty", async () => {
    expect(await search(owner, "")).toHaveLength(8)
  })

  it("is for staff who link avatars only", async () => {
    await expect(search(analyst, "maya")).rejects.toThrow(/permission/i)
    await expect(search(clientAdminA, "maya")).rejects.toThrow(/permission/i)
    expect((await clientAdminA.client.from("tavus_pals").select("pal_id")).data).toEqual([])
  })
})

describe("avatar-link", () => {
  it("links avatars to a client and points their Tavus webhook here", async () => {
    const res = await callFunction("avatar-link", {
      action: "link", client_id: northline.id,
      pals: [{ pal_id: MAYA, display_name: "Maya" }, { pal_id: THEO }],
    }, { token: manager.token })
    expect(res.status).toBe(200)
    expect(res.body.results.map((r: any) => r.status)).toEqual(["linked", "linked"])

    const { data: avatars } = await admin.from("avatars").select("*").eq("client_id", northline.id).order("display_name")
    expect(avatars!.map((a) => a.display_name)).toEqual(["Maya", "Theo · Northline Buyer Intake"])
    expect(avatars![0]).toMatchObject({ webhook_status: "pending", webhook_error: null })
    expect(avatars![0].webhook_configured_at).not.toBeNull()
    expect(avatars![0].photo_url).toContain(MAYA)

    // Tavus was told where to send events, with a signing secret.
    const { data: secret } = await admin.from("avatar_secrets").select("*").eq("avatar_id", avatars![0].id).single()
    const tavus = await mockTavusState()
    const maya = tavus.pals.find((p) => p.pal_id === MAYA)!
    expect(maya.callback_url).toBe(`${FUNCTIONS_URL}/tavus-webhook/${secret!.webhook_token}`)
    expect(maya._callback_secret).toBe(secret!.callback_secret)
    // Only the webhook was touched.
    const paths = tavus.patches.flatMap((p) => p.ops.map((o) => o.path))
    expect(new Set(paths)).toEqual(new Set(["/callback_url", "/callback_secret"]))
  })

  it("shows linked avatars to the client, with their embed deployments", async () => {
    const { data: avatars } = await clientAdminA.client.from("avatars").select("display_name").order("display_name")
    expect(avatars!.map((a) => a.display_name)).toEqual(["Maya", "Theo · Northline Buyer Intake"])
    const { data: deps } = await clientAdminA.client.from("tavus_deployments").select("deployment_id").order("deployment_id")
    expect(deps!.map((d) => d.deployment_id)).toEqual(["d-maya-embed", "d-maya-widget", "d-theo-embed"])
  })

  it("will not link the same avatar twice", async () => {
    const res = await callFunction("avatar-link", { action: "link", client_id: harbor.id, pals: [{ pal_id: MAYA }] }, { token: owner.token })
    expect(res.body.results[0].status).toBe("already_linked")
    const hits = await manager.client.rpc("search_tavus_pals", { p_query: "maya" })
    expect(hits.data[0].linked_client_name).toBe("Northline Realty")
  })

  it("stops a manager from linking to a client they are not assigned to", async () => {
    const res = await callFunction("avatar-link", { action: "link", client_id: harbor.id, pals: [{ pal_id: IVY }] }, { token: manager.token })
    expect(res.status).toBe(403)
    expect((await callFunction("avatar-link", { action: "link", client_id: northline.id, pals: [{ pal_id: IVY }] }, { token: clientAdminA.token })).status).toBe(403)
  })

  it("asks before replacing a webhook the avatar already uses", async () => {
    const first = await callFunction("avatar-link", { action: "link", client_id: harbor.id, pals: [{ pal_id: HARBOR_PAL }] }, { token: owner.token })
    expect(first.body.results[0]).toMatchObject({ status: "callback_in_use", existing_callback_host: "hooks.harbor-dental.example" })
    expect((await admin.from("avatars").select("id").eq("tavus_pal_id", HARBOR_PAL)).data).toEqual([])

    const confirmed = await callFunction("avatar-link", { action: "link", client_id: harbor.id, pals: [{ pal_id: HARBOR_PAL }], replace_existing_callback: true }, { token: owner.token })
    expect(confirmed.body.results[0].status).toBe("linked")
    const { data } = await admin.from("avatars").select("previous_callback_url").eq("tavus_pal_id", HARBOR_PAL).single()
    expect(data!.previous_callback_url).toBe("https://hooks.harbor-dental.example/tavus")
  })

  it("keeps the link and reports the problem when Tavus refuses the change, then retries", async () => {
    await resetMockTavusKeepingPals({ failPatchFor: [IVY] })
    const res = await callFunction("avatar-link", { action: "link", client_id: northline.id, pals: [{ pal_id: IVY }] }, { token: owner.token })
    expect(res.body.results[0].status).toBe("linked_webhook_error")
    expect(res.body.results[0].message).toMatch(/PAL Maker/)
    const { data: ivy } = await admin.from("avatars").select("id, webhook_status, webhook_error").eq("tavus_pal_id", IVY).single()
    expect(ivy).toMatchObject({ webhook_status: "error" })

    await resetMockTavusKeepingPals({ failPatchFor: [] })
    expect((await callFunction("avatar-link", { action: "retry", avatar_id: ivy!.id }, { token: owner.token })).status).toBe(200)
    const { data: fixed } = await admin.from("avatars").select("webhook_status, webhook_error").eq("id", ivy!.id).single()
    expect(fixed).toEqual({ webhook_status: "pending", webhook_error: null })
  })

  it("unlinking restores the old webhook and keeps past usage with the client", async () => {
    const { data: avatar } = await admin.from("avatars").select("id").eq("tavus_pal_id", HARBOR_PAL).single()
    const res = await callFunction("avatar-link", { action: "unlink", avatar_id: avatar!.id }, { token: owner.token })
    expect(res).toMatchObject({ status: 200, body: { ok: true, warning: null } })
    const tavus = await mockTavusState()
    expect(tavus.pals.find((p) => p.pal_id === HARBOR_PAL)!.callback_url).toBe("https://hooks.harbor-dental.example/tavus")
    const { data } = await admin.from("avatars").select("unlinked_at, client_id").eq("id", avatar!.id).single()
    expect(data!.unlinked_at).not.toBeNull()
    expect(data!.client_id).toBe(harbor.id)
    // It can now be linked again.
    const again = await callFunction("avatar-link", { action: "link", client_id: harbor.id, pals: [{ pal_id: HARBOR_PAL }], replace_existing_callback: true }, { token: owner.token })
    expect(again.body.results[0].status).toBe("linked")
  })
})

async function resetMockTavusKeepingPals(overrides: Record<string, unknown>) {
  const state = await mockTavusState()
  await resetMockTavus({ pals: state.pals, ...overrides })
}

describe("tavus-webhook", () => {
  async function mayaWebhook() {
    const { data: avatar } = await admin.from("avatars").select("id").eq("tavus_pal_id", MAYA).single()
    const { data: secret } = await admin.from("avatar_secrets").select("*").eq("avatar_id", avatar!.id).single()
    return { avatarId: avatar!.id as string, token: secret!.webhook_token as string, secret: secret!.callback_secret as string }
  }
  const sign = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex")
  const post = (token: string, body: string, signature?: string) =>
    callFunction(`tavus-webhook/${token}`, body, { headers: signature ? { "X-Tavus-Signature": signature } : {} })

  it("accepts signed events and counts the call", async () => {
    const hook = await mayaWebhook()
    const joined = JSON.stringify(event("wh-1", "system.pal_joined", "2026-11-12T14:00:00.000000Z", { face_id: "r1" }))
    const shutdown = JSON.stringify(event("wh-1", "system.shutdown", "2026-11-12T14:03:00.000000Z", { shutdown_reason: "max_call_duration reached" }))
    expect((await post(hook.token, joined, sign(hook.secret, joined))).status).toBe(200)
    const res = await post(hook.token, shutdown, sign(hook.secret, shutdown))
    expect(res).toMatchObject({ status: 200, body: { ok: true, counted: true, talk_seconds: 180, billable_seconds: 180 } })

    const { data: usage } = await clientAdminA.client.rpc("usage_by_avatar", { p_client_id: northline.id, p_from: "2026-11-12", p_to: "2026-11-12" })
    expect(usage).toEqual([{ avatar_id: hook.avatarId, conversations: 1, talk_seconds: 180, billable_seconds: 180 }])
    const { data: avatar } = await admin.from("avatars").select("webhook_status, last_event_at").eq("id", hook.avatarId).single()
    expect(avatar!.webhook_status).toBe("active")
    expect(avatar!.last_event_at).not.toBeNull()
  })

  it("rejects a missing or wrong signature, and a changed body", async () => {
    const hook = await mayaWebhook()
    const body = JSON.stringify(event("wh-2", "system.shutdown", "2026-11-12T15:00:00Z"))
    expect((await post(hook.token, body)).status).toBe(401)
    expect((await post(hook.token, body, sign("not-the-secret", body))).status).toBe(401)
    expect((await post(hook.token, body.replace("wh-2", "wh-3"), sign(hook.secret, body))).status).toBe(401)
    const { data } = await admin.from("conversations").select("conversation_id").in("conversation_id", ["wh-2", "wh-3"])
    expect(data).toEqual([])
  })

  it("rejects an address it does not know", async () => {
    const body = JSON.stringify(event("wh-4", "system.shutdown", "2026-11-12T15:00:00Z"))
    expect((await post("0".repeat(48), body, sign("x", body))).status).toBe(404)
    expect((await post("../../etc", body, sign("x", body))).status).toBe(404)
  })

  it("accepts but ignores callbacks that are not conversation events", async () => {
    const hook = await mayaWebhook()
    const body = JSON.stringify({ conversation_id: "wh-5", properties: { guardrail: "no-pricing" } })
    expect((await post(hook.token, body, sign(hook.secret, body))).status).toBe(202)
  })
})

describe("tavus-backfill", () => {
  it("picks up a call whose webhooks never arrived", async () => {
    const state = await mockTavusState()
    const recent = new Date(Date.now() - 3_600_000)
    const iso = (offsetSeconds: number) => new Date(recent.getTime() + offsetSeconds * 1000).toISOString()
    await resetMockTavus({
      pals: state.pals,
      conversations: [
        { conversation_id: "bf-1", status: "ended", pal_id: THEO, created_at: iso(-5), updated_at: iso(95),
          events: [
            { event_type: "system.pal_joined", timestamp: iso(0), properties: {} },
            { event_type: "system.shutdown", timestamp: iso(90), properties: { shutdown_reason: "participant_left_timeout" } },
            { event_type: "application.transcription_ready", timestamp: iso(91), properties: { transcript: [{ role: "user", content: "Hi", duration: 1 }] } },
          ] },
        { conversation_id: "bf-active", status: "active", pal_id: THEO, created_at: iso(0), events: [] },
        { conversation_id: "bf-other", status: "ended", pal_id: "pc00c0de0007", created_at: iso(0), events: [{ event_type: "system.shutdown", timestamp: iso(10) }] },
        { conversation_id: "bf-nopal", status: "ended", pal_id: null, created_at: iso(0), events: [] },
      ],
    })
    const res = await callFunction("tavus-backfill", {}, { headers: { "x-cron-secret": "local-cron-secret" } })
    expect(res).toMatchObject({ status: 200, body: { ok: true, scanned: 4, fetched: 1, events_stored: 3, unattributed: 1 } })
    const { data } = await admin.from("conversations").select("talk_seconds, has_transcript").eq("conversation_id", "bf-1").single()
    expect(data).toEqual({ talk_seconds: 90, has_transcript: true })
    expect((await admin.from("conversations").select("conversation_id").eq("conversation_id", "bf-other")).data).toEqual([])

    // Running it again finds nothing new to do.
    const again = await callFunction("tavus-backfill", {}, { headers: { "x-cron-secret": "local-cron-secret" } })
    expect(again.body).toMatchObject({ fetched: 0, events_stored: 0 })
  })
})

describe("user-invite", () => {
  const roleId = async (key: string) => (await admin.from("roles").select("id").eq("key", key).single()).data!.id

  it("lets the Owner invite a Divigner teammate", async () => {
    const res = await callFunction("user-invite", { email: "Dee@Divigner.test", full_name: "Dee", role_id: await roleId("admin") }, { token: owner.token })
    expect(res.status).toBe(200)
    const { data } = await admin.from("profiles").select("email, side, client_id, invited_by").eq("id", res.body.user_id).single()
    expect(data).toEqual({ email: "dee@divigner.test", side: "divigner", client_id: null, invited_by: owner.id })
  })

  it("lets a client admin invite people to their own client only", async () => {
    const member = await roleId("client_member")
    const ok = await callFunction("user-invite", { email: "sam@northline.test", full_name: "Sam", role_id: member, client_id: northline.id }, { token: clientAdminA.token })
    expect(ok.status).toBe(200)
    const other = await callFunction("user-invite", { email: "eve@harbor.test", full_name: "Eve", role_id: member, client_id: harbor.id }, { token: clientAdminA.token })
    expect(other.status).toBe(403)
    const staff = await callFunction("user-invite", { email: "eve@divigner.test", full_name: "Eve", role_id: await roleId("owner") }, { token: clientAdminA.token })
    expect(staff.status).toBe(403)
    expect((await admin.from("profiles").select("id").like("email", "eve@%")).data).toEqual([])
  })

  it("refuses a duplicate email and people without permission", async () => {
    const dup = await callFunction("user-invite", { email: "sam@northline.test", full_name: "Sam", role_id: await roleId("client_member"), client_id: northline.id }, { token: owner.token })
    expect(dup.status).toBe(409)
    const analystTry = await callFunction("user-invite", { email: "new@divigner.test", full_name: "New", role_id: await roleId("analyst") }, { token: analyst.token })
    expect(analystTry.status).toBe(403)
    const bad = await callFunction("user-invite", { email: "not-an-email", full_name: "X", role_id: await roleId("analyst") }, { token: owner.token })
    expect(bad.status).toBe(400)
  })

  it("assigns clients to an invited Manager", async () => {
    const res = await callFunction("user-invite", { email: "shah@divigner.test", full_name: "Shah", role_id: await roleId("manager"), assigned_client_ids: [harbor.id] }, { token: owner.token })
    expect(res.status).toBe(200)
    const { data } = await admin.from("staff_client_assignments").select("client_id").eq("user_id", res.body.user_id)
    expect(data).toEqual([{ client_id: harbor.id }])
  })
})
