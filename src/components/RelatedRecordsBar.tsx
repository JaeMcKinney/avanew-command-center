import { Link } from "react-router-dom"
import { Building2, User, Briefcase, UserPlus, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Kind = "account" | "contact" | "deal" | "lead"

const KIND_META: Record<Kind, { icon: typeof Building2; label: string }> = {
  account: { icon: Building2,  label: "Account"  },
  contact: { icon: User,       label: "Contact"  },
  deal:    { icon: Briefcase,  label: "Deal"     },
  lead:    { icon: UserPlus,   label: "Lead"     },
}

export type RelatedRecord = {
  kind: Kind
  id: string
  /** Primary line (e.g. company name, person name, deal title). */
  label: string
  /** Optional secondary line (stage name, amount, role, etc.) shown in muted text. */
  sublabel?: string
}

const KIND_TO_PATH: Record<Kind, (id: string) => string> = {
  account: (id) => `/accounts/${id}`,
  contact: (id) => `/contacts/${id}/edit`,
  deal:    (id) => `/deals/${id}/edit`,
  lead:    (id) => `/leads/${id}/edit`,
}

/**
 * Compact horizontal strip of clickable chips that surface the records related
 * to the current page (e.g. on a Deal: its Account + Contact). Drop it under
 * the sticky header. Hidden automatically when there are no related records.
 */
export function RelatedRecordsBar({
  records,
  className,
}: {
  records: RelatedRecord[]
  className?: string
}) {
  if (records.length === 0) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2 md:px-6",
        className
      )}
    >
      <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mr-1">
        Related
      </span>
      {records.map((r) => {
        const meta = KIND_META[r.kind]
        const Icon = meta.icon
        return (
          <Link
            key={`${r.kind}-${r.id}`}
            to={KIND_TO_PATH[r.kind](r.id)}
            className="group inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5"
            title={`Open ${meta.label}: ${r.label}`}
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
            <span className="text-muted-foreground">{meta.label}:</span>
            <span className="font-medium max-w-[180px] truncate">{r.label}</span>
            {r.sublabel && (
              <span className="text-muted-foreground hidden sm:inline">· {r.sublabel}</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
