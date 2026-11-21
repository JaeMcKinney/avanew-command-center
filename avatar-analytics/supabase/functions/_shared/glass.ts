// Talks to the Glass Health API (https://glass.health/api/external/openapi)
// with a client's own key. No imports from Deno or Supabase, so the pure parts
// run the same in the Node unit tests.

export const GLASS_DEFAULT_BASE = "https://glass.health/api/external"
export const GLASS_DEFAULT_VERSION = "5.5-2026-03-31"
/** Glass searches the literature before it answers, so a reply takes a while. */
export const GLASS_TIMEOUT_MS = 45_000
export const MAX_QUESTION_LENGTH = 4000

export type GlassReference = {
  title?: string
  journal_title?: string
  year?: number | string
  generic_name?: string
  code?: string
  url?: string
  display?: { heading?: string; subheading?: string }
}

export type GlassSource = { title: string; detail: string | null; url: string | null }

export type GlassErrorCode =
  | "invalid_key" // Glass does not accept the key
  | "past_due" // the client's Glass subscription is unpaid
  | "rate_limited" // the client's Glass account is over its per-minute limit
  | "timeout"
  | "unreachable"
  | "glass_error" // Glass answered with a failure of its own
  | "bad_response"

export type GlassOutcome =
  | { ok: true; text: string; references: GlassReference[]; inputTokens: number; outputTokens: number; durationMs: number; requestId: string | null; version: string }
  | { ok: false; code: GlassErrorCode; retryable: boolean; durationMs: number; requestId: string | null; version: string }

const LANGUAGES: Record<string, string> = { en: "English", es: "Spanish" }

/**
 * Glass has no system role, so the instructions travel inside the one user
 * message, in the tags Glass's own guides use. The answer is going to be
 * spoken by an avatar, so it has to be short and free of formatting.
 */
export function buildGlassPrompt(question: string, language = "en"): string {
  const spoken = LANGUAGES[language] ?? LANGUAGES.en
  return [
    "<role>You are a clinical evidence assistant. A clinician is asking through a spoken video avatar.</role>",
    "<objective>Answer the clinical question from current published evidence and guidelines.</objective>",
    `<clinical_task>${question.trim()}</clinical_task>`,
    "<user_template>",
    `Answer in ${spoken}, in plain sentences that sound natural read aloud. Keep it under 90 words.`,
    "Start with the direct answer, then the one qualifier that matters most.",
    "No lists, no headings, no markdown, no tables.",
    "</user_template>",
  ].join("\n")
}

/**
 * Removes citation markers and formatting so the text can be read aloud.
 * Glass marks its sources inline, as <ref_7/> tags or as [1] and [2,3].
 */
export function spokenAnswer(text: string): string {
  return text
    .replace(/\s*<\/?ref[^<>]*>/gi, "")
    .replace(/\s*\[\d+(?:\s*[,–-]\s*\d+)*\]/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim()
}

/** The first few sources behind an answer, in a form the avatar can name or show. */
export function topSources(references: GlassReference[] | null | undefined, limit = 3): GlassSource[] {
  const sources: GlassSource[] = []
  const seen = new Set<string>()
  for (const ref of references ?? []) {
    const title = (ref.title ?? ref.display?.heading ?? ref.generic_name ?? ref.code ?? "").trim()
    // Glass can list one paper more than once, when it draws on several passages of it.
    if (!title || seen.has(title.toLowerCase())) continue
    seen.add(title.toLowerCase())
    const detail = [ref.journal_title ?? ref.display?.subheading, ref.year].filter((part) => part != null && String(part).trim() !== "").join(", ")
    sources.push({ title, detail: detail || null, url: typeof ref.url === "string" && /^https:\/\//.test(ref.url) ? ref.url : null })
    if (sources.length >= limit) break
  }
  return sources
}

function failureFor(status: number): { code: GlassErrorCode; retryable: boolean } {
  if (status === 401 || status === 403) return { code: "invalid_key", retryable: false }
  if (status === 402) return { code: "past_due", retryable: false }
  if (status === 429) return { code: "rate_limited", retryable: false }
  if (status >= 500) return { code: "glass_error", retryable: true }
  return { code: "bad_response", retryable: false }
}

type GlassSettings = { base?: string; version?: string; timeoutMs?: number; fetchImpl?: typeof fetch }

async function post(key: string, body: unknown, settings: GlassSettings): Promise<{ res: Response | null; timedOut: boolean; durationMs: number }> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs ?? GLASS_TIMEOUT_MS)
  try {
    const res = await (settings.fetchImpl ?? fetch)(`${(settings.base ?? GLASS_DEFAULT_BASE).replace(/\/+$/, "")}/v2/messages`, {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    return { res, timedOut: false, durationMs: Date.now() - started }
  } catch {
    return { res: null, timedOut: controller.signal.aborted, durationMs: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sends one question to Glass and reports the answer with what it cost.
 * `metadata` is echoed back by Glass and shows in the client's Glass logs, so
 * it carries ids only.
 */
export async function askGlass(key: string, prompt: string, metadata: Record<string, string>, settings: GlassSettings = {}): Promise<GlassOutcome> {
  const version = settings.version ?? GLASS_DEFAULT_VERSION
  const { res, timedOut, durationMs } = await post(key, { messages: [{ role: "user", content: prompt }], version, stream: false, metadata }, settings)
  if (!res) return { ok: false, code: timedOut ? "timeout" : "unreachable", retryable: !timedOut, durationMs, requestId: null, version }

  const requestId = res.headers.get("x-glass-request-id")
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined)
    return { ok: false, ...failureFor(res.status), durationMs, requestId, version }
  }
  const data = (await res.json().catch(() => null)) as
    | { text?: unknown; references?: unknown; usage?: { inputTokens?: unknown; outputTokens?: unknown }; error?: unknown }
    | null
  // Glass reports a failed generation with a 200 and an "error" field.
  if (!data || data.error || typeof data.text !== "string" || !data.text.trim()) {
    return { ok: false, code: data?.error ? "glass_error" : "bad_response", retryable: false, durationMs, requestId, version }
  }
  return {
    ok: true,
    text: data.text,
    references: Array.isArray(data.references) ? (data.references as GlassReference[]) : [],
    inputTokens: Math.max(0, Math.round(Number(data.usage?.inputTokens) || 0)),
    outputTokens: Math.max(0, Math.round(Number(data.usage?.outputTokens) || 0)),
    durationMs,
    requestId,
    version,
  }
}

export type GlassKeyCheck = { status: "ok" | "invalid" | "past_due" | "error"; detail: string | null }

/**
 * Checks a key without spending anything: an empty question is refused as a
 * bad request by a key Glass accepts, and as unauthorised by one it does not.
 */
export async function checkGlassKey(key: string, settings: GlassSettings = {}): Promise<GlassKeyCheck> {
  const { res, timedOut } = await post(key, { messages: [] }, { ...settings, timeoutMs: settings.timeoutMs ?? 15_000 })
  if (!res) return { status: "error", detail: timedOut ? "Glass Health took too long to answer. Try again." : "Could not reach Glass Health. Try again." }
  await res.body?.cancel().catch(() => undefined)
  if (res.status === 400 || res.status === 422 || res.ok) return { status: "ok", detail: null }
  if (res.status === 401 || res.status === 403) return { status: "invalid", detail: "Glass Health did not accept this key." }
  if (res.status === 402) return { status: "past_due", detail: "Glass Health says the subscription on this account is unpaid." }
  return { status: "error", detail: `Glass Health answered with an error (${res.status}). Try again later.` }
}

/** What the avatar is told when Glass could not answer, by reason. */
export function glassFailureMessage(code: GlassErrorCode | "no_key"): string {
  switch (code) {
    case "no_key":
      return "Glass Health is not connected for this account yet."
    case "invalid_key":
      return "The Glass Health key on this account is no longer accepted."
    case "past_due":
      return "The Glass Health subscription on this account is unpaid."
    case "rate_limited":
      return "Glass Health is busy right now. Try again in a minute."
    case "timeout":
      return "Glass Health took too long to answer."
    default:
      return "Glass Health could not answer right now."
  }
}
