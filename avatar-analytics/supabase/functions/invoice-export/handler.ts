// Every invoice for a client between two dates, as one ZIP: each invoice's PDF
// from Stripe plus a summary spreadsheet (CSV).
//
// Body: { client_id, from: "YYYY-MM-DD", to: "YYYY-MM-DD" }   → application/zip

import { strToU8, zipSync } from "npm:fflate@0.8.2"
import { requireAccess, requireUser, serviceClient, writeAudit } from "../_shared/clients.ts"
import { corsHeaders, endpoint, HttpError, readJson } from "../_shared/http.ts"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX = 120
const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value)
  // Stop a spreadsheet from treating a value as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const handler = endpoint(async (req) => {
  const caller = await requireUser(req)
  const body = await readJson<{ client_id?: string; from?: string; to?: string }>(req)
  if (!body.client_id || !DAY.test(body.from ?? "") || !DAY.test(body.to ?? "") || body.from! > body.to!) throw new HttpError(400, "Choose a client and a valid period")
  await requireAccess(caller, "billing.view", body.client_id)

  const admin = serviceClient()
  const { data: client } = await admin.from("clients").select("name, slug, timezone").eq("id", body.client_id).single()
  if (!client) throw new HttpError(404, "Client not found")
  // The period is in the client's own days.
  const { data: invoices, error } = await admin.from("invoices").select("*").eq("client_id", body.client_id)
    .gte("issued_at", `${body.from}T00:00:00Z`).lte("issued_at", `${body.to}T23:59:59Z`).order("issued_at").limit(MAX)
  if (error) throw new Error(error.message)
  if (!invoices?.length) throw new HttpError(404, "There are no invoices in that period")

  const files: Record<string, Uint8Array> = {}
  const rows = [["Invoice", "Date", "Status", "Amount due", "Amount paid", "Currency", "Period start", "Period end", "PDF included", "View online"]]
  let missing = 0
  for (const invoice of invoices) {
    const name = `${(invoice.number ?? invoice.id).replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`
    let included = false
    // Only ever fetch from Stripe's own invoice hosts.
    if (invoice.invoice_pdf && /^https:\/\/([a-z0-9-]+\.)*stripe\.(com|test)\//.test(invoice.invoice_pdf)) {
      try {
        const res = await fetch(invoice.invoice_pdf, { signal: AbortSignal.timeout(20_000) })
        if (res.ok) {
          files[name] = new Uint8Array(await res.arrayBuffer())
          included = true
        }
      } catch { /* listed in the summary as not included */ }
    }
    if (!included) missing++
    rows.push([invoice.number ?? invoice.id, invoice.issued_at.slice(0, 10), invoice.status, (invoice.amount_due_cents / 100).toFixed(2), (invoice.amount_paid_cents / 100).toFixed(2),
      invoice.currency.toUpperCase(), invoice.period_start?.slice(0, 10) ?? "", invoice.period_end?.slice(0, 10) ?? "", included ? "yes" : "no", invoice.hosted_invoice_url ?? ""])
  }
  files["invoices-summary.csv"] = strToU8("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n")

  await writeAudit(admin, { actorId: caller.userId, action: "invoices.exported", targetType: "client", targetId: body.client_id, clientId: body.client_id, detail: { from: body.from, to: body.to, invoices: invoices.length } })
  const filename = `${client.slug}-invoices-${body.from}-to-${body.to}.zip`
  return new Response(zipSync(files, { level: 1 }) as BodyInit, {
    status: 200,
    headers: {
      ...corsHeaders, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`,
      "Access-Control-Expose-Headers": "Content-Disposition, X-Invoices, X-Invoices-Missing", "X-Invoices": String(invoices.length), "X-Invoices-Missing": String(missing),
    },
  })
})
