import { AlertTriangle, CheckCircle2, Circle, Clock, Info, PauseCircle, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "ok" | "warn" | "bad" | "info" | "neutral"

const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-primary-text",
  neutral: "bg-muted text-muted-foreground",
}

/** A status label. Always an icon and words, never colour alone. */
export function StatusPill({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone])}>
      <span aria-hidden="true" className="[&_svg]:size-3.5">{icon}</span>
      {children}
    </span>
  )
}

export function ClientStatusPill({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <StatusPill tone="ok" icon={<CheckCircle2 />}>Active</StatusPill>
    case "paused":
      return <StatusPill tone="warn" icon={<PauseCircle />}>Paused</StatusPill>
    case "cancelled":
      return <StatusPill tone="bad" icon={<XCircle />}>Cancelled</StatusPill>
    default:
      return <StatusPill tone="info" icon={<Clock />}>Setting up</StatusPill>
  }
}

/** Whether Tavus is reporting an avatar's calls to this app. */
export function WebhookStatusPill({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <StatusPill tone="ok" icon={<CheckCircle2 />}>Reporting calls</StatusPill>
    case "error":
      return <StatusPill tone="bad" icon={<AlertTriangle />}>Not connected</StatusPill>
    default:
      return <StatusPill tone="info" icon={<Clock />}>Waiting for first call</StatusPill>
  }
}

export function DeploymentStatusPill({ status }: { status: string }) {
  if (status === "active") return <StatusPill tone="ok" icon={<CheckCircle2 />}>Live</StatusPill>
  if (status === "inactive") return <StatusPill tone="warn" icon={<PauseCircle />}>Off</StatusPill>
  return <StatusPill tone="neutral" icon={<Circle />}>{status === "draft" ? "Draft" : status}</StatusPill>
}

export function InfoPill({ children }: { children: ReactNode }) {
  return <StatusPill tone="neutral" icon={<Info />}>{children}</StatusPill>
}
