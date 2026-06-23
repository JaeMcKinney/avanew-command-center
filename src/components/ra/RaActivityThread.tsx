import { useMemo, useState } from "react"
import {
  History,
  UserPlus,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Landmark,
  FileText,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { RaAssociate, RaSectionComment, RaChangeRequest } from "@/types/db"

type EventKind =
  | "invited"
  | "submitted"
  | "changes_requested"
  | "comment"
  | "change_request"
  | "approved"
  | "declined"

type Event = {
  ts: string
  kind: EventKind
  title: string
  body?: string | null
  author?: string | null
  meta?: string | null
}

const PAGE_SIZE = 12

const KIND_META: Record<EventKind, { icon: typeof History; tint: string; label: string }> = {
  invited:           { icon: UserPlus,     tint: "text-muted-foreground",          label: "Invited" },
  submitted:         { icon: Send,         tint: "text-blue-600 dark:text-blue-400", label: "Submitted" },
  changes_requested: { icon: AlertTriangle, tint: "text-amber-600 dark:text-amber-400", label: "Changes requested" },
  comment:           { icon: MessageSquare, tint: "text-muted-foreground",         label: "Reviewer comment" },
  change_request:    { icon: Landmark,     tint: "text-violet-600 dark:text-violet-400", label: "Change request" },
  approved:          { icon: CheckCircle2, tint: "text-primary",                    label: "Approved" },
  declined:          { icon: XCircle,      tint: "text-destructive",                label: "Declined" },
}

const SECTION_LABEL: Record<string, string> = {
  agreement: "Agreement", photo: "Profile photo", bio: "Bio",
  contact: "Contact info", banking: "ACH banking", w9: "IRS Form W-9",
  profile: "Profile", other: "Other",
}

const CHANGE_REQUEST_ICON: Record<string, typeof Landmark> = {
  banking: Landmark, w9: FileText, other: MessageSquare,
}

export function RaActivityThread({
  ra,
  comments,
  changeRequests,
}: {
  ra: RaAssociate
  comments: RaSectionComment[]
  changeRequests: RaChangeRequest[]
}) {
  const [expanded, setExpanded] = useState(false)

  const events = useMemo<Event[]>(() => {
    const out: Event[] = []
    if (ra.created_at) out.push({
      ts: ra.created_at, kind: "invited",
      title: `Invited to the program`, meta: ra.email || undefined,
    })
    if (ra.submitted_at) out.push({
      ts: ra.submitted_at, kind: "submitted",
      title: "Application submitted for review",
    })
    if (ra.verification_notes_at && ra.verification_notes) out.push({
      ts: ra.verification_notes_at, kind: "changes_requested",
      title: "Program Admin requested changes",
      body: ra.verification_notes,
    })
    if (ra.verified_at && ra.status === "active") out.push({
      ts: ra.verified_at, kind: "approved",
      title: "Application approved & activated",
    })
    if (ra.status === "declined" && ra.verified_at) out.push({
      ts: ra.verified_at, kind: "declined",
      title: "Application declined",
    })
    for (const c of comments) {
      out.push({
        ts: c.created_at, kind: "comment",
        title: `${SECTION_LABEL[c.section] ?? c.section} — reviewer comment`,
        body: c.body, author: c.author_name || c.author_email || "Reviewer",
        meta: c.resolved_at ? "resolved" : null,
      })
    }
    for (const r of changeRequests) {
      const typeLabel = r.request_type === "banking" ? "Banking" : r.request_type === "w9" ? "W-9" : "Profile"
      const statusLabel = r.status === "pending" ? "pending review" : r.status
      out.push({
        ts: r.requested_at, kind: "change_request",
        title: `${typeLabel} change request submitted`,
        body: r.note,
        meta: statusLabel,
      })
      if (r.reviewed_at) out.push({
        ts: r.reviewed_at, kind: r.status === "approved" ? "approved" : "declined",
        title: `${typeLabel} change request ${r.status}`,
        body: r.review_note,
      })
    }
    return out.sort((a, b) => b.ts.localeCompare(a.ts))
  }, [ra, comments, changeRequests])

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Communication & activity
          </CardTitle>
          <CardDescription>No events yet for this RA.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const visible = expanded ? events : events.slice(0, PAGE_SIZE)
  const hidden = events.length - visible.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Communication & activity
        </CardTitle>
        <CardDescription>
          Every Program Admin ↔ RA event on this record, newest first. {events.length} entr{events.length === 1 ? "y" : "ies"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-3 border-l border-border pl-5">
          {visible.map((e, idx) => {
            const m = KIND_META[e.kind]
            const Icon = e.kind === "change_request"
              ? (CHANGE_REQUEST_ICON[((e.meta ?? "").includes("banking") ? "banking" : (e.meta ?? "").includes("w9") ? "w9" : "other")] ?? m.icon)
              : m.icon
            return (
              <li key={idx} className="relative">
                <span className="absolute -left-[26px] grid h-5 w-5 place-items-center rounded-full border bg-card">
                  <Icon className={`h-3 w-3 ${m.tint}`} />
                </span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium">{e.title}</span>
                  {e.meta && (
                    <Badge variant="outline" className="text-[10px] font-normal capitalize">{e.meta}</Badge>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(e.ts).toLocaleString()}
                  </span>
                </div>
                {e.author && (
                  <p className="text-[11px] text-muted-foreground">by {e.author}</p>
                )}
                {e.body && (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {e.body}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
        {hidden > 0 && (
          <div className="pt-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
              Show {hidden} earlier event{hidden === 1 ? "" : "s"}
            </Button>
          </div>
        )}
        {expanded && events.length > PAGE_SIZE && (
          <div className="pt-3 flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              Collapse
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
