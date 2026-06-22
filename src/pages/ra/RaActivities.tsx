import { useEffect, useState } from "react"
import { Phone, Video, Users, Mail, ClipboardList, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getRaAssociate, listCheckinsForRaSlug, listLeadsForRaSlug,
} from "@/lib/data"
import type { ClientCheckin, RaLead } from "@/lib/data"
import { LogCheckinModal } from "@/components/LogCheckinModal"
import type { RaAssociate } from "@/types/db"

const METHOD_META: Record<ClientCheckin["method"], { label: string; icon: typeof Phone }> = {
  phone: { label: "Phone call", icon: Phone },
  video: { label: "Video call", icon: Video },
  in_person: { label: "In person", icon: Users },
  email: { label: "Email", icon: Mail },
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function RaActivities() {
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [checkins, setCheckins] = useState<ClientCheckin[]>([])
  const [clients, setClients] = useState<RaLead[]>([])
  const [loading, setLoading] = useState(true)
  const [logTarget, setLogTarget] = useState<{ leadId: string | null; name: string } | null>(null)

  async function load() {
    const r = await getRaAssociate()
    setRa(r)
    if (!r?.slug) { setLoading(false); return }
    const [c, leads] = await Promise.all([
      listCheckinsForRaSlug(r.slug),
      listLeadsForRaSlug(r.slug),
    ])
    setCheckins(c)
    setClients(leads.filter((l) => l.stage === "closed_won"))
    setLoading(false)
  }

  useEffect(() => { void load().catch(() => setLoading(false)) }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Activities</h1>
          <p className="text-sm text-muted-foreground mt-1">Your logged client touchpoints and check-ins.</p>
        </div>
        {clients.length > 0 && (
          <Button size="sm" onClick={() => setLogTarget({ leadId: clients[0].id, name: clients[0].company ?? clients[0].name })}>
            <Plus className="h-3.5 w-3.5" /> Log activity
          </Button>
        )}
      </div>

      {/* Quick-log per active client */}
      {clients.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Log a touchpoint with a client</p>
            <div className="flex flex-wrap gap-2">
              {clients.map((c) => (
                <Button key={c.id} variant="outline" size="sm" onClick={() => setLogTarget({ leadId: c.id, name: c.company ?? c.name })}>
                  {c.company ?? c.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feed */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : checkins.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center mb-4"><ClipboardList className="h-6 w-6 text-primary" /></div>
          <p className="font-medium">No activities yet</p>
          <p className="text-sm text-muted-foreground">Log a check-in with one of your clients to start your activity history.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {checkins.map((c) => {
            const meta = METHOD_META[c.method]
            const Icon = meta.icon
            return (
              <Card key={c.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{meta.label} · {c.client_name}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{relTime(c.checkin_at)}</span>
                    </div>
                    {c.notes && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {logTarget && ra?.slug && (
        <LogCheckinModal
          open={!!logTarget}
          onClose={() => setLogTarget(null)}
          raSlug={ra.slug}
          leadId={logTarget.leadId}
          clientName={logTarget.name}
          onLogged={() => { void load() }}
        />
      )}
    </div>
  )
}
