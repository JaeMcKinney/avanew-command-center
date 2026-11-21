// Pure helpers shared with the server functions.

import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { hmacSha256Hex, timingSafeEqual, verifySvixSignature, verifyTavusSignature } from "../../supabase/functions/_shared/signature.ts"
import { emailAddress, htmlToText, replyAddress, stripQuotedReply, ticketReference } from "../../supabase/functions/_shared/support.ts"
import { toIso } from "../../supabase/functions/_shared/time.ts"

const bytes = (s: string) => new TextEncoder().encode(s)

describe("Tavus webhook signature", () => {
  const secret = "your-shared-secret"
  const body = '{"conversation_id":"c1","event_type":"system.shutdown","note":"café ☕"}'
  const good = createHmac("sha256", secret).update(body).digest("hex")

  it("matches Node's HMAC-SHA256 hex digest of the raw body", async () => {
    expect(await hmacSha256Hex(secret, bytes(body))).toBe(good)
    expect(await verifyTavusSignature(secret, bytes(body), good)).toBe(true)
  })

  it("fails for a wrong secret, a changed body, or a malformed header", async () => {
    expect(await verifyTavusSignature("other", bytes(body), good)).toBe(false)
    expect(await verifyTavusSignature(secret, bytes(body + " "), good)).toBe(false)
    expect(await verifyTavusSignature(secret, bytes(body), null)).toBe(false)
    expect(await verifyTavusSignature(secret, bytes(body), good.toUpperCase())).toBe(false)
    expect(await verifyTavusSignature(secret, bytes(body), good.slice(0, 60))).toBe(false)
  })

  it("compares strings of different lengths safely", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true)
    expect(timingSafeEqual("abc", "abd")).toBe(false)
    expect(timingSafeEqual("abc", "abcd")).toBe(false)
  })
})

describe("Tavus timestamps", () => {
  it("understands every format Tavus sends", () => {
    expect(toIso("2026-10-17T11:55:10.643621+00:00Z")).toBe("2026-10-17T11:55:10.643Z")
    expect(toIso("2024-08-28 15:27:40.824457")).toBe("2024-08-28T15:27:40.824Z")
    expect(toIso("2025-07-11T06:48:37.564961Z")).toBe("2025-07-11T06:48:37.564Z")
    expect(toIso("2026-11-10T18:47:00-05:00")).toBe("2026-11-10T23:47:00.000Z")
    expect(toIso("2026-04-30T22:11:14Z")).toBe("2026-04-30T22:11:14.000Z")
  })

  it("returns null for anything that is not a date", () => {
    expect(toIso("")).toBeNull()
    expect(toIso("soon")).toBeNull()
    expect(toIso(undefined)).toBeNull()
    expect(toIso(1779475660.12)).toBeNull()
  })
})

describe("support email", () => {
  it("reads an address out of a From line", () => {
    expect(emailAddress("Dana Reyes <Dana@Northline.test>")).toBe("dana@northline.test")
    expect(emailAddress("lee@northline.test")).toBe("lee@northline.test")
    expect(emailAddress("nobody")).toBeNull()
  })

  it("builds the reply address and reads the ticket back from it", () => {
    const address = replyAddress("Support <support@inbound.example.com>", 1001, "abcdef0123456789abcdef01")!
    expect(address).toBe("support+t1001-abcdef0123456789abcdef01@inbound.example.com")
    expect(ticketReference(["someone@else.com", address], "support@inbound.example.com")).toBe("t1001-abcdef0123456789abcdef01")
    expect(ticketReference(["support@inbound.example.com"], "support@inbound.example.com")).toBe("")
    expect(ticketReference(["support@other.example.com"], "support@inbound.example.com")).toBeNull()
    expect(ticketReference(["support+hello@inbound.example.com"], "support@inbound.example.com")).toBeNull()
  })

  it("keeps only what the person wrote", () => {
    expect(stripQuotedReply("Thanks!\n\nOn Fri, Nov 20, 2026 at 9:00 AM Divigner <a@b.co> wrote:\n> Fixed.")).toBe("Thanks!")
    expect(stripQuotedReply("Yes.\n\n— Reply above this line —\n\nOlder text")).toBe("Yes.")
    expect(stripQuotedReply("First line\n> quoted\nSecond line")).toBe("First line\nSecond line")
  })

  it("turns an HTML email into plain text", () => {
    expect(htmlToText("<style>p{}</style><p>Hello &amp; welcome</p><p>Line two<br>three</p>")).toBe("Hello & welcome\nLine two\nthree")
  })

  it("checks a webhook signature and its age", async () => {
    const secret = "whsec_" + Buffer.from("unit-test-secret").toString("base64")
    const body = '{"type":"email.received"}'
    const now = 1_800_000_000
    const sign = (t: number) => `v1,${createHmac("sha256", Buffer.from("unit-test-secret")).update(`msg_1.${t}.${body}`).digest("base64")}`
    expect(await verifySvixSignature(secret, body, { id: "msg_1", timestamp: String(now), signature: `v1,wrong ${sign(now)}` }, now)).toBe(true)
    expect(await verifySvixSignature(secret, body + " ", { id: "msg_1", timestamp: String(now), signature: sign(now) }, now)).toBe(false)
    expect(await verifySvixSignature(secret, body, { id: "msg_1", timestamp: String(now - 900), signature: sign(now - 900) }, now)).toBe(false)
    expect(await verifySvixSignature(secret, body, { id: null, timestamp: String(now), signature: sign(now) }, now)).toBe(false)
  })
})
