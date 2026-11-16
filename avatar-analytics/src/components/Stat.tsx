import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** A labelled figure. `hero` is the large version used for talk-time totals. */
export function Stat({
  label,
  value,
  unit,
  note,
  hero,
  highlight,
}: {
  label: string
  value: ReactNode
  unit?: string
  note?: ReactNode
  hero?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-4", hero && "sm:p-5")}
      style={highlight ? { background: "color-mix(in srgb, var(--brand) 12%, var(--card))", borderColor: "color-mix(in srgb, var(--brand) 45%, var(--border))" } : undefined}
    >
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("tabular font-display leading-none font-semibold", hero ? "text-4xl sm:text-5xl" : "text-2xl")}>
        {value}
        {unit && <span className={cn("ml-1.5 font-sans font-semibold text-muted-foreground", hero ? "text-lg" : "text-sm")}>{unit}</span>}
      </p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  )
}
