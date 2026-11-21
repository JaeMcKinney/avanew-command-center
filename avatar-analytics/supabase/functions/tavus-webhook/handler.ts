// Receives call events from Tavus.
//
//   POST /functions/v1/tavus-webhook/<avatar token>
//
// Each linked avatar has its own address, so every event can be matched to
// the right avatar even when Tavus does not say which PAL a conversation used.
// The body is checked against X-Tavus-Signature before anything is stored.

import { checkUsage } from "../_shared/billing.ts"
import { serviceClient } from "../_shared/clients.ts"
import { endpoint, HttpError, json } from "../_shared/http.ts"
import { processPendingInsights } from "../_shared/insights.ts"
import { verifyTavusSignature } from "../_shared/signature.ts"

export const handler = endpoint(async (req) => {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean)
  const at = parts.lastIndexOf("tavus-webhook")
  const token = at >= 0 ? parts[at + 1] : undefined
  if (!token || !/^[0-9a-f]{32,128}$/.test(token)) throw new HttpError(404, "Unknown webhook address")

  // Read the exact bytes: the signature covers them, not a re-serialised copy.
  const raw = new Uint8Array(await req.arrayBuffer())
  if (raw.byteLength > 5_000_000) throw new HttpError(413, "Payload too large")

  const admin = serviceClient()
  const { data: secret, error } = await admin
    .from("avatar_secrets")
    .select("avatar_id, callback_secret")
    .eq("webhook_token", token)
    .maybeSingle()
  if (error) throw new HttpError(500, "Could not look up the webhook")
  if (!secret) throw new HttpError(404, "Unknown webhook address")

  const valid = await verifyTavusSignature(secret.callback_secret, raw, req.headers.get("X-Tavus-Signature"))
  if (!valid) throw new HttpError(401, "Signature check failed")

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(new TextDecoder().decode(raw))
  } catch {
    throw new HttpError(400, "The body is not JSON")
  }

  // Guardrail and objective callbacks have a different shape. Accept them so
  // Tavus does not retry, but there is nothing to count yet.
  if (typeof payload.conversation_id !== "string" || typeof payload.event_type !== "string") {
    return json(202, { ok: true, ignored: "not a conversation event" })
  }

  const { data, error: ingestError } = await admin.rpc("ingest_tavus_event", {
    p_avatar_id: secret.avatar_id,
    p_payload: payload,
    p_source: "webhook",
  })
  if (ingestError) {
    console.error("ingest_tavus_event failed", ingestError.message)
    throw new HttpError(500, "Could not store the event")
  }
  // A transcript just arrived: summarise it now, without making Tavus wait.
  // The schedule picks up anything this misses.
  if (payload.event_type === "application.transcription_ready") {
    const work = processPendingInsights(admin, 3).catch((err) => console.error("insights:", err.message))
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
    runtime?.waitUntil(work)
  }
  // A call just ended: see whether this client has reached a usage warning or their limit.
  if (payload.event_type === "system.shutdown") {
    const work = (async () => {
      const { data: avatar } = await admin.from("avatars").select("client_id").eq("id", secret.avatar_id).maybeSingle()
      if (avatar) await checkUsage(admin, avatar.client_id)
    })().catch((err) => console.error("usage check:", err.message))
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
    runtime?.waitUntil(work)
  }
  return json(200, { ok: true, ...data })
})
