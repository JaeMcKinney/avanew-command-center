import { useNavigate } from "react-router-dom"
import { Plus, UserPlus, Building2, Handshake, ListChecks } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

type Stat = { label: string; value: string }

const ACTIONS: { label: string; to: string; icon: LucideIcon }[] = [
  { label: "New Lead", to: "/leads/new", icon: UserPlus },
  { label: "New Account", to: "/accounts/new", icon: Building2 },
  { label: "New Deal", to: "/deals/new", icon: Handshake },
  { label: "New Task", to: "/tasks/new", icon: ListChecks },
]

// Bar heights (%) for the voice waveform motif borrowed from avanew.ai.
const WAVE = [22, 38, 60, 44, 78, 52, 90, 64, 40, 70, 96, 58, 34, 66, 84, 48, 28, 56, 74, 42, 62, 88, 50, 30, 46, 72, 36, 54, 80, 26]

function greeting(d: Date) {
  const h = d.getHours()
  if (h < 12) return "Good Morning"
  if (h < 18) return "Good Afternoon"
  return "Good Evening"
}

function usDate(d: Date) {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" })
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${weekday}, ${mm}-${dd}-${d.getFullYear()}`
}

export function AvanewHomeHero({ stats }: { stats: Stat[] }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const meta = user?.user_metadata as { full_name?: string; first_name?: string } | undefined
  const firstName =
    meta?.first_name ?? meta?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? ""
  const now = new Date()

  return (
    <section className="avanew-hero relative overflow-hidden rounded-2xl text-white">
      <div className="avanew-hero-wave" aria-hidden>
        {WAVE.map((h, i) => (
          <span key={i} style={{ height: `${h}%`, animationDelay: `${(i % 10) * 0.12}s` }} />
        ))}
      </div>

      <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#FF8A94]">
            {usDate(now)}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight text-white">
            {greeting(now)}{firstName ? `, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}` : ""}.
          </h1>
          <p className="max-w-xl text-sm sm:text-base text-white/70">
            Here's where Avanew stands today: your pipeline, your people, and what needs you next.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm"
            >
              <div className="text-xs text-white/60">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {ACTIONS.map(({ label, to, icon: Icon }, i) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(to)}
              className={
                i === 0
                  ? "inline-flex items-center gap-2 rounded-lg bg-[#C42133] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(196,33,51,.8)] transition hover:bg-[#A32235]"
                  : "inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-[#FF8A94]/60 hover:bg-white/10"
              }
            >
              {i === 0 ? <Plus className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
