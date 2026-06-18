import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Copy,
  CheckCheck,
  Users,
  TrendingUp,
  Handshake,
  DollarSign,
  Clock,
  Inbox,
  LogOut,
  List,
  LayoutGrid,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  getRaAssociate, getRaDashboardStats, listLeadsForRaSlug,
  listActiveClientsForRaSlug, getAnnualMinimumStatus,
} from "@/lib/data"
import type { RaLead, ActiveClient, AnnualMinimumStatus } from "@/lib/data"
import { PipelineBoard } from "@/components/PipelineBoard"
import { usePipelineView } from "@/lib/usePipelineView"
import { LogCheckinModal } from "@/components/LogCheckinModal"
import {
  DIVIGNER_LOGO_SRC,
  DIVIGNER_NOISE_SVG,
  DIVIGNER_BG,
  DIVIGNER_CARD_BG,
  DIVIGNER_BTN_BG,
} from "@/lib/brand"
import type { RaAssociate } from "@/types/db"

interface RaStats {
  totalLeads: number
  activeLeads: number
  dealsClosed: number
  totalCommission: number
  pendingCommission: number
}

const STAT_DEFS: {
  key: keyof RaStats
  label: string
  icon: React.ElementType
  format: (n: number) => string
}[] = [
  { key: "totalLeads",       label: "Total Leads",         icon: Users,     format: String },
  { key: "activeLeads",      label: "Active Leads",        icon: TrendingUp, format: String },
  { key: "dealsClosed",      label: "Deals Closed",        icon: Handshake,  format: String },
  { key: "totalCommission",  label: "Total Commission",    icon: DollarSign, format: fmtCurrency },
  { key: "pendingCommission",label: "Pending Commission",  icon: Clock,      format: fmtCurrency },
]

const STAGE_LABEL: Record<RaLead["stage"], string> = {
  new: "New",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  call_booked: "Call Booked",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function getInitials(name: string | null | undefined) {
  if (!name) return "RA"
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function RaDashboard() {
  const navigate = useNavigate()
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState<RaStats>({
    totalLeads: 0,
    activeLeads: 0,
    dealsClosed: 0,
    totalCommission: 0,
    pendingCommission: 0,
  })
  const [leads, setLeads] = useState<RaLead[]>([])
  const [pipelineView, setPipelineView] = usePipelineView("ra-dashboard")
  const [activeClients, setActiveClients] = useState<ActiveClient[]>([])
  const [annual, setAnnual] = useState<AnnualMinimumStatus | null>(null)
  const [checkinTarget, setCheckinTarget] = useState<{ leadId: string | null; name: string } | null>(null)

  async function refreshActive(slug: string) {
    const [ac, am] = await Promise.all([
      listActiveClientsForRaSlug(slug),
      getAnnualMinimumStatus(slug),
    ])
    setActiveClients(ac)
    setAnnual(am)
  }

  useEffect(() => {
    void (async () => {
      try {
        const r = await getRaAssociate()
        setRa(r)
        const [s, l] = await Promise.all([
          getRaDashboardStats(),
          r?.slug ? listLeadsForRaSlug(r.slug) : Promise.resolve([] as RaLead[]),
        ])
        setStats((prev) => ({
          ...prev,
          totalLeads:  s.total_leads,
          activeLeads: s.active_leads,
          dealsClosed: s.deals_closed,
        }))
        setLeads(l)
        if (r?.slug) await refreshActive(r.slug)
      } catch {
        // leave defaults — RA can still see the page
      }
    })()
  }, [])

  const boardLeads = leads.filter((l) => l.stage !== "closed_lost")
  const lostLeads = leads.filter((l) => l.stage === "closed_lost")

  const referralUrl = ra?.slug
    ? `${window.location.origin}/refer/${ra.slug}`
    : ""

  async function handleCopy() {
    if (!referralUrl) return
    await navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate("/login", { replace: true })
  }

  const firstName = ra?.full_name?.split(" ")[0] ?? ""

  return (
    <div className="relative min-h-screen" style={{ background: DIVIGNER_BG }}>
      {/* noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[.04] mix-blend-overlay"
        style={{ backgroundImage: DIVIGNER_NOISE_SVG, backgroundSize: "160px 160px" }}
      />

      {/* header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[.08]">
        <img src={DIVIGNER_LOGO_SRC} alt="Divigner" className="h-7" />

        <div className="flex items-center gap-3">
          {/* avatar + name */}
          <div className="flex items-center gap-2.5">
            {ra?.photo_url ? (
              <img
                src={ra.photo_url}
                alt={ra.full_name ?? "RA"}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-[#06101D] ring-1 ring-white/20"
                style={{ background: DIVIGNER_BTN_BG }}
              >
                {getInitials(ra?.full_name)}
              </div>
            )}
            <span
              className="text-white/80 text-sm font-medium hidden sm:block"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              {ra?.full_name ?? ""}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-sm px-2 py-1 rounded"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* main */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* greeting */}
        <div>
          <h1
            className="text-3xl font-semibold text-white"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
          <p
            className="text-white/40 text-sm mt-1"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Referral Associate Portal
          </p>
        </div>

        {/* referral URL card */}
        <div
          className="rounded-2xl border border-white/10 p-6"
          style={{ background: DIVIGNER_CARD_BG }}
        >
          <p
            className="text-white/40 text-xs font-medium uppercase tracking-widest mb-3"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Your Referral Link
          </p>
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-0 bg-white/[.05] border border-white/10 rounded-lg px-4 py-3">
              <p className="text-[#34D6C2] text-sm font-mono truncate">
                {referralUrl || "Loading…"}
              </p>
            </div>
            <button
              onClick={handleCopy}
              disabled={!referralUrl}
              className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-[#06101D] transition-opacity disabled:opacity-40"
              style={{ background: DIVIGNER_BTN_BG, fontFamily: "Manrope, sans-serif" }}
            >
              {copied ? (
                <><CheckCheck className="h-4 w-4" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4" /> Copy link</>
              )}
            </button>
          </div>
          <p
            className="text-white/25 text-xs mt-3 leading-relaxed"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Share this link with potential clients. Every lead submitted through it is tracked to your account.
          </p>
        </div>

        {/* stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {STAT_DEFS.map(({ key, label, icon: Icon, format }) => (
            <div
              key={key}
              className="rounded-xl border border-white/10 p-4"
              style={{ background: DIVIGNER_CARD_BG }}
            >
              <Icon className="h-4 w-4 text-[#34D6C2] mb-3" />
              <p
                className="text-2xl font-semibold text-white"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                {format(stats[key])}
              </p>
              <p
                className="text-white/40 text-xs mt-1"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* annual minimum + check-ins due */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* annual minimum tracker */}
          <div
            className="rounded-2xl border border-white/10 p-6"
            style={{ background: DIVIGNER_CARD_BG }}
          >
            <p
              className="text-white/40 text-xs font-medium uppercase tracking-widest mb-3"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Annual Referrals
            </p>
            {annual ? (
              <>
                <p
                  className="text-3xl font-semibold text-white"
                  style={{ fontFamily: "Fraunces, serif" }}
                >
                  {annual.count}<span className="text-white/40 text-xl">/{annual.target}</span>
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-white/[.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (annual.count / Math.max(1, annual.target)) * 100)}%`,
                      background: annual.on_track ? "#34D6C2" : annual.grace_period_active ? "#F4B23A" : "#E76F51",
                    }}
                  />
                </div>
                <p
                  className="text-white/50 text-xs mt-3"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  {annual.on_track
                    ? `On track for ${annual.year}.`
                    : annual.grace_period_active
                    ? `Grace period — ${annual.grace_days_remaining} day${annual.grace_days_remaining === 1 ? "" : "s"} to catch up.`
                    : `${annual.days_remaining_in_year} day${annual.days_remaining_in_year === 1 ? "" : "s"} left in ${annual.year}.`}
                </p>
              </>
            ) : (
              <p className="text-white/30 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>—</p>
            )}
          </div>

          {/* check-ins due */}
          <div
            className="rounded-2xl border border-white/10 p-6 lg:col-span-2"
            style={{ background: DIVIGNER_CARD_BG }}
          >
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-white/40 text-xs font-medium uppercase tracking-widest"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Active Clients — Check-ins Due
              </p>
              {activeClients.length > 0 && (
                <span className="text-white/40 text-xs" style={{ fontFamily: "Manrope, sans-serif" }}>
                  {activeClients.filter((c) => c.severity !== "ok").length} due
                </span>
              )}
            </div>
            {activeClients.length === 0 ? (
              <p className="text-white/30 text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>
                No active clients yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {activeClients.map((c) => {
                  const dotColor = c.severity === "overdue" ? "#E76F51"
                    : c.severity === "warning" ? "#F4B23A"
                    : "#34D6C2"
                  return (
                    <li
                      key={c.lead_id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white/[.03] hover:bg-white/[.05] border border-white/[.06]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: dotColor }} />
                        <div className="min-w-0">
                          <p
                            className="text-white/85 text-sm truncate"
                            style={{ fontFamily: "Manrope, sans-serif" }}
                          >
                            {c.client_name}
                          </p>
                          <p
                            className="text-white/40 text-xs truncate"
                            style={{ fontFamily: "Manrope, sans-serif" }}
                          >
                            {c.last_checkin_at
                              ? `Last check-in ${c.days_since}d ago`
                              : `${c.days_since}d since onboard, no check-in yet`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCheckinTarget({ leadId: c.lead_id, name: c.client_name })}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-white/15 text-white/80 hover:bg-white/[.06] transition-colors"
                        style={{ fontFamily: "Manrope, sans-serif" }}
                      >
                        Log check-in
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* pipeline */}
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: DIVIGNER_CARD_BG }}
        >
          <div className="px-6 py-4 border-b border-white/[.08] flex items-center justify-between gap-3">
            <h2
              className="text-white/80 text-sm font-semibold"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Your Pipeline
            </h2>
            <div className="flex items-center gap-3">
              {leads.length > 0 && (
                <span className="text-white/40 text-xs hidden sm:inline" style={{ fontFamily: "Manrope, sans-serif" }}>
                  {leads.length} {leads.length === 1 ? "lead" : "leads"}
                </span>
              )}
              <div className="inline-flex rounded-md border border-white/10 bg-white/[.04] p-0.5">
                <button
                  type="button"
                  onClick={() => setPipelineView("list")}
                  className={[
                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                    pipelineView === "list" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80",
                  ].join(" ")}
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  <List className="h-3.5 w-3.5" /> List
                </button>
                <button
                  type="button"
                  onClick={() => setPipelineView("board")}
                  className={[
                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                    pipelineView === "board" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80",
                  ].join(" ")}
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Board
                </button>
              </div>
            </div>
          </div>
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(52,214,194,.12)" }}
              >
                <Inbox className="h-6 w-6 text-[#34D6C2]" />
              </div>
              <p
                className="text-white/60 text-sm font-medium mb-1"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                No leads yet
              </p>
              <p
                className="text-white/30 text-sm"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Share your referral link to start tracking leads.
              </p>
            </div>
          ) : pipelineView === "board" ? (
            <div className="p-4">
              <PipelineBoard
                leads={boardLeads}
                variant="dark"
                onLeadsChange={(next) => setLeads([...next, ...lostLeads])}
              />
            </div>
          ) : (
            <div className="divide-y divide-white/[.06]">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[.02] cursor-pointer"
                >
                  <div className="min-w-0">
                    <p
                      className="text-white/90 text-sm font-medium truncate"
                      style={{ fontFamily: "Manrope, sans-serif" }}
                    >
                      {lead.name}
                    </p>
                    <p className="text-white/40 text-xs truncate" style={{ fontFamily: "Manrope, sans-serif" }}>
                      {lead.company ?? lead.email ?? lead.phone ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="px-2 py-0.5 text-[10px] uppercase tracking-widest rounded-full"
                      style={{
                        background: lead.stage === "closed_won" ? "rgba(52,214,194,.15)" : "rgba(255,255,255,.05)",
                        color: lead.stage === "closed_won" ? "#34D6C2" : "rgba(255,255,255,.5)",
                        fontFamily: "Manrope, sans-serif",
                      }}
                    >
                      {STAGE_LABEL[lead.stage]}
                    </span>
                    <span className="text-white/30 text-xs" style={{ fontFamily: "Manrope, sans-serif" }}>
                      {new Date(lead.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {checkinTarget && ra?.slug && (
        <LogCheckinModal
          open={!!checkinTarget}
          onClose={() => setCheckinTarget(null)}
          raSlug={ra.slug}
          leadId={checkinTarget.leadId}
          clientName={checkinTarget.name}
          variant="dark"
          onLogged={() => { if (ra?.slug) void refreshActive(ra.slug) }}
        />
      )}
    </div>
  )
}
