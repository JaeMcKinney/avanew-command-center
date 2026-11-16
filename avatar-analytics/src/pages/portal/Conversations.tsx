import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getTranscript, listAvatars, listConversations, type Conversation } from "@/lib/api"
import { formatDateTime, formatRange, presetRange, todayIn } from "@/lib/dates"
import { duration, endedBecause } from "@/lib/format"
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
  const [state, setState] = useState<RangeState>({ preset: "month", range: presetRange("month", today) })
  const [open, setOpen] = useState<Conversation | null>(null)
  const avatars = useQuery({ queryKey: ["avatars", client.id], queryFn: () => listAvatars(client.id) })
  const conversations = useQuery({ queryKey: ["conversations", client.id, state.range.from, state.range.to], queryFn: () => listConversations(client.id, state.range) })
  const nameOf = (avatarId: string) => avatars.data?.find((a) => a.id === avatarId)?.display_name ?? "Avatar"

  return (
    <>
      <PageHeader title="Conversations" description="Every finished call with your avatars. Open one to read what was said." />
      <DateRangeControl value={state} onChange={setState} today={today} />

      {conversations.isPending ? (
        <LoadingBlock label="Loading conversations" />
      ) : conversations.isError ? (
        <ErrorBlock error={conversations.error} onRetry={() => void conversations.refetch()} />
      ) : conversations.data.length === 0 ? (
        <EmptyState title="No conversations in this period">Try a longer period.</EmptyState>
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {conversations.data.length === 100 ? "The latest 100 conversations" : `${conversations.data.length} conversation${conversations.data.length === 1 ? "" : "s"}`} · {formatRange(state.range)}
          </p>
          <div className="relative overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Conversations, newest first</caption>
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
                {conversations.data.map((conv) => (
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
        </>
      )}

      {open && <TranscriptDialog conversation={open} avatarName={nameOf(open.avatar_id)} timeZone={client.timezone} onClose={() => setOpen(null)} />}
    </>
  )
}
