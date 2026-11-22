// Backup check. Looks at recent Tavus conversations and feeds any events the
// webhooks missed through the same ingest function, so a missed webhook only
// delays the numbers. Run by a schedule, or by staff.
//
// Body (all optional): { since_hours: 48, max_pages: 5 }

import { isScheduledCall, requireAccess, requireUser, serviceClient, requireDivignerAccount } from "../_shared/clients.ts"
import { endpoint, json } from "../_shared/http.ts"
import { getConversationWithEvents, listConversations } from "../_shared/tavus.ts"
import { toIso } from "../_shared/time.ts"

type Body = { since_hours?: number; max_pages?: number }

export const handler = endpoint(async (req) => {
  if (!isScheduledCall(req)) {
    const caller = await requireUser(req)
    await requireAccess(caller, "avatars.link")
    await requireDivignerAccount(caller, "Tavus")
  }
  const body: Body = await req.json().catch(() => ({}))
  const sinceHours = Math.min(Math.max(Number(body.since_hours) || 48, 1), 24 * 90)
  const maxPages = Math.min(Math.max(Number(body.max_pages) || 5, 1), 100)
  const since = Date.now() - sinceHours * 3_600_000

  const admin = serviceClient()
  const { data: avatars, error } = await admin.from("avatars").select("id, tavus_pal_id").is("unlinked_at", null)
  if (error) throw error
  const avatarByPal = new Map((avatars ?? []).map((a) => [a.tavus_pal_id as string, a.id as string]))

  const result = { scanned: 0, fetched: 0, events_stored: 0, unattributed: 0, errors: 0 }
  if (avatarByPal.size === 0) return json(200, { ok: true, ...result })

  for (let page = 1; page <= maxPages; page++) {
    const conversations = await listConversations(page)
    if (conversations.length === 0) break
    result.scanned += conversations.length

    const candidates = conversations.filter((c) => {
      const created = Date.parse(toIso(c.created_at) ?? "")
      return c.status === "ended" && !Number.isNaN(created) && created >= since
    })
    result.unattributed += candidates.filter((c) => !c.pal_id).length
    const ours = candidates.filter((c) => c.pal_id && avatarByPal.has(c.pal_id))
    if (ours.length === 0) continue

    // Skip conversations that are already complete.
    const { data: known } = await admin
      .from("conversations")
      .select("conversation_id, ended_at, has_transcript")
      .in("conversation_id", ours.map((c) => c.conversation_id))
    const complete = new Set(
      (known ?? []).filter((k) => k.ended_at && k.has_transcript).map((k) => k.conversation_id as string),
    )

    for (const c of ours) {
      if (complete.has(c.conversation_id)) continue
      try {
        const full = await getConversationWithEvents(c.conversation_id)
        result.fetched++
        for (const event of full.events ?? []) {
          if (!event.event_type) continue
          const { data } = await admin.rpc("ingest_tavus_event", {
            p_avatar_id: avatarByPal.get(c.pal_id!)!,
            p_payload: {
              conversation_id: c.conversation_id,
              event_type: event.event_type,
              timestamp: toIso(event.timestamp) ?? event.timestamp ?? null,
              properties: event.properties ?? {},
            },
            p_source: "backfill",
          })
          if (data?.stored) result.events_stored++
        }
      } catch (err) {
        result.errors++
        console.error(`backfill ${c.conversation_id}:`, (err as Error).message)
      }
    }
  }

  return json(200, { ok: true, ...result })
})
