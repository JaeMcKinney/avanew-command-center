// Turns an export file a person just uploaded into a private link that
// expires, and can email that link to the person who made it.
//
// Body: { path, action: "link" | "email" }   path = <client id>/<user id>/<id>/<file name>
//       { action: "options" }                → which export options are set up
// With the schedule's secret and no body: removes export files older than 7 days.
//
// Settings: RESEND_API_KEY and EMAIL_FROM (both needed for email).

import { isScheduledCall, requireAccess, requireUser, serviceClient, writeAudit } from "../_shared/clients.ts"
import { endpoint, HttpError, json } from "../_shared/http.ts"

const BUCKET = "exports"
const LINK_DAYS = 7
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const emailSettings = () => {
  const key = Deno.env.get("RESEND_API_KEY")
  const from = Deno.env.get("EMAIL_FROM")
  return key && from ? { key, from, base: (Deno.env.get("RESEND_API_BASE") ?? "https://api.resend.com").replace(/\/+$/, "") } : null
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

async function sendEmail(to: string, clientName: string, fileName: string, url: string, expires: Date) {
  const settings = emailSettings()
  if (!settings) throw new HttpError(503, "Email is not set up yet. Download the file instead, or ask Divigner to turn email on.")
  const until = expires.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
  const text = `Here are the conversation transcripts you asked for from ${clientName}.\n\nDownload: ${url}\n\nFile: ${fileName}\nThis private link works until ${until}. Anyone with the link can open the file, so share it with care.\n\nDivigner`
  const html = `<p>Here are the conversation transcripts you asked for from ${escapeHtml(clientName)}.</p>`
    + `<p><a href="${escapeHtml(url)}">Download ${escapeHtml(fileName)}</a></p>`
    + `<p>This private link works until ${until}. Anyone with the link can open the file, so share it with care.</p><p>Divigner</p>`
  let res: Response
  try {
    res = await fetch(`${settings.base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: settings.from, to: [to], subject: `Your transcripts from ${clientName}`, text, html }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new HttpError(502, "The email could not be sent. Try again in a moment.")
  }
  if (!res.ok) {
    console.error("email send failed", res.status, (await res.text()).slice(0, 300))
    throw new HttpError(502, "The email could not be sent. Try again in a moment.")
  }
}

export const handler = endpoint(async (req) => {
  const admin = serviceClient()

  if (isScheduledCall(req)) {
    const { data: paths, error } = await admin.rpc("expired_export_paths", { p_days: LINK_DAYS })
    if (error) throw new Error(error.message)
    const names = (paths ?? []) as string[]
    for (let i = 0; i < names.length; i += 100) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(names.slice(i, i + 100))
      if (removeError) throw new Error(removeError.message)
    }
    return json(200, { ok: true, removed: names.length })
  }

  const caller = await requireUser(req)
  const body = await req.json().catch(() => ({})) as { path?: string; action?: string }
  if (body.action === "options") return json(200, { ok: true, email: Boolean(emailSettings()), link_days: LINK_DAYS })
  if (body.action !== "link" && body.action !== "email") throw new HttpError(400, "Unknown action")

  // The path itself says whose file it is; check every part of it.
  const parts = (body.path ?? "").split("/")
  const [clientId, ownerId, exportId, fileName] = parts
  if (parts.length !== 4 || !UUID.test(clientId) || !UUID.test(exportId) || !/^[a-z0-9][a-z0-9._-]{0,120}\.(pdf|zip)$/.test(fileName ?? "")) {
    throw new HttpError(400, "That file address is not valid")
  }
  if (ownerId !== caller.userId) throw new HttpError(403, "You can only share files you exported yourself")
  await requireAccess(caller, "transcripts.view", clientId)

  const expires = new Date(Date.now() + LINK_DAYS * 86_400_000)
  const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(body.path!, LINK_DAYS * 86_400, { download: fileName })
  if (error || !signed?.signedUrl) throw new HttpError(404, "That file was not found. Export it again.")

  let emailedTo: string | null = null
  if (body.action === "email") {
    // Only ever to the address of the person signed in.
    const { data: user } = await admin.auth.admin.getUserById(caller.userId)
    const to = user.user?.email
    if (!to) throw new HttpError(400, "Your account has no email address")
    const { data: client } = await admin.from("clients").select("name").eq("id", clientId).single()
    await sendEmail(to, client?.name ?? "your avatars", fileName, signed.signedUrl, expires)
    emailedTo = to
  }

  await writeAudit(admin, {
    actorId: caller.userId, action: body.action === "email" ? "transcripts.emailed" : "transcripts.link_created",
    targetType: "export", targetId: exportId, clientId, detail: { file: fileName },
  })
  return json(200, { ok: true, url: signed.signedUrl, expires_at: expires.toISOString(), emailed_to: emailedTo })
})
