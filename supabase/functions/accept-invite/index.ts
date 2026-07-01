// Supabase Edge Function — accept-invite
//
// Public entry point for the RA custom invite flow. The emailed invite link
// points at the app's /invite/accept?token=<signed> page, which POSTs the
// token here. This function:
//   1. Verifies the HMAC-signed token (INVITE_TOKEN_SECRET) and its 72h exp.
//   2. Loads the RA by ra_id and gates on lifecycle status + invite_expires_at.
//   3. On success, records invite_clicked_at and mints a FRESH GoTrue magic
//      link (seconds-lived, well within the platform's 24h cap since it's
//      created at click-time), returning its action_link for the browser to
//      follow into /onboarding.
//
// Returns 200 for all handled outcomes with an { ok, reason? } body so the
// client can branch without treating expected states as errors:
//   { ok: true, action_link }                 → redirect the browser here
//   { ok: false, reason: "expired" }           → 72h window passed / row expired
//   { ok: false, reason: "closed" }            → onboarding_expired (21d)
//   { ok: false, reason: "already" }           → already accepted → send to login
//   { ok: false, reason: "invalid" }           → bad/forged/unknown token
//
// Deploy (PUBLIC — the invited user has no session yet):
//   supabase functions deploy accept-invite --no-verify-jwt
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INVITE_TOKEN_SECRET
// Optional: APP_BASE_URL

import { createClient } from "npm:@supabase/supabase-js@2"
import { verifyInviteToken } from "../_shared/invite.ts"
import { DEFAULT_APP_URL } from "../_shared/email.ts"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const secret = Deno.env.get("INVITE_TOKEN_SECRET")
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  if (!secret) return json(500, { error: "INVITE_TOKEN_SECRET not set" })

  let token: string | undefined
  try {
    token = (await req.json())?.token
  } catch {
    return json(400, { error: "Invalid JSON" })
  }
  if (!token || typeof token !== "string") return json(200, { ok: false, reason: "invalid" })

  const payload = await verifyInviteToken(token, secret)
  if (!payload) return json(200, { ok: false, reason: "invalid" })

  const nowSec = Math.floor(Date.now() / 1000)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: ra, error: raErr } = await admin
    .from("ra_associates")
    .select("id, status, invite_expires_at, invite_clicked_at, profiles!ra_associates_user_id_fkey(email)")
    .eq("id", payload.ra_id)
    .maybeSingle<{
      id: string
      status: string
      invite_expires_at: string | null
      invite_clicked_at: string | null
      profiles: { email: string | null } | null
    }>()
  if (raErr) return json(500, { error: raErr.message })
  if (!ra) return json(200, { ok: false, reason: "invalid" })

  // Already closed by the 21-day onboarding deadline.
  if (ra.status === "onboarding_expired") return json(200, { ok: false, reason: "closed" })

  // Already expired (either the cron flipped it, or the token/row is past 72h).
  const rowExpiredMs = ra.invite_expires_at ? new Date(ra.invite_expires_at).getTime() : 0
  const isExpired =
    ra.status === "invite_expired" ||
    payload.exp <= nowSec ||
    (rowExpiredMs > 0 && rowExpiredMs <= Date.now())
  if (isExpired) {
    // Flip a still-pending row so the admin UI reflects it immediately rather
    // than waiting for the hourly cron. Only if not already clicked.
    if (ra.status === "pending" && !ra.invite_clicked_at) {
      await admin.from("ra_associates").update({ status: "invite_expired" }).eq("id", ra.id)
    }
    return json(200, { ok: false, reason: "expired" })
  }

  // Any non-pending, non-expired status means they've already moved on
  // (active / verification / needs_changes / suspended / declined / terminated)
  // — send them to the normal login instead of re-accepting.
  if (ra.status !== "pending") return json(200, { ok: false, reason: "already" })

  const email = ra.profiles?.email
  if (!email) return json(500, { error: "RA has no login email on file" })

  // Record the click once (also stops the invite-expiring cron from expiring
  // them mid-onboarding).
  if (!ra.invite_clicked_at) {
    await admin.from("ra_associates").update({ invite_clicked_at: new Date().toISOString() }).eq("id", ra.id)
  }

  // Mint a fresh, seconds-lived GoTrue magic link at click-time. Because it's
  // generated now (not at invite time), its expiry (governed by the platform
  // OTP setting) is irrelevant to our 72h window — it only needs to survive
  // the immediate redirect.
  const appUrl = Deno.env.get("APP_BASE_URL") ?? DEFAULT_APP_URL
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${appUrl}/onboarding` },
  })
  if (linkErr) return json(500, { error: linkErr.message })
  const actionLink = linkData?.properties?.action_link
  if (!actionLink) return json(500, { error: "Failed to mint sign-in link" })

  return json(200, { ok: true, action_link: actionLink })
})
