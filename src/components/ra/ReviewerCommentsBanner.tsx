import { MessageSquareWarning, CheckCircle2 } from "lucide-react"
import type { RaCommentSection, RaSectionComment } from "@/types/db"

type Props = {
  section: RaCommentSection
  comments: RaSectionComment[]
}

// Read-only banner shown at the top of each onboarding step. Surfaces the
// reviewer's open comments for that section so the RA knows exactly what to
// address. Resolved comments are dimmed but still visible so the RA can see
// the full review trail.
export function ReviewerCommentsBanner({ section, comments }: Props) {
  const mine = comments.filter((c) => c.section === section)
  if (mine.length === 0) return null

  const open = mine.filter((c) => !c.resolved_at)
  const isAllResolved = open.length === 0

  return (
    <div
      style={{
        background: isAllResolved ? "rgba(52,214,194,.07)" : "rgba(251,191,36,.07)",
        border: `1px solid ${isAllResolved ? "rgba(52,214,194,.3)" : "rgba(251,191,36,.3)"}`,
        borderRadius: "12px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {isAllResolved
          ? <CheckCircle2 style={{ width: 14, height: 14, color: "#34D6C2" }} />
          : <MessageSquareWarning style={{ width: 14, height: 14, color: "#fbbf24" }} />}
        <span style={{
          fontSize: "12px",
          fontWeight: 600,
          color: isAllResolved ? "#34D6C2" : "#fbbf24",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          {isAllResolved
            ? `Reviewer feedback (${mine.length} resolved)`
            : `${open.length} open comment${open.length === 1 ? "" : "s"} from your reviewer`}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {mine.map((c) => (
          <div
            key={c.id}
            style={{
              background: "rgba(0,0,0,.18)",
              border: "1px solid rgba(160,190,215,.12)",
              borderRadius: "8px",
              padding: "10px 12px",
              opacity: c.resolved_at ? 0.55 : 1,
            }}
          >
            <p style={{
              margin: "0 0 4px",
              fontSize: "11px",
              color: "#6E8499",
            }}>
              <span style={{ fontWeight: 600, color: "#A2B6C9" }}>{c.author_name || c.author_email || "Reviewer"}</span>
              {" · "}
              {new Date(c.created_at).toLocaleString()}
              {c.resolved_at && <> · resolved</>}
            </p>
            <p style={{
              margin: 0,
              fontSize: "13px",
              color: "#C8D5E0",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
