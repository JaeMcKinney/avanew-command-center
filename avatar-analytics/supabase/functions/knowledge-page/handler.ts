// The page of questions and answers Tavus reads for one avatar.
//
//   GET /functions/v1/knowledge-page/<page token>
//
// Public by design (Tavus fetches it without a login), so the address
// contains a long random token and the page holds nothing but the answers
// the client chose to give their avatar.

import { serviceClient } from "../_shared/clients.ts"

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Use GET", { status: 405 })
  const parts = new URL(req.url).pathname.split("/").filter(Boolean)
  const token = parts[parts.lastIndexOf("knowledge-page") + 1]
  if (!token || !/^[0-9a-f]{32,128}$/.test(token)) return new Response("Not found", { status: 404 })

  const admin = serviceClient()
  const { data: page } = await admin.from("avatar_knowledge").select("avatar_id, avatars(display_name)").eq("page_token", token).maybeSingle()
  if (!page) return new Response("Not found", { status: 404 })

  const { data: groups } = await admin
    .from("question_groups")
    .select("question, answer")
    .eq("status", "answered")
    .contains("avatar_ids", [page.avatar_id])
    .order("answered_at")
  const avatar = page.avatars as { display_name?: string } | null

  const lines = [`# Questions and answers for ${avatar?.display_name ?? "this avatar"}`, "",
    "These answers were written by the business. Use them when a visitor asks about these topics.", ""]
  for (const g of groups ?? []) lines.push(`## ${g.question}`, "", g.answer ?? "", "")
  if (!groups?.length) lines.push("No answers have been added yet.")

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  })
}
