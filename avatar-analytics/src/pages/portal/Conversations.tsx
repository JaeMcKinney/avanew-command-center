import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useId, useState } from "react"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CONVERSATIONS_PAGE_SIZE, getTranscript, listAvatarsEver, listConversations, type Conversation } from "@/lib/api"
import { formatDateTime, formatRange, presetRange, todayIn } from "@/lib/dates"
import { count, duration, endedBecause } from "@/lib/format"
import { cn } from "@/lib/utils"
import { usePortalClient } from "@/pages/portal/PortalLayout"

function TranscriptDialog({ conversation, avatarName, timeZone, onClose }: { conversation: Conversation; avatarName: string; timeZone: string; onClose: () => void }) {
  const transcript = useQuery({ queryKey: ["transcript", conversation.conversation_id], queryFn: () => getTranscript(conversation.conversation_id) })
  const turns = (transcript.data ?? []).filter((t) => t.role === "user" || t.role === "assistant")
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
        ) : turns.length === 0 ? (
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
          <p role="status" className="text-sm text-muted-foreground">
            {total > CONVERSATIONS_PAGE_SIZE ? `Showing ${first}–${last} of ${count(total)}` : count(total)} conversation{total === 1 ? "" : "s"}{who} · {formatRange(state.range)}
          </p>
          <div className={cn("relative overflow-x-auto rounded-lg border bg-card", conversations.isPlaceholderData && "opacity-60")}>
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
          </div>

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

      {open && <TranscriptDialog conversation={open} avatarName={nameOf(open.avatar_id)} timeZone={client.timezone} onClose={() => setOpen(null)} />}
    </>
  )
}
