// Builds the file a person exports: one PDF for a single transcript, or a ZIP
// of PDFs (one per conversation) for several. Everything is made in the browser.

import type { Client } from "@/lib/api"
import type { PdfConversation } from "@/lib/pdf"

export type ExportFile = { bytes: Uint8Array; filename: string; type: "application/pdf" | "application/zip"; count: number }

const slug = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

/** "maya-2026-11-14-2149" in the client's time zone, so files sort by avatar and then by time. */
function baseName(item: PdfConversation, timeZone: string): string {
  const at = item.conversation.started_at ?? item.conversation.ended_at
  let stamp = "undated"
  if (at) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at))
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
    stamp = `${get("year")}-${get("month")}-${get("day")}-${get("hour")}${get("minute")}`
  }
  return `${slug(item.avatarName) || "avatar"}-${stamp}`
}

export async function buildExportFile(client: Client, items: PdfConversation[]): Promise<ExportFile> {
  if (items.length === 0) throw new Error("Choose at least one conversation that has a transcript.")
  const { buildTranscriptPdf } = await import("@/lib/pdf")
  const pdfFor = (item: PdfConversation) => buildTranscriptPdf({ clientName: client.name, logoUrl: client.logo_url, timeZone: client.timezone, conversations: [item] })

  if (items.length === 1) {
    return { bytes: await pdfFor(items[0]), filename: `${client.slug}-${baseName(items[0], client.timezone)}-transcript.pdf`, type: "application/pdf", count: 1 }
  }

  const { zipSync } = await import("fflate")
  const files: Record<string, Uint8Array> = {}
  for (const item of items) {
    const base = baseName(item, client.timezone)
    let name = `${base}.pdf`
    for (let n = 2; files[name]; n++) name = `${base}-${n}.pdf`
    files[name] = await pdfFor(item)
  }
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: client.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  // PDFs are already compressed inside, so a light setting keeps large exports quick.
  return { bytes: zipSync(files, { level: 1 }), filename: `${client.slug}-transcripts-${items.length}-conversations-${day}.zip`, type: "application/zip", count: items.length }
}

export function asFile(file: ExportFile): File {
  return new File([file.bytes as BlobPart], file.filename, { type: file.type })
}
