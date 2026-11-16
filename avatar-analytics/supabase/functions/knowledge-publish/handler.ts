// Puts a client's answers into their avatars' knowledge in Tavus.
//
// Each avatar has one page of questions and answers (see knowledge-page).
// The first time, that page is added to Tavus as a knowledge document and
// attached to the avatar's PAL. After that, Tavus is asked to read it again.
// Tavus allows one re-read per document per hour, so a refresh that comes too
// soon is remembered and retried by the schedule.
//
// Body: { group_id }   publish after one answer changed (signed-in user)
//       {}             retry anything still waiting (schedule)

import { functionsBaseUrl, isScheduledCall, requireAccess, requireUser, serviceClient, type SupabaseClient } from "../_shared/clients.ts"
import { endpoint, HttpError, json } from "../_shared/http.ts"
import { randomHex } from "../_shared/signature.ts"
import { createDocument, getPal, patchPal, recrawlDocument, TavusError } from "../_shared/tavus.ts"

type Outcome = "published" | "waiting" | "error"

async function publishAvatar(admin: SupabaseClient, avatarId: string): Promise<{ outcome: Outcome; message?: string }> {
  const { data: avatar } = await admin.from("avatars").select("id, tavus_pal_id, display_name, unlinked_at").eq("id", avatarId).maybeSingle()
  if (!avatar || avatar.unlinked_at) return { outcome: "published" } // nothing to update for an unlinked avatar

  let { data: page } = await admin.from("avatar_knowledge").select("*").eq("avatar_id", avatarId).maybeSingle()
  if (!page) {
    const created = await admin.from("avatar_knowledge").insert({ avatar_id: avatarId, page_token: randomHex(24) }).select("*").single()
    if (created.error) return { outcome: "error", message: created.error.message }
    page = created.data
  }

  try {
    if (!page.tavus_document_id) {
      const doc = await createDocument({
        document_url: `${functionsBaseUrl()}/knowledge-page/${page.page_token}`,
        document_name: `${avatar.display_name} · answers from Avatar Analytics`,
        tags: ["avatar-analytics"],
        // One page, no links to follow. A crawl configuration is what allows re-reading later.
        crawl: { depth: 1, max_pages: 1 },
      })
      await admin.from("avatar_knowledge").update({ tavus_document_id: doc.document_id }).eq("avatar_id", avatarId)
      const pal = await getPal(avatar.tavus_pal_id)
      const ids = pal.document_ids ?? []
      if (!ids.includes(doc.document_id)) {
        await patchPal(avatar.tavus_pal_id, [{ op: "add", path: "/document_ids", value: [...ids, doc.document_id] }])
      }
    } else {
      await recrawlDocument(page.tavus_document_id)
    }
  } catch (err) {
    // 429: re-read too soon. 409: Tavus is still processing the last one. Both clear by themselves.
    if (err instanceof TavusError && (err.status === 429 || err.status === 409)) {
      await admin.from("avatar_knowledge").update({ needs_refresh: true, last_error: null }).eq("avatar_id", avatarId)
      return { outcome: "waiting" }
    }
    const message = (err as Error).message
    await admin.from("avatar_knowledge").update({ needs_refresh: true, last_error: message }).eq("avatar_id", avatarId)
    return { outcome: "error", message }
  }
  await admin.from("avatar_knowledge").update({ needs_refresh: false, last_error: null, published_at: new Date().toISOString() }).eq("avatar_id", avatarId)
  return { outcome: "published" }
}

/** Sets each waiting group's status from the state of its avatars' pages. */
async function settleGroups(admin: SupabaseClient, clientId?: string) {
  let query = admin.from("question_groups").select("id, avatar_ids").eq("knowledge_status", "pending")
  if (clientId) query = query.eq("client_id", clientId)
  const { data: groups } = await query
  for (const g of groups ?? []) {
    const { data: pages } = await admin.from("avatar_knowledge").select("needs_refresh, last_error, published_at").in("avatar_id", g.avatar_ids)
    const { data: active } = await admin.from("avatars").select("id").in("id", g.avatar_ids).is("unlinked_at", null)
    const failed = (pages ?? []).find((p) => p.last_error)
    const done = (pages ?? []).filter((p) => !p.needs_refresh && p.published_at).length >= (active ?? []).length
    if (failed) await admin.from("question_groups").update({ knowledge_status: "error", knowledge_error: failed.last_error }).eq("id", g.id)
    else if (done) await admin.from("question_groups").update({ knowledge_status: "published", knowledge_error: null }).eq("id", g.id)
  }
}

export const handler = endpoint(async (req) => {
  const admin = serviceClient()
  const body = await req.json().catch(() => ({})) as { group_id?: string }

  if (body.group_id) {
    const caller = await requireUser(req)
    const { data: group } = await admin.from("question_groups").select("id, client_id, avatar_ids").eq("id", body.group_id).maybeSingle()
    if (!group) throw new HttpError(404, "Question not found")
    await requireAccess(caller, "questions.answer", group.client_id)

    const results = []
    for (const avatarId of group.avatar_ids as string[]) results.push(await publishAvatar(admin, avatarId))
    await settleGroups(admin, group.client_id)
    const { data: after } = await admin.from("question_groups").select("knowledge_status, knowledge_error").eq("id", group.id).single()
    return json(200, { ok: true, knowledge_status: after?.knowledge_status, knowledge_error: after?.knowledge_error, waiting: results.some((r) => r.outcome === "waiting") })
  }

  if (!isScheduledCall(req)) {
    const caller = await requireUser(req)
    await requireAccess(caller, "avatars.link")
  }
  const { data: waiting } = await admin.from("avatar_knowledge").select("avatar_id").eq("needs_refresh", true).limit(50)
  let published = 0
  for (const row of waiting ?? []) if ((await publishAvatar(admin, row.avatar_id)).outcome === "published") published++
  await settleGroups(admin)
  return json(200, { ok: true, retried: waiting?.length ?? 0, published })
})
