// Glass Health: who may connect it, that the key cannot be read back, and that
// every question an avatar asks is counted against the right client.

import { execFileSync } from "node:child_process"
import { createHmac } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import {
  admin, callFunction, createClientRow, createUser, FUNCTIONS_URL, mockTavusState,
  resetDatabase, resetMockTavus, seedAvatar, type TestUser,
} from "./helpers"

const GOOD_KEY = "sk-gla-test-0000000000000000good"
const OTHER_KEY = "sk-gla-test-0000000000000000swap"
const BAD_KEY = "sk-gla-test-00000000000000invalid"
const UNPAID_KEY = "sk-gla-test-00000000000000pastdue"

let owner: TestUser, analyst: TestUser, manager: TestUser
let clinicAdmin: TestUser, clinicMember: TestUser, otherAdmin: TestUser
let clinic: { id: string }, other: { id: string }
let ada: { id: string; token: string; secret: string }, otherAvatar: { id: string; token: string; secret: string }

/** Posts to the avatar's tool address the way Tavus does: a fixed envelope, signed with the avatar's secret. */
async function consult(avatar: { token: string; secret: string }, args: unknown, opts: { conversationId?: string; signature?: string } = {}) {
  const body = JSON.stringify({
    name: "consult_clinical_evidence",
    arguments: typeof args === "string" ? args : JSON.stringify(args),
    tool_call_id: `call_${Math.random().toString(36).slice(2)}`,
    conversation_id: opts.conversationId ?? "c-clinic-1",
    inference_id: "inf_1",
    turn_idx: 3,
  })
  const res = await fetch(`${FUNCTIONS_URL}/glass-consult/${avatar.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tavus-Signature": opts.signature ?? createHmac("sha256", avatar.secret).update(body).digest("hex") },
    body,
  })
  return { status: res.status, body: await res.json() }
}

const connection = async (user: TestUser, clientId: string) =>
  (await user.client.from("client_glass").select("client_id, key_hint, status, status_detail, last_used_at").eq("client_id", clientId).maybeSingle()).data

beforeAll(async () => {
  resetDatabase()
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  clinic = await createClientRow(owner, "Riverside Clinic", "riverside")
  other = await createClientRow(owner, "Harbor Dental", "harbor-dental")
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  manager = await createUser({ email: "manager@divigner.test", role: "manager", assignedClientIds: [clinic.id] })
  clinicAdmin = await createUser({ email: "admin@riverside.test", role: "client_admin", clientId: clinic.id })
  clinicMember = await createUser({ email: "member@riverside.test", role: "client_member", clientId: clinic.id })
  otherAdmin = await createUser({ email: "admin@harbor.test", role: "client_admin", clientId: other.id })
  ada = await seedAvatar(clinic.id, "pa00c0de0004", "Ada")
  otherAvatar = await seedAvatar(other.id, "pb00c0de0006", "Harbor Front Desk")
})

describe("turning Glass on", () => {
  it("is for Divigner staff who may manage it, not for clients", async () => {
    expect((await clinicAdmin.client.rpc("glass_enable", { p_client_id: clinic.id, p_enabled: true })).error?.code).toBe("42501")
    expect((await analyst.client.rpc("glass_enable", { p_client_id: clinic.id, p_enabled: true })).error?.code).toBe("42501")
    expect((await manager.client.rpc("glass_enable", { p_client_id: clinic.id, p_enabled: true })).error?.code).toBe("42501")
    expect(await connection(owner, clinic.id)).toBeNull()

    expect((await owner.client.rpc("glass_enable", { p_client_id: clinic.id, p_enabled: true })).error).toBeNull()
    expect(await connection(clinicAdmin, clinic.id)).toMatchObject({ status: "no_key", key_hint: null })
  })

  it("a key cannot be entered until it is on", async () => {
    const res = await callFunction("glass-connection", { action: "save", client_id: other.id, key: GOOD_KEY }, { token: otherAdmin.token })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not turned on/i)
  })
})

describe("the key", () => {
  it("can be entered by the client's admin, and is checked with Glass", async () => {
    expect((await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: GOOD_KEY })).status).toBe(401)
    expect((await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: GOOD_KEY }, { token: clinicMember.token })).status).toBe(403)
    expect((await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: GOOD_KEY }, { token: otherAdmin.token })).status).toBe(403)
    expect((await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: "too short" }, { token: clinicAdmin.token })).status).toBe(400)

    const res = await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: `  ${GOOD_KEY}\n` }, { token: clinicAdmin.token })
    expect(res.status).toBe(200)
    expect(res.body.connection).toMatchObject({ status: "ok", key_hint: "good" })
    expect(JSON.stringify(res.body)).not.toContain(GOOD_KEY)
    // The check asks Glass nothing, so it costs nothing.
    expect((await mockTavusState()).glassCalls).toHaveLength(0)
  })

  it("cannot be read back by anyone signed in", async () => {
    for (const user of [owner, clinicAdmin, clinicMember]) {
      expect((await user.client.rpc("glass_read_key", { p_client_id: clinic.id })).error).not.toBeNull()
      expect((await user.client.from("client_glass").select("secret_id")).error).not.toBeNull()
      expect((await user.client.from("client_glass").select("*")).error).not.toBeNull()
    }
    expect((await admin.rpc("glass_read_key", { p_client_id: clinic.id })).data).toBe(GOOD_KEY)
    const { data: log } = await admin.from("audit_log").select("action, detail").like("action", "glass.%")
    expect(JSON.stringify(log)).not.toContain(GOOD_KEY)
  })

  it("is not visible to another client, and members see only that it is connected", async () => {
    expect(await connection(otherAdmin, clinic.id)).toBeNull()
    expect(await connection(clinicMember, clinic.id)).toMatchObject({ status: "ok" })
    expect((await clinicMember.client.rpc("glass_remove_key", { p_client_id: clinic.id })).error?.code).toBe("42501")
    expect((await otherAdmin.client.rpc("glass_set_key", { p_client_id: clinic.id, p_key: OTHER_KEY })).error?.code).toBe("42501")
  })

  it("replacing it leaves one stored key, and a key Glass refuses is flagged", async () => {
    const stored = () => Number(execFileSync("docker", ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-Atc", "select count(*) from vault.secrets where name like 'glass:%'"]).toString().trim())
    expect(stored()).toBe(1)
    const bad = await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: BAD_KEY }, { token: clinicAdmin.token })
    expect(bad.body.connection).toMatchObject({ status: "invalid", key_hint: "alid" })
    const unpaid = await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: UNPAID_KEY }, { token: owner.token })
    expect(unpaid.body.connection).toMatchObject({ status: "past_due" })
    const good = await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: GOOD_KEY }, { token: clinicAdmin.token })
    expect(good.body.connection).toMatchObject({ status: "ok", key_hint: "good" })
    expect(stored()).toBe(1)
    expect((await admin.rpc("glass_read_key", { p_client_id: clinic.id })).data).toBe(GOOD_KEY)
  })
})

describe("an avatar asks Glass", () => {
  it("only with Tavus's signature, at a real avatar's address", async () => {
    expect((await consult(ada, { question: "What is first-line for hypertension?" }, { signature: "0".repeat(64) })).status).toBe(401)
    expect((await consult({ token: "f".repeat(48), secret: ada.secret }, { question: "x" })).status).toBe(404)
    expect((await consult({ token: ada.token, secret: otherAvatar.secret }, { question: "x" })).status).toBe(401)
    expect((await consult(ada, {})).status).toBe(400)
    expect((await consult(ada, "not json")).status).toBe(400)
    expect((await admin.from("glass_calls").select("id")).data).toHaveLength(0)
  })

  it("answers in speakable words and counts what it cost", async () => {
    await admin.from("settings").update({ value: 200 }).eq("key", "glass.input_cents_per_million")
    await admin.from("settings").update({ value: 1000 }).eq("key", "glass.output_cents_per_million")

    const res = await consult(ada, { question: "What is first-line for hypertension?", language: "es" })
    expect(res.status).toBe(200)
    expect(res.body.answer).toBe("Thiazide-type diuretics, ACE inhibitors, ARBs and calcium channel blockers are all first-line choices. Pick by comorbidity.")
    expect(res.body.sources).toEqual([
      { title: "Guideline for High Blood Pressure in Adults", detail: "Hypertension, 2025", url: "https://pubmed.example/1" },
      { title: "Choosing a First Antihypertensive", detail: "JAMA, 2024", url: "https://pubmed.example/2" },
    ])

    const sent = (await mockTavusState()).glassCalls
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ key_hint: "good", version: "5.5-2026-03-31", stream: false, metadata: { conversationId: "c-clinic-1", avatarId: ada.id } })
    expect(sent[0].prompt).toContain("What is first-line for hypertension?")
    expect(sent[0].prompt).toContain("Spanish")

    const { data: rows } = await admin.from("glass_calls").select("*")
    expect(rows).toHaveLength(1)
    expect(rows![0]).toMatchObject({
      client_id: clinic.id, avatar_id: ada.id, conversation_id: "c-clinic-1", status: "ok", error_code: null,
      input_tokens: 12000, output_tokens: 180, glass_version: "5.5-2026-03-31", glass_request_id: "mock-glass-1",
    })
    // 12,000 × 200¢ + 180 × 1,000¢, per million.
    expect(Number(rows![0].cost_cents)).toBeCloseTo(2.58, 4)
    // Nothing a person said is kept.
    expect(JSON.stringify(rows)).not.toContain("hypertension")
    expect((await connection(clinicAdmin, clinic.id))?.last_used_at).not.toBeNull()
  })

  it("says why when the client has no key, without calling Glass", async () => {
    const res = await consult(otherAvatar, { question: "Anything?" }, { conversationId: "c-harbor-1" })
    expect(res.status).toBe(422)
    expect(res.body.error).toMatch(/not connected/i)
    expect((await mockTavusState()).glassCalls).toHaveLength(1)
    const { data } = await admin.from("glass_calls").select("status, error_code, cost_cents").eq("client_id", other.id)
    expect(data).toEqual([{ status: "error", error_code: "no_key", cost_cents: null }])
  })

  it("flags the connection when Glass stops accepting the key", async () => {
    await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: GOOD_KEY }, { token: clinicAdmin.token })
    // A stumble on Glass's side is worth one more try by Tavus, and says nothing about the key.
    await resetMockTavus({ glassStatus: 500 })
    const failed = await consult(ada, { question: "Second question?" }, { conversationId: "c-clinic-2" })
    expect(failed.status).toBe(502)
    await resetMockTavus()
    const { data: errors } = await admin.from("glass_calls").select("status, error_code, input_tokens").eq("conversation_id", "c-clinic-2")
    expect(errors).toEqual([{ status: "error", error_code: "glass_error", input_tokens: 0 }])
    expect(await connection(clinicAdmin, clinic.id)).toMatchObject({ status: "ok" })

    // Glass refusing the key during a call marks the connection, until a check passes again.
    await admin.rpc("glass_record_call", {
      p_avatar_id: ada.id, p_conversation_id: "c-clinic-2", p_tool_call_id: null, p_status: "error", p_error_code: "invalid_key",
      p_input_tokens: 0, p_output_tokens: 0, p_duration_ms: 120, p_version: null, p_request_id: null,
    })
    expect(await connection(clinicAdmin, clinic.id)).toMatchObject({ status: "invalid" })
    await callFunction("glass-connection", { action: "check", client_id: clinic.id }, { token: clinicAdmin.token })
    expect(await connection(clinicAdmin, clinic.id)).toMatchObject({ status: "ok" })
  })
})

describe("usage", () => {
  const range = { p_from: "2026-01-01", p_to: "2027-12-31" }

  it("adds up for the people who may see the client's dashboards", async () => {
    await consult(ada, { question: "A third question?" }, { conversationId: "c-clinic-2" })
    const { data: byDay, error } = await clinicMember.client.rpc("glass_usage_by_day", { p_client_id: clinic.id, ...range })
    expect(error).toBeNull()
    expect(byDay).toHaveLength(1)
    expect(byDay![0]).toMatchObject({ questions: 2, failed: 2, input_tokens: 24000, output_tokens: 360 })
    expect(Number(byDay![0].cost_cents)).toBeCloseTo(5.16, 4)

    const { data: byAvatar } = await owner.client.rpc("glass_usage_by_avatar", { p_client_id: clinic.id, ...range })
    expect(byAvatar).toMatchObject([{ avatar_id: ada.id, questions: 2 }])

    const { data: byConversation } = await clinicAdmin.client.rpc("glass_usage_by_conversation", { p_conversation_ids: ["c-clinic-1", "c-clinic-2", "c-harbor-1"] })
    expect(byConversation!.map((r: { conversation_id: string; questions: number; failed: number }) => [r.conversation_id, Number(r.questions), Number(r.failed)]).sort()).toEqual([["c-clinic-1", 1, 0], ["c-clinic-2", 1, 2]])
  })

  it("stays with its own client", async () => {
    expect((await otherAdmin.client.rpc("glass_usage_by_day", { p_client_id: clinic.id, ...range })).data).toEqual([])
    expect((await otherAdmin.client.from("glass_calls").select("id").eq("client_id", clinic.id)).data).toEqual([])
    expect((await otherAdmin.client.rpc("glass_usage_by_conversation", { p_conversation_ids: ["c-clinic-1"] })).data).toEqual([])
    // A manager sees only the clients assigned to them.
    expect((await manager.client.rpc("glass_usage_by_day", { p_client_id: clinic.id, ...range })).data).toHaveLength(1)
    expect((await manager.client.rpc("glass_usage_by_day", { p_client_id: other.id, ...range })).data).toEqual([])
    for (const user of [clinicAdmin, owner]) {
      expect((await user.client.from("glass_calls").insert({ client_id: clinic.id, avatar_id: ada.id, conversation_id: "x", usage_date: "2026-11-21", status: "ok" })).error).not.toBeNull()
      expect((await user.client.rpc("glass_record_call", {
        p_avatar_id: ada.id, p_conversation_id: "x", p_tool_call_id: null, p_status: "ok", p_error_code: null,
        p_input_tokens: 1, p_output_tokens: 1, p_duration_ms: 1, p_version: null, p_request_id: null,
      })).error).not.toBeNull()
    }
  })
})

describe("removing and turning off", () => {
  it("forgets the key and keeps the history", async () => {
    const res = await callFunction("glass-connection", { action: "remove", client_id: clinic.id }, { token: clinicAdmin.token })
    expect(res.body.connection).toMatchObject({ status: "no_key", key_hint: null })
    expect((await admin.rpc("glass_read_key", { p_client_id: clinic.id })).data).toBeNull()
    expect((await consult(ada, { question: "Still there?" })).status).toBe(422)

    await callFunction("glass-connection", { action: "save", client_id: clinic.id, key: GOOD_KEY }, { token: clinicAdmin.token })
    expect((await owner.client.rpc("glass_enable", { p_client_id: clinic.id, p_enabled: false })).error).toBeNull()
    expect(await connection(owner, clinic.id)).toBeNull()
    expect((await admin.rpc("glass_read_key", { p_client_id: clinic.id })).data).toBeNull()
    expect((await admin.from("glass_calls").select("id").eq("client_id", clinic.id).eq("status", "ok")).data).toHaveLength(2)
    const { data: log } = await owner.client.from("audit_log").select("action").like("action", "glass.%")
    expect(new Set(log!.map((l) => l.action))).toEqual(new Set(["glass.enabled", "glass.key_set", "glass.key_removed", "glass.disabled"]))
  })
})
