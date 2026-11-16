// Compares each client's talk time with their package: one warning email at
// the alert level, a pause at the limit, and a resume when there is room again.
// Run by a schedule every few minutes, or by staff.

import { checkUsage } from "../_shared/billing.ts"
import { isScheduledCall, requireAccess, requireUser, serviceClient } from "../_shared/clients.ts"
import { endpoint, json } from "../_shared/http.ts"

export const handler = endpoint(async (req) => {
  if (!isScheduledCall(req)) {
    const caller = await requireUser(req)
    await requireAccess(caller, "plans.manage")
  }
  return json(200, { ok: true, ...(await checkUsage(serviceClient())) })
})
