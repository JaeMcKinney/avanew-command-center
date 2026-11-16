// Summaries, the questions inbox, and publishing answers to Tavus knowledge.

import { createHmac } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import {
  admin, callFunction, createClientRow, createUser, event, FUNCTIONS_URL, ingest, MOCK_TAVUS, mockTavusState,
  resetDatabase, resetMockTavus, type TestUser,
} from "./helpers"

let owner: TestUser, analyst: TestUser, clientAdminA: TestUser, clientMemberA: TestUser, clientAdminB: TestUser
let northline: { id: string }, harbor: { id: string }
let maya: string, theo: string, zara: string
const CRON = { headers: { "x-cron-secret": "local-cron-secret" } }

const transcript = (lines: Array<[string, string]>) => ({ transcript: lines.map(([role, content], i) => ({ role, content, seconds_from_start: i * 5, duration: 2 })) })

async function call(avatarId: string, id: string, at: string, lines: Array<[string, string]>) {
  await ingest(avatarId, event(id, "system.pal_joined", at))
  await ingest(avatarId, event(id, "system.shutdown", new Date(Date.parse(at) + 90_000).toISOString()))
  await ingest(avatarId, event(id, "application.transcription_ready", new Date(Date.parse(at) + 91_000).toISOString(), transcript(lines)))
}
const groupsFor = async (clientId: string) =>
  (await admin.from("question_groups").select("*").eq("client_id", clientId).order("created_at")).data!

beforeAll(async () => {
  resetDatabase()
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  northline = await createClientRow(owner, "Northline Realty", "northline")
  harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental")
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  clientAdminA = await createUser({ email: "admin@northline.test", role: "client_admin", clientId: northline.id })
  clientMemberA = await createUser({ email: "member@northline.test", role: "client_member", clientId: northline.id })
  clientAdminB = await createUser({ email: "admin@harbor.test", role: "client_admin", clientId: harbor.id })
  await callFunction("tavus-sync", {}, { token: owner.token })
  const linked = await callFunction("avatar-link", { action: "link", client_id: northline.id, pals: [{ pal_id: "p3a91c0de01", display_name: "Maya" }, { pal_id: "p7c20c0de02", display_name: "Theo" }] }, { token: owner.token })
  ;[maya, theo] = linked.body.results.map((r: any) => r.avatar_id)
  const other = await callFunction("avatar-link", { action: "link", client_id: harbor.id, pals: [{ pal_id: "pc00c0de0007", display_name: "Zara" }] }, { token: owner.token })
  zara = other.body.results[0].avatar_id
})

describe("summaries and questions", () => {
  it("queues a conversation when its transcript arrives, and summarises it", async () => {
    await call(maya, "ins-1", "2026-11-10T15:00:00Z", [
      ["user", "Hi. Do you have two-bedroom homes in January?"],
      ["assistant", "Yes, three open up in January."],
      ["user", "Is there a pet deposit?"],
      ["assistant", "I'm not certain about that. Someone will follow up."],
    ])
    expect((await admin.from("conversation_insights").select("status").eq("conversation_id", "ins-1").single()).data).toEqual({ status: "pending" })

    const res = await callFunction("conversation-insights", {}, CRON)
    expect(res).toMatchObject({ status: 200, body: { ok: true, processed: 1, failed: 0 } })
    const { data: insight } = await admin.from("conversation_insights").select("status, summary, model").eq("conversation_id", "ins-1").single()
    expect(insight).toMatchObject({ status: "ready", model: "claude-opus-5-5" })
    expect(insight!.summary).toContain("2 questions")

    const { data: questions } = await admin.from("questions").select("question, outcome, group_id").eq("conversation_id", "ins-1").order("position")
    expect(questions!.map((q) => q.outcome)).toEqual(["answered", "unanswered"])
    expect(questions![0].group_id).toBeNull() // answered questions do not go to the inbox
    const groups = await groupsFor(northline.id)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ question: "Is there a pet deposit?", status: "open", times_asked: 1, avatar_ids: [maya] })
  })

  it("groups the same question from another call and another avatar", async () => {
    await call(theo, "ins-2", "2026-11-11T15:00:00Z", [["user", "Is there a pet deposit?"], ["assistant", "Please check the website for that."]])
    await callFunction("conversation-insights", {}, CRON)
    const groups = await groupsFor(northline.id)
    expect(groups).toHaveLength(1)
    expect(groups[0].times_asked).toBe(2)
    expect([...groups[0].avatar_ids].sort()).toEqual([maya, theo].sort())
    expect(groups[0].last_asked_at).toBe("2026-11-11T15:00:00+00:00")
    const { data } = await admin.from("questions").select("outcome").eq("conversation_id", "ins-2")
    expect(data).toEqual([{ outcome: "weak" }])
  })

  it("is summarised as soon as the webhook delivers the transcript", async () => {
    const { data: secret } = await admin.from("avatar_secrets").select("*").eq("avatar_id", zara).single()
    const post = async (payload: unknown) => {
      const body = JSON.stringify(payload)
      return callFunction(`tavus-webhook/${secret!.webhook_token}`, body, { headers: { "X-Tavus-Signature": createHmac("sha256", secret!.callback_secret).update(body).digest("hex") } })
    }
    await post(event("ins-3", "system.pal_joined", "2026-11-12T10:00:00Z"))
    await post(event("ins-3", "system.shutdown", "2026-11-12T10:02:00Z"))
    expect((await post(event("ins-3", "application.transcription_ready", "2026-11-12T10:02:01Z", transcript([["user", "Do you take walk-ins?"]])))).status).toBe(200)
    await expect.poll(async () => (await admin.from("conversation_insights").select("status").eq("conversation_id", "ins-3").single()).data?.status, { timeout: 10_000 }).toBe("ready")
    expect((await groupsFor(harbor.id)).map((g) => g.question)).toEqual(["Do you take walk-ins?"])
  })

  it("running it again changes nothing, and a re-sent transcript does not duplicate questions", async () => {
    const before = (await mockTavusState()).anthropicCalls
    expect((await callFunction("conversation-insights", {}, CRON)).body.processed).toBe(0)
    expect((await mockTavusState()).anthropicCalls).toBe(before)
    await admin.rpc("save_conversation_insights", { p_conversation_id: "ins-2", p_summary: "Again.", p_questions: [{ question: "Is there a pet deposit?", outcome: "weak", topic: "x", group_id: (await groupsFor(northline.id))[0].id }] })
    const groups = await groupsFor(northline.id)
    expect(groups).toHaveLength(1)
    expect(groups[0].times_asked).toBe(2)
  })

  it("retries a failure, then gives up and records why", async () => {
    await call(maya, "ins-4", "2026-11-12T16:00:00Z", [["user", "Where do guests park?"]])
    await fetch(`${MOCK_TAVUS}/__control/reset`, { method: "POST", body: JSON.stringify({ pals: (await mockTavusState()).pals, anthropicStatus: 500 }) })
    for (let i = 0; i < 3; i++) await callFunction("conversation-insights", {}, CRON)
    const { data } = await admin.from("conversation_insights").select("status, attempts, error").eq("conversation_id", "ins-4").single()
    expect(data).toMatchObject({ status: "failed", attempts: 3 })
    expect(data!.error).toBeTruthy()
    await fetch(`${MOCK_TAVUS}/__control/reset`, { method: "POST", body: JSON.stringify({ pals: (await mockTavusState()).pals }) })
    await admin.from("conversation_insights").update({ status: "pending", attempts: 0 }).eq("conversation_id", "ins-4")
    expect((await callFunction("conversation-insights", {}, CRON)).body.processed).toBe(1)
  })

  it("can only be run by the schedule or staff", async () => {
    expect((await callFunction("conversation-insights", {})).status).toBe(401)
    expect((await callFunction("conversation-insights", {}, { token: clientAdminA.token })).status).toBe(403)
  })
})

describe("who can see and answer", () => {
  it("clients see their own summaries and questions only", async () => {
    const a = await clientAdminA.client.from("conversation_insights").select("conversation_id").order("conversation_id")
    expect(a.data!.map((r) => r.conversation_id)).toEqual(["ins-1", "ins-2", "ins-4"])
    expect((await clientAdminB.client.from("question_groups").select("question")).data).toEqual([{ question: "Do you take walk-ins?" }])
    expect((await clientAdminB.client.from("questions").select("conversation_id")).data).toEqual([{ conversation_id: "ins-3" }])
    // Analysts cannot read transcripts, so they cannot read what was asked either.
    expect((await analyst.client.from("questions").select("id")).data).toEqual([])
    expect((await analyst.client.from("conversation_insights").select("conversation_id")).data).toEqual([])
  })

  it("only people allowed to answer can, and only for their own client", async () => {
    const [group] = await groupsFor(northline.id)
    const member = await clientMemberA.client.rpc("answer_question", { p_group_id: group.id, p_answer: "Yes." })
    expect(member.error?.message).toMatch(/permission/i)
    const other = await clientAdminB.client.rpc("answer_question", { p_group_id: group.id, p_answer: "Yes." })
    expect(other.error?.message).toMatch(/permission/i)
    const empty = await clientAdminA.client.rpc("answer_question", { p_group_id: group.id, p_answer: "   " })
    expect(empty.error?.message).toMatch(/Write an answer/)
    const direct = await clientAdminA.client.from("question_groups").update({ answer: "x", status: "answered" }).eq("id", group.id).select()
    expect(direct.error).not.toBeNull()
    const save = await clientAdminA.client.from("questions").insert({ conversation_id: "ins-1", client_id: northline.id, avatar_id: maya, question: "x", outcome: "answered" })
    expect(save.error).not.toBeNull()
    expect((await clientAdminA.client.rpc("save_conversation_insights", { p_conversation_id: "ins-1", p_summary: "x", p_questions: [] })).error).not.toBeNull()
  })
})

describe("publishing answers to the avatar's knowledge", () => {
  let groupId: string
  const pageFor = async (avatarId: string) => {
    const { data } = await admin.from("avatar_knowledge").select("*").eq("avatar_id", avatarId).single()
    return data!
  }

  it("adds a knowledge page to Tavus for every avatar that was asked", async () => {
    groupId = (await groupsFor(northline.id))[0].id
    const answered = await clientAdminA.client.rpc("answer_question", { p_group_id: groupId, p_answer: "Yes: $300, plus $35 a month in pet rent." })
    expect(answered.data).toMatchObject({ status: "answered", knowledge_status: "pending" })

    const res = await callFunction("knowledge-publish", { group_id: groupId }, { token: clientAdminA.token })
    expect(res).toMatchObject({ status: 200, body: { knowledge_status: "published" } })

    const tavus = await mockTavusState()
    expect(tavus.documents).toHaveLength(2)
    for (const [avatarId, palId] of [[maya, "p3a91c0de01"], [theo, "p7c20c0de02"]]) {
      const page = await pageFor(avatarId)
      const doc = tavus.documents.find((d) => d.document_id === page.tavus_document_id)!
      expect(doc.document_url).toBe(`${FUNCTIONS_URL}/knowledge-page/${page.page_token}`)
      expect(doc.crawl).toEqual({ depth: 1, max_pages: 1 })
      // Attached to the PAL without disturbing anything else on it.
      const pal = tavus.pals.find((p) => p.pal_id === palId)!
      expect(pal.document_ids).toEqual([doc.document_id])
      expect(pal.callback_url).toContain("/tavus-webhook/")
    }
  })

  it("serves the page Tavus reads: the answers for that avatar, and nothing else", async () => {
    const page = await pageFor(maya)
    const res = await fetch(`${FUNCTIONS_URL}/knowledge-page/${page.page_token}`)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain("# Questions and answers for Maya")
    expect(text).toContain("## Is there a pet deposit?")
    expect(text).toContain("$300, plus $35 a month in pet rent.")
    expect(text).not.toContain("walk-ins") // another client's question
    expect(text).not.toContain("Where do guests park") // not answered yet
    expect((await fetch(`${FUNCTIONS_URL}/knowledge-page/${"0".repeat(48)}`)).status).toBe(404)
    expect((await fetch(`${FUNCTIONS_URL}/knowledge-page/${page.page_token}`, { method: "POST" })).status).toBe(405)
  })

  it("asks Tavus to re-read the page when an answer changes", async () => {
    await clientAdminA.client.rpc("answer_question", { p_group_id: groupId, p_answer: "Yes: $350." })
    const res = await callFunction("knowledge-publish", { group_id: groupId }, { token: clientAdminA.token })
    expect(res.body.knowledge_status).toBe("published")
    const tavus = await mockTavusState()
    expect(tavus.documents).toHaveLength(2) // no new documents
    expect(tavus.recrawls).toHaveLength(2)
    const page = await pageFor(maya)
    expect(await (await fetch(`${FUNCTIONS_URL}/knowledge-page/${page.page_token}`)).text()).toContain("$350.")
  })

  it("waits and retries when Tavus says it is too soon to re-read", async () => {
    const state = await mockTavusState()
    await fetch(`${MOCK_TAVUS}/__control/reset`, { method: "POST", body: JSON.stringify({ pals: state.pals, documents: state.documents, recrawlStatus: 429 }) })
    await clientAdminA.client.rpc("answer_question", { p_group_id: groupId, p_answer: "Yes: $400." })
    const res = await callFunction("knowledge-publish", { group_id: groupId }, { token: clientAdminA.token })
    expect(res.body).toMatchObject({ knowledge_status: "pending", waiting: true })
    expect((await pageFor(maya)).needs_refresh).toBe(true)

    await fetch(`${MOCK_TAVUS}/__control/reset`, { method: "POST", body: JSON.stringify({ pals: state.pals, documents: state.documents }) })
    const retry = await callFunction("knowledge-publish", {}, CRON)
    expect(retry.body).toMatchObject({ retried: 2, published: 2 })
    expect((await groupsFor(northline.id))[0].knowledge_status).toBe("published")
  })

  it("dismissing a question removes its answer from the page", async () => {
    await clientAdminA.client.rpc("set_question_status", { p_group_id: groupId, p_status: "dismissed" })
    await callFunction("knowledge-publish", { group_id: groupId }, { token: clientAdminA.token })
    const page = await pageFor(maya)
    expect(await (await fetch(`${FUNCTIONS_URL}/knowledge-page/${page.page_token}`)).text()).toContain("No answers have been added yet.")
  })

  it("refuses people who may not answer for that client", async () => {
    expect((await callFunction("knowledge-publish", { group_id: groupId }, { token: clientAdminB.token })).status).toBe(403)
    expect((await callFunction("knowledge-publish", { group_id: groupId }, { token: clientMemberA.token })).status).toBe(403)
    expect((await callFunction("knowledge-publish", {}, { token: clientAdminA.token })).status).toBe(403)
  })
})
