import { useEffect, useState } from "react"
import { ShieldAlert, Check, X, Loader2, Landmark, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { listPendingRaChangeRequests, reviewRaChangeRequest } from "@/lib/data"
import type { PendingRaChangeRequest } from "@/lib/data"

function maskedBanking(payload: Record<string, unknown>): string {
  const parts: string[] = []
  if (payload.ach_account_holder) parts.push(`Holder: ${String(payload.ach_account_holder)}`)
  if (payload.ach_bank_name) parts.push(`Bank: ${String(payload.ach_bank_name)}`)
  if (payload.ach_routing) parts.push(`Routing ···${String(payload.ach_routing).slice(-4)}`)
  if (payload.ach_account) parts.push(`Acct ···${String(payload.ach_account).slice(-4)}`)
  return parts.join(" · ") || "No values provided"
}

/**
 * Program-Admin surface for pending RA banking / W-9 change requests. Renders
 * nothing when the queue is empty, so it stays out of the way until an RA
 * submits a request from their self-service settings page.
 */
export function RaChangeRequestsCard() {
  const [requests, setRequests] = useState<PendingRaChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try { setRequests(await listPendingRaChangeRequests()) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function act(id: string, approve: boolean) {
    setActingId(id)
    try {
      await reviewRaChangeRequest(id, approve)
      toast.success(approve ? "Change approved and applied" : "Change request declined")
      setRequests((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setActingId(null)
    }
  }

  if (loading || requests.length === 0) return null

  return (
    <Card className="border-amber-300/50 bg-amber-50/40 dark:bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Pending change requests
          <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5">{requests.length}</span>
        </CardTitle>
        <CardDescription>RAs requested banking or tax changes. Approving applies the change to their record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {r.request_type === "banking" ? <Landmark className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                {r.ra_display_name}
                <span className="text-muted-foreground font-normal capitalize">· {r.request_type} change</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {r.request_type === "banking" ? maskedBanking(r.payload) : "W-9 document update"}
              </p>
              {r.note && <p className="text-xs text-muted-foreground mt-1 italic">"{r.note}"</p>}
              <p className="text-[11px] text-muted-foreground mt-1">{new Date(r.requested_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-8" disabled={actingId === r.id} onClick={() => act(r.id, false)}>
                {actingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Decline
              </Button>
              <Button size="sm" className="h-8" disabled={actingId === r.id} onClick={() => act(r.id, true)}>
                {actingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
