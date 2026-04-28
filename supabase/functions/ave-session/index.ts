/**
 * AVE Session Edge Function
 *
 * Creates and ends Tavus audio-only conversations for the AI Voice Experience.
 * Restricted to owner / super_user roles only.
 *
 * Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   TAVUS_API_KEY      — API key from Tavus dashboard
 *   TAVUS_REPLICA_ID   — Replica ID of the AVE persona
 *   TAVUS_PERSONA_ID   — Persona ID (optional, for custom context injection)
 *   SUPABASE_URL       — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 */

import { requireAuth } from "../_shared/auth.ts"
import { corsHeaders } from "../_shared/cors.ts"

const TAVUS_BASE = "https://tavusapi.com/v2"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const auth = await requireAuth(req, ["owner", "super_user"])
    if (!auth.ok) return auth.response
    const { profile } = auth

    const tavusKey = Deno.env.get("TAVUS_API_KEY")
    if (!tavusKey) return json({ error: "TAVUS_API_KEY not configured" }, 500)

    const replicaId = Deno.env.get("TAVUS_REPLICA_ID")
    const personaId = Deno.env.get("TAVUS_PERSONA_ID")

    type Body =
      | { action: "start"; context?: string }
      | { action: "end"; conversation_id: string }

    const body = await req.json() as Body

    // ── Start conversation ─────────────────────────────────────────────────
    if (body.action === "start") {
      const contextText = body.context
        ? `The user is currently viewing: ${body.context}.`
        : ""

      const payload: Record<string, unknown> = {
        replica_id: replicaId,
        conversation_name: `AVE — ${profile.email ?? profile.id} — ${new Date().toISOString()}`,
        audio_only: true,
        properties: {
          participant_left_timeout: 300,
          enable_recording: false,
          max_call_duration: 3600,
        },
      }
      if (personaId) payload.persona_id = personaId
      if (contextText) payload.custom_greeting = contextText

      const res = await fetch(`${TAVUS_BASE}/conversations`, {
        method: "POST",
        headers: {
          "x-api-key": tavusKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.text()
        return json({ error: `Tavus error: ${err}` }, 502)
      }

      const data = await res.json() as { conversation_id: string; conversation_url: string }
      return json({ conversation_id: data.conversation_id, conversation_url: data.conversation_url })
    }

    // ── End conversation ───────────────────────────────────────────────────
    if (body.action === "end") {
      if (!("conversation_id" in body) || !body.conversation_id) {
        return json({ error: "conversation_id required" }, 400)
      }

      await fetch(`${TAVUS_BASE}/conversations/${body.conversation_id}/end`, {
        method: "POST",
        headers: { "x-api-key": tavusKey },
      })

      return json({ ok: true })
    }

    return json({ error: "Unknown action" }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
