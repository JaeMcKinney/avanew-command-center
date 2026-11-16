import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { TableScroll } from "@/components/TableScroll"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Download } from "lucide-react"
import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  CONVERSATIONS_PAGE_SIZE, EXPORT_LIMIT, getInsight, getTranscript, listAvatarsEver, listConversations, listForExport, splitQuestions,
  type Client, type Conversation, type Question,
} from "@/lib/api"
import { formatDateTime, formatRange, presetRange, todayIn } from "@/lib/dates"
import { count, duration, endedBecause } from "@/lib/format"
import { cn } from "@/lib/utils"
import { usePortalClient } from "@/pages/portal/PortalLayout"

/** One of the two question lists on a call: what the avatar answered, or what it did not. */
function QuestionSection({ id, title, questions, empty, questionsPath }: { id: string; title: string; questions: Question[]; empty: string; questionsPath?: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h3 id={id} className="text-sm font-semibold">{title} ({count(questions.length)})</h3>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {questions.map((q) => (
            <li key={q.id} className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 flex-1 basis-56">{q.question}</span>
                {q.outcome === "answered" ? (
                  <StatusPill tone="ok" icon={<CheckCircle2 />}>Answered</StatusPill>
                ) : q.outcome === "weak" ? (
                  <StatusPill tone="warn" icon={<CircleHelp />}>Partly answered</StatusPill>
                ) : (
                  <StatusPill tone="bad" icon={<AlertTriangle />}>Not answered</StatusPill>
                )}
              </div>
              {q.outcome !== "answered" && q.group?.status === "answered" && q.group.answer && (
                <p className="rounded-md bg-muted p-2 text-sm"><span className="font-semibold">Your answer, now in the avatar's knowledge: </span>{q.group.answer}</p>
              )}
              {q.outcome !== "answered" && q.group?.status === "open" && questionsPath && (
                <p><Link to={questionsPath} className="inline-flex min-h-6 items-center font-medium text-primary-text underline">Write an answer in Questions</Link></p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Builds the PDF only when asked, so the PDF code is not loaded for people who never download. */
async function downloadPdf(client: Client, scope: string | undefined, name: Array<string | null | undefined>, conversations: import("@/lib/pdf").PdfConversation[]) {
  const { buildTranscriptPdf, pdfFileName, saveFile } = await import("@/lib/pdf")
  const bytes = await buildTranscriptPdf({ clientName: client.name, logoUrl: client.logo_url, timeZone: client.timezone, scope, conversations })
  saveFile(bytes, pdfFileName(name))
}

function TranscriptDialog({ conversation, avatarName, client, onClose }: { conversation: Conversation; avatarName: string; client: Client; onClose: () => void }) {
  const timeZone = client.timezone
  const transcript = useQuery({ queryKey: ["transcript", conversation.conversation_id], queryFn: () => getTranscript(conversation.conversation_id) })
  const insight = useQuery({ queryKey: ["insight", conversation.conversation_id], queryFn: () => getInsight(conversation.conversation_id) })
  const [saving, setSaving] = useState(false)
  const turns = (transcript.data ?? []).filter((t) => t.role === "user" || t.role === "assistant")
  const summary = insight.data?.insight?.status === "ready" ? insight.data.insight.summary : null
  const questions = insight.data?.questions ?? []
  const split = splitQuestions(questions)

  const download = async () => {
    setSaving(true)
    try {
      await downloadPdf(client, undefined, [client.slug, avatarName, (conversation.started_at ?? conversation.ended_at ?? "").slice(0, 10), "transcript"],
        [{ conversation, avatarName, summary, questions, turns: transcript.data ?? [] }])
    } catch (err) {
      toast.error(`The PDF could not be made: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conversation with {avatarName}</DialogTitle>
          <DialogDescription>
            {formatDateTime(conversation.started_at ?? conversation.ended_at, timeZone)} · {duration(conversation.talk_seconds)} · {endedBecause(conversation.shutdown_reason)}
          </DialogDescription>
        </DialogHeader>
        {transcript.isPending ? (
          <LoadingBlock label="Loading transcript" />
        ) : transcript.isError ? (
          <ErrorBlock error={transcript.error} />
        ) : (
          <>
            <div>
              <Button variant="outline" className="min-h-10" onClick={() => void download()} disabled={saving || insight.isPending}>
                <Download aria-hidden="true" />{saving ? "Preparing PDF…" : "Download PDF"}
              </Button>
            </div>

            <section aria-labelledby="summary-heading" className="flex flex-col gap-1.5">
              <h3 id="summary-heading" className="text-sm font-semibold">Summary</h3>
              {insight.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : summary ? (
                <p className="text-sm">{summary}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {insight.data?.insight?.status === "failed" ? "A summary could not be made for this conversation." : "The summary is being prepared. Check back in a few minutes."}
                </p>
              )}
            </section>

            {insight.data?.insight?.status === "ready" && (
              questions.length === 0 ? (
                <section aria-labelledby="questions-heading" className="flex flex-col gap-1.5">
                  <h3 id="questions-heading" className="text-sm font-semibold">Questions</h3>
                  <p className="text-sm text-muted-foreground">The visitor did not ask any questions.</p>
                </section>
              ) : (
                <>
                  <p role="status" className="rounded-lg bg-muted p-3 text-sm">
                    The visitor asked <strong>{count(questions.length)}</strong> question{questions.length === 1 ? "" : "s"}. The avatar answered <strong>{count(split.answered.length)}</strong>, partly answered <strong>{count(split.partly.length)}</strong> and did not answer <strong>{count(split.unanswered.length)}</strong>.
                  </p>
                  <QuestionSection id="answered-heading" title="Questions answered" questions={split.answered} empty="None." />
                  <QuestionSection id="partly-heading" title="Questions partly answered" questions={split.partly} empty="None." questionsPath={`/c/${client.slug}/questions`} />
                  <QuestionSection id="unanswered-heading" title="Questions not answered" questions={split.unanswered} empty="None." questionsPath={`/c/${client.slug}/questions`} />
                </>
              )
            )}

            <section aria-labelledby="transcript-heading" className="flex flex-col gap-1.5">
              <h3 id="transcript-heading" className="text-sm font-semibold">Transcript</h3>
              {turns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing was said in this conversation.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {turns.map((turn, i) => (
                    <li key={i} className={turn.role === "assistant" ? "rounded-lg bg-muted p-3" : "rounded-lg border p-3"}>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {turn.role === "assistant" ? avatarName : "Visitor"}
                        {typeof turn.seconds_from_start === "number" && <span className="tabular font-normal"> · {duration(turn.seconds_from_start)}</span>}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function Conversations() {
  const client = usePortalClient()
  const today = todayIn(client.timezone)
  const selectId = useId()
  const [state, setState] = useState<RangeState>({ preset: "month", range: presetRange("month", today) })
  const [avatarId, setAvatarId] = useState("")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Conversation | null>(null)
  const [exporting, setExporting] = useState(false)
  const avatars = useQuery({ queryKey: ["avatars-ever", client.id], queryFn: () => listAvatarsEver(client.id) })
  const conversations = useQuery({
    queryKey: ["conversations", client.id, state.range.from, state.range.to, avatarId, page],
    queryFn: () => listConversations(client.id, state.range, { avatarId: avatarId || null, page }),
    placeholderData: keepPreviousData,
  })
  const nameOf = (id: string) => avatars.data?.find((a) => a.id === id)?.display_name ?? "Avatar"

  const total = conversations.data?.total ?? 0
  const rows = conversations.data?.rows ?? []
  const pages = Math.max(1, Math.ceil(total / CONVERSATIONS_PAGE_SIZE))
  const first = (page - 1) * CONVERSATIONS_PAGE_SIZE + 1
  const last = Math.min(total, page * CONVERSATIONS_PAGE_SIZE)
  const who = avatarId ? ` with ${nameOf(avatarId)}` : ""

  const downloadAll = async () => {
    setExporting(true)
    try {
      const { items, total: withTranscript } = await listForExport(client.id, state.range, avatarId || null)
      if (items.length === 0) {
        toast.message("None of these conversations has a transcript to download.")
        return
      }
      const scope = `${formatRange(state.range)}${avatarId ? ` · ${nameOf(avatarId)}` : ""}`
      await downloadPdf(client, scope, [client.slug, avatarId ? nameOf(avatarId) : null, "transcripts", state.range.from, "to", state.range.to],
        items.map((item) => ({ ...item, avatarName: nameOf(item.conversation.avatar_id) })))
      if (withTranscript > items.length) {
        toast.message(`The PDF has the newest ${count(items.length)} of ${count(withTranscript)} transcripts. Choose a shorter period to get the rest.`)
      } else {
        toast.success(`Downloaded ${count(items.length)} transcript${items.length === 1 ? "" : "s"}`)
      }
    } catch (err) {
      toast.error(`The PDF could not be made: ${(err as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader title="Conversations" description="Every finished call with your avatars. Choose a period and an avatar, then open a call to read what was said." />
      <DateRangeControl value={state} onChange={(next) => { setState(next); setPage(1) }} today={today} />

      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor={selectId}>Avatar</Label>
        <select
          id={selectId}
          value={avatarId}
          onChange={(e) => { setAvatarId(e.target.value); setPage(1) }}
          className="min-h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All avatars</option>
          {(avatars.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.display_name}{a.unlinked_at ? " (no longer linked)" : ""}</option>
          ))}
        </select>
      </div>

      {conversations.isPending ? (
        <LoadingBlock label="Loading conversations" />
      ) : conversations.isError ? (
        <ErrorBlock error={conversations.error} onRetry={() => void conversations.refetch()} />
      ) : total === 0 ? (
        <EmptyState title={`No conversations${who} in this period`}>Try a longer period{avatarId ? " or all avatars" : ""}.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              {total > CONVERSATIONS_PAGE_SIZE ? `Showing ${first}–${last} of ${count(total)}` : count(total)} conversation{total === 1 ? "" : "s"}{who} · {formatRange(state.range)}
            </p>
            <Button variant="outline" className="min-h-10" onClick={() => void downloadAll()} disabled={exporting} aria-describedby={`${selectId}-export-help`}>
              <Download aria-hidden="true" />{exporting ? "Preparing PDF…" : "Download transcripts (PDF)"}
            </Button>
          </div>
          <p id={`${selectId}-export-help`} className="sr-only">One PDF with every transcript in this period{who}, up to {EXPORT_LIMIT}.</p>
          <TableScroll label="Conversations table" className={cn("rounded-lg border bg-card", conversations.isPlaceholderData && "opacity-60")}>
            <table className="w-full text-sm">
              <caption className="sr-only">Conversations{who}, newest first</caption>
              <thead>
                <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">When</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Avatar</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide">Length</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-semibold tracking-wide sm:table-cell">How it ended</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Transcript</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((conv) => (
                  <tr key={conv.conversation_id} className="border-b last:border-0">
                    <td className="tabular px-4 py-3">{formatDateTime(conv.started_at ?? conv.ended_at, client.timezone)}</td>
                    <td className="px-4 py-3">{nameOf(conv.avatar_id)}</td>
                    <td className="tabular px-4 py-3 text-right">{duration(conv.talk_seconds)}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">{endedBecause(conv.shutdown_reason)}</td>
                    <td className="px-4 py-3 text-right">
                      {conv.has_transcript ? (
                        <Button variant="outline" size="sm" className="min-h-9" onClick={() => setOpen(conv)} aria-label={`Read the conversation from ${formatDateTime(conv.started_at ?? conv.ended_at, client.timezone)}`}>
                          Read
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No transcript</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>

          {pages > 1 && (
            <nav aria-label="Pages of conversations" className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" className="min-h-10" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft aria-hidden="true" />Newer
              </Button>
              <p className="tabular text-sm text-muted-foreground">Page {page} of {pages}</p>
              <Button variant="outline" className="min-h-10" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Older<ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}

      {open && <TranscriptDialog conversation={open} avatarName={nameOf(open.avatar_id)} client={client} onClose={() => setOpen(null)} />}
    </>
  )
}
