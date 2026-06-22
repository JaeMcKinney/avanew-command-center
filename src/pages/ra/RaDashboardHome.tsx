import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Copy, CheckCheck, DollarSign, Repeat, Eye, Megaphone, Share2,
  TrendingUp, CalendarClock, ArrowRight, Sparkles, Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getRaAssociate, listLeadsForRaSlug, listPayoutsForRaSlug,
  listActiveClientsForRaSlug, getAnnualMinimumStatus, getCommissionConfig,
  getRaPageViewStats, ensureRaDemoLeads, clearRaDemoLeads,
} from "@/lib/data"
import type { RaLead, RaPayout, ActiveClient, AnnualMinimumStatus } from "@/lib/data"
import { LogCheckinModal } from "@/components/LogCheckinModal"
import type { RaAssociate, RaPageViewStats } from "@/types/db"

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: Infinity },
] as const

type RangeKey = (typeof RANGES)[number]["key"]

export function RaDashboardHome() {
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [leads, setLeads] = useState<RaLead[]>([])
  const [payouts, setPayouts] = useState<RaPayout[]>([])
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
  const [annual, setAnnual] = useState<AnnualMinimumStatus | null>(null)
  const [views, setViews] = useState<RaPageViewStats | null>(null)
  const [checkinIntervalDays, setCheckinIntervalDays] = useState(90)
  const [range, setRange] = useState<RangeKey>("365")
  const [copied, setCopied] = useState<"demo" | "refer" | null>(null)
  const [checkinTarget, setCheckinTarget] = useState<{ leadId: string | null; name: string } | null>(null)
  const [clearingDemo, setClearingDemo] = useState(false)

  async function load() {
    const r = await getRaAssociate()
    setRa(r)
    if (!r?.slug) return
    // Seed demo data on first visit (no-op once they have leads).
    await ensureRaDemoLeads(r.slug).catch(() => 0)
    const [l, p, ac, am, cfg, vs] = await Promise.all([
      listLeadsForRaSlug(r.slug),
      listPayoutsForRaSlug(r.slug),
      listActiveClientsForRaSlug(r.slug),
      getAnnualMinimumStatus(r.slug),
      getCommissionConfig(),
      getRaPageViewStats(),
    ])
    setLeads(l); setPayouts(p); setActiveClients(ac); setAnnual(am)
    setCheckinIntervalDays(cfg.checkin_interval_days)
    setViews(vs)
  }

  useEffect(() => { void load().catch(() => {}) }, [])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const demoUrl = ra?.slug ? `${origin}/demo/${ra.slug}` : ""
  const referUrl = ra?.slug ? `${origin}/refer/${ra.slug}` : ""
  // Demo seed leads carry a "Safe to delete" marker in their notes — detecting
  // by marker keeps this resilient even before the is_demo_seed column ships.
  const hasDemoSeed = useMemo(() => leads.some((l) => (l.notes ?? "").includes("Safe to delete")), [leads])

  async function copy(which: "demo" | "refer", url: string) {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  // ── Earnings ──────────────────────────────────────────────────────────────
  const earnings = useMemo(() => {
    const paid = payouts.filter((p) => p.status === "paid")
    const rangeDays = RANGES.find((r) => r.key === range)!.days
    const cutoff = rangeDays === Infinity ? 0 : Date.now() - rangeDays * 86400_000
    const totalInRange = paid
      .filter((p) => (p.paid_at ? new Date(p.paid_at).getTime() >= cutoff : false) || rangeDays === Infinity)
      .reduce((s, p) => s + p.amount, 0)
    const totalAllTime = paid.reduce((s, p) => s + p.amount, 0)
    const oneTimeAllTime = paid.filter((p) => p.type === "one_time").reduce((s, p) => s + p.amount, 0)

    // MRR = sum of the active recurring monthly amount per client (a client with
    // any scheduled or recently-paid recurring payout is considered active).
    const byClient = new Map<string, { total: number; monthly: number; recurringActive: boolean }>()
    for (const p of payouts) {
      const e = byClient.get(p.client_name) ?? { total: 0, monthly: 0, recurringActive: false }
      if (p.status === "paid") e.total += p.amount
      if (p.type === "recurring" && (p.status === "scheduled" || p.status === "paid")) {
        e.monthly = p.amount
        if (p.status === "scheduled") e.recurringActive = true
      }
      byClient.set(p.client_name, e)
    }
    const mrr = [...byClient.values()].filter((c) => c.recurringActive).reduce((s, c) => s + c.monthly, 0)
    const clients = [...byClient.entries()]
      .map(([name, v]) => ({ name, total: v.total, monthly: v.recurringActive ? v.monthly : 0 }))
      .filter((c) => c.total > 0 || c.monthly > 0)
      .sort((a, b) => b.total - a.total)
    return { totalInRange, totalAllTime, oneTimeAllTime, mrr, clients }
  }, [payouts, range])

  async function handleClearDemo() {
    if (!ra?.slug) return
    setClearingDemo(true)
    try {
      const n = await clearRaDemoLeads(ra.slug)
      toast.success(n > 0 ? `Cleared ${n} demo record${n === 1 ? "" : "s"}` : "No demo records to clear")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear demo data")
    } finally {
      setClearingDemo(false)
    }
  }

  const firstName = ra?.full_name?.split(" ")[0] ?? ra?.display_name?.split(" ")[0] ?? ""

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">{firstName ? `Welcome back, ${firstName}.` : "Welcome back."}</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's how your referrals and earnings are tracking.</p>
      </div>

      {hasDemoSeed && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="flex-1 text-amber-800 dark:text-amber-300">
            Your portal includes <strong>3 sample records</strong> so you can see how things look once prospects use your demo page. Clear them whenever you're ready.
          </span>
          <Button variant="outline" size="sm" onClick={handleClearDemo} disabled={clearingDemo}>
            <Trash2 className="h-3.5 w-3.5" /> Clear demo data
          </Button>
        </div>
      )}

      {/* Share links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" /> Your Demo Link
              <span className="ml-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">Share this one</span>
            </CardTitle>
            <CardDescription>Send this to prospects — it shows off the AI experience with your branding.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate rounded-md border bg-muted/50 px-3 py-2 text-xs">{demoUrl || "Loading…"}</code>
              <Button size="sm" onClick={() => copy("demo", demoUrl)} disabled={!demoUrl}>
                {copied === "demo" ? <><CheckCheck className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4 text-muted-foreground" /> Your Referral Link</CardTitle>
            <CardDescription>The lead-capture page. Every submission is tracked to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate rounded-md border bg-muted/50 px-3 py-2 text-xs">{referUrl || "Loading…"}</code>
              <Button size="sm" variant="outline" onClick={() => copy("refer", referUrl)} disabled={!referUrl}>
                {copied === "refer" ? <><CheckCheck className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Your Earnings</CardTitle>
              <CardDescription>Commissions paid to you, including one-time and recurring.</CardDescription>
            </div>
            <div className="inline-flex rounded-md border p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Paid ({RANGES.find((r) => r.key === range)!.label})</p>
              <p className="text-2xl font-semibold mt-1">{fmtCurrency(earnings.totalInRange)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{fmtCurrency(earnings.totalAllTime)} all-time</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> Monthly recurring</p>
              <p className="text-2xl font-semibold mt-1">{fmtCurrency(earnings.mrr)}<span className="text-sm text-muted-foreground font-normal">/mo</span></p>
              <p className="text-[11px] text-muted-foreground mt-1">From {earnings.clients.filter((c) => c.monthly > 0).length} active client{earnings.clients.filter((c) => c.monthly > 0).length === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> One-time commissions</p>
              <p className="text-2xl font-semibold mt-1">{fmtCurrency(earnings.oneTimeAllTime)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">$1,000 per closed client</p>
            </div>
          </div>

          {earnings.clients.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Clients you're earning from</p>
              <div className="rounded-lg border divide-y">
                {earnings.clients.map((c) => (
                  <div key={c.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="flex items-center gap-4 text-muted-foreground shrink-0">
                      {c.monthly > 0 && <span className="text-primary">{fmtCurrency(c.monthly)}/mo</span>}
                      <span className="tabular-nums">{fmtCurrency(c.total)} paid</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics + Annual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground" /> Page Views</CardTitle>
            <CardDescription>How often your public pages were opened.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5 text-primary" /> Demo</span>
              <span className="tabular-nums"><strong>{views?.demo_total ?? 0}</strong> <span className="text-muted-foreground text-xs">total · {views?.demo_7d ?? 0} this week</span></span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5 text-muted-foreground" /> Refer</span>
              <span className="tabular-nums"><strong>{views?.refer_total ?? 0}</strong> <span className="text-muted-foreground text-xs">total · {views?.refer_7d ?? 0} this week</span></span>
            </div>
          </CardContent>
        </Card>

        {annual && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Annual Referrals</CardTitle>
              <CardDescription>{annual.on_track ? `On track for ${annual.year}.` : `${annual.days_remaining_in_year} days left in ${annual.year}.`}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{annual.count}<span className="text-muted-foreground text-xl">/{annual.target}</span></p>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (annual.count / Math.max(1, annual.target)) * 100)}%` }} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline</CardTitle>
            <CardDescription>{leads.length} {leads.length === 1 ? "lead" : "leads"} referred.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/ra/deals">View your deals <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Check-ins due — countdown from closed-won date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Client Check-ins</CardTitle>
          <CardDescription>Quarterly touchpoints, timed from when each deal closed.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active clients yet.</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {activeClients.map((c) => {
                const dueInDays = checkinIntervalDays - c.days_since
                const label = dueInDays < 0 ? `${Math.abs(dueInDays)}d overdue`
                  : dueInDays === 0 ? "Due today"
                  : `Due in ${dueInDays}d`
                const color = c.severity === "overdue" ? "text-red-600"
                  : c.severity === "warning" ? "text-amber-600" : "text-muted-foreground"
                return (
                  <div key={c.lead_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium truncate">{c.client_name}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs ${color}`}>{label}</span>
                      <Button variant="outline" size="sm" className="h-7" onClick={() => setCheckinTarget({ leadId: c.lead_id, name: c.client_name })}>Log check-in</Button>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {checkinTarget && ra?.slug && (
        <LogCheckinModal
          open={!!checkinTarget}
          onClose={() => setCheckinTarget(null)}
          raSlug={ra.slug}
          leadId={checkinTarget.leadId}
          clientName={checkinTarget.name}
          onLogged={() => { if (ra?.slug) void load() }}
        />
      )}
    </div>
  )
}
