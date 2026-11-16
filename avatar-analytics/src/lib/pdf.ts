// Builds the branded transcript PDF in the browser: Divigner letterhead, the
// client's logo or name, a summary, the questions asked, the full transcript,
// and "Page X of Y" on every page. Loaded only when someone downloads.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"
import type { Conversation, Question, TranscriptTurn } from "@/lib/api"
import { formatDateTime } from "@/lib/dates"
import { duration, endedBecause } from "@/lib/format"

export type PdfConversation = {
  conversation: Conversation
  avatarName: string
  summary: string | null
  questions: Question[]
  turns: TranscriptTurn[]
}

export type PdfInput = {
  clientName: string
  logoUrl?: string | null
  timeZone: string
  /** Shown under the title when the file covers a period, e.g. "1 Nov – 16 Nov 2026 · Maya". */
  scope?: string
  conversations: PdfConversation[]
}

const PAGE = { width: 612, height: 792 } // US Letter, in points
const MARGIN = 54
const HEADER_HEIGHT = 58
const FOOTER_HEIGHT = 40
const WIDTH = PAGE.width - MARGIN * 2
const NAVY = rgb(0.078, 0.216, 0.294)
const BLUE = rgb(0.184, 0.357, 1)
const INK = rgb(0.1, 0.12, 0.16)
const MUTED = rgb(0.36, 0.4, 0.46)
const RULE = rgb(0.85, 0.87, 0.9)

const OUTCOME_LABEL: Record<string, string> = { answered: "Answered", weak: "Partly answered", unanswered: "Not answered" }

const REPLACEMENTS: Record<string, string> = {
  "→": "->", "←": "<-", "≤": "<=", "≥": ">=", "≠": "!=", "−": "-", "‑": "-",
  " ": " ", " ": " ", " ": " ", "​": "", "﻿": "", "\t": "    ",
}

/** The built-in PDF fonts cover Western European text only. Anything else becomes "?" instead of failing the file. */
export function printable(text: string, font: PDFFont): string {
  let out = ""
  for (const char of text.normalize("NFC")) {
    if (char === "\n") { out += char; continue }
    const swapped = REPLACEMENTS[char] ?? char
    try {
      font.encodeText(swapped)
      out += swapped
    } catch {
      // Try without accents and symbols before giving up on the character.
      const plain = swapped.normalize("NFD").replace(/[̀-ͯ]/g, "")
      try {
        font.encodeText(plain)
        out += plain
      } catch {
        out += /\p{Extended_Pictographic}|\p{Mark}|\p{Cf}/u.test(char) ? "" : "?"
      }
    }
  }
  return out
}

/** Breaks text into lines no wider than `maxWidth`, splitting very long words. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (let word of paragraph.split(/ +/)) {
      while (font.widthOfTextAtSize(word, size) > maxWidth) {
        let cut = word.length - 1
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--
        if (line) { lines.push(line); line = "" }
        lines.push(word.slice(0, cut))
        word = word.slice(cut)
      }
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines
}

async function loadLogo(doc: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes)
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes)
    return null // SVG and WebP cannot be placed in a PDF; the client's name is used instead.
  } catch {
    return null // The logo's site may not allow other sites to read it.
  }
}

export async function buildTranscriptPdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const logo = await loadLogo(doc, input.logoUrl)
  const clientName = printable(input.clientName, bold)

  const single = input.conversations.length === 1
  doc.setTitle(single ? `Conversation with ${input.conversations[0].avatarName}` : `Conversation transcripts for ${input.clientName}`)
  doc.setAuthor("Divigner")
  doc.setSubject(`Prepared for ${input.clientName}`)
  doc.setLanguage("en")
  doc.setCreationDate(new Date())

  let page!: PDFPage
  let y = 0
  const bottom = MARGIN + FOOTER_HEIGHT

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height])
    const top = PAGE.height - MARGIN
    // Letterhead: Divigner on the left, the client on the right.
    page.drawText("Divigner", { x: MARGIN, y: top - 20, size: 20, font: bold, color: NAVY })
    page.drawText("AI video avatars", { x: MARGIN, y: top - 34, size: 8.5, font: regular, color: MUTED })
    if (logo) {
      const scale = Math.min(30 / logo.height, 150 / logo.width)
      page.drawImage(logo, { x: PAGE.width - MARGIN - logo.width * scale, y: top - 32, width: logo.width * scale, height: logo.height * scale })
    } else {
      const size = Math.min(13, (13 * 260) / Math.max(260, bold.widthOfTextAtSize(clientName, 13)))
      page.drawText(clientName, { x: PAGE.width - MARGIN - bold.widthOfTextAtSize(clientName, size), y: top - 22, size, font: bold, color: INK })
    }
    page.drawRectangle({ x: MARGIN, y: top - 46, width: WIDTH, height: 2, color: BLUE })
    y = top - HEADER_HEIGHT - 12
  }

  const need = (height: number) => {
    if (y - height < bottom) newPage()
  }

  const paragraph = (text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const font = opts.font ?? regular
    const size = opts.size ?? 10.5
    const indent = opts.indent ?? 0
    const leading = size * 1.42
    for (const line of wrapText(printable(text, font), font, size, WIDTH - indent)) {
      need(leading)
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color: opts.color ?? INK })
      y -= leading
    }
    y -= opts.gap ?? 0
  }

  const heading = (text: string) => {
    need(40)
    y -= 6
    page.drawText(text.toUpperCase(), { x: MARGIN, y: y - 9, size: 9, font: bold, color: NAVY })
    y -= 14
    page.drawRectangle({ x: MARGIN, y, width: WIDTH, height: 0.75, color: RULE })
    y -= 8
  }

  for (const item of input.conversations) {
    newPage()
    const conv = item.conversation
    const avatar = item.avatarName
    paragraph(`Conversation with ${avatar}`, { font: bold, size: 18, color: NAVY, gap: 2 })
    paragraph(
      [formatDateTime(conv.started_at ?? conv.ended_at, input.timeZone), duration(conv.talk_seconds), endedBecause(conv.shutdown_reason)].join("  ·  "),
      { size: 10, color: MUTED },
    )
    if (input.scope && !single) paragraph(`Part of: ${input.scope}`, { size: 9, color: MUTED })
    paragraph(`Reference: ${conv.conversation_id}`, { size: 8.5, color: MUTED, gap: 8 })

    heading("Summary")
    paragraph(item.summary ?? "A summary is not available for this conversation yet.", item.summary ? { gap: 6 } : { font: italic, color: MUTED, gap: 6 })

    if (item.questions.length > 0) {
      heading("Questions the visitor asked")
      item.questions.forEach((q, i) => {
        const label = OUTCOME_LABEL[q.outcome] ?? q.outcome
        need(30)
        const number = `${i + 1}.`
        page.drawText(number, { x: MARGIN, y: y - 10.5, size: 10.5, font: bold, color: INK })
        paragraph(q.question, { indent: 18 })
        paragraph(label, { indent: 18, size: 9, font: bold, color: q.outcome === "answered" ? MUTED : NAVY, gap: 5 })
      })
    }

    heading("Transcript")
    const turns = item.turns.filter((t) => (t.role === "user" || t.role === "assistant") && t.content)
    if (turns.length === 0) paragraph("Nothing was said in this conversation.", { font: italic, color: MUTED })
    for (const turn of turns) {
      const fromAvatar = turn.role === "assistant"
      const speaker = fromAvatar ? avatar : "Visitor"
      const stamp = typeof turn.seconds_from_start === "number" ? `  ·  ${duration(turn.seconds_from_start)}` : ""
      need(34)
      if (fromAvatar) page.drawRectangle({ x: MARGIN, y: y - 12, width: 3, height: 12, color: BLUE })
      const name = printable(speaker, bold)
      page.drawText(name, { x: MARGIN + 9, y: y - 10, size: 9.5, font: bold, color: fromAvatar ? NAVY : INK })
      page.drawText(stamp, { x: MARGIN + 9 + bold.widthOfTextAtSize(name, 9.5), y: y - 10, size: 8.5, font: regular, color: MUTED })
      y -= 15
      paragraph(turn.content, { indent: 9, gap: 8 })
    }
  }

  // Footers go on last, once the page count is known.
  const pages = doc.getPages()
  const note = printable(`Confidential  ·  Prepared by Divigner for ${input.clientName}`, regular)
  const prepared = `Prepared ${formatDateTime(new Date().toISOString(), input.timeZone)}`
  pages.forEach((p, i) => {
    p.drawRectangle({ x: MARGIN, y: MARGIN + 22, width: WIDTH, height: 0.75, color: RULE })
    const fitted = wrapText(note, regular, 8.5, WIDTH - 90)[0]
    p.drawText(fitted, { x: MARGIN, y: MARGIN + 8, size: 8.5, font: regular, color: MUTED })
    p.drawText(printable(prepared, regular), { x: MARGIN, y: MARGIN - 3, size: 7.5, font: regular, color: MUTED })
    const label = `Page ${i + 1} of ${pages.length}`
    p.drawText(label, { x: PAGE.width - MARGIN - bold.widthOfTextAtSize(label, 9), y: MARGIN + 8, size: 9, font: bold, color: INK })
  })

  return doc.save()
}

/** Hands a finished file to the browser to save. */
export function saveFile(bytes: Uint8Array, filename: string, type = "application/pdf"): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function pdfFileName(parts: Array<string | null | undefined>): string {
  const slug = parts.filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `${slug.slice(0, 80) || "transcript"}.pdf`
}
