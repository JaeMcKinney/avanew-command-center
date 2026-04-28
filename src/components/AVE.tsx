import { useLocation } from "react-router-dom"
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react"
import { usePermissions } from "@/hooks/usePermissions"
import { useAVE } from "@/hooks/useAVE"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MODULE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/contacts": "Contacts",
  "/accounts": "Accounts",
  "/deals": "Deals",
  "/tasks": "Tasks",
  "/activities": "Activities",
  "/reports": "Reports",
  "/cashflow": "Cashflow",
  "/partners": "Partners",
  "/vendors": "Vendors",
  "/settings": "Settings",
  "/permissions": "Permissions",
}

const BAR_HEIGHTS = [12, 20, 10, 24, 16, 22, 8, 18, 14, 20]

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function currentModule(pathname: string): string {
  const match = Object.keys(MODULE_LABELS)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k))
  return match ? MODULE_LABELS[match] : "Application"
}

function Waveform() {
  return (
    <div className="flex items-center gap-[3px] h-8">
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-primary"
          style={{
            height: `${h}px`,
            animation: `ave-bar 1.1s ease-in-out infinite alternate`,
            animationDelay: `${i * 90}ms`,
          }}
        />
      ))}
    </div>
  )
}

export function AVE() {
  const { can } = usePermissions()
  const location = useLocation()
  const { status, conversationUrl, errorMsg, elapsed, start, end } = useAVE()

  if (!can("ai.ave")) return null

  const module = currentModule(location.pathname)
  const isIdle = status === "idle"
  const isStarting = status === "starting"
  const isActive = status === "active"
  const isEnding = status === "ending"
  const isError = status === "error"

  return (
    <>
      <style>{`
        @keyframes ave-bar {
          from { transform: scaleY(0.4); opacity: 0.5; }
          to   { transform: scaleY(1);   opacity: 1;   }
        }
      `}</style>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Active panel */}
        {isActive && (
          <div className="rounded-2xl border border-border bg-background shadow-2xl w-72 overflow-hidden">
            <div className="px-4 pt-3 pb-2 bg-primary/5 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-semibold">AVE Active</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {formatElapsed(elapsed)}
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Context:{" "}
                <span className="font-medium text-foreground">{module}</span>
              </p>
              <Waveform />
              <p className="text-[11px] text-muted-foreground/60 italic">Listening…</p>
            </div>
            {conversationUrl && (
              <iframe
                src={conversationUrl}
                allow="microphone; autoplay"
                className="hidden"
                title="AVE audio session"
              />
            )}
            <div className="px-4 pb-4">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => void end()}
                disabled={isEnding}
              >
                <MicOff className="h-3.5 w-3.5" />
                End Session
              </Button>
            </div>
          </div>
        )}

        {/* Error panel */}
        {isError && (
          <div className="rounded-2xl border border-destructive/40 bg-background shadow-xl w-64 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMsg ?? "Failed to connect"}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => void start(module)}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Floating action button */}
        <button
          type="button"
          onClick={() => {
            if (isIdle || isError) void start(module)
          }}
          disabled={isStarting || isEnding || isActive}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg",
            "ring-2 ring-offset-2 transition-all focus-visible:outline-none",
            isActive
              ? "bg-emerald-600 text-white ring-emerald-400 cursor-default"
              : isStarting || isEnding
                ? "bg-primary/80 text-primary-foreground ring-primary/40 cursor-not-allowed"
                : "bg-primary text-primary-foreground ring-primary hover:bg-primary/90 active:scale-95"
          )}
          aria-label="AVE — AI Voice Experience"
        >
          {isStarting || isEnding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          <span>
            {isStarting
              ? "Connecting…"
              : isEnding
                ? "Ending…"
                : isActive
                  ? "AVE Active"
                  : "AVE"}
          </span>
        </button>
      </div>
    </>
  )
}
