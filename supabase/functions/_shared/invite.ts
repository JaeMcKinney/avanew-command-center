/**
 * Stateless invite-token helpers for the RA custom invite flow.
 *
 * The emailed invite link carries an HMAC-SHA256-signed token containing
 * { ra_id, exp } — where exp is the 72h invite window we control ourselves,
 * NOT a Supabase GoTrue token (which caps at 24h). On click, accept-invite
 * verifies this token and mints a fresh, seconds-lived GoTrue magic link on
 * the spot. This is what lets the emailed link stay valid a full 72 hours.
 *
 * Signed with INVITE_TOKEN_SECRET (shared across invite-ra, reinvite-ra,
 * notify-ra-invite-expiring as signers, and accept-invite as verifier).
 */

import { wrap, escapeHtml } from "./email.ts"

export type InvitePayload = { ra_id: string; exp: number } // exp = unix seconds

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(msg: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg))
  return new Uint8Array(sig)
}

// Constant-time-ish string compare — avoids leaking signature bytes via
// early-exit timing on a public endpoint.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function signInviteToken(payload: InvitePayload, secret: string): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = b64urlEncode(await hmac(body, secret))
  return `${body}.${sig}`
}

export async function verifyInviteToken(token: string, secret: string): Promise<InvitePayload | null> {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = b64urlEncode(await hmac(body, secret))
  if (!timingSafeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as InvitePayload
    if (typeof payload.ra_id !== "string" || typeof payload.exp !== "number") return null
    return payload
  } catch {
    return null
  }
}

export function buildAcceptUrl(appUrl: string, token: string): string {
  return `${appUrl}/invite/accept?token=${encodeURIComponent(token)}`
}

/** The "you're invited, here are your two deadlines" email, shared by
 *  invite-ra (initial) and reinvite-ra (resend/reapply). */
export function inviteEmailHtml(firstName: string, orgName: string, acceptUrl: string): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  return wrap(
    greeting, orgName,
    "You're invited!",
    `<p style="color:#A2B6C9;font-size:.95rem;line-height:1.6;margin:0 0 14px">You've been invited to join <strong style="color:#EAF2F9">${escapeHtml(orgName)}</strong>'s Referral Associate Program. Click below to accept and set up your account.</p>
     <div style="background:rgba(244,178,58,.1);border:1px solid rgba(244,178,58,.3);border-radius:8px;padding:14px 16px">
       <p style="margin:0 0 8px;font-weight:600;color:#F4D58A;font-size:.9rem">Two deadlines to know</p>
       <p style="margin:0 0 6px;color:#A2B6C9;font-size:.85rem;line-height:1.5">This invite link expires in <strong style="color:#EAF2F9">72 hours</strong>.</p>
       <p style="margin:0;color:#A2B6C9;font-size:.85rem;line-height:1.5">You must complete and submit your onboarding within <strong style="color:#EAF2F9">3 weeks (21 days)</strong> of this invite, or your application will be automatically closed and you'll need to reapply.</p>
     </div>`,
    "Accept invite & set your password",
    acceptUrl,
  )
}
