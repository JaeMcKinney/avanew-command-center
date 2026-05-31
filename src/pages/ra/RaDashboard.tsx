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
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getRaAssociate } from "@/lib/data"
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

  // Day 5: replace with getRaStats(ra.id) once ra_leads table exists
  const stats: RaStats = {
    totalLeads: 0,
    activeLeads: 0,
    dealsClosed: 0,
    totalCommission: 0,
    pendingCommission: 0,
  }

  useEffect(() => {
    getRaAssociate().then(setRa).catch(() => null)
  }, [])

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

        {/* pipeline */}
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: DIVIGNER_CARD_BG }}
        >
          <div className="px-6 py-4 border-b border-white/[.08]">
            <h2
              className="text-white/80 text-sm font-semibold"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Your Pipeline
            </h2>
          </div>
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
        </div>

      </main>
    </div>
  )
}
