// Tavus signs each webhook: X-Tavus-Signature is the lowercase hex
// HMAC-SHA256 of the exact request body bytes, keyed with the shared secret.
// https://docs.tavus.io/sections/webhooks-and-callbacks#signed-callbacks
//
// Pure Web Crypto, so it runs the same in Deno and in Node tests.

const encoder = new TextEncoder()

export async function hmacSha256Hex(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const digest = await crypto.subtle.sign("HMAC", key, body as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Compares two strings without leaking where they differ. */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return diff === 0
}

export async function verifyTavusSignature(
  secret: string,
  rawBody: Uint8Array,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader || !/^[0-9a-f]{64}$/.test(signatureHeader)) return false
  const expected = await hmacSha256Hex(secret, rawBody)
  return timingSafeEqual(expected, signatureHeader)
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("")
}
