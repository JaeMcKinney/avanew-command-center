// Supabase Edge Function — tavus-start-conversation
//
// Public endpoint that mints a fresh Tavus conversation for one visitor.
// Each call returns a unique conversation_url the browser can iframe.
//
// Why server-side: the Tavus API key must never reach the browser.
// Why per-visitor: a Tavus conversation is a 1:1 WebRTC room — multiple
// visitors on the same URL would collide.
//
// Deploy:
//   supabase functions deploy tavus-start-conversation --no-verify-jwt
//   supabase secrets set TAVUS_API_KEY=...
//
// POST body:
//   { persona_id: string, replica_id?: string, conversation_name?: string }
//
// Returns:
//   { conversation_id, conversation_url, status }
//
// Guardrails:
//   - Caps max_call_duration at 300s (5 min)
//   - Naive in-memory rate limit per persona (5 req / minute / function instance)

const TAVUS_API_BASE = "https://tavusapi.com/v2"
const MAX_CALL_DURATION_SEC = 300

const CORS_HEADERS: HeadersInit = {
  "access-control-allow-origin":  "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  })

// Naive per-instance rate limiter (Edge functions scale per region, so this
// is a soft cap, not a hard one — enough to discourage abuse from a single
// browser tab without spinning up Redis).
const recentCalls = new Map<string, number[]>()
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5

function rateLimited(key: string): boolean {
  const now = Date.now()
  const arr = (recentCalls.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (arr.length >= RATE_MAX) {
    recentCalls.set(key, arr)
    return true
  }
  arr.push(now)
  recentCalls.set(key, arr)
  return false
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const apiKey = Deno.env.get("TAVUS_API_KEY")
  if (!apiKey) return json(500, { error: "TAVUS_API_KEY not configured" })

  let payload: { persona_id?: string; replica_id?: string; conversation_name?: string }
  try { payload = await req.json() } catch { return json(400, { error: "Invalid JSON" }) }

  const personaId = payload.persona_id?.trim()
  if (!personaId) return json(400, { error: "persona_id is required" })

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon"
  if (rateLimited(`${ip}:${personaId}`)) {
    return json(429, { error: "Too many requests. Try again in a minute." })
  }

  const body: Record<string, unknown> = {
    persona_id: personaId,
    properties: { max_call_duration: MAX_CALL_DURATION_SEC },
  }
  if (payload.replica_id) body.replica_id = payload.replica_id
  if (payload.conversation_name) body.conversation_name = payload.conversation_name

  const resp = await fetch(`${TAVUS_API_BASE}/conversations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    return json(resp.status, { error: "Tavus error", detail: data })
  }

  return json(200, {
    conversation_id:  data.conversation_id,
    conversation_url: data.conversation_url,
    status:           data.status,
  })
})
