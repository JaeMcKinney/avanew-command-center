// Summarises transcripts that are waiting. Run by a schedule every few
// minutes (and nudged by the webhook as transcripts arrive), or by staff.
//
// Body (optional): { limit: 10 }

import { isScheduledCall, requireAccess, requireUser, serviceClient, requireDivignerAccount } from "../_shared/clients.ts"
import { endpoint, json } from "../_shared/http.ts"
import { processPendingInsights } from "../_shared/insights.ts"

export const handler = endpoint(async (req) => {
  if (!isScheduledCall(req)) {
    const caller = await requireUser(req)
    await requireAccess(caller, "avatars.link")
    await requireDivignerAccount(caller, "This")
  }
  const body = await req.json().catch(() => ({})) as { limit?: number }
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50)
  const result = await processPendingInsights(serviceClient(), limit)
  return json(200, { ok: true, ...result })
})
