import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { AvatarPhoto } from "@/components/AvatarPhoto"
import { ChartCard, Columns, DataTable, Donut, type Slice } from "@/components/Charts"
import { DateRangeControl, type RangeState } from "@/components/DateRangeControl"
import { GlassSummary } from "@/components/Glass"
import { Stat } from "@/components/Stat"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { listAvatars, sumUsage, usageByAvatar, usageByDay, type Client } from "@/lib/api"
import { bucketColumns, GRAIN_LABEL, grainFor } from "@/lib/buckets"
import { MAX_SERIES, seriesColor } from "@/lib/chartColors"
import { formatDay, formatRange, presetRange, startOfMonth, startOfQuarter, todayIn } from "@/lib/dates"
import { count, duration, minutes, percent } from "@/lib/format"
import { useDocumentTitle } from "@/hooks/useDocumentTitle"
import { usePortalClient } from "@/pages/portal/PortalLayout"
import { company } from "@/lib/brand"

/** Shown in the client's portal, and inside the client's file for Divigner staff (pass `client` and `embedded`). */
export default function Dashboard({ client: given, embedded = false }: { client?: Client; embedded?: boolean } = {}) {
  const fromPortal = usePortalClient()
  const client = given ?? fromPortal
  useDocumentTitle(embedded ? client.name : `${client.name} dashboard`)
  const today = todayIn(client.timezone)
  const [state, setState] = useState<RangeState>({ preset: "month", range: presetRange("month", today) })
  const { range } = state

  const avatars = useQuery({ queryKey: ["avatars", client.id], queryFn: () => listAvatars(client.id) })
  const year = presetRange("year", today)
  const yearDays = useQuery({ queryKey: ["usage-by-day", client.id, year.from, year.to], queryFn: () => usageByDay(client.id, year) })
  const byAvatar = useQuery({ queryKey: ["usage-by-avatar", client.id, range.from, range.to], queryFn: () => usageByAvatar(client.id, range) })
  const byDay = useQuery({ queryKey: ["usage-by-day", client.id, range.from, range.to], queryFn: () => usageByDay(client.id, range) })

  if (avatars.isPending || yearDays.isPending) return <LoadingBlock label="Loading your dashboard" />
  const failed = [avatars, yearDays, byAvatar, byDay].find((q) => q.isError)
  if (failed) return <ErrorBlock error={failed.error} onRetry={() => void failed.refetch()} />

  const yearRows = yearDays.data ?? []
  const month = sumUsage(yearRows.filter((r) => r.usage_date >= startOfMonth(today)))
  const quarter = sumUsage(yearRows.filter((r) => r.usage_date >= startOfQuarter(today)))
  const yearTotal = sumUsage(yearRows)

  // Each avatar keeps its colour whatever the date range, by its place in the list.
  const list = avatars.data ?? []
  const usage = byAvatar.data ?? new Map()
  const secondsFor = (id: string) => Number(usage.get(id)?.billable_seconds ?? 0)
  const named: Slice[] = list.slice(0, MAX_SERIES).map((a, i) => ({ id: a.id, label: a.display_name, value: secondsFor(a.id) / 60, color: seriesColor(i) }))
  const restSeconds = [...usage.entries()].filter(([id]) => !list.slice(0, MAX_SERIES).some((a) => a.id === id)).reduce((sum, [, u]) => sum + Number(u.billable_seconds), 0)
  const slices = restSeconds > 0 ? [...named, { id: "other", label: "Other Avatars", value: restSeconds / 60, color: seriesColor(-1) }] : named
  const rangeTotal = sumUsage(usage.values())
  const totalMinutes = rangeTotal.billable_seconds / 60
  const columns = bucketColumns(range, new Map((byDay.data ?? []).map((r) => [r.usage_date, Number(r.billable_seconds)])))
  const rangeText = formatRange(range)

  return (
    <>
      {!embedded && <h1 className="sr-only">{client.name} Dashboard</h1>}

      <section aria-labelledby="talk-time-heading" className="flex flex-col gap-3">
        <h2 id="talk-time-heading" className="text-2xl font-semibold">Talk Time You Have Used</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat hero highlight label="This Month" value={minutes(month.billable_seconds)} unit="min" note={`${formatDay(startOfMonth(today))} to today · ${count(month.conversations)} conversations`} />
          <Stat hero label="This Quarter" value={minutes(quarter.billable_seconds)} unit="min" note={`${formatDay(startOfQuarter(today))} to today · ${count(quarter.conversations)} conversations`} />
          <Stat hero label="This Year" value={minutes(yearTotal.billable_seconds)} unit="min" note={`${formatDay(year.from)} to today · ${count(yearTotal.conversations)} conversations`} />
        </div>
      </section>

      <GlassSummary client={client} today={today} moreHref={embedded ? undefined : `/c/${client.slug}/glass`} />

      {list.length === 0 ? (
        <EmptyState title="Your Avatars Are Being Set Up">
          Once {company()} links your avatars, you will see them here, with how much talk time each one has used.
        </EmptyState>
      ) : (
        <section aria-labelledby="period-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <h2 id="period-heading" className="text-2xl font-semibold">Explore a Period</h2>
            <DateRangeControl value={state} onChange={setState} today={today} />
            <p role="status" className="text-sm text-muted-foreground">
              Showing {rangeText}: <strong className="text-foreground">{minutes(rangeTotal.billable_seconds)} min</strong> across {count(rangeTotal.conversations)} conversations.
            </p>
          </div>

          <ul aria-label="Your avatars" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a, i) => (
              <li key={a.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                <AvatarPhoto name={a.display_name} src={a.custom_photo_url ?? a.photo_url} size="lg" ring={seriesColor(i < MAX_SERIES ? i : -1)} />
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold break-words">{a.display_name}</p>
                  {a.role_label && <p className="text-sm text-muted-foreground">{a.role_label}</p>}
                  <p className="tabular mt-1 text-sm">
                    <strong className="text-base">{minutes(secondsFor(a.id))} min</strong>
                    <span className="text-muted-foreground"> · {percent(secondsFor(a.id), rangeTotal.billable_seconds)} · {count(usage.get(a.id)?.conversations)} calls</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Talk Time by Avatar"
              subtitle={rangeText}
              chart={<Donut slices={slices} centerValue={Math.round(totalMinutes).toLocaleString("en-US")} centerLabel="minutes" unit="min" />}
              table={
                <DataTable
                  caption={`Talk time by avatar, ${rangeText}`}
                  head={["Avatar", "Minutes", "Share", "Conversations"]}
                  rows={list.map((a) => [a.display_name, minutes(secondsFor(a.id)), percent(secondsFor(a.id), rangeTotal.billable_seconds), count(usage.get(a.id)?.conversations)])}
                />
              }
            />
            <ChartCard
              title="Talk Time Over Time"
              subtitle={`${GRAIN_LABEL[grainFor(range)]}, in minutes · ${rangeText}`}
              chart={byDay.isPending ? <LoadingBlock /> : <Columns columns={columns} unit="min" color={seriesColor(0)} />}
              table={<DataTable caption={`Talk time over time, ${rangeText}`} head={["Period", "Minutes"]} rows={columns.map((col) => [col.longLabel, Math.round(col.value)])} />}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Conversations" value={count(rangeTotal.conversations)} note={rangeText} />
            <Stat label="Average Call" value={rangeTotal.conversations ? duration(rangeTotal.talk_seconds / rangeTotal.conversations) : "—"} note="From the avatar joining to the call ending" />
            <Stat label="Avatars" value={count(list.length)} />
          </div>
        </section>
      )}
    </>
  )
}
