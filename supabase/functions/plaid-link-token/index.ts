/**
 * Plaid Link Token Edge Function
 *
 * Step 1 of the Plaid OAuth flow. Creates a link_token for the frontend
 * Plaid Link widget. Called when user clicks "Connect bank via Plaid".
 *
 * Required environment variables:
 *   PLAID_CLIENT_ID   — from Plaid Dashboard
 *   PLAID_SECRET      — sandbox / development / production key
 *   PLAID_ENV         — "sandbox" | "development" | "production"
 */

import { requireAuth } from "../_shared/auth.ts"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const auth = await requireAuth(req, ["owner", "super_user"])
  if (!auth.ok) return auth.response
  const { profile } = auth

  // ── Create Plaid link token ───────────────────────────────────────────────
  const plaidEnv = Deno.env.get("PLAID_ENV") ?? "sandbox"
  const plaidBase = plaidEnv === "production"
    ? "https://production.plaid.com"
    : plaidEnv === "development"
    ? "https://development.plaid.com"
    : "https://sandbox.plaid.com"

  const res = await fetch(`${plaidBase}/link/token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("PLAID_CLIENT_ID"),
      secret: Deno.env.get("PLAID_SECRET"),
      user: { client_user_id: user.id },
      client_name: "Avanew Command Center",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    return json({ error: err.error_message ?? "Failed to create link token" }, 502)
  }

  const data = await res.json() as { link_token: string }
  return json({ link_token: data.link_token })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
