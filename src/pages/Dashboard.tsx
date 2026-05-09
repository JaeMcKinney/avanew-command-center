import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  DollarSign,
  TrendingUp,
  Trophy,
  CheckSquare,
  Phone,
  Mail,
  CalendarDays,
  StickyNote,
  Briefcase,
  ArrowRight,
  Handshake,
  Truck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"
import {
  listActivities,
  listContacts,
  listDeals,
  listPartners,
  listStages,
  listTasks,
  listVendors,
} from "@/lib/data"
import type {
  Activity,
  ActivityType,
  Contact,
  Deal,
  Partner,
  PipelineStage,
  Task,
  Vendor,
} from "@/types/db"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  note: StickyNote,
  task: CheckSquare,
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso + "T00:00:00"))
}

const PRIORITY_COLOR: Record<string, string> = {
  Highest: "bg-destructive",
  High: "bg-destructive",
  Normal: "bg-muted-foreground",
  Low: "bg-muted-foreground",
  Lowest: "bg-muted-foreground",
}

function ModuleSection({
  icon: Icon,
  label,
  href,
  color,
  children,
}: {
  icon: LucideIcon
  label: string
  href: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("h-6 w-6 rounded grid place-items-center", color)}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
        <Link
          to={href}
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </div>
  )
}

type RelPeriod = "mtd" | "qtd" | "ytd"

function periodStart(p: RelPeriod): string {
  const now = new Date()
  if (p === "mtd") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  if (p === "qtd") {
    const qMonth = Math.floor(now.getMonth() / 3) * 3
    return `${now.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`
  }
  return `${now.getFullYear()}-01-01`
}

function toMonthlyCost(amount: number, frequency: Vendor["cost_frequency"]): number {
  if (frequency === "quarterly") return amount / 3
  if (frequency === "annually") return amount / 12
  return amount
}

export function Dashboard() {
  const navigate = useNavigate()
  const { role } = useRole()
  const isLimitedRole = role === "bd" || role === "partner"
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [relPeriod, setRelPeriod] = useState<RelPeriod>("ytd")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [s, d, c, a, t, pt, v] = await Promise.all([
          listStages(),
          listDeals(),
          listContacts(),
          listActivities(),
          isLimitedRole ? Promise.resolve([]) : listTasks(),
          isLimitedRole ? Promise.resolve([]) : listPartners(),
          isLimitedRole ? Promise.resolve([]) : listVendors(),
        ])
        if (!alive) return
        setStages(s)
        setDeals(d)
        setContacts(c)
        setActivities(a)
        setTasks(t)
        setPartners(pt)
        setVendors(v)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages]
  )

  const { activeDeals, pipelineValue, wonCount } = useMemo(() => {
    let activeDeals = 0
    let pipelineValue = 0
    let wonCount = 0
    for (const d of deals) {
      const stage = stageById.get(d.stage_id)
      if (!stage) continue
      if (stage.is_won) wonCount += 1
      else if (!stage.is_lost) { activeDeals += 1; pipelineValue += d.amount ?? 0 }
    }
    return { activeDeals, pipelineValue, wonCount }
  }, [deals, stageById])

  const { openTasksCount, overdueCount, upcomingTasks } = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const open = tasks.filter((t) => t.status !== "Completed")
    const overdueCount = open.filter((t) => t.due_date && t.due_date < today).length
    const upcoming = open
      .filter((t) => t.due_date)
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
      .slice(0, 6)
    return { openTasksCount: open.length, overdueCount, upcomingTasks: upcoming }
  }, [tasks])

  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts]
  )

  const pipelineByStage = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>()
    for (const d of deals) {
      const stage = stageById.get(d.stage_id)
      if (!stage || stage.is_won || stage.is_lost) continue
      const prev = map.get(d.stage_id) ?? { count: 0, value: 0 }
      map.set(d.stage_id, { count: prev.count + 1, value: prev.value + (d.amount ?? 0) })
    }
    return stages
      .filter((s) => !s.is_won && !s.is_lost && map.has(s.id))
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ stage: s, ...map.get(s.id)! }))
  }, [deals, stages, stageById])

  const recentActivity = useMemo(() => activities.slice(0, 6), [activities])

  const topPartners = useMemo(() => {
    const cutoff = periodStart(relPeriod)
    const partnerMap = new Map(partners.map((p) => [p.id, p]))
    const totals = new Map<string, number>()
    for (const d of deals) {
      if (!d.partner_id) continue
      const stage = stageById.get(d.stage_id)
      if (stage?.is_lost) continue
      if (d.created_at.slice(0, 10) < cutoff) continue
      totals.set(d.partner_id, (totals.get(d.partner_id) ?? 0) + (d.amount ?? 0))
    }
    return [...totals.entries()]
      .map(([id, value]) => ({ partner: partnerMap.get(id)!, value }))
      .filter((x) => x.partner)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [deals, partners, stageById, relPeriod])

  const topVendors = useMemo(() => {
    return vendors
      .filter((v) => v.cost_amount != null && v.cost_frequency != null)
      .map((v) => ({
        vendor: v,
        monthlyCost: toMonthlyCost(v.cost_amount!, v.cost_frequency),
      }))
      .sort((a, b) => b.monthlyCost - a.monthlyCost)
      .slice(0, 5)
  }, [vendors])

  const maxPartnerValue = useMemo(
    () => topPartners.reduce((m, x) => Math.max(m, x.value), 0),
    [topPartners]
  )
  const maxVendorCost = useMemo(
    () => topVendors.reduce((m, x) => Math.max(m, x.monthlyCost), 0),
    [topVendors]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your pipeline, tasks, and business performance."
      />

      {/* Module sections — 2-col on lg, stacked on mobile */}
      <div className={cn("grid grid-cols-1 gap-6", !isLimitedRole && "lg:grid-cols-2")}>

        {/* CRM module */}
        <ModuleSection icon={Briefcase} label="CRM" href="/deals" color="bg-blue-500">
          <div className="space-y-3">
            {/* CRM KPI mini-stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Active deals", value: loading ? "…" : String(activeDeals), icon: TrendingUp },
                { label: "Pipeline value", value: loading ? "…" : fmtCurrency(pipelineValue), icon: DollarSign },
                { label: "Won deals", value: loading ? "…" : String(wonCount), icon: Trophy },
              ].map(({ label, value, icon: Icon }) => (
                <Link key={label} to="/deals" className="block group">
                  <Card className="px-3 py-2.5 transition-all group-hover:ring-1 group-hover:ring-primary/40">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-lg font-semibold leading-tight truncate">{value}</p>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pipeline by stage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Pipeline by stage</CardTitle>
                <Link to="/deals" className="text-xs text-muted-foreground hover:text-primary">
                  Board →
                </Link>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {loading ? (
                  <div className="text-sm text-muted-foreground py-4">Loading…</div>
                ) : pipelineByStage.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    No open deals.{" "}
                    <Link to="/deals/new" className="text-primary underline">Add one</Link>.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {pipelineByStage.map(({ stage, count, value }) => (
                      <li key={stage.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/deals?stage=${stage.id}`)}
                          className="w-full text-left group/row"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium truncate group-hover/row:text-primary transition-colors">{stage.name}</span>
                            <span className="shrink-0 text-muted-foreground text-xs">{count} {count === 1 ? "deal" : "deals"}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: pipelineValue > 0 ? `${(value / pipelineValue) * 100}%` : "0%" }}
                              />
                            </div>
                            <span className="shrink-0 text-xs font-medium">{fmtCurrency(value)}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Recent activity</CardTitle>
                <Link to="/activities" className="text-xs text-muted-foreground hover:text-primary">
                  View all →
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">Loading…</div>
                ) : recentActivity.length === 0 ? (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">
                    Nothing yet.{" "}
                    <Link to="/activities" className="text-primary underline">Log activity</Link>.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {recentActivity.map((a) => {
                      const Icon = ACTIVITY_ICONS[a.type]
                      const completed = Boolean(a.completed_at)
                      const href = a.deal_id ? `/deals/${a.deal_id}/edit` : "/activities"
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => navigate(href)}
                            className="w-full px-4 py-2.5 flex items-start gap-3 text-sm text-left hover:bg-muted/40 transition-colors"
                          >
                            <div className={cn("shrink-0 mt-0.5 h-6 w-6 rounded-full grid place-items-center", completed ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{a.subject}</div>
                              <div className="text-xs text-muted-foreground">{fmtRelative(a.created_at)}</div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </ModuleSection>

        {/* Right column — Tasks + Relationships stacked (hidden for BD/Partner) */}
        {!isLimitedRole && <div className="space-y-6">
          <ModuleSection icon={CheckSquare} label="Tasks" href="/tasks" color="bg-emerald-500">
            <div className="space-y-3">
              {/* Task KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Open tasks</p>
                  <p className="text-2xl font-semibold mt-0.5">{loading ? "…" : openTasksCount}</p>
                </Card>
                <Card className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className={cn("text-2xl font-semibold mt-0.5", overdueCount > 0 && !loading ? "text-destructive" : "")}>
                    {loading ? "…" : overdueCount}
                  </p>
                </Card>
              </div>

              {/* Upcoming tasks */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">Upcoming tasks</CardTitle>
                  <Link to="/tasks" className="text-xs text-muted-foreground hover:text-primary">
                    View all →
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">Loading…</div>
                  ) : upcomingTasks.length === 0 ? (
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      No open tasks.{" "}
                      <Link to="/tasks/new" className="text-primary underline">Add one</Link>.
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {upcomingTasks.map((t) => {
                        const contact = t.contact_id ? contactById.get(t.contact_id) : null
                        const isHigh = t.priority === "High" || t.priority === "Highest"
                        const today = new Date().toISOString().split("T")[0]
                        const isOverdue = t.due_date && t.due_date < today
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/tasks/${t.id}/edit`)}
                              className="w-full px-4 py-2.5 flex items-start gap-3 text-sm text-left hover:bg-muted/40 transition-colors"
                            >
                              <div className={cn("shrink-0 mt-1.5 h-2 w-2 rounded-full", PRIORITY_COLOR[t.priority] ?? "bg-muted-foreground")} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{t.subject}</div>
                                <div className={cn("text-xs mt-0.5", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                                  {t.due_date ? fmtDate(t.due_date) : "No due date"}
                                  {contact && ` · ${contact.first_name} ${contact.last_name ?? ""}`}
                                </div>
                              </div>
                              {isHigh && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 shrink-0">
                                  {t.priority}
                                </Badge>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </ModuleSection>

          {/* Relationships widget */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded grid place-items-center bg-violet-500">
                <Handshake className="h-3.5 w-3.5 text-white" />
              </div>
              <h2 className="text-sm font-semibold tracking-tight">Relationships</h2>
              <div className="ml-auto flex gap-1">
                {(["mtd", "qtd", "ytd"] as RelPeriod[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRelPeriod(p)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded font-medium uppercase transition-colors",
                      relPeriod === p
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* Top Partners */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Handshake className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Top Partners</span>
                      <Link to="/partners" className="ml-auto text-[10px] text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">
                        View all →
                      </Link>
                    </div>
                    {loading ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : topPartners.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No partner-linked deals this period.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {topPartners.map(({ partner, value }, i) => (
                          <li key={partner.id}>
                            <div className="flex items-baseline gap-1.5 mb-0.5">
                              <span className="text-[10px] text-muted-foreground w-3 shrink-0">{i + 1}.</span>
                              <span className="flex-1 text-xs font-medium truncate">{partner.name}</span>
                              <span className="text-xs font-semibold shrink-0">{fmtCurrency(value)}</span>
                            </div>
                            <div className="ml-4 h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-all"
                                style={{ width: maxPartnerValue > 0 ? `${(value / maxPartnerValue) * 100}%` : "0%" }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Top Vendors */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Top Vendors</span>
                      <Link to="/vendors" className="ml-auto text-[10px] text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">
                        View all →
                      </Link>
                    </div>
                    {loading ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : topVendors.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No vendor costs configured.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {topVendors.map(({ vendor, monthlyCost }, i) => (
                          <li key={vendor.id}>
                            <div className="flex items-baseline gap-1.5 mb-0.5">
                              <span className="text-[10px] text-muted-foreground w-3 shrink-0">{i + 1}.</span>
                              <span className="flex-1 text-xs font-medium truncate">{vendor.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{fmtCurrency(monthlyCost)}/mo</span>
                            </div>
                            <div className="ml-4 h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-orange-500 transition-all"
                                style={{ width: maxVendorCost > 0 ? `${(monthlyCost / maxVendorCost) * 100}%` : "0%" }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>}
      </div>

    </div>
  )
}
