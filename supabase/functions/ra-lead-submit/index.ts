// Supabase Edge Function — ra-lead-submit
//
// Public lead-capture endpoint for /refer/:slug landing pages.
// Anyone can POST here (no JWT required). The function:
//
//   1. Validates the form payload (slug, first_name required; email-or-phone required)
//   2. Calls public.record_ra_lead() (SECURITY DEFINER) to insert a row into leads
//      with referred_by_ra_id wired to the RA's user_id and lead_source='ra_referral'
//   3. Sends a branded confirmation email to the prospect, RA, and Divigner team
//   4. Returns { id } of the new lead on success
//
// Deploy:
//   supabase functions deploy ra-lead-submit --no-verify-jwt
//
// Required secrets:
//   - SUPABASE_URL              (auto)
//   - SUPABASE_SERVICE_ROLE_KEY (your project's service-role key)
//   - SENDGRID_API_KEY          (SendGrid API key for transactional email)

import { createClient } from "npm:@supabase/supabase-js@2"

type SubmitPayload = {
  slug:               string
  first_name:         string
  last_name?:         string
  email?:             string
  phone?:             string
  company?:           string
  website?:           string
  message?:           string
  marketing_consent?: boolean
  // Which form sent this. "cme" = the CME Interactive Avatars demo page;
  // absent/empty = a standard /refer/:slug RA landing page.
  source?:            string
  // Prospect's self-selected interest level ("exploring" | "ready")
  prospect_intent?:   string
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DIVIGNER_TEAM = ["jae@divigner.com", "zuirrae@divigner.com"]

function buildEmailHtml(p: {
  prospectFirstName: string
  prospectName: string
  prospectEmail: string
  prospectPhone: string
  company: string
  website: string
  message: string
  intentLabel: string
  formLabel: string
  isCme: boolean
  raName: string
  raEmail: string
  slug: string
}): string {
  const detailRow = (label: string, value: string) =>
    value
      ? `<tr>
          <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8A9BB0;text-transform:uppercase;letter-spacing:0.08em;vertical-align:top;white-space:nowrap;width:90px;border-bottom:1px solid rgba(120,214,196,0.1)">${label}</td>
          <td style="padding:10px 0 10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#E8ECF0;vertical-align:top;word-break:break-word;border-bottom:1px solid rgba(120,214,196,0.1)">${value}</td>
        </tr>`
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Inquiry Received — Divigner</title>
<style>
  body{margin:0;padding:0;background-color:#06101D;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
  img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  @media only screen and (max-width:600px){
    .outer-wrap{padding:0!important}
    .card{border-radius:0!important;border-left:0!important;border-right:0!important}
    .card-pad{padding-left:20px!important;padding-right:20px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#06101D">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#06101D">
<tr><td align="center" class="outer-wrap" style="padding:32px 16px">

  <!-- Card -->
  <table role="presentation" class="card" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#0E2741;border:1px solid rgba(201,168,106,0.3);border-radius:16px;overflow:hidden">

    <!-- Gold accent bar -->
    <tr><td height="3" style="background:linear-gradient(90deg,#C9A86A,#34D6C2,#5FE3D2);font-size:0;line-height:0">&nbsp;</td></tr>

    <!-- Logo -->
    <tr><td align="center" class="card-pad" style="padding:32px 40px 24px">
      <img src="https://ai-automation.divigner.com/logos/divigner-logo-dark.png" alt="Divigner Group" width="200" height="auto" style="display:block;max-width:200px;height:auto">
    </td></tr>

    <!-- Heading -->
    <tr><td align="center" class="card-pad" style="padding:0 40px 8px">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;font-style:italic;color:#E8ECF0;line-height:1.3">
        Submission Received!
      </h1>
    </td></tr>

    <!-- Body text — greeting by first name, no orphans -->
    <tr><td align="center" class="card-pad" style="padding:16px 40px 28px">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:rgba(232,236,240,0.72);max-width:420px;margin-left:auto;margin-right:auto">
        Hi ${p.prospectFirstName}, thank you for reaching out. We have received your submission and will be in touch soon.
      </p>
    </td></tr>

    <!-- Divider -->
    <tr><td class="card-pad" style="padding:0 40px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:linear-gradient(90deg,transparent,rgba(201,168,106,0.35),transparent);font-size:0;line-height:0">&nbsp;</td></tr></table>
    </td></tr>

    <!-- Details heading -->
    <tr><td class="card-pad" style="padding:24px 40px 10px">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#34D6C2">
        Submission Details
      </p>
    </td></tr>

    <!-- Details table -->
    <tr><td class="card-pad" style="padding:0 40px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Form", p.formLabel)}
        ${detailRow("Name", p.prospectName)}
        ${detailRow("Email", p.prospectEmail)}
        ${detailRow("Phone", p.prospectPhone)}
        ${detailRow("Company", p.company)}
        ${detailRow("Website", p.website)}
        ${detailRow("Interest", p.intentLabel)}
        ${detailRow("Message", p.message)}
        ${detailRow("Referred by", p.isCme ? "" : p.raName)}
      </table>
    </td></tr>

    <!-- Divider -->
    <tr><td class="card-pad" style="padding:0 40px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" style="background:linear-gradient(90deg,transparent,rgba(201,168,106,0.35),transparent);font-size:0;line-height:0">&nbsp;</td></tr></table>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" class="card-pad" style="padding:24px 40px 32px">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:rgba(232,236,240,0.4);line-height:1.7">
        Divigner Group &middot; AI Automation Solutions<br>
        ${p.isCme
          ? `<a href="https://ai-automation.divigner.com/cme-avatars" style="color:#34D6C2;text-decoration:none">ai-automation.divigner.com/cme-avatars</a>`
          : `<a href="https://ai-automation.divigner.com/demo/${p.slug}" style="color:#34D6C2;text-decoration:none">ai-automation.divigner.com/demo/${p.slug}</a>`}
      </p>
    </td></tr>

  </table>

</td></tr>
</table>

</body>
</html>`
}

async function sendNotificationEmail(
  sendgridKey: string,
  prospectEmail: string | null,
  raEmail: string | null,
  emailHtml: string,
  subject: string,
): Promise<void> {
  const to: string[] = []
  const cc: string[] = []

  if (prospectEmail) to.push(prospectEmail)

  // Build CC list, excluding any address already in TO
  const seen = new Set(to.map((e) => e.toLowerCase()))
  for (const addr of [...DIVIGNER_TEAM, ...(raEmail ? [raEmail] : [])]) {
    const lower = addr.toLowerCase()
    if (!seen.has(lower)) {
      cc.push(addr)
      seen.add(lower)
    }
  }

  // If the prospect didn't provide an email, send only to the internal team
  if (to.length === 0) {
    to.push(...cc.splice(0))
  }

  if (to.length === 0) return

  const personalizations: Record<string, unknown> = {
    to: to.map((e) => ({ email: e })),
  }
  if (cc.length > 0) {
    personalizations.cc = cc.map((e) => ({ email: e }))
  }

  const payload = {
    personalizations: [personalizations],
    from: { email: "zuirrae@divigner.com", name: "Divigner Group" },
    subject,
    content: [{ type: "text/html", value: emailHtml }],
  }

  console.log("SendGrid payload TO:", JSON.stringify(to), "CC:", JSON.stringify(cc))

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    const body = res.ok ? "(accepted)" : await res.text()
    console.log("SendGrid response:", res.status, body)
  } catch (err) {
    console.error("SendGrid fetch failed:", err)
  }
}

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
  const marketingConsent = payload.marketing_consent !== false
  const source     = payload.source?.trim().toLowerCase() ?? ""
  const intentRaw  = payload.prospect_intent?.trim().toLowerCase() ?? ""
  const isCme      = source === "cme"

  const INTENT_LABELS: Record<string, string> = {
    exploring:  "Just exploring",
    ready:      "Ready to start",
    interested: "Interested",
    sold:       "Ready to move forward",
  }
  const intentLabel = intentRaw
    ? INTENT_LABELS[intentRaw] ?? intentRaw.charAt(0).toUpperCase() + intentRaw.slice(1)
    : ""

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
    p_marketing_consent: marketingConsent,
  })

  if (error) {
    if (/no_data_found|not found/i.test(error.message)) {
      return json(404, { error: "Referral link not active" })
    }
    return json(500, { error: error.message })
  }

  // Send notification email (best-effort — never blocks the response)
  const sendgridKey = Deno.env.get("SENDGRID_API_KEY")
  if (sendgridKey) {
    const { data: raData } = await admin
      .from("ra_associates")
      .select("contact_email, display_name")
      .eq("slug", slug)
      .maybeSingle()

    const prospectName = [firstName, lastName].filter(Boolean).join(" ")

    const emailHtml = buildEmailHtml({
      prospectFirstName: firstName,
      prospectName,
      prospectEmail: email,
      prospectPhone: phone,
      company,
      website,
      message,
      intentLabel,
      formLabel: isCme ? "CME Interactive Avatars" : "",
      isCme,
      raName: raData?.display_name ?? "",
      raEmail: raData?.contact_email ?? "",
      slug,
    })

    const subject = isCme
      ? `CME Form: New Inquiry from ${prospectName} · Divigner Group`
      : `New Inquiry from ${prospectName} — Divigner Group`

    await sendNotificationEmail(
      sendgridKey,
      email || null,
      raData?.contact_email ?? null,
      emailHtml,
      subject,
    )
  }

  return json(200, { id: data, message: "Lead received" })
})
