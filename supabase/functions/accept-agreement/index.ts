// Supabase Edge Function — accept-agreement
//
// Captures a Referral Associate's electronic signature on the Referral Associate
// Agreement. Records an immutable audit row in `agreement_acceptances` plus an
// `agreement_completed=true` patch on the RA record. The client cannot forge the
// IP address or user agent — both are read here from request headers.
//
// Deploy:
//   supabase functions deploy accept-agreement
//
// Required secrets:
//   - SUPABASE_URL              (auto)
//   - SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2"

type Payload = {
  ra_associate_id: string
  agreement_version: string
  signed_legal_name: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    },
  })

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() || null
  return req.headers.get("x-real-ip")
    ?? req.headers.get("cf-connecting-ip")
    ?? null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
        "access-control-allow-methods": "POST, OPTIONS",
      },
    })
  }
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  }

  // Verify the caller via the user's anon JWT.
  const authHeader = req.headers.get("Authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" })

  const anonClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes, error: userErr } = await anonClient.auth.getUser()
  if (userErr || !userRes?.user) return json(401, { error: "Invalid session" })
  const userId = userRes.user.id

  // Parse + validate payload.
  let payload: Payload
  try { payload = await req.json() as Payload } catch { return json(400, { error: "Invalid JSON" }) }
  if (!payload.ra_associate_id) return json(400, { error: "ra_associate_id required" })
  if (!payload.agreement_version) return json(400, { error: "agreement_version required" })
  if (!payload.signed_legal_name || payload.signed_legal_name.trim().length < 3) {
    return json(400, { error: "signed_legal_name required (min 3 chars)" })
  }

  // Service-role client for the audit write + RA patch.
  const admin = createClient(supabaseUrl, serviceKey)

  // Confirm the RA row belongs to the caller.
  const { data: raRow, error: raErr } = await admin
    .from("ra_associates")
    .select("id, user_id")
    .eq("id", payload.ra_associate_id)
    .maybeSingle()
  if (raErr) return json(500, { error: raErr.message })
  if (!raRow) return json(404, { error: "RA not found" })
  if (raRow.user_id !== userId) return json(403, { error: "RA does not belong to caller" })

  const ip = clientIp(req)
  const ua = req.headers.get("user-agent")
  const acceptedAt = new Date().toISOString()
  const signedName = payload.signed_legal_name.trim()

  // 1. Insert audit row.
  const { error: auditErr } = await admin
    .from("agreement_acceptances")
    .insert({
      ra_associate_id: payload.ra_associate_id,
      user_id: userId,
      agreement_version: payload.agreement_version,
      accepted_at: acceptedAt,
      ip_address: ip,
      user_agent: ua,
      signed_legal_name: signedName,
    })
  if (auditErr) return json(500, { error: `audit insert failed: ${auditErr.message}` })

  // 2. Patch ra_associates with the latest acceptance.
  const { error: patchErr } = await admin
    .from("ra_associates")
    .update({
      agreement_completed: true,
      agreement_version: payload.agreement_version,
      agreement_accepted_at: acceptedAt,
      agreement_ip_address: ip,
      agreement_user_agent: ua,
      agreement_signed_name: signedName,
    })
    .eq("id", payload.ra_associate_id)
  if (patchErr) return json(500, { error: `ra patch failed: ${patchErr.message}` })

  return json(200, {
    agreement_completed: true,
    agreement_version: payload.agreement_version,
    agreement_accepted_at: acceptedAt,
    agreement_ip_address: ip,
    agreement_user_agent: ua,
    agreement_signed_name: signedName,
  })
})
