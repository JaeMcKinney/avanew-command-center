// The support desk: who may open, read and answer tickets, what stays internal,
// and how email goes out and comes in.

import { createHmac, randomUUID } from "node:crypto"
import { beforeAll, describe, expect, it } from "vitest"
import { admin, callFunction, createClientRow, createUser, FUNCTIONS_URL, MOCK_TAVUS, mockTavusState, resetDatabase, resetMockTavus, type TestUser } from "./helpers"

let owner: TestUser, manager: TestUser, analyst: TestUser, dana: TestUser, lee: TestUser, pat: TestUser
let northline: { id: string; slug: string }, harbor: { id: string; slug: string }
const CRON = { headers: { "x-cron-secret": "local-cron-secret" } }
const WEBHOOK_SECRET = "whsec_bG9jYWwtdGVzdC1zdXBwb3J0LXNlY3JldA=="
const INBOX = "support@inbound.divigner.test"

type Ticket = { id: string; number: number; status: string; priority: string; client_id: string }
const open = async (user: TestUser, clientId: string, subject = "Wrong hours", category = "question", extra: Record<string, unknown> = {}) =>
  user.client.rpc("support_open_ticket", { p_client_id: clientId, p_subject: subject, p_body: "Please help.", p_category: category, ...extra })
const reply = (user: TestUser, ticketId: string, body: string, internal = false, attachments: unknown[] = []) =>
  user.client.rpc("support_reply", { p_ticket_id: ticketId, p_body: body, p_internal: internal, p_attachments: attachments })
const ticketRow = async (id: string) => (await admin.from("support_tickets").select("*").eq("id", id).single()).data!
const emailsTo = async (address: string) => (await mockTavusState()).emails.filter((e) => e.to.includes(address))

/** Posts an "email received" event the way Resend does, signed with the webhook secret. */
async function inbound(email: { from: string; to: string[]; subject?: string; text?: string; html?: string; message_id?: string }, opts: { sign?: boolean } = {}) {
  const emailId = randomUUID()
  const state = await mockTavusState()
  await resetMockTavus({ emails: state.emails, received: { [emailId]: { message_id: `<${emailId}@mail.test>`, ...email } } })
  const body = JSON.stringify({ type: "email.received", data: { email_id: emailId } })
  const id = `msg_${emailId}`
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = Buffer.from(WEBHOOK_SECRET.replace("whsec_", ""), "base64")
  const signature = opts.sign === false ? "v1,bm90LXRoZS1zaWduYXR1cmU=" : `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`
  const res = await fetch(`${FUNCTIONS_URL}/support-inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature },
    body,
  })
  return { status: res.status, body: await res.json() }
}

beforeAll(async () => {
  resetDatabase()
  await admin.storage.emptyBucket("support")
  await resetMockTavus()
  owner = await createUser({ email: "owner@divigner.test", role: "owner" })
  northline = await createClientRow(owner, "Northline Realty", "northline")
  harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental")
  manager = await createUser({ email: "manager@divigner.test", role: "manager", assignedClientIds: [harbor.id] })
  analyst = await createUser({ email: "analyst@divigner.test", role: "analyst" })
  dana = await createUser({ email: "dana@northline.test", role: "client_admin", clientId: northline.id })
  lee = await createUser({ email: "lee@northline.test", role: "client_member", clientId: northline.id })
  pat = await createUser({ email: "pat@harbor.test", role: "client_admin", clientId: harbor.id })
})

describe("opening tickets", () => {
  it("lets a client open a ticket for their own company, numbered from 1001", async () => {
    const { data, error } = await open(dana, northline.id)
    expect(error).toBeNull()
    expect(data).toMatchObject({ number: 1001, status: "open", priority: "normal", opened_via: "portal", opened_by_name: "dana", message_count: 1, last_message_side: "client" })
  })

  it("marks a ticket about an avatar that is down as urgent", async () => {
    expect((await open(dana, northline.id, "Avatar is blank", "avatar_down")).data).toMatchObject({ priority: "urgent" })
  })

  it("refuses another company's client, staff who do not run the desk, and staff not assigned to the client", async () => {
    expect((await open(pat, northline.id)).error?.code).toBe("42501")
    expect((await open(analyst, northline.id)).error?.code).toBe("42501")
    expect((await open(manager, northline.id)).error?.code).toBe("42501")
  })

  it("lets staff open a ticket for a client, which then waits on the client", async () => {
    expect((await open(manager, harbor.id, "Your new avatar is ready to review")).data).toMatchObject({ status: "waiting", opened_via: "staff", last_message_side: "divigner" })
  })

  it("links a conversation only when it belongs to the same client", async () => {
    await admin.from("tavus_pals").upsert({ pal_id: "p-support", name: "Maya" })
    const avatar = (await admin.from("avatars").insert({ client_id: northline.id, tavus_pal_id: "p-support", display_name: "Maya" }).select("id").single()).data!
    await admin.from("conversations").insert({ conversation_id: "c-support-1", client_id: northline.id, avatar_id: avatar.id })
    expect((await open(dana, northline.id, "About a call", "question", { p_conversation_id: "c-support-1" })).data).toMatchObject({ conversation_id: "c-support-1" })
    expect((await open(pat, harbor.id, "About a call", "question", { p_conversation_id: "c-support-1" })).error?.code).toBe("22023")
  })

  it("does not let anyone write to the tables directly", async () => {
    expect((await dana.client.from("support_tickets").insert({ client_id: northline.id, subject: "x" })).error).not.toBeNull()
    expect((await owner.client.from("support_messages").update({ body: "edited" }).neq("body", "")).error).not.toBeNull()
    expect((await dana.client.from("support_ticket_secrets").select("*")).error).not.toBeNull()
  })
})

describe("the thread", () => {
  let ticket: Ticket

  beforeAll(async () => {
    ticket = (await open(dana, northline.id, "Maya gave the wrong hours")).data as Ticket
  })

  it("moves the ticket between the two sides as each replies", async () => {
    expect((await reply(owner, ticket.id, "Fixed. Can you confirm?")).error).toBeNull()
    let row = await ticketRow(ticket.id)
    expect(row).toMatchObject({ status: "waiting", last_message_side: "divigner", message_count: 2 })
    expect(row.first_response_at).not.toBeNull()

    expect((await reply(lee, ticket.id, "Confirmed, thank you.")).error).toBeNull()
    row = await ticketRow(ticket.id)
    expect(row).toMatchObject({ status: "open", last_message_side: "client", message_count: 3 })
  })

  it("keeps internal notes away from the client and out of the reply count", async () => {
    expect((await reply(owner, ticket.id, "Their hours page is out of date.", true)).error).toBeNull()
    expect((await ticketRow(ticket.id)).message_count).toBe(3)
    const staffView = (await owner.client.from("support_messages").select("body, is_internal").eq("ticket_id", ticket.id)).data!
    const clientView = (await dana.client.from("support_messages").select("body, is_internal").eq("ticket_id", ticket.id)).data!
    expect(staffView.some((m) => m.is_internal)).toBe(true)
    expect(clientView.some((m) => m.is_internal)).toBe(false)
    expect(clientView.map((m) => m.body)).not.toContain("Their hours page is out of date.")
  })

  it("does not let a client write an internal note", async () => {
    expect((await reply(dana, ticket.id, "secret", true)).error?.code).toBe("42501")
  })

  it("shows a ticket only to its own company and to staff who run the desk for it", async () => {
    const seenBy = async (user: TestUser) => ((await user.client.from("support_tickets").select("id").eq("id", ticket.id)).data ?? []).length
    expect(await seenBy(dana)).toBe(1)
    expect(await seenBy(lee)).toBe(1)
    expect(await seenBy(owner)).toBe(1)
    expect(await seenBy(pat)).toBe(0)
    expect(await seenBy(manager)).toBe(0) // not assigned to Northline
    expect(await seenBy(analyst)).toBe(0) // does not run the desk
    expect((await reply(pat, ticket.id, "hello")).error?.code).toBe("42501")
    expect((await reply(manager, ticket.id, "hello")).error?.code).toBe("42501")
  })

  it("lets the client resolve and reopen, but only staff set it to waiting", async () => {
    expect((await dana.client.rpc("support_set_status", { p_ticket_id: ticket.id, p_status: "resolved" })).error).toBeNull()
    let row = await ticketRow(ticket.id)
    expect(row.status).toBe("resolved")
    expect(row.resolved_at).not.toBeNull()
    expect((await dana.client.rpc("support_set_status", { p_ticket_id: ticket.id, p_status: "waiting" })).error?.code).toBe("22023")
    expect((await reply(dana, ticket.id, "One more thing.")).error).toBeNull()
    row = await ticketRow(ticket.id)
    expect(row).toMatchObject({ status: "open", resolved_at: null })
    const events = (await dana.client.from("support_messages").select("body").eq("ticket_id", ticket.id).eq("kind", "event")).data!
    expect(events.map((e) => e.body)).toContain("Marked as resolved")
  })

  it("lets staff assign, and set priority, and refuses both to clients", async () => {
    expect((await owner.client.rpc("support_assign", { p_ticket_id: ticket.id, p_assignee_id: owner.id })).error).toBeNull()
    expect(await ticketRow(ticket.id)).toMatchObject({ assignee_id: owner.id, assignee_name: "owner" })
    expect((await owner.client.rpc("support_assign", { p_ticket_id: ticket.id, p_assignee_id: manager.id })).error?.code).toBe("22023") // not assigned to Northline
    expect((await owner.client.rpc("support_assign", { p_ticket_id: ticket.id, p_assignee_id: dana.id })).error?.code).toBe("22023")
    expect((await owner.client.rpc("support_update_ticket", { p_ticket_id: ticket.id, p_priority: "high" })).error).toBeNull()
    expect((await ticketRow(ticket.id)).priority).toBe("high")
    expect((await dana.client.rpc("support_assign", { p_ticket_id: ticket.id, p_assignee_id: owner.id })).error?.code).toBe("42501")
    expect((await dana.client.rpc("support_update_ticket", { p_ticket_id: ticket.id, p_priority: "urgent" })).error?.code).toBe("42501")
    // The priority change is recorded for staff only.
    const clientEvents = (await dana.client.from("support_messages").select("body").eq("ticket_id", ticket.id).eq("kind", "event")).data!
    expect(clientEvents.map((e) => e.body)).not.toContain("Priority set to high")
    expect((await owner.client.rpc("support_staff", { p_client_id: northline.id })).data!.map((s: { email: string }) => s.email)).toEqual(["owner@divigner.test"])
    expect((await dana.client.rpc("support_staff", { p_client_id: northline.id })).data).toEqual([])
  })
})

describe("attached files", () => {
  const file = new Blob(["%PDF-1.7 test"], { type: "application/pdf" })
  let ticket: Ticket

  beforeAll(async () => {
    ticket = (await open(dana, northline.id, "Screenshot attached")).data as Ticket
  })

  it("lets a person attach a file they uploaded, and only people who can read the message open it", async () => {
    const path = `${northline.id}/${dana.id}/${randomUUID()}/screen.pdf`
    expect((await dana.client.storage.from("support").upload(path, file, { contentType: "application/pdf" })).error).toBeNull()
    expect((await reply(dana, ticket.id, "See the file.", false, [{ path, name: "screen.pdf", size: 13 }])).error).toBeNull()
    expect((await lee.client.storage.from("support").createSignedUrl(path, 60)).error).toBeNull()
    expect((await owner.client.storage.from("support").createSignedUrl(path, 60)).error).toBeNull()
    expect((await pat.client.storage.from("support").createSignedUrl(path, 60)).error).not.toBeNull()
  })

  it("keeps a file on an internal note away from the client", async () => {
    const path = `${northline.id}/${owner.id}/${randomUUID()}/notes.pdf`
    expect((await owner.client.storage.from("support").upload(path, file, { contentType: "application/pdf" })).error).toBeNull()
    expect((await reply(owner, ticket.id, "Internal file.", true, [{ path, name: "notes.pdf", size: 13 }])).error).toBeNull()
    expect((await owner.client.storage.from("support").createSignedUrl(path, 60)).error).toBeNull()
    expect((await dana.client.storage.from("support").createSignedUrl(path, 60)).error).not.toBeNull()
  })

  it("refuses files in another person's or another client's folder, and files that do not exist", async () => {
    expect((await dana.client.storage.from("support").upload(`${northline.id}/${lee.id}/${randomUUID()}/x.pdf`, file, { contentType: "application/pdf" })).error).not.toBeNull()
    expect((await pat.client.storage.from("support").upload(`${northline.id}/${pat.id}/${randomUUID()}/x.pdf`, file, { contentType: "application/pdf" })).error).not.toBeNull()
    expect((await reply(dana, ticket.id, "Ghost file.", false, [{ path: `${northline.id}/${dana.id}/nope/x.pdf`, name: "x.pdf", size: 1 }])).error?.code).toBe("22023")
    const others = `${northline.id}/${owner.id}/${randomUUID()}/theirs.pdf`
    await owner.client.storage.from("support").upload(others, file, { contentType: "application/pdf" })
    expect((await reply(dana, ticket.id, "Someone else's file.", false, [{ path: others, name: "theirs.pdf", size: 13 }])).error?.code).toBe("22023")
  })
})

describe("email", () => {
  let ticket: Ticket

  beforeAll(async () => {
    resetDatabase()
    await resetMockTavus()
    owner = await createUser({ email: "owner@divigner.test", role: "owner" })
    northline = await createClientRow(owner, "Northline Realty", "northline")
    harbor = await createClientRow(owner, "Harbor Dental", "harbor-dental")
    manager = await createUser({ email: "manager@divigner.test", role: "manager", assignedClientIds: [harbor.id] })
    dana = await createUser({ email: "dana@northline.test", role: "client_admin", clientId: northline.id })
    lee = await createUser({ email: "lee@northline.test", role: "client_member", clientId: northline.id })
    pat = await createUser({ email: "pat@harbor.test", role: "client_admin", clientId: harbor.id })
  })

  it("needs a signed-in user or the schedule's secret", async () => {
    expect((await callFunction("support-notify", {})).status).toBe(401)
    expect((await callFunction("support-notify", {}, { headers: { "x-cron-secret": "wrong" } })).status).toBe(401)
  })

  it("emails a client's new ticket to the staff who run the desk for that client, once", async () => {
    ticket = (await open(dana, northline.id, "Maya gave the wrong hours")).data as Ticket
    const res = await callFunction("support-notify", {}, { token: dana.token })
    expect(res.body).toMatchObject({ messages: 1, sent: 1, failed: 0 })
    const toOwner = await emailsTo("owner@divigner.test")
    expect(toOwner).toHaveLength(1)
    expect(toOwner[0].subject).toBe(`[Ticket #${ticket.number}] Maya gave the wrong hours`)
    expect(toOwner[0].text).toContain("dana at Northline Realty wrote")
    expect(toOwner[0].text).toContain(`/admin/support/${ticket.number}`)
    expect(await emailsTo("manager@divigner.test")).toHaveLength(0) // not assigned to Northline
    expect(await emailsTo("dana@northline.test")).toHaveLength(0) // never the author
    expect((await callFunction("support-notify", {}, CRON)).body).toMatchObject({ messages: 0 })
  })

  it("emails a staff reply to the client's people on the ticket, with an address to reply to, and never an internal note", async () => {
    await reply(owner, ticket.id, "Internal thinking.", true)
    await reply(owner, ticket.id, "Fixed. Can you confirm?")
    expect((await callFunction("support-notify", {}, CRON)).body).toMatchObject({ messages: 1, sent: 1 })
    const toDana = await emailsTo("dana@northline.test")
    expect(toDana).toHaveLength(1)
    expect(toDana[0].text).toContain("owner at Divigner wrote")
    expect(toDana[0].text).toContain(`/c/northline/support/${ticket.number}`)
    expect(toDana[0].text).not.toContain("Internal thinking.")
    expect((toDana[0] as unknown as { reply_to: string }).reply_to).toMatch(new RegExp(`^support\\+t${ticket.number}-[0-9a-f]{24}@inbound\\.divigner\\.test$`))
    expect(await emailsTo("lee@northline.test")).toHaveLength(0) // has not taken part
  })

  it("alerts the Owners as well when the ticket is urgent and someone else is assigned", async () => {
    const urgent = (await open(pat, harbor.id, "Avatar is down", "avatar_down")).data as Ticket
    await owner.client.rpc("support_assign", { p_ticket_id: urgent.id, p_assignee_id: manager.id })
    await reply(pat, urgent.id, "Still down.")
    await callFunction("support-notify", {}, CRON)
    expect((await emailsTo("manager@divigner.test")).filter((e) => e.text.includes("Still down."))).toHaveLength(1)
    expect((await emailsTo("owner@divigner.test")).filter((e) => e.text.includes("Still down."))).toHaveLength(1)
  })

  it("tries again later when the email service fails", async () => {
    const state = await mockTavusState()
    await resetMockTavus({ emails: state.emails, emailStatus: 500 })
    await reply(dana, ticket.id, "Yes, confirmed.")
    expect((await callFunction("support-notify", {}, CRON)).body).toMatchObject({ messages: 1, failed: 1 })
    await resetMockTavus({ emails: state.emails })
    expect((await callFunction("support-notify", {}, CRON)).body).toMatchObject({ messages: 1, sent: 1 })
  })

  it("files a signed reply-by-email on its ticket, without the quoted text", async () => {
    const replyTo = ((await emailsTo("dana@northline.test"))[0] as unknown as { reply_to: string }).reply_to
    const res = await inbound({
      from: "Dana Reyes <Dana@Northline.test>", to: [replyTo], subject: "Re: [Ticket] Maya gave the wrong hours",
      text: "Sunday hours are right.\n\nOn Fri, Nov 20, 2026 at 9:00 AM Divigner <support@divigner.test> wrote:\n> Fixed. Can you confirm?",
    })
    expect(res).toMatchObject({ status: 200, body: { status: "added", ticket_number: ticket.number } })
    const last = (await admin.from("support_messages").select("body, via, author_side, author_id").eq("ticket_id", ticket.id).order("created_at", { ascending: false }).limit(1)).data![0]
    expect(last).toMatchObject({ body: "Sunday hours are right.", via: "email", author_side: "client", author_id: dana.id })
    expect((await ticketRow(ticket.id)).status).toBe("open")
  })

  it("opens a new ticket from an email to the plain support address", async () => {
    const res = await inbound({ from: "lee@northline.test", to: [INBOX], subject: "Change our greeting", html: "<p>Please greet visitors with &quot;Welcome to Northline&quot;.</p>" })
    expect(res.body).toMatchObject({ status: "opened" })
    const row = (await admin.from("support_tickets").select("*").eq("number", res.body.ticket_number).single()).data!
    expect(row).toMatchObject({ client_id: northline.id, subject: "Change our greeting", opened_via: "email", opened_by: lee.id, status: "open" })
  })

  it("accepts the same email only once", async () => {
    const email = { from: "lee@northline.test", to: [INBOX], subject: "Twice", text: "Sent twice.", message_id: "<same@mail.test>" }
    expect((await inbound(email)).body).toMatchObject({ status: "opened" })
    expect((await inbound(email)).body).toMatchObject({ status: "duplicate" })
  })

  it("refuses unknown senders, another company's ticket, a wrong reference and a bad signature", async () => {
    const replyTo = ((await emailsTo("dana@northline.test"))[0] as unknown as { reply_to: string }).reply_to
    const before = (await admin.from("support_messages").select("id", { count: "exact", head: true })).count
    expect((await inbound({ from: "stranger@elsewhere.test", to: [INBOX], subject: "Hi", text: "Let me in." })).body).toMatchObject({ status: "rejected", reason: "unknown_sender" })
    expect((await inbound({ from: "pat@harbor.test", to: [replyTo], text: "Not my ticket." })).body).toMatchObject({ status: "rejected", reason: "bad_reference" })
    expect((await inbound({ from: "dana@northline.test", to: [`support+t${ticket.number}-${"0".repeat(24)}@inbound.divigner.test`], text: "Guessing." })).body).toMatchObject({ status: "rejected", reason: "bad_reference" })
    expect((await inbound({ from: "dana@northline.test", to: ["someone@else.test"], text: "Wrong inbox." })).body).toMatchObject({ status: "ignored" })
    expect((await inbound({ from: "dana@northline.test", to: [replyTo], text: "Forged." }, { sign: false })).status).toBe(401)
    expect((await admin.from("support_messages").select("id", { count: "exact", head: true })).count).toBe(before)
    expect(MOCK_TAVUS).toContain("54398")
  })
})
