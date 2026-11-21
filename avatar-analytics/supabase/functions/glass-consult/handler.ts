// An avatar asks Glass Health a clinical question.
//
//   POST /functions/v1/glass-consult/<avatar token>
//
// This is the address of the avatar's Tavus tool (API delivery with HMAC
// auth: docs.tavus.io, "Tool Delivery"). Tavus signs the body with the
// avatar's secret, the same one that signs its call events. The question goes
// to Glass with the client's own key, and what the answer cost is recorded
// against the conversation. The question and answer are not stored.
//
// Body from Tavus: { name, arguments: "<json>", tool_call_id, conversation_id, inference_id, turn_idx }
//   arguments: { question: string, language?: "en" | "es" }
// Answer: 200 { answer, sources: [{ title, detail, url }] }

import { serviceClient, type SupabaseClient } from "../_shared/clients.ts"
import { askGlass, buildGlassPrompt, glassFailureMessage, GLASS_DEFAULT_VERSION, MAX_QUESTION_LENGTH, spokenAnswer, topSources, type GlassErrorCode } from "../_shared/glass.ts"
import { endpoint, HttpError, json } from "../_shared/http.ts"
import { verifyTavusSignature } from "../_shared/signature.ts"

type Call = { avatarId: string; conversationId: string; toolCallId: string | null }

async function record(
  admin: SupabaseClient,
  call: Call,
  result: { status: "ok" | "error"; errorCode?: GlassErrorCode | "no_key"; inputTokens?: number; outputTokens?: number; durationMs?: number; version?: string; requestId?: string | null },
) {
  const { error } = await admin.rpc("glass_record_call", {
    p_avatar_id: call.avatarId,
    p_conversation_id: call.conversationId,
    p_tool_call_id: call.toolCallId,
    p_status: result.status,
    p_error_code: result.errorCode ?? null,
    p_input_tokens: result.inputTokens ?? 0,
    p_output_tokens: result.outputTokens ?? 0,
    p_duration_ms: result.durationMs ?? 0,
    p_version: result.version ?? null,
    p_request_id: result.requestId ?? null,
  })
  // The avatar still gets its answer; a lost count is logged for follow-up.
  if (error) console.error("glass_record_call failed", error.message)
}

export const handler = endpoint(async (req) => {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean)
  const at = parts.lastIndexOf("glass-consult")
  const token = at >= 0 ? parts[at + 1] : undefined
  if (!token || !/^[0-9a-f]{32,128}$/.test(token)) throw new HttpError(404, "Unknown address")

  // Read the exact bytes: the signature covers them, not a re-serialised copy.
  const raw = new Uint8Array(await req.arrayBuffer())
  if (raw.byteLength > 100_000) throw new HttpError(413, "Payload too large")

  const admin = serviceClient()
  const { data: secret, error } = await admin
    .from("avatar_secrets")
    .select("avatar_id, callback_secret")
    .eq("webhook_token", token)
    .maybeSingle()
  if (error) throw new HttpError(500, "Could not look up the avatar")
  if (!secret) throw new HttpError(404, "Unknown address")

  const valid = await verifyTavusSignature(secret.callback_secret, raw, req.headers.get("X-Tavus-Signature"))
  if (!valid) throw new HttpError(401, "Signature check failed")

  let payload: { arguments?: unknown; conversation_id?: unknown; tool_call_id?: unknown }
  let args: { question?: unknown; language?: unknown }
  try {
    payload = JSON.parse(new TextDecoder().decode(raw))
    args = typeof payload.arguments === "string" ? JSON.parse(payload.arguments) : (payload.arguments ?? {})
  } catch {
    throw new HttpError(400, "The body is not JSON")
  }
  const question = typeof args?.question === "string" ? args.question.trim() : ""
  if (typeof payload.conversation_id !== "string" || !payload.conversation_id) throw new HttpError(400, "conversation_id is missing")
  if (!question) throw new HttpError(400, "A question is required")
  if (question.length > MAX_QUESTION_LENGTH) throw new HttpError(400, "The question is too long")

  const { data: avatar } = await admin.from("avatars").select("client_id, unlinked_at").eq("id", secret.avatar_id).maybeSingle()
  if (!avatar || avatar.unlinked_at) throw new HttpError(404, "Unknown address")

  const call: Call = {
    avatarId: secret.avatar_id,
    conversationId: payload.conversation_id,
    toolCallId: typeof payload.tool_call_id === "string" ? payload.tool_call_id : null,
  }

  const { data: key, error: keyError } = await admin.rpc("glass_read_key", { p_client_id: avatar.client_id })
  if (keyError) throw new HttpError(500, "Could not read the Glass Health connection")
  if (!key) {
    await record(admin, call, { status: "error", errorCode: "no_key" })
    // Not a 5xx: Tavus retries those, and a retry cannot fix a missing key.
    return json(422, { error: glassFailureMessage("no_key") })
  }

  const outcome = await askGlass(
    key as string,
    buildGlassPrompt(question, typeof args.language === "string" ? args.language : "en"),
    { conversationId: call.conversationId, avatarId: call.avatarId, source: "avalytics" },
    { base: Deno.env.get("GLASS_API_BASE") || undefined, version: Deno.env.get("GLASS_VERSION") || GLASS_DEFAULT_VERSION },
  )

  if (!outcome.ok) {
    await record(admin, call, { status: "error", errorCode: outcome.code, durationMs: outcome.durationMs, version: outcome.version, requestId: outcome.requestId })
    // Tavus tries once more after a 5xx, which is right only when Glass itself stumbled.
    return json(outcome.retryable ? 502 : 422, { error: glassFailureMessage(outcome.code) })
  }

  await record(admin, call, {
    status: "ok",
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
    durationMs: outcome.durationMs,
    version: outcome.version,
    requestId: outcome.requestId,
  })
  return json(200, { answer: spokenAnswer(outcome.text), sources: topSources(outcome.references) })
})
