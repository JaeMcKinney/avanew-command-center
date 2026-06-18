import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, ChevronRight, CheckCircle2, XCircle, Mail, Phone, Building2,
  FileText, MessageSquare, Trophy, ClipboardList, Sparkles, Plus, Wallet, DollarSign,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { getLeadDetail, updateLeadStage, addLeadNote, getCommissionConfig, listPayoutsForRaSlug } from "@/lib/data"
import { formatMoney, calcOneTimeCommission, calcRecurringCommissionPerMonth } from "@/lib/commissions"
import type { RaLead, RaPayout } from "@/lib/data"
import type { CommissionConfig } from "@/types/db"

const STAGES: Array<{ key: RaLead["stage"]; label: string }> = [
  { key: "new",            label: "New" },
  { key: "qualified",      label: "Qualified" },
  { key: "proposal_sent",  label: "Proposal Sent" },
  { key: "call_booked",    label: "Call Booked" },
  { key: "closed_won",     label: "Closed Won" },
]

const INTENT_VARIANT: Record<NonNullable<RaLead["intent"]>, "default" | "secondary" | "outline"> = {
  learning: "outline", interested: "secondary", sold: "default",
}

type TimelineItem = { id: string; at: string; title: string; detail?: string; kind: "stage" | "note" | "contact" }

export function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<RaLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Array<{ id: string; text: string; at: string }>>([])
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [acting, setActing] = useState(false)
  const [cfg, setCfg] = useState<CommissionConfig | null>(null)
  const [payouts, setPayouts] = useState<RaPayout[]>([])

  useEffect(() => {
    if (!id) return
    void getLeadDetail(id).then((res) => {
      setLead(res.lead)
      setNotes(res.notes)
      setLoading(false)
      // For closed-won deals, also fetch the commission config + payouts.
      if (res.lead.stage === "closed_won" && res.lead.ra_slug) {
        void getCommissionConfig().then(setCfg)
        void listPayoutsForRaSlug(res.lead.ra_slug).then((all) => {
          setPayouts(all.filter((p) => p.deal_id === res.lead.id))
        })
      }
    })
  }, [id])

  const timeline: TimelineItem[] = useMemo(() => {
    if (!lead) return []
    const out: TimelineItem[] = [
      { id: "created", at: lead.created_at, title: "Lead submitted", detail: lead.company ? `Through ${lead.company}` : undefined, kind: "stage" },
    ]
    if (lead.updated_at !== lead.created_at) {
      out.push({ id: "advance", at: lead.updated_at, title: `Stage: ${STAGES.find((s) => s.key === lead.stage)?.label ?? lead.stage}`, kind: "stage" })
    }
    for (const n of notes) out.push({ id: n.id, at: n.at, title: "Note", detail: n.text, kind: "note" })
    if (lead.closed_at) {
      out.push({
        id: "closed", at: lead.closed_at,
        title: lead.stage === "closed_won" ? "Closed Won" : "Closed Lost",
        detail: lead.closed_reason ?? undefined, kind: "stage",
      })
    }
    return out.sort((a, b) => +new Date(b.at) - +new Date(a.at))
  }, [lead, notes])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (!lead) return (
    <div className="p-6 space-y-3">
      <p className="text-sm">Lead not found.</p>
      <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Button>
    </div>
  )

  const isOpen = lead.stage !== "closed_won" && lead.stage !== "closed_lost"
  const stageIndex = STAGES.findIndex((s) => s.key === lead.stage)

  async function moveStage(target: RaLead["stage"]) {
    if (!lead) return
    setActing(true)
    try {
      const updated = await updateLeadStage(lead.id, target)
      setLead(updated)
      toast.success(`Moved to ${STAGES.find((s) => s.key === target)?.label ?? target}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to advance stage")
    } finally {
      setActing(false)
    }
  }

  async function submitNote() {
    if (!lead || !noteText.trim()) return
    setActing(true)
    try {
      const note = await addLeadNote(lead.id, noteText.trim())
      setNotes((prev) => [note, ...prev])
      setNoteText("")
      setNoteOpen(false)
      toast.success("Note added")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setActing(false)
    }
  }

  const nextStage = STAGES[stageIndex + 1]

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/leads" className="hover:text-foreground">Leads</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{lead.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {lead.name}
            {lead.intent && (
              <Badge variant={INTENT_VARIANT[lead.intent]} className="text-[10px]">
                <Sparkles className="h-3 w-3" /> {lead.intent}
              </Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {lead.company ?? "—"}
            {lead.ra_slug && (
              <>
                {" · "}
                <Link to={`/settings/ra/${lead.ra_slug}`} className="text-primary hover:underline">
                  Referred by /refer/{lead.ra_slug}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && nextStage && (
            <Button size="sm" disabled={acting} onClick={() => moveStage(nextStage.key)}>
              Move to {nextStage.label}
            </Button>
          )}
          {isOpen && (
            <>
              <Button variant="default" size="sm" disabled={acting} onClick={() => moveStage("closed_won")}>
                <Trophy className="h-3.5 w-3.5" /> Mark Closed Won
              </Button>
              <Button variant="outline" size="sm" disabled={acting} onClick={() => moveStage("closed_lost")}>
                <XCircle className="h-3.5 w-3.5" /> Mark Closed Lost
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" disabled={acting} onClick={() => setNoteOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add note
          </Button>
        </div>
      </div>

      {/* Stage progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Pipeline stage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-1.5">
            {STAGES.map((s, idx) => {
              const done = idx < stageIndex
              const current = idx === stageIndex
              const lost = lead.stage === "closed_lost"
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={acting || !isOpen}
                  onClick={() => moveStage(s.key)}
                  className={
                    "rounded-md border px-3 py-2 text-xs text-left transition-colors " +
                    (current
                      ? "border-primary bg-primary/10 text-foreground"
                      : done
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : lost
                          ? "border-destructive/30 bg-destructive/5 text-muted-foreground"
                          : "border-border text-muted-foreground hover:border-primary/30")
                  }
                >
                  <div className="flex items-center gap-1.5">
                    {done ? <CheckCircle2 className="h-3 w-3" /> : current ? <ChevronRight className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border" />}
                    <span className="font-medium">{s.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
          {lead.stage === "closed_lost" && (
            <div className="mt-3 text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Lead marked closed lost
              {lead.closed_reason && <span className="text-muted-foreground"> · {lead.closed_reason}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {lead.stage === "closed_won" && cfg && (
        <ClosedWonView lead={lead} cfg={cfg} payouts={payouts} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left — timeline + notes */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Activity timeline
              </CardTitle>
              <CardDescription>Stage changes, notes, and contact events.</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="space-y-3 text-sm">
                  {timeline.map((t) => (
                    <li key={t.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{t.title}</p>
                        {t.detail && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.detail}</p>}
                        <p className="text-[11px] text-muted-foreground/70">{new Date(t.at).toLocaleString()}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right — contact + meta */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.company && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> {lead.company}
                </div>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {lead.phone}
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal note</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.notes
                ? <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                : <p className="text-sm text-muted-foreground italic">No notes captured at submission.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Deal value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{lead.value ? formatMoney(lead.value) : "—"}</p>
              <p className="text-xs text-muted-foreground">Implementation fee on win</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add note modal */}
      <Dialog open={noteOpen} onOpenChange={(v) => !v && setNoteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add internal note</DialogTitle>
            <DialogDescription>Visible to admins on this lead's timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="note" className="text-xs">Note</Label>
            <Textarea id="note" rows={5} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)} disabled={acting}>Cancel</Button>
            <Button onClick={submitNote} disabled={!noteText.trim() || acting}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClosedWonView({
  lead, cfg, payouts,
}: {
  lead: RaLead
  cfg: CommissionConfig
  payouts: RaPayout[]
}) {
  const oneTimePer = calcOneTimeCommission(cfg)
  const recurringPer = calcRecurringCommissionPerMonth(cfg)

  const oneTimeEarned = payouts.filter((p) => p.type === "one_time" && p.status === "paid").reduce((s, p) => s + p.amount, 0)
  const recurringEarned = payouts.filter((p) => p.type === "recurring" && p.status === "paid").reduce((s, p) => s + p.amount, 0)
  const recurringScheduled = payouts.filter((p) => p.type === "recurring" && p.status === "scheduled").reduce((s, p) => s + p.amount, 0)
  const totalEarned = oneTimeEarned + recurringEarned

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Deal value</span>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tracking-tight">{formatMoney(lead.value ?? cfg.implementation_fee)}</p>
            <p className="text-[11px] text-muted-foreground">Implementation fee</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">RA one-time</span>
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tracking-tight">{formatMoney(oneTimePer)}</p>
            <p className="text-[11px] text-muted-foreground">{oneTimeEarned > 0 ? "Paid" : "Pending"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Recurring earned</span>
              <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tracking-tight">{formatMoney(recurringEarned)}</p>
            <p className="text-[11px] text-muted-foreground">{formatMoney(recurringPer)}/mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total to date</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tracking-tight">{formatMoney(totalEarned)}</p>
            <p className="text-[11px] text-muted-foreground">{formatMoney(recurringScheduled)} scheduled</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Payout history
          </CardTitle>
          <CardDescription>Commissions earned from this client.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid on</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No payouts scheduled yet.</TableCell></TableRow>
                ) : payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="outline" className="text-xs">{p.type === "one_time" ? "One-time" : "Recurring"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.period_start && p.period_end
                        ? `${new Date(p.period_start).toLocaleDateString()} – ${new Date(p.period_end).toLocaleDateString()}`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "paid" ? "default" : p.status === "scheduled" ? "secondary" : "outline"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
