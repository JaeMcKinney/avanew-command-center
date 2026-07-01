import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, ExternalLink, Trophy, Users, Wallet, DollarSign, TrendingUp,
  Mail, Phone, FileSignature, Landmark, FileText, List, LayoutGrid,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getRaBySlug, listLeadsForRaSlug, listPayoutsForRaSlug, getCommissionConfig,
  listCheckinsForRaSlug, listActiveClientsForRaSlug, getAnnualMinimumStatus,
} from "@/lib/data"
import { PipelineBoard } from "@/components/PipelineBoard"
import { usePipelineView } from "@/lib/usePipelineView"
import { LogCheckinModal } from "@/components/LogCheckinModal"
import type { ClientCheckin, ActiveClient, AnnualMinimumStatus } from "@/lib/data"
import {
  calcOneTimeCommission, calcRecurringCommissionPerMonth, formatMoney,
} from "@/lib/commissions"
import type { CommissionConfig, RaAssociate, RaStatus } from "@/types/db"
import type { RaLead, RaPayout } from "@/lib/data"

const STATUS_LABEL: Record<RaStatus, string> = {
  pending: "Pending onboarding", verification: "Pending review", needs_changes: "Changes requested",
  active: "Active", suspended: "Suspended", declined: "Declined", terminated: "Terminated",
  invite_expired: "Invite expired", onboarding_expired: "Onboarding expired",
}

const STAGE_LABEL: Record<RaLead["stage"], string> = {
  new: "New", qualified: "Qualified", proposal_sent: "Proposal Sent",
  call_booked: "Call Booked", closed_won: "Closed Won", closed_lost: "Closed Lost",
}

const OPEN_STAGES: Array<RaLead["stage"]> = ["new", "qualified", "proposal_sent", "call_booked"]

/** Format a "YYYY-MM-DD" string in local time without UTC midnight shift. */
function formatDateOnly(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString()
}

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Trophy }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function SettingsRADetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [leads, setLeads] = useState<RaLead[]>([])
  const [payouts, setPayouts] = useState<RaPayout[]>([])
  const [cfg, setCfg] = useState<CommissionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkins, setCheckins] = useState<ClientCheckin[]>([])
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
  const [annual, setAnnual] = useState<AnnualMinimumStatus | null>(null)
  const [checkinTarget, setCheckinTarget] = useState<{ leadId: string | null; name: string } | null>(null)

  async function refreshCheckinData(s: string) {
    const [ch, ac, am] = await Promise.all([
      listCheckinsForRaSlug(s),
      listActiveClientsForRaSlug(s),
      getAnnualMinimumStatus(s),
    ])
    setCheckins(ch); setActiveClients(ac); setAnnual(am)
  }

  useEffect(() => {
    if (!slug) return
    void Promise.all([
      getRaBySlug(slug),
      listLeadsForRaSlug(slug),
      listPayoutsForRaSlug(slug),
      getCommissionConfig(),
    ]).then(async ([r, l, p, c]) => {
      setRa(r); setLeads(l); setPayouts(p); setCfg(c)
      if (slug) await refreshCheckinData(slug)
      setLoading(false)
    })
  }, [slug])

  const [pipelineView, setPipelineView] = usePipelineView("admin-ra-detail")
  const openLeads = useMemo(() => leads.filter((l) => OPEN_STAGES.includes(l.stage)), [leads])
  const wonLeads = useMemo(() => leads.filter((l) => l.stage === "closed_won"), [leads])
  const lostLeads = useMemo(() => leads.filter((l) => l.stage === "closed_lost"), [leads])
  const boardLeads = useMemo(() => leads.filter((l) => l.stage !== "closed_lost"), [leads])

  const oneTimeEarned = useMemo(
    () => payouts.filter((p) => p.type === "one_time" && p.status === "paid").reduce((s, p) => s + p.amount, 0),
    [payouts]
  )
  const recurringEarned = useMemo(
    () => payouts.filter((p) => p.type === "recurring" && p.status === "paid").reduce((s, p) => s + p.amount, 0),
    [payouts]
  )
  const recurringScheduled = useMemo(
    () => payouts.filter((p) => p.type === "recurring" && p.status === "scheduled").reduce((s, p) => s + p.amount, 0),
    [payouts]
  )
  const activeClientCount = useMemo(
    () => new Set(payouts.filter((p) => p.type === "recurring" && p.status === "scheduled").map((p) => p.client_name)).size,
    [payouts]
  )

  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>
  if (!ra) return (
    <div className="p-6 space-y-3">
      <p className="text-sm">Associate not found.</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/settings/team")}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to list
      </Button>
    </div>
  )

  const oneTimePer = cfg ? calcOneTimeCommission(cfg) : 1000
  const recurringPer = cfg ? calcRecurringCommissionPerMonth(cfg) : 50

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/settings/team" className="hover:text-foreground">Referral Associates</Link>
        <span>›</span>
        <span className="text-foreground">{ra.display_name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {ra.photo_url ? (
            <img src={ra.photo_url} alt="" className="h-14 w-14 rounded-full object-cover border" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-muted border flex items-center justify-center text-base font-medium">
              {ra.display_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">{ra.display_name}</h1>
            <p className="text-xs text-muted-foreground">
              {ra.email} · <span className="font-mono">/demo/{ra.slug}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ra.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[ra.status]}</Badge>
          <Button asChild variant="outline" size="sm">
            <a href={`/demo/${ra.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Demo page
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active clients" value={String(activeClientCount)} hint={`${formatMoney(recurringPer)}/mo each`} icon={Users} />
        <StatCard label="Open pipeline"  value={String(openLeads.length)} hint={`${wonLeads.length} closed won · ${lostLeads.length} lost`} icon={TrendingUp} />
        <StatCard label="One-time earned" value={formatMoney(oneTimeEarned)} hint={`${formatMoney(oneTimePer)} per referral`} icon={Trophy} />
        <StatCard label="Recurring earned" value={formatMoney(recurringEarned)} hint={`${formatMoney(recurringScheduled)} scheduled`} icon={Wallet} />
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="grid grid-cols-5 w-full sm:w-auto sm:inline-grid">
          <TabsTrigger value="pipeline">Pipeline <span className="ml-1.5 text-[10px] opacity-70">{openLeads.length}</span></TabsTrigger>
          <TabsTrigger value="closed">Closed <span className="ml-1.5 text-[10px] opacity-70">{wonLeads.length + lostLeads.length}</span></TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        {/* Pipeline */}
        <TabsContent value="pipeline" className="pt-4 space-y-3">
          <div className="flex justify-end">
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <Button
                type="button"
                size="sm"
                variant={pipelineView === "list" ? "secondary" : "ghost"}
                className="h-7 px-2 gap-1.5 text-xs"
                onClick={() => setPipelineView("list")}
              >
                <List className="h-3.5 w-3.5" /> List
              </Button>
              <Button
                type="button"
                size="sm"
                variant={pipelineView === "board" ? "secondary" : "ghost"}
                className="h-7 px-2 gap-1.5 text-xs"
                onClick={() => setPipelineView("board")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </Button>
            </div>
          </div>
          {pipelineView === "list" ? (
            <LeadsTable leads={openLeads} navigate={navigate} emptyText="No open leads in pipeline." />
          ) : (
            <PipelineBoard
              leads={boardLeads}
              variant="light"
              onLeadsChange={(next) => setLeads([...next, ...lostLeads])}
            />
          )}
        </TabsContent>

        {/* Closed */}
        <TabsContent value="closed" className="pt-4 space-y-4">
          <LeadsTable leads={[...wonLeads, ...lostLeads]} navigate={navigate} emptyText="No closed deals yet." showClosed />
        </TabsContent>

        {/* Commissions */}
        <TabsContent value="commissions" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payout schedule</CardTitle>
              <CardDescription>One-time and recurring commissions earned by {ra.display_name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No payouts yet.</TableCell></TableRow>
                    ) : payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.client_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{p.type === "one_time" ? "One-time" : "Recurring"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.period_start && p.period_end
                            ? `${formatDateOnly(p.period_start)} – ${formatDateOnly(p.period_end)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "paid" ? "default" : p.status === "scheduled" ? "secondary" : "outline"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active clients — check-ins</CardTitle>
              <CardDescription>
                Quarterly cadence required by §7. Threshold: warning at {cfg?.checkin_warning_days ?? 90}d · suspended at {cfg?.checkin_suspension_days ?? 150}d.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeClients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No active clients yet.</p>
              ) : activeClients.map((c) => {
                const dot = c.severity === "overdue" ? "bg-red-500" : c.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"
                return (
                  <div key={c.lead_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.client_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.last_checkin_at
                            ? `Last check-in ${c.days_since}d ago`
                            : `${c.days_since}d since onboard, no check-in yet`}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => setCheckinTarget({ leadId: c.lead_id, name: c.client_name })}>
                      Log check-in
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Check-in log</CardTitle>
              <CardDescription>Most recent touchpoints logged by this RA.</CardDescription>
            </CardHeader>
            <CardContent>
              {checkins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No check-ins logged yet.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {checkins.slice(0, 12).map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                      <div className="flex-1 min-w-0">
                        <p>
                          <span className="font-medium">{c.client_name}</span>{" "}
                          <span className="text-muted-foreground">·  {c.method.replace("_", " ")}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.checkin_at).toLocaleString()}{c.notes ? ` · ${c.notes}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline activity</CardTitle>
              <CardDescription>Lead stage changes.</CardDescription>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No activity yet.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {leads.slice(0, 10).map((l) => (
                    <li key={l.id} className="flex gap-3">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p>
                          <span className="font-medium">{l.name}</span>{" "}
                          <span className="text-muted-foreground">moved to {STAGE_LABEL[l.stage]}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(l.updated_at).toLocaleString()}{l.notes ? ` · ${l.notes}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile" className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {annual && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Annual referral minimum</CardTitle>
                <CardDescription>
                  Agreement §6: at least {annual.target} qualified referrals per calendar year.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold tracking-tight">{annual.count}</p>
                  <p className="text-sm text-muted-foreground">/ {annual.target} closed in {annual.year}</p>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (annual.count / Math.max(1, annual.target)) * 100)}%`,
                      background: annual.on_track ? "var(--primary)" : annual.grace_period_active ? "#F4B23A" : "#E76F51",
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {annual.on_track
                    ? `On track for ${annual.year}.`
                    : annual.grace_period_active
                    ? `Grace period — ${annual.grace_days_remaining} day${annual.grace_days_remaining === 1 ? "" : "s"} until suspension flag (Apr 1).`
                    : `${annual.days_remaining_in_year} day${annual.days_remaining_in_year === 1 ? "" : "s"} left in ${annual.year}. ${annual.target - annual.count} more needed.`}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {ra.contact_email || ra.email}</div>
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {ra.contact_phone || "—"}</div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bio</p>
                <p className="text-sm whitespace-pre-wrap">{ra.bio || <span className="text-muted-foreground italic">None</span>}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance &amp; banking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <FileSignature className="h-3.5 w-3.5 text-muted-foreground" />
                Agreement: {ra.agreement_completed
                  ? `Signed${ra.agreement_signed_name ? ` by ${ra.agreement_signed_name}` : ""}${ra.agreement_accepted_at ? ` · ${new Date(ra.agreement_accepted_at).toLocaleDateString()}` : ""}`
                  : <span className="text-muted-foreground italic"> not signed</span>}
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                W-9: {ra.w9_completed ? "On file" : <span className="text-muted-foreground italic">missing</span>}
              </div>
              <div className="flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                ACH: {ra.banking_completed ? `${ra.ach_bank_name ?? "Bank"} · ${ra.ach_routing ?? ""} / ${ra.ach_account ?? ""}` : <span className="text-muted-foreground italic">not provided</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {checkinTarget && slug && (
        <LogCheckinModal
          open={!!checkinTarget}
          onClose={() => setCheckinTarget(null)}
          raSlug={slug}
          leadId={checkinTarget.leadId}
          clientName={checkinTarget.name}
          variant="light"
          onLogged={() => { if (slug) void refreshCheckinData(slug) }}
        />
      )}
    </div>
  )
}

function LeadsTable({
  leads, navigate, emptyText, showClosed,
}: {
  leads: RaLead[]
  navigate: (to: string) => void
  emptyText: string
  showClosed?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>{showClosed ? "Closed" : "Last update"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">{emptyText}</TableCell></TableRow>
            ) : leads.map((l) => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-muted-foreground">{l.company ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={l.stage === "closed_won" ? "default" : l.stage === "closed_lost" ? "outline" : "secondary"}>
                    {STAGE_LABEL[l.stage]}
                  </Badge>
                </TableCell>
                <TableCell>{l.value ? formatMoney(l.value) : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {showClosed && l.closed_at
                    ? new Date(l.closed_at).toLocaleDateString()
                    : new Date(l.updated_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
