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
  prospectName: string
  prospectEmail: string
  prospectPhone: string
  company: string
  website: string
  message: string
  raName: string
  slug: string
}): string {
  const detailRow = (label: string, value: string) =>
    value
      ? `<tr>
          <td style="padding:8px 12px;font-family:'Manrope',Helvetica,Arial,sans-serif;font-size:13px;color:#8A9BB0;text-align:right;vertical-align:top;white-space:nowrap">${label}</td>
          <td style="padding:8px 12px;font-family:'Manrope',Helvetica,Arial,sans-serif;font-size:14px;color:#E8ECF0;vertical-align:top">${value}</td>
        </tr>`
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inquiry Received — Divigner</title>
</head>
<body style="margin:0;padding:0;background-color:#06101D;-webkit-text-size-adjust:100%">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#06101D">
<tr><td align="center" style="padding:40px 16px">

  <!-- Card -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(165deg,#0E2741,#091A2D);border:1px solid rgba(201,168,106,0.3);border-radius:16px;overflow:hidden">

    <!-- Gold top accent line -->
    <tr><td style="height:3px;background:linear-gradient(90deg,#C9A86A,#34D6C2,#5FE3D2)"></td></tr>

    <!-- Logo -->
    <tr><td align="center" style="padding:36px 32px 24px">
      <img src="https://ai-automation.divigner.com/divigner-logo.svg" alt="Divigner" width="160" style="display:block;max-width:160px;height:auto">
    </td></tr>

    <!-- Heading -->
    <tr><td align="center" style="padding:0 32px 8px">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;font-style:italic;color:#E8ECF0;line-height:1.3">
        We've Received Your Inquiry
      </h1>
    </td></tr>

    <!-- Body text -->
    <tr><td style="padding:12px 32px 28px">
      <p style="margin:0;font-family:'Manrope',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:rgba(232,236,240,0.7);text-align:center">
        Thank you for reaching out. Our team has received your submission and will review it promptly.
        A member of our team will be in touch with you shortly.
      </p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:0 32px">
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,106,0.35),transparent)"></div>
    </td></tr>

    <!-- Details heading -->
    <tr><td style="padding:24px 32px 12px">
      <p style="margin:0;font-family:'Manrope',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#34D6C2">
        Submission Details
      </p>
    </td></tr>

    <!-- Details table -->
    <tr><td style="padding:0 20px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(6,16,29,0.5);border:1px solid rgba(120,214,196,0.12);border-radius:10px;overflow:hidden">
        ${detailRow("Name", p.prospectName)}
        ${detailRow("Email", p.prospectEmail)}
        ${detailRow("Phone", p.prospectPhone)}
        ${detailRow("Company", p.company)}
        ${detailRow("Website", p.website)}
        ${detailRow("Message", p.message)}
        ${detailRow("Referred by", p.raName)}
      </table>
    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:0 32px">
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,106,0.35),transparent)"></div>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center" style="padding:24px 32px 32px">
      <p style="margin:0;font-family:'Manrope',Helvetica,Arial,sans-serif;font-size:12px;color:rgba(232,236,240,0.35);line-height:1.6">
        Divigner Group &middot; AI Automation Solutions<br>
        <a href="https://ai-automation.divigner.com" style="color:#34D6C2;text-decoration:none">ai-automation.divigner.com</a>
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
  prospectName: string,
): Promise<void> {
  const to: string[] = []
  const cc: string[] = [...DIVIGNER_TEAM]

  if (prospectEmail) to.push(prospectEmail)
  if (raEmail && !cc.includes(raEmail)) cc.push(raEmail)

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

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [personalizations],
        from: { email: "zuirrae@divigner.com", name: "Divigner Group" },
        subject: `New Inquiry from ${prospectName} — Divigner Group`,
        content: [{ type: "text/html", value: emailHtml }],
      }),
    })
    if (!res.ok) {
      console.error("SendGrid error:", res.status, await res.text())
    }
  } catch {
    console.error("Failed to send notification email")
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
      prospectName,
      prospectEmail: email,
      prospectPhone: phone,
      company,
      website,
      message,
      raName: raData?.display_name ?? "",
      slug,
    })

    await sendNotificationEmail(
      sendgridKey,
      email || null,
      raData?.contact_email ?? null,
      emailHtml,
      prospectName,
    )
  }

  return json(200, { id: data, message: "Lead received" })
})
