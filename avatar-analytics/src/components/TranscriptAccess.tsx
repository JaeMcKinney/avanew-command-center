// What visitors said to a client's avatars is the client's own. Its support
// team (Divigner, or the client's agency) sees every number about a
// conversation but reads what was said only while the client allows it.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LockKeyhole, LockKeyholeOpen } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { getTranscriptAccess, grantTranscriptAccess, revokeTranscriptAccess, type Client } from "@/lib/api"
import { company } from "@/lib/brand"
import { formatDateTime } from "@/lib/dates"

const LENGTHS = [
  { hours: 24, label: "One day" },
  { hours: 72, label: "Three days" },
  { hours: 168, label: "Seven days" },
  { hours: 720, label: "Thirty days" },
]

// eslint-disable-next-line react-refresh/only-export-components
export function useTranscriptAccess(clientId: string) {
  return useQuery({ queryKey: ["transcript-access", clientId], queryFn: () => getTranscriptAccess(clientId), refetchInterval: 60_000 })
}

/** For staff, above a client's conversations: whether they may read what was said, and why not. */
export function TranscriptLockNotice({ client }: { client: Pick<Client, "id" | "name" | "timezone"> }) {
  const queryClient = useQueryClient()
  const access = useTranscriptAccess(client.id)
  const giveUp = useMutation({
    mutationFn: () => revokeTranscriptAccess(client.id),
    onSuccess: async () => {
      toast.success(`You can no longer read ${client.name}'s transcripts.`)
      await queryClient.invalidateQueries({ queryKey: ["transcript-access", client.id] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
  if (access.isPending) return null
  if (access.data) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border bg-info-soft p-4 text-sm">
        <LockKeyholeOpen className="size-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <strong>{client.name} has allowed you to read its transcripts</strong> until {formatDateTime(access.data.expires_at, client.timezone)}
          {access.data.granted_by_name && <>, allowed by {access.data.granted_by_name}</>}
          {access.data.reason && <>. Reason given: “{access.data.reason}”</>}.
        </p>
        <Button variant="outline" className="min-h-10" disabled={giveUp.isPending} onClick={() => giveUp.mutate()}>{giveUp.isPending ? "Ending…" : "Give up access now"}</Button>
      </div>
    )
  }
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border bg-muted p-4 text-sm">
      <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p>
        <strong>What was said in {client.name}'s conversations is private to {client.name}.</strong> You can see every conversation, its length, its avatar and its ID.
        To read a transcript, its summary or its questions, ask {client.name} to allow it: a Client admin can turn it on for a limited time from the Support page in their portal.
      </p>
    </div>
  )
}

/** For the client, on its Support page: let the support team read transcripts for a while, or stop them. */
export function TranscriptAccessCard({ client }: { client: Pick<Client, "id" | "name" | "timezone"> }) {
  const id = useId()
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const access = useTranscriptAccess(client.id)
  const [hours, setHours] = useState(24)
  const [reason, setReason] = useState("")
  const done = async () => queryClient.invalidateQueries({ queryKey: ["transcript-access", client.id] })
  const allow = useMutation({
    mutationFn: () => grantTranscriptAccess(client.id, hours, reason),
    onSuccess: async (row) => {
      toast.success(`${company()} can read your transcripts until ${formatDateTime(row.expires_at, client.timezone)}.`)
      setReason("")
      await done()
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const stop = useMutation({
    mutationFn: () => revokeTranscriptAccess(client.id),
    onSuccess: async () => {
      toast.success(`${company()} can no longer read your transcripts.`)
      await done()
    },
    onError: (err: Error) => toast.error(err.message),
  })
  if (access.isPending || access.isError) return null
  const mayShare = can("transcripts.share")

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {access.data ? <LockKeyholeOpen className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
        <div>
          <h2 id={`${id}-title`} className="font-sans text-base font-semibold">Transcript Access for {company()}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Your transcripts are private to you. The {company()} team sees how many conversations you have and how long they run, never what was said. If a support issue needs them to read a transcript, you can allow it here for a limited time.
          </p>
        </div>
      </div>
      {access.data ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="min-w-0 flex-1 text-sm">
            <strong>On.</strong> {company()} can read your transcripts until {formatDateTime(access.data.expires_at, client.timezone)}
            {access.data.granted_by_name && <>, allowed by {access.data.granted_by_name}</>}. It turns off by itself then.
          </p>
          {mayShare && <Button variant="outline" className="min-h-10" disabled={stop.isPending} onClick={() => stop.mutate()}>{stop.isPending ? "Turning off…" : "Turn off now"}</Button>}
        </div>
      ) : mayShare ? (
        <form
          className="flex flex-wrap items-end gap-3" noValidate
          onSubmit={(e) => {
            e.preventDefault()
            allow.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-hours`}>Allow For</Label>
            <select id={`${id}-hours`} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="min-h-10 rounded-md border border-input bg-transparent px-3 text-sm">
              {LENGTHS.map((l) => <option key={l.hours} value={l.hours}>{l.label}</option>)}
            </select>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${id}-reason`}>Reason (Optional)</Label>
            <Input id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="For example, ticket 12" className="min-h-10" />
          </div>
          <Button type="submit" className="min-h-10" disabled={allow.isPending}>{allow.isPending ? "Allowing…" : "Allow access"}</Button>
        </form>
      ) : (
        <p role="status" className="text-sm"><strong>Off.</strong> A Client admin on your team can turn it on.</p>
      )}
    </section>
  )
}
