// Supabase Edge Function — ra-lead-submit
//
// Public lead-capture endpoint for /refer/:slug landing pages.
// Anyone can POST here (no JWT required). The function:
//
//   1. Validates the form payload (slug, first_name required; email-or-phone required)
//   2. Calls public.record_ra_lead() (SECURITY DEFINER) to insert a row into leads
//      with referred_by_ra_id wired to the RA's user_id and lead_source='ra_referral'
//   3. Returns { id } of the new lead on success
//
// Deploy:
//   supabase functions deploy ra-lead-submit --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

type SubmitPayload = {
  slug:        string
  first_name:  string
  last_name?:  string
  email?:      string
  phone?:      string
  company?:    string
  website?:    string
  message?:    string
}

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

// Very loose email shape check — defer real validation to downstream systems.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  }

  let payload: SubmitPayload
  try {
    payload = (await req.json()) as SubmitPayload
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  const slug       = payload.slug?.trim()
  const firstName  = payload.first_name?.trim()
  const lastName   = payload.last_name?.trim() ?? ""
  const email      = payload.email?.trim() ?? ""
  const phone      = payload.phone?.trim() ?? ""
  const company    = payload.company?.trim() ?? ""
  const website    = payload.website?.trim() ?? ""
  const message    = payload.message?.trim() ?? ""

  if (!slug)      return json(400, { error: "slug is required" })
  if (!firstName) return json(400, { error: "first_name is required" })

  if (!email && !phone) {
    return json(400, { error: "Either email or phone is required" })
  }
  if (email && !EMAIL_RE.test(email)) {
    return json(400, { error: "Invalid email format" })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.rpc("record_ra_lead", {
    p_slug:       slug,
    p_first_name: firstName,
    p_last_name:  lastName || null,
    p_email:      email    || null,
    p_phone:      phone    || null,
    p_company:    company  || null,
    p_website:    website  || null,
    p_message:    message  || null,
  })

  if (error) {
    // Friendlier error for the "no active RA at this slug" case.
    if (/no_data_found|not found/i.test(error.message)) {
      return json(404, { error: "Referral link not active" })
    }
    return json(500, { error: error.message })
  }

  return json(200, { id: data, message: "Lead received" })
})
