// Tavus events → conversations → daily talk-time totals.

import { beforeAll, describe, expect, it } from "vitest"
import { admin, createClientRow, createUser, event, ingest, resetDatabase, seedAvatar, type TestUser } from "./helpers"

let owner: TestUser, analyst: TestUser, clientA: TestUser, clientB: TestUser
let northline: { id: string }, harbor: { id: string }
let maya: { id: string }, theo: { id: string }, zara: { id: string }

async function conversation(id: string) {
  const { data } = await admin.from("conversations").select("*").eq("conversation_id", id).single()
  return data!
}
async function day(avatarId: string, date: string) {
  const { data } = await admin.from("usage_daily").select("*").eq("avatar_id", avatarId).eq("usage_date", date).maybeSingle()
  return data
}

beforeAll(async () => {
  resetDatabase()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  northline = await createClientRow(owner, "Northline Realty", "northline", "America/New_York")
  harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental", "America/Los_Angeles")
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  clientA = await createUser({ email: "admin@northline.test", role: "client_admin", clientId: northline.id })
  clientB = await createUser({ email: "admin@harbor.test", role: "client_admin", clientId: harbor.id })
  maya = await seedAvatar(northline.id, "pmaya", "Maya")
  theo = await seedAvatar(northline.id, "ptheo", "Theo")
  zara = await seedAvatar(harbor.id, "pzara", "Zara")
})

describe("counting talk time", () => {
  it("measures from the avatar joining to the room shutting down", async () => {
    await ingest(maya.id, event("c1", "system.pal_joined", "2026-11-10T15:00:00.000000Z"))
    const open = await conversation("c1")
    expect(open.talk_seconds).toBeNull() // still in progress: not counted yet
    expect(await day(maya.id, "2026-11-10")).toBeNull()

    const done = await ingest(maya.id, event("c1", "system.shutdown", "2026-11-10T15:02:05.000000Z", { shutdown_reason: "participant_left_timeout" }))
    expect(done.talk_seconds).toBe(125)
    expect(done.billable_seconds).toBe(126) // nearest 6 seconds, as Tavus bills
    expect((await conversation("c1")).shutdown_reason).toBe("participant_left_timeout")
    expect(await day(maya.id, "2026-11-10")).toMatchObject({ conversations: 1, talk_seconds: 125, billable_seconds: 126, client_id: northline.id })
  })

  it("applies the 30-second minimum to a very short call", async () => {
    await ingest(maya.id, event("c2", "system.pal_joined", "2026-11-10T16:00:00Z"))
    const done = await ingest(maya.id, event("c2", "system.shutdown", "2026-11-10T16:00:10Z"))
    expect(done).toMatchObject({ talk_seconds: 10, billable_seconds: 30 })
    expect(await day(maya.id, "2026-11-10")).toMatchObject({ conversations: 2, talk_seconds: 135, billable_seconds: 156 })
  })

  it("does not double count when Tavus sends an event twice", async () => {
    const again = await ingest(maya.id, event("c2", "system.shutdown", "2026-11-10T16:00:10Z"))
    expect(again.stored).toBe(false)
    // Tavus also sends a legacy copy of the join event under another name.
    await ingest(maya.id, event("c2", "system.replica_joined", "2026-11-10T16:00:00Z"))
    // And the backup check may deliver the same events again later.
    const backup = await ingest(maya.id, event("c2", "system.shutdown", "2026-11-10T16:00:10+00:00"), "backfill")
    expect(backup.stored).toBe(false)
    expect(await day(maya.id, "2026-11-10")).toMatchObject({ conversations: 2, talk_seconds: 135, billable_seconds: 156 })
  })

  it("gets the same answer when events arrive out of order", async () => {
    await ingest(theo.id, event("c3", "system.shutdown", "2026-11-10T18:05:00Z"))
    expect((await conversation("c3")).talk_seconds).toBe(0)
    const fixed = await ingest(theo.id, event("c3", "system.pal_joined", "2026-11-10T18:00:00Z"))
    expect(fixed).toMatchObject({ talk_seconds: 300, billable_seconds: 300 })
    expect(await day(theo.id, "2026-11-10")).toMatchObject({ conversations: 1, talk_seconds: 300 })
  })

  it("counts a call that never connected as zero", async () => {
    const failed = await ingest(theo.id, event("c4", "system.shutdown", "2026-11-10T19:00:00Z", { shutdown_reason: "exception_encountered_during_conversation_startup" }))
    expect(failed).toMatchObject({ talk_seconds: 0, billable_seconds: 0 })
    expect(await day(theo.id, "2026-11-10")).toMatchObject({ conversations: 2, talk_seconds: 300, billable_seconds: 300 })
  })

  it("puts a late-night call on the right day for the client's time zone", async () => {
    // 03:30 UTC on Nov 11 is 10:30 pm on Nov 10 in New York, and 7:30 pm in Los Angeles.
    await ingest(theo.id, event("c5", "system.pal_joined", "2026-11-11T03:30:00Z"))
    const ny = await ingest(theo.id, event("c5", "system.shutdown", "2026-11-11T03:31:00Z"))
    expect(ny.usage_date).toBe("2026-11-10")
    // 07:30 UTC on Nov 11 is already Nov 11 in New York but still Nov 10 in Los Angeles.
    await ingest(zara.id, event("c6", "system.pal_joined", "2026-11-11T07:30:00Z"))
    const la = await ingest(zara.id, event("c6", "system.shutdown", "2026-11-11T07:32:00Z"))
    expect(la.usage_date).toBe("2026-11-10")
  })

  it("keeps the transcript and speaking time", async () => {
    await ingest(maya.id, event("c1", "application.transcription_ready", "2026-11-10T15:02:06Z", {
      transcript: [
        { role: "system", content: "You are Maya." },
        { role: "user", content: "Do you allow pets?", duration: 2.5, seconds_from_start: 4 },
        { role: "assistant", content: "Cats and small dogs are welcome.", duration: 3.25, seconds_from_start: 7 },
        { role: "user", content: "Great, thanks.", duration: 1 },
      ],
    }))
    expect(await conversation("c1")).toMatchObject({ turns: 3, has_transcript: true, talk_seconds: 125 })
    expect(Number((await conversation("c1")).visitor_speech_seconds)).toBe(3.5)
    expect(Number((await conversation("c1")).avatar_speech_seconds)).toBe(3.25)
    const { data } = await admin.from("transcripts").select("turns").eq("conversation_id", "c1").single()
    expect(data!.turns).toHaveLength(4)
  })

  it("stores other event types without changing the totals", async () => {
    const before = await day(maya.id, "2026-11-10")
    const r = await ingest(maya.id, event("c1", "application.perception_analysis", "2026-11-10T15:03:00Z", { analysis: "Visitor at a desk." }))
    expect(r.stored).toBe(true)
    expect(await day(maya.id, "2026-11-10")).toEqual(before)
  })

  it("stores but does not count events for an avatar it does not know", async () => {
    const r = await ingest("00000000-0000-0000-0000-000000000000", event("c-unknown", "system.shutdown", "2026-11-10T15:00:00Z"))
    expect(r).toMatchObject({ stored: true, counted: false })
  })

  it("uses the rounding settings", async () => {
    await admin.from("settings").update({ value: 60 }).eq("key", "usage.round_to_seconds")
    await admin.from("settings").update({ value: 0 }).eq("key", "usage.minimum_seconds")
    await ingest(zara.id, event("c7", "system.pal_joined", "2026-11-12T20:00:00Z"))
    const r = await ingest(zara.id, event("c7", "system.shutdown", "2026-11-12T20:01:40Z"))
    expect(r).toMatchObject({ talk_seconds: 100, billable_seconds: 120 })
    await admin.from("settings").update({ value: 6 }).eq("key", "usage.round_to_seconds")
    await admin.from("settings").update({ value: 30 }).eq("key", "usage.minimum_seconds")
  })
})

describe("reading usage", () => {
  it("a client sees only their own numbers", async () => {
    const a = await clientA.client.rpc("usage_by_avatar", { p_client_id: northline.id, p_from: "2026-11-01", p_to: "2026-11-30" })
    expect(a.error).toBeNull()
    const byAvatar = Object.fromEntries(a.data.map((r: any) => [r.avatar_id, r]))
    expect(byAvatar[maya.id]).toMatchObject({ conversations: 2, talk_seconds: 135, billable_seconds: 156 })
    expect(byAvatar[theo.id]).toMatchObject({ conversations: 3, talk_seconds: 360 })

    const other = await clientA.client.rpc("usage_by_avatar", { p_client_id: harbor.id, p_from: "2026-11-01", p_to: "2026-11-30" })
    expect(other.data).toEqual([])
    const rows = await clientA.client.from("usage_daily").select("client_id")
    expect(new Set(rows.data!.map((r) => r.client_id))).toEqual(new Set([northline.id]))
    const convs = await clientB.client.from("conversations").select("conversation_id").order("conversation_id")
    expect(convs.data!.map((c) => c.conversation_id)).toEqual(["c6", "c7"])
  })

  it("staff see every client, by client and by day", async () => {
    const byClient = await analyst.client.rpc("usage_by_client", { p_from: "2026-11-01", p_to: "2026-11-30" })
    const map = Object.fromEntries(byClient.data.map((r: any) => [r.client_id, r]))
    expect(map[northline.id]).toMatchObject({ conversations: 5, talk_seconds: 495 })
    expect(map[harbor.id]).toMatchObject({ conversations: 2, talk_seconds: 220 })

    const byDay = await analyst.client.rpc("usage_by_day", { p_client_id: null, p_from: "2026-11-10", p_to: "2026-11-10" })
    expect(byDay.data).toEqual([{ usage_date: "2026-11-10", conversations: 6, talk_seconds: 615, billable_seconds: 636 }])
    const oneClient = await analyst.client.rpc("usage_by_day", { p_client_id: harbor.id, p_from: "2026-11-01", p_to: "2026-11-30" })
    expect(oneClient.data.map((r: any) => r.usage_date)).toEqual(["2026-11-10", "2026-11-12"])
  })

  it("transcripts need their own permission", async () => {
    // Analysts see dashboards but not what was said.
    expect((await analyst.client.from("conversations").select("conversation_id")).data!.length).toBeGreaterThan(0)
    expect((await analyst.client.from("transcripts").select("conversation_id")).data).toEqual([])
    expect((await clientA.client.from("transcripts").select("conversation_id")).data).toEqual([{ conversation_id: "c1" }])
    expect((await clientB.client.from("transcripts").select("conversation_id")).data).toEqual([])
  })

  it("staff read what was said only while the client allows it", async () => {
    const said = async (user: TestUser) => ({
      transcripts: ((await user.client.from("transcripts").select("conversation_id").eq("client_id", northline.id)).data ?? []).length,
      mayRead: (await user.client.rpc("can_read_transcripts", { p_client_id: northline.id })).data,
    })
    // The Owner sees the conversation and its numbers, not the words.
    expect((await owner.client.from("conversations").select("conversation_id").eq("conversation_id", "c1")).data).toHaveLength(1)
    expect(await said(owner)).toEqual({ transcripts: 0, mayRead: false })
    expect(await said(clientA)).toEqual({ transcripts: 1, mayRead: true })

    // Staff cannot give it to themselves, another client cannot give it, and the length is one of a few.
    expect((await owner.client.rpc("grant_transcript_access", { p_client_id: northline.id, p_hours: 24 })).error?.code).toBe("42501")
    expect((await clientB.client.rpc("grant_transcript_access", { p_client_id: northline.id, p_hours: 24 })).error?.code).toBe("42501")
    expect((await clientA.client.rpc("grant_transcript_access", { p_client_id: northline.id, p_hours: 5000 })).error?.code).toBe("22023")

    // The client allows it for a day: staff with the transcripts permission can read, others still cannot.
    const granted = await clientA.client.rpc("grant_transcript_access", { p_client_id: northline.id, p_hours: 24, p_reason: "Ticket 12" })
    expect(granted.error).toBeNull()
    expect(new Date(granted.data.expires_at).getTime() - Date.now()).toBeGreaterThan(23 * 3_600_000)
    expect(await said(owner)).toEqual({ transcripts: 1, mayRead: true })
    expect(await said(analyst)).toEqual({ transcripts: 0, mayRead: false })
    expect((await owner.client.from("transcripts").select("conversation_id").eq("client_id", harbor.id)).data).toEqual([])
    expect((await owner.client.from("transcript_access").select("reason, granted_by_name")).data).toEqual([{ reason: "Ticket 12", granted_by_name: expect.any(String) }])
    expect(((await admin.from("audit_log").select("action").eq("action", "transcripts.access_granted")).data ?? []).length).toBe(1)

    // It runs out on its own.
    await admin.from("transcript_access").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("client_id", northline.id)
    expect(await said(owner)).toEqual({ transcripts: 0, mayRead: false })

    // And the client, or staff handing it back, can end it early.
    await clientA.client.rpc("grant_transcript_access", { p_client_id: northline.id, p_hours: 168 })
    expect((await clientB.client.rpc("revoke_transcript_access", { p_client_id: northline.id })).error?.code).toBe("42501")
    expect((await owner.client.rpc("revoke_transcript_access", { p_client_id: northline.id })).error).toBeNull()
    expect(await said(owner)).toEqual({ transcripts: 0, mayRead: false })
    await clientA.client.rpc("grant_transcript_access", { p_client_id: northline.id, p_hours: 72 })
    expect((await clientA.client.rpc("revoke_transcript_access", { p_client_id: northline.id })).error).toBeNull()
    expect((await admin.from("transcript_access").select("client_id")).data).toEqual([])
  })

  it("nobody signed in can inject events or read webhook secrets", async () => {
    const inject = await clientA.client.rpc("ingest_tavus_event", { p_avatar_id: maya.id, p_payload: event("x", "system.shutdown", "2026-11-10T15:00:00Z") })
    expect(inject.error).not.toBeNull()
    for (const user of [owner, clientA]) {
      const secrets = await user.client.from("avatar_secrets").select("*")
      expect(secrets.data ?? []).toEqual([])
    }
    const raw = await clientA.client.from("tavus_events").select("id")
    expect(raw.data).toEqual([])
    const write = await clientA.client.from("usage_daily").update({ talk_seconds: 0 }).eq("client_id", northline.id).select()
    expect(write.error).not.toBeNull()
  })
})
