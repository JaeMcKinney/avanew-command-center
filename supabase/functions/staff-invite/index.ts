// Supabase Edge Function — staff-invite
//
// Long-lived invite links for team members (Owner/Admin/BD/Partner). Supabase's
// own invite links cap at 24h; this mirrors the RA flow (HMAC token we control,
// fresh magic link minted at click-time) so a staff invite can last e.g. 7 days.
//
// POST { action: "create", user_id, app_url, days? }
//   Service-role bearer only. Returns { url } for /setup-account?invite=<token>.
// POST { action: "accept", token }
//   Public. Returns { ok: true, action_link } or { ok: false, reason }.
//   reason: "expired" | "already" (password already set) | "invalid"
//
// Deploy (PUBLIC — invitee has no session yet):
//   supabase functions deploy staff-invite --no-verify-jwt
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INVITE_TOKEN_SECRET

import { createClient } from "npm:@supabase/supabase-js@2"
import { signStaffInviteToken, verifyStaffInviteToken } from "../_shared/invite.ts"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } })

const ALLOWED_APP_URLS = [
  "https://app.avanew.ai",
  "https://ai-automation.divigner.com",
  "https://avanew-command-center.vercel.app",
]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const secret = Deno.env.get("INVITE_TOKEN_SECRET")
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  if (!secret) return json(500, { error: "INVITE_TOKEN_SECRET not set" })

  let body: { action?: string; token?: string; user_id?: string; app_url?: string; days?: number }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (body.action === "create") {
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
    if (bearer !== serviceKey) return json(403, { error: "Service role required" })
    const appUrl = body.app_url ?? ""
    if (!ALLOWED_APP_URLS.includes(appUrl)) return json(400, { error: "app_url not allowed" })
    if (!body.user_id) return json(400, { error: "user_id is required" })
    const days = Math.min(Math.max(body.days ?? 7, 1), 30)
    const exp = Math.floor(Date.now() / 1000) + days * 86400
    const token = await signStaffInviteToken({ kind: "staff", user_id: body.user_id, exp }, secret)
    return json(200, { url: `${appUrl}/setup-account?invite=${encodeURIComponent(token)}`, exp })
  }

  if (body.action !== "accept") return json(400, { error: "Unknown action" })

  const payload = body.token ? await verifyStaffInviteToken(body.token, secret) : null
  if (!payload) return json(200, { ok: false, reason: "invalid" })
  if (payload.exp <= Math.floor(Date.now() / 1000)) return json(200, { ok: false, reason: "expired" })

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(payload.user_id)
  if (userErr || !userData?.user?.email) return json(200, { ok: false, reason: "invalid" })
  const user = userData.user
  // Once they've chosen a password the link is spent; they sign in normally.
  if (user.user_metadata?.password_set === true) return json(200, { ok: false, reason: "already" })

  // Fresh, seconds-lived sign-in link minted now, so the 24h platform cap
  // never applies to the emailed link.
  const origin = new URL(req.headers.get("origin") ?? ALLOWED_APP_URLS[0]).origin
  const appUrl = ALLOWED_APP_URLS.includes(origin) ? origin : ALLOWED_APP_URLS[0]
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email!,
    options: { redirectTo: `${appUrl}/setup-account` },
  })
  if (linkErr) return json(500, { error: linkErr.message })
  const actionLink = linkData?.properties?.action_link
  if (!actionLink) return json(500, { error: "Failed to mint sign-in link" })
  return json(200, { ok: true, action_link: actionLink })
})
