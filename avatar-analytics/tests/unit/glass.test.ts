// The Glass Health helpers: the pure parts of the server code, and the sums the screens show.

import { describe, expect, it } from "vitest"
import { askGlass, buildGlassPrompt, checkGlassKey, glassFailureMessage, spokenAnswer, topSources } from "../../supabase/functions/_shared/glass.ts"
import { sumGlass } from "../../src/lib/glass"
import { bucketColumns } from "../../src/lib/buckets"
import { compact, estimate } from "../../src/lib/format"

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

describe("the question sent to Glass", () => {
  it("carries the question, asks for a short spoken answer, and names the language", () => {
    const prompt = buildGlassPrompt("  What is first-line for hypertension?  ", "es")
    expect(prompt).toContain("<clinical_task>What is first-line for hypertension?</clinical_task>")
    expect(prompt).toContain("Answer in Spanish")
    expect(prompt).toMatch(/under 90 words/)
    expect(buildGlassPrompt("Q", "xx")).toContain("Answer in English")
  })
})

describe("making an answer speakable", () => {
  it("drops citation markers and formatting", () => {
    expect(spokenAnswer("**Start** an ACE inhibitor [1]. \n\n- Recheck in *four* weeks [2,3].\n## Notes\nUse `mg` doses [4-6] .")).toBe(
      "Start an ACE inhibitor. Recheck in four weeks. Notes Use mg doses.",
    )
    expect(spokenAnswer("Three months is recommended.<ref_1/><ref_3/> Extend it if the cause persists.<ref_2/>")).toBe(
      "Three months is recommended. Extend it if the cause persists.",
    )
    expect(spokenAnswer("Plain sentence.")).toBe("Plain sentence.")
  })

  it("names at most three sources, whatever kind they are", () => {
    const sources = topSources([
      { title: "A Trial", journal_title: "NEJM", year: 2024, url: "https://example.org/a" },
      { title: "a trial", journal_title: "NEJM", year: 2024, url: "https://example.org/a#2" },
      { generic_name: "lisinopril", url: "http://insecure.example" },
      { display: { heading: "I10", subheading: "ICD-10-CM" } },
      {},
      { title: "Fourth" },
    ])
    expect(sources).toEqual([
      { title: "A Trial", detail: "NEJM, 2024", url: "https://example.org/a" },
      { title: "lisinopril", detail: null, url: null },
      { title: "I10", detail: "ICD-10-CM", url: null },
    ])
    expect(topSources(null)).toEqual([])
  })
})

describe("asking Glass", () => {
  it("sends the client's key and reports the answer with its token counts", async () => {
    let seen: { url: string; headers: Headers; body: Record<string, unknown> } | undefined
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) }
      return reply(200, { text: "Yes.", references: [{ title: "T" }], usage: { inputTokens: 22683, outputTokens: 330 } }, { "x-glass-request-id": "req-1" })
    }) as unknown as typeof fetch
    const outcome = await askGlass("the-key", "prompt", { conversationId: "c1" }, { base: "https://glass.example/api/", fetchImpl })
    expect(outcome).toMatchObject({ ok: true, text: "Yes.", inputTokens: 22683, outputTokens: 330, requestId: "req-1", version: "5.5-2026-03-31" })
    expect(seen!.url).toBe("https://glass.example/api/v2/messages")
    expect(seen!.headers.get("X-Api-Key")).toBe("the-key")
    expect(seen!.body).toEqual({ messages: [{ role: "user", content: "prompt" }], version: "5.5-2026-03-31", stream: false, metadata: { conversationId: "c1" } })
  })

  it("tells the failures apart, and only a stumble on Glass's side is worth another try", async () => {
    const ask = (res: () => Promise<Response>) => askGlass("k", "p", {}, { fetchImpl: res as unknown as typeof fetch, timeoutMs: 50 })
    expect(await ask(async () => reply(401, "Invalid API key"))).toMatchObject({ ok: false, code: "invalid_key", retryable: false })
    expect(await ask(async () => reply(402, {}))).toMatchObject({ ok: false, code: "past_due", retryable: false })
    expect(await ask(async () => reply(429, {}))).toMatchObject({ ok: false, code: "rate_limited", retryable: false })
    expect(await ask(async () => reply(503, {}))).toMatchObject({ ok: false, code: "glass_error", retryable: true })
    // Glass reports a failed generation with a 200 and an error field.
    expect(await ask(async () => reply(200, { text: "", error: { errorCode: "tokens_exceeded" } }))).toMatchObject({ ok: false, code: "glass_error", retryable: false })
    expect(await ask(async () => reply(200, "not json"))).toMatchObject({ ok: false, code: "bad_response" })
    expect(await ask(async () => { throw new Error("offline") })).toMatchObject({ ok: false, code: "unreachable", retryable: true })
    const slow = (_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted"))))
    expect(await askGlass("k", "p", {}, { fetchImpl: slow as unknown as typeof fetch, timeoutMs: 20 })).toMatchObject({ ok: false, code: "timeout", retryable: false })
  })

  it("checks a key with an empty question, which costs nothing", async () => {
    const check = (status: number) => checkGlassKey("k", { fetchImpl: (async () => reply(status, {})) as unknown as typeof fetch })
    expect((await check(400)).status).toBe("ok")
    expect((await check(401)).status).toBe("invalid")
    expect((await check(402)).status).toBe("past_due")
    expect((await check(500)).status).toBe("error")
    expect((await checkGlassKey("k", { fetchImpl: (async () => { throw new Error("offline") }) as unknown as typeof fetch })).status).toBe("error")
  })

  it("has a plain sentence for every way it can fail", () => {
    for (const code of ["no_key", "invalid_key", "past_due", "rate_limited", "timeout", "unreachable", "glass_error", "bad_response"] as const) {
      expect(glassFailureMessage(code)).toMatch(/Glass Health/)
    }
  })
})

describe("what the screens show", () => {
  it("adds usage up and leaves the cost empty when no rates are set", () => {
    const row = { questions: 2, failed: 1, input_tokens: 24000, output_tokens: 360, duration_ms: 14000, cost_cents: null }
    expect(sumGlass([row, row])).toEqual({ questions: 4, failed: 2, input_tokens: 48000, output_tokens: 720, duration_ms: 28000, cost_cents: null })
    expect(sumGlass([row, { ...row, cost_cents: 5.16 }]).cost_cents).toBeCloseTo(5.16)
    expect(sumGlass([])).toMatchObject({ questions: 0, cost_cents: null })
  })

  it("formats token counts and estimates", () => {
    expect(compact(553_466)).toBe("553.5K")
    expect(compact(2_900_000)).toBe("2.9M")
    expect(compact(null)).toBe("0")
    expect(estimate(146.2)).toBe("$1.46")
    expect(estimate(0)).toBe("$0.00")
    expect(estimate(null)).toBe("—")
  })

  it("buckets plain counts as well as seconds", () => {
    const range = { from: "2026-11-01", to: "2026-11-03" }
    const days = new Map([["2026-11-01", 6], ["2026-11-03", 2]])
    expect(bucketColumns(range, days, 1).map((c) => c.value)).toEqual([6, 0, 2])
    expect(bucketColumns(range, new Map([["2026-11-02", 120]])).map((c) => c.value)).toEqual([0, 2, 0])
  })
})
