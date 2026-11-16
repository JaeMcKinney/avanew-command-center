import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { answerQuestion, listAvatarsEver, listQuestionGroups, publishKnowledge, setQuestionStatus, type Client, type QuestionGroup } from "@/lib/api"
import { formatDateTime } from "@/lib/dates"
import { count } from "@/lib/format"
import { usePortalClient } from "@/pages/portal/PortalLayout"

const MAX_ANSWER = 2000

function KnowledgePill({ group }: { group: QuestionGroup }) {
  if (group.knowledge_status === "published") return <StatusPill tone="ok" icon={<CheckCircle2 />}>Added to avatar knowledge</StatusPill>
  if (group.knowledge_status === "error") return <StatusPill tone="bad" icon={<AlertTriangle />}>Not added yet</StatusPill>
  return <StatusPill tone="info" icon={<Clock />}>Being added to avatar knowledge</StatusPill>
}

function QuestionCard({ group, avatarNames, timeZone, canAnswer, onChanged }: {
  group: QuestionGroup
  avatarNames: string
  timeZone: string
  canAnswer: boolean
  onChanged: () => void
}) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [answer, setAnswer] = useState(group.answer ?? "")
  const [problem, setProblem] = useState("")

  /** Saves the change, then sends it to Tavus. A Tavus hiccup is not a failure: the server keeps trying. */
  const publishAfter = async (change: () => Promise<void>, needsPublish: boolean) => {
    await change()
    if (!needsPublish) return null
    return publishKnowledge(group.id).catch(() => null)
  }
  const save = useMutation({
    mutationFn: () => publishAfter(() => answerQuestion(group.id, answer.trim()), true),
    onSuccess: (result) => {
      setEditing(false)
      toast.success(result?.knowledge_status === "published" ? "Answer saved and added to the avatar's knowledge" : "Answer saved. It will be added to the avatar's knowledge shortly")
      onChanged()
    },
    onError: (err) => setProblem((err as Error).message),
  })
  const move = useMutation({
    mutationFn: (status: "open" | "dismissed") => publishAfter(() => setQuestionStatus(group.id, status), group.status === "answered"),
    onSuccess: (_, status) => {
      toast.success(status === "dismissed" ? "Question dismissed" : "Question moved back to Needs an answer")
      onChanged()
    },
    onError: (err) => toast.error((err as Error).message),
  })
  const retry = useMutation({
    mutationFn: () => publishKnowledge(group.id),
    onSuccess: (result) => {
      if (result.knowledge_status === "published") toast.success("Added to the avatar's knowledge")
      else toast.message("Tavus is not ready yet. We will keep trying.")
      onChanged()
    },
    onError: (err) => toast.error((err as Error).message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return setProblem("Write an answer first.")
    setProblem("")
    save.mutate()
  }
  const showForm = canAnswer && (group.status === "open" || editing)
  const busy = save.isPending || move.isPending

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{group.question}</h3>
        <p className="text-sm text-muted-foreground">
          Asked {count(group.times_asked)} time{group.times_asked === 1 ? "" : "s"}
          {avatarNames && <> · {avatarNames}</>}
          {group.last_asked_at && <> · last on {formatDateTime(group.last_asked_at, timeZone)}</>}
        </p>
      </div>

      {group.status === "answered" && !editing && (
        <div className="flex flex-col gap-2">
          <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{group.answer}</p>
          <div className="flex flex-wrap items-center gap-2">
            <KnowledgePill group={group} />
            {group.knowledge_status === "error" && (
              <span className="text-xs text-muted-foreground">{group.knowledge_error ?? "Tavus could not be reached."}</span>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
          <Label htmlFor={`${id}-answer`}>Your answer</Label>
          <textarea
            id={`${id}-answer`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            maxLength={MAX_ANSWER}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${id}-help${problem ? ` ${id}-problem` : ""}`}
            className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            Write it the way you would like the avatar to say it. The avatar will use this answer in future calls.
          </p>
          {problem && <p id={`${id}-problem`} role="alert" className="text-sm font-medium text-bad">{problem}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-10" disabled={busy}>{save.isPending ? "Saving…" : "Save answer"}</Button>
            {editing && <Button type="button" variant="outline" className="min-h-10" disabled={busy} onClick={() => { setEditing(false); setAnswer(group.answer ?? ""); setProblem("") }}>Cancel</Button>}
            {group.status === "open" && <Button type="button" variant="outline" className="min-h-10" disabled={busy} onClick={() => move.mutate("dismissed")}>Dismiss</Button>}
          </div>
        </form>
      )}

      {canAnswer && group.status === "answered" && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-10" onClick={() => setEditing(true)}>Change answer</Button>
          {group.knowledge_status === "error" && <Button variant="outline" className="min-h-10" disabled={retry.isPending} onClick={() => retry.mutate()}>{retry.isPending ? "Trying…" : "Try again"}</Button>}
          <Button variant="outline" className="min-h-10" disabled={busy} onClick={() => move.mutate("dismissed")}>Remove answer</Button>
        </div>
      )}
      {canAnswer && group.status === "dismissed" && (
        <div><Button variant="outline" className="min-h-10" disabled={busy} onClick={() => move.mutate("open")}>Move back to Needs an answer</Button></div>
      )}
    </li>
  )
}

/** Shown in the client's portal, and inside the client's file for Divigner staff (pass `client` and `embedded`). */
export default function Questions({ client: given, embedded = false }: { client?: Client; embedded?: boolean } = {}) {
  const fromPortal = usePortalClient()
  const client = given ?? fromPortal
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const groups = useQuery({ queryKey: ["question-groups", client.id], queryFn: () => listQuestionGroups(client.id) })
  const avatars = useQuery({ queryKey: ["avatars-ever", client.id], queryFn: () => listAvatarsEver(client.id) })
  const canAnswer = can("questions.answer")
  const namesFor = (ids: string[]) => ids.map((id) => avatars.data?.find((a) => a.id === id)?.display_name).filter(Boolean).join(", ")
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["question-groups", client.id] })

  const all = groups.data ?? []
  const tabs = [
    { value: "open", label: "Needs an answer", rows: all.filter((g) => g.status === "open"), empty: "Nothing is waiting for an answer.", help: "When a visitor asks something an avatar cannot answer well, it appears here." },
    { value: "answered", label: "Answered", rows: all.filter((g) => g.status === "answered"), empty: "No answers yet.", help: "Answers you write are added to the avatar's knowledge." },
    { value: "dismissed", label: "Dismissed", rows: all.filter((g) => g.status === "dismissed"), empty: "Nothing has been dismissed.", help: "Questions you chose not to answer." },
  ]

  return (
    <>
      {!embedded && (
      <PageHeader
        title="Questions"
        description={canAnswer
          ? "Questions visitors asked that your avatars could not answer well. Write an answer once and the avatar will use it from then on."
          : "Questions visitors asked that your avatars could not answer well."}
      />
      )}
      {embedded && <p className="max-w-prose text-sm text-muted-foreground">Questions visitors asked that {client.name}'s avatars could not answer well. An answer written here is added to the avatar's knowledge.</p>}
      {groups.isPending ? (
        <LoadingBlock label="Loading questions" />
      ) : groups.isError ? (
        <ErrorBlock error={groups.error} onRetry={() => void groups.refetch()} />
      ) : (
        <Tabs defaultValue="open" className="flex flex-col gap-4">
          <TabsList className="h-auto flex-wrap">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="min-h-10 px-4">{tab.label} ({count(tab.rows.length)})</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.rows.length === 0 ? (
                <EmptyState title={tab.empty}>{tab.help}</EmptyState>
              ) : (
                <ul className="flex flex-col gap-3">
                  {tab.rows.map((group) => (
                    <QuestionCard key={`${group.id}-${group.status}-${group.answer ?? ""}`} group={group} avatarNames={namesFor(group.avatar_ids)} timeZone={client.timezone} canAnswer={canAnswer} onChanged={refresh} />
                  ))}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  )
}
