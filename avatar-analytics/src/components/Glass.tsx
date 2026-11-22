import { AvatarName } from "@/components/AvatarPhoto"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock, KeyRound, XCircle } from "lucide-react"
import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ChartCard, Columns, DataTable } from "@/components/Charts"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { Stat } from "@/components/Stat"
import { ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import {
  checkGlassKey, getGlassConnection, glassUsageByAvatar, glassUsageByDay, listAvatarsEver, removeGlassKey, saveGlassKey,
  setGlassEnabled, sumGlass, usageByAvatar, type Client, type GlassConnection, type GlassTotals,
} from "@/lib/api"
import { bucketColumns, GRAIN_LABEL, grainFor } from "@/lib/buckets"
import { seriesColor } from "@/lib/chartColors"
import { formatDay, formatRange, presetRange, startOfMonth, startOfQuarter, timeAgo, todayIn } from "@/lib/dates"
import { compact, count, duration, estimate, minutes } from "@/lib/format"
import { company } from "@/lib/brand"

// eslint-disable-next-line react-refresh/only-export-components
export function useGlassConnection(clientId: string) {
  return useQuery({ queryKey: ["glass-connection", clientId], queryFn: () => getGlassConnection(clientId) })
}

function GlassStatusPill({ connection }: { connection: GlassConnection }) {
  switch (connection.status) {
    case "ok":
      return <StatusPill tone="ok" icon={<CheckCircle2 />}>Connected</StatusPill>
    case "invalid":
      return <StatusPill tone="bad" icon={<XCircle />}>Key not accepted</StatusPill>
    case "past_due":
      return <StatusPill tone="bad" icon={<AlertTriangle />}>Glass account unpaid</StatusPill>
    case "error":
      return <StatusPill tone="warn" icon={<AlertTriangle />}>Could not check</StatusPill>
    case "unchecked":
      return <StatusPill tone="info" icon={<Clock />}>Not checked yet</StatusPill>
    default:
      return <StatusPill tone="warn" icon={<KeyRound />}>Waiting for a key</StatusPill>
  }
}

/**
 * What to do about a connection that is not working. The same screen is shown
 * to the client and, inside the client's file, to Divigner staff, so the
 * wording depends on who is reading: `clientName` is set for staff.
 */
function statusHelp(status: GlassConnection["status"], clientName?: string): string | undefined {
  switch (status) {
    case "invalid":
      return clientName
        ? `Glass Health did not accept this key. ${clientName} needs to create a new key in their Glass account, and it can be entered here.`
        : "Glass Health did not accept this key. Create a new key in your Glass account and enter it here."
    case "past_due":
      return clientName
        ? `Glass Health says the subscription on this account is unpaid, so ${clientName}'s avatars cannot look anything up. Once it is settled in their Glass account, check the connection again.`
        : "Glass Health says the subscription on this account is unpaid, so your avatars cannot look anything up. Settle it in your Glass account, then check the connection again."
    case "no_key":
      return clientName ? `${clientName}'s avatars cannot look anything up until a key is entered.` : "Your avatars cannot look anything up until a key is entered."
  }
}

/**
 * The client's Glass Health connection: whether it is on, whether the key
 * works, and the form to enter a key. The key is write-only: once saved, only
 * its last four characters are ever shown.
 */
export function GlassConnectionCard({ client }: { client: Client }) {
  const { access, can } = useAuth()
  const id = useId()
  const queryClient = useQueryClient()
  const connection = useGlassConnection(client.id)
  const [key, setKey] = useState("")
  const [confirming, setConfirming] = useState<"remove" | "off" | null>(null)
  const staff = access?.side === "divigner"
  const manage = can("glass.manage")

  const done = (message: string) => (next?: GlassConnection | null | void) => {
    if (next !== undefined) queryClient.setQueryData(["glass-connection", client.id], next ?? null)
    void queryClient.invalidateQueries({ queryKey: ["glass-connection", client.id] })
    setConfirming(null)
    toast.success(message)
  }
  const fail = (err: Error) => toast.error(err.message)
  const enable = useMutation({ mutationFn: (on: boolean) => setGlassEnabled(client.id, on), onSuccess: (_d, on) => done(on ? "Glass Health is turned on." : "Glass Health is turned off.")(), onError: fail })
  const save = useMutation({
    mutationFn: () => saveGlassKey(client.id, key),
    onSuccess: (next) => {
      setKey("")
      done(next?.status === "ok" ? "Key saved. Glass Health accepted it." : "Key saved.")(next)
    },
    onError: fail,
  })
  const check = useMutation({ mutationFn: () => checkGlassKey(client.id), onSuccess: (next) => done(next?.status === "ok" ? "Glass Health accepted the key." : "Checked.")(next), onError: fail })
  const remove = useMutation({ mutationFn: () => removeGlassKey(client.id), onSuccess: (next) => done("Key removed.")(next), onError: fail })

  if (connection.isPending) return <LoadingBlock label="Loading the Glass Health connection" />
  if (connection.isError) return <ErrorBlock error={connection.error} onRetry={() => void connection.refetch()} />

  const c = connection.data
  if (!c) {
    return (
      <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
        <h2 id={`${id}-title`} className="text-lg font-semibold">Glass Health Is Not Turned On</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Glass Health lets a clinical avatar look up published medical evidence during a call. It uses {staff ? `${client.name}'s` : "your"} own Glass Health account, and every question is counted here.
          {!staff && ` Ask ${company()} to turn it on.`}
        </p>
        {staff && manage && (
          <div><Button className="min-h-10" disabled={enable.isPending} onClick={() => enable.mutate(true)}>{enable.isPending ? "Turning on…" : "Turn on Glass Health"}</Button></div>
        )}
      </section>
    )
  }

  const hasKey = c.status !== "no_key"
  const help = statusHelp(c.status, staff ? client.name : undefined)
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">Connection</h2>
        <GlassStatusPill connection={c} />
      </div>

      {hasKey ? (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div><dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Key</dt><dd className="font-mono">Ends in {c.key_hint}</dd></div>
          <div><dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Last Checked</dt><dd>{c.checked_at ? timeAgo(c.checked_at) : "Not yet"}</dd></div>
          <div><dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Last Used by an Avatar</dt><dd>{c.last_used_at ? timeAgo(c.last_used_at) : "Not yet"}</dd></div>
        </dl>
      ) : null}
      {(help || c.status_detail) && (
        <p role="status" className="max-w-prose text-sm">{help ?? c.status_detail}</p>
      )}

      {manage ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (key.trim()) save.mutate()
          }}
        >
          <div className="flex max-w-md flex-col gap-1.5">
            <Label htmlFor={`${id}-key`}>{hasKey ? "Replace the Key" : "Glass Health Key"}</Label>
            <Input
              id={`${id}-key`}
              type="password"
              name="glass-health-key"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              className="min-h-10 font-mono"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              aria-describedby={`${id}-key-help`}
            />
            <p id={`${id}-key-help`} className="text-sm text-muted-foreground">
              {staff
                ? `Paste a key created in ${client.name}'s Glass Health account, under API settings. It is stored encrypted and is never shown again, to the client or to ${company()}.`
                : `Create a key in your Glass Health account, under API settings, and paste it here. It is stored encrypted and is never shown again, to you or to ${company()}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-10" disabled={!key.trim() || save.isPending}>{save.isPending ? "Saving and checking…" : hasKey ? "Replace key" : "Save key"}</Button>
            {hasKey && <Button type="button" variant="outline" className="min-h-10" disabled={check.isPending} onClick={() => check.mutate()}>{check.isPending ? "Checking…" : "Check connection"}</Button>}
            {hasKey && <Button type="button" variant="outline" className="min-h-10" onClick={() => setConfirming("remove")}>Remove key</Button>}
            {staff && <Button type="button" variant="outline" className="min-h-10" onClick={() => setConfirming("off")}>Turn off Glass Health</Button>}
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{staff ? "You do not have permission to enter or change the key." : "Only an account admin can enter or change the key."}</p>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming === "off" ? `Turn Off Glass Health for ${client.name}?` : "Remove the Glass Health Key?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "off"
                ? "The stored key is deleted and the avatars can no longer look anything up. Usage already recorded stays in the reports."
                : "The avatars can no longer look anything up until a new key is entered. Usage already recorded stays in the reports. The key is not changed in the Glass account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-10">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-10"
              disabled={remove.isPending || enable.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (confirming === "off") enable.mutate(false)
                else remove.mutate()
              }}
            >
              {confirming === "off" ? "Turn off" : "Remove key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** "24.9K tokens · about $2.58", the line under a count of questions. */
function glassNote(t: GlassTotals): string {
  const tokens = `${compact(t.input_tokens + t.output_tokens)} tokens`
  return t.cost_cents == null ? tokens : `${tokens} · about ${estimate(t.cost_cents)}`
}

/**
 * Glass use for this month, quarter and year, to sit beside the talk-time
 * totals. Renders nothing for a client that has never used Glass.
 */
export function GlassSummary({ client, today, moreHref }: { client: Client; today: string; moreHref?: string }) {
  const connection = useGlassConnection(client.id)
  const year = presetRange("year", today)
  const days = useQuery({ queryKey: ["glass-by-day", client.id, year.from, year.to], queryFn: () => glassUsageByDay(client.id, year) })
  const rows = days.data ?? []
  if (!connection.data && rows.length === 0) return null

  const month = sumGlass(rows.filter((r) => r.usage_date >= startOfMonth(today)))
  const quarter = sumGlass(rows.filter((r) => r.usage_date >= startOfQuarter(today)))
  const all = sumGlass(rows)
  return (
    <section aria-labelledby="glass-summary-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="glass-summary-heading" className="text-2xl font-semibold">Glass Health Your Avatars Have Used</h2>
        {moreHref && <Link to={moreHref} className="inline-flex min-h-8 items-center text-sm font-medium text-primary-text underline">See Glass Health usage</Link>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="This Month" value={count(month.questions)} unit={month.questions === 1 ? "question" : "questions"} note={`${formatDay(startOfMonth(today))} to today · ${glassNote(month)}`} />
        <Stat label="This Quarter" value={count(quarter.questions)} unit={quarter.questions === 1 ? "question" : "questions"} note={`${formatDay(startOfQuarter(today))} to today · ${glassNote(quarter)}`} />
        <Stat label="This Year" value={count(all.questions)} unit={all.questions === 1 ? "question" : "questions"} note={`${formatDay(year.from)} to today · ${glassNote(all)}`} />
      </div>
    </section>
  )
}

/** Glass use for a chosen period: totals, a chart over time, and each avatar's share beside its talk time. */
export function GlassUsage({ client }: { client: Client }) {
  const { access } = useAuth()
  // Divigner staff read this inside the client's file, so it names the client instead of saying "your".
  const staff = access?.side === "divigner"
  const today = todayIn(client.timezone)
  const [state, setState] = useState<RangeState>({ preset: "month", range: presetRange("month", today) })
  const { range } = state
  const avatars = useQuery({ queryKey: ["avatars-ever", client.id], queryFn: () => listAvatarsEver(client.id) })
  const byDay = useQuery({ queryKey: ["glass-by-day", client.id, range.from, range.to], queryFn: () => glassUsageByDay(client.id, range) })
  const byAvatar = useQuery({ queryKey: ["glass-by-avatar", client.id, range.from, range.to], queryFn: () => glassUsageByAvatar(client.id, range) })
  const talk = useQuery({ queryKey: ["usage-by-avatar", client.id, range.from, range.to], queryFn: () => usageByAvatar(client.id, range) })

  const failed = [avatars, byDay, byAvatar, talk].find((q) => q.isError)
  if (failed) return <ErrorBlock error={failed.error} onRetry={() => void failed.refetch()} />
  if (avatars.isPending || byDay.isPending || byAvatar.isPending || talk.isPending) return <LoadingBlock label="Loading Glass Health usage" />

  const days = byDay.data ?? []
  const glassBy = byAvatar.data ?? new Map<string, GlassTotals>()
  const talkBy = talk.data ?? new Map()
  const total = sumGlass(days)
  const rangeText = formatRange(range)
  const columns = bucketColumns(range, new Map(days.map((r) => [r.usage_date, r.questions])), 1)
  const used = (avatars.data ?? []).filter((a) => glassBy.has(a.id) || !a.unlinked_at)
  const each = (id: string) => glassBy.get(id) ?? sumGlass([])

  return (
    <section aria-labelledby="glass-usage-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h2 id="glass-usage-heading" className="text-2xl font-semibold">Usage</h2>
        <DateRangeControl value={state} onChange={setState} today={today} />
        <p role="status" className="text-sm text-muted-foreground">
          Showing {rangeText}: <strong className="text-foreground">{count(total.questions)} {total.questions === 1 ? "question" : "questions"}</strong> sent to Glass Health by {staff ? `${client.name}'s` : "your"} avatars.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat highlight label="Questions Answered" value={count(total.questions)} note={total.failed > 0 ? `${count(total.failed)} more could not be answered` : staff ? "Each one is a request on the client's Glass account" : "Each one is a request on your Glass account"} />
        <Stat label="Tokens" value={compact(total.input_tokens + total.output_tokens)} note={`${count(total.input_tokens)} in · ${count(total.output_tokens)} out`} />
        <Stat label="Estimated Cost" value={estimate(total.cost_cents)} note={total.cost_cents == null ? (staff ? "Shown once the Glass rates are entered in settings" : `Shown once Glass rates are entered by ${company()}`) : "From the token counts Glass reported"} />
        <Stat label="Time Waiting on Glass" value={duration(total.duration_ms / 1000)} note={total.questions ? `About ${Math.round(total.duration_ms / 1000 / (total.questions + total.failed))} seconds a question` : "While Glass searched and answered"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Glass Questions Over Time"
          subtitle={`${GRAIN_LABEL[grainFor(range)]} · ${rangeText}`}
          chart={<Columns columns={columns} unit="questions" color={seriesColor(1)} label="Glass questions over time" />}
          table={<DataTable caption={`Glass questions over time, ${rangeText}`} head={["Period", "Questions"]} rows={columns.map((col) => [col.longLabel, Math.round(col.value)])} />}
        />
        <section aria-labelledby="glass-by-avatar-heading" className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
          <div>
            <h3 id="glass-by-avatar-heading" className="font-sans text-base font-semibold">Glass Health Beside Talk Time, by Avatar</h3>
            <p className="text-sm text-muted-foreground">{rangeText}</p>
          </div>
          <div className="overflow-x-auto">
            <DataTable
              caption={`Talk time and Glass Health use by avatar, ${rangeText}`}
              head={["Avatar", "Talk Minutes", "Glass Questions", "Tokens", "Estimated Cost"]}
              rows={used.map((a) => [<AvatarName key={a.id} avatar={a} />, minutes(talkBy.get(a.id)?.billable_seconds), count(each(a.id).questions), count(each(a.id).input_tokens + each(a.id).output_tokens), estimate(each(a.id).cost_cents)])}
            />
          </div>
        </section>
      </div>

      <p className="max-w-prose text-sm text-muted-foreground">
        {staff
          ? `${client.name}'s Glass Health account shows everything used on it. This page shows the part their avatars used, so the difference is anything else on that account.`
          : "Your Glass Health account shows everything used on it. This page shows the part your avatars used, so the difference is anything else on that account."}{" "}
        Glass charges by the question, in tokens, so this is counted in questions and tokens rather than minutes.
      </p>
    </section>
  )
}
