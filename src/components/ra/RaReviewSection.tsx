import { useState } from "react"
import type { ReactNode } from "react"
import { CheckCircle2, CircleDot, MessageSquare, Send, Loader2, MoreVertical, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { addRaSectionComment, resolveRaSectionComment, deleteRaSectionComment } from "@/lib/data"
import type { RaCommentSection, RaSectionComment } from "@/types/db"

type Props = {
  raId: string
  section: RaCommentSection
  title: string
  description?: string
  icon: ReactNode
  done: boolean
  comments: RaSectionComment[]
  onCommentsChange: (next: RaSectionComment[]) => void
  children: ReactNode
}

// Single review section: header (status + title) + the RA's submitted data
// (children) + a per-section comment thread. Used by SettingsRAReview to
// stack agreement / photo / bio / contact / banking / w9 vertically.
export function RaReviewSection({ raId, section, title, description, icon, done, comments, onCommentsChange, children }: Props) {
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const sectionComments = comments.filter((c) => c.section === section)
  const openCount = sectionComments.filter((c) => !c.resolved_at).length

  async function postComment() {
    const body = draft.trim()
    if (!body) return
    setPosting(true)
    try {
      const created = await addRaSectionComment({ raId, section, body })
      onCommentsChange([...comments, created])
      setDraft("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post")
    } finally {
      setPosting(false)
    }
  }

  async function toggleResolved(c: RaSectionComment) {
    setResolvingId(c.id)
    try {
      const next = !c.resolved_at
      await resolveRaSectionComment(c.id, next)
      onCommentsChange(comments.map((x) =>
        x.id === c.id
          ? { ...x, resolved_at: next ? new Date().toISOString() : null }
          : x))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setResolvingId(null)
    }
  }

  async function removeComment(c: RaSectionComment) {
    try {
      await deleteRaSectionComment(c.id)
      onCommentsChange(comments.filter((x) => x.id !== c.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  return (
    <Card id={`review-${section}`} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {done
                ? <CheckCircle2 className="h-5 w-5 text-primary" />
                : <CircleDot className="h-5 w-5 text-muted-foreground/60" />}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {icon}
                {title}
              </CardTitle>
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
          </div>
          {sectionComments.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <MessageSquare className="h-3.5 w-3.5" />
              {openCount > 0
                ? <span><strong className="text-amber-600 dark:text-amber-500">{openCount}</strong> open · {sectionComments.length} total</span>
                : <span>{sectionComments.length} resolved</span>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>{children}</div>

        {/* Comment thread */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" />
            Reviewer comments
          </div>

          {sectionComments.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No comments on this section yet.
            </p>
          )}

          {sectionComments.map((c) => (
            <div
              key={c.id}
              className={`rounded-md border bg-card p-2.5 text-sm ${c.resolved_at ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {c.author_name || c.author_email || "Reviewer"}
                    </span>
                    {" · "}
                    {new Date(c.created_at).toLocaleString()}
                    {c.resolved_at && (
                      <> · <span className="text-primary">resolved</span></>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap mt-1 leading-relaxed">{c.body}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" disabled={resolvingId === c.id}>
                      {resolvingId === c.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <MoreVertical className="h-3 w-3" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleResolved(c)}>
                      {c.resolved_at ? "Re-open" : "Mark resolved"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => removeComment(c)}
                      className="text-destructive focus:text-destructive"
                    >
                      <X className="h-3 w-3" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {/* Compose */}
          <div className="space-y-2 pt-1">
            <Textarea
              rows={2}
              placeholder={`Comment on ${title.toLowerCase()}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault()
                  void postComment()
                }
              }}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {draft.length > 0 && <>⌘/Ctrl + Enter to post</>}
              </p>
              <Button size="sm" onClick={postComment} disabled={posting || !draft.trim()}>
                {posting
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Posting…</>
                  : <><Send className="h-3 w-3" /> Add comment</>}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
