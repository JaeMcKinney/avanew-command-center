// Pure helpers shared with the server functions.

import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { hmacSha256Hex, timingSafeEqual, verifyTavusSignature } from "../../supabase/functions/_shared/signature.ts"
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
