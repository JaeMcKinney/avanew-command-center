import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { ChartCard, Columns, DataTable } from "@/components/Charts"
import { ClientsTable } from "@/components/ClientsTable"
import { PageHeader } from "@/components/PageHeader"
import { Stat } from "@/components/Stat"
import { EmptyState } from "@/components/States"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { listAvatars, listClients, sumUsage, usageByDay } from "@/lib/api"
import { bucketColumns } from "@/lib/buckets"
import { browserToday, formatRange, presetRange, startOfMonth } from "@/lib/dates"
import { count, minutes } from "@/lib/format"
import { seriesColor } from "@/lib/chartColors"

export default function Overview() {
  const { can } = useAuth()
  const today = browserToday()
  const year = presetRange("year", today)
  const month = presetRange("month", today)
  const days = useQuery({ queryKey: ["usage-by-day", "all", year.from, year.to], queryFn: () => usageByDay(null, year) })
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients })
  const avatars = useQuery({ queryKey: ["avatars", "all"], queryFn: () => listAvatars() })

  const rows = days.data ?? []
  const todayTotal = sumUsage(rows.filter((r) => r.usage_date === today))
  const monthTotal = sumUsage(rows.filter((r) => r.usage_date >= startOfMonth(today)))
  const yearTotal = sumUsage(rows)
  const columns = bucketColumns(month, new Map(rows.map((r) => [r.usage_date, Number(r.billable_seconds)])))

  return (
    <>
      <PageHeader
        title="Overview"
        description="Talk time across every client you can see."
        actions={can("clients.manage") && (
          <Button asChild className="min-h-10"><Link to="/admin/clients/new"><Plus aria-hidden="true" />New client</Link></Button>
        )}
      />

      <section aria-label="Talk time" className="grid gap-3 sm:grid-cols-3">
        <Stat hero label="Today" value={minutes(todayTotal.billable_seconds)} unit="min" note={`${count(todayTotal.conversations)} conversations`} />
        <Stat hero highlight label="This Month" value={minutes(monthTotal.billable_seconds)} unit="min" note={`${count(monthTotal.conversations)} conversations`} />
        <Stat hero label="This Year" value={minutes(yearTotal.billable_seconds)} unit="min" note={`${count(yearTotal.conversations)} conversations`} />
      </section>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Clients" value={count(clients.data?.length)} />
        <Stat label="Avatars Linked" value={count(avatars.data?.length)} />
        <Stat label="Average Call This Month" value={monthTotal.conversations ? `${(monthTotal.talk_seconds / monthTotal.conversations / 60).toFixed(1)}` : "—"} unit={monthTotal.conversations ? "min" : undefined} />
      </section>

      <ChartCard
        title="Talk Time This Month"
        subtitle={`Minutes per day, all clients · ${formatRange(month)}`}
        chart={<Columns columns={columns} unit="min" color={seriesColor(0)} />}
        table={<DataTable caption="Talk time per day this month" head={["Day", "Minutes"]} rows={columns.map((c) => [c.longLabel, Math.round(c.value)])} />}
      />

      <section aria-labelledby="clients-heading" className="flex flex-col gap-3">
        <h2 id="clients-heading" className="text-xl font-semibold">Clients</h2>
        <ClientsTable
          empty={
            <EmptyState
              title="No Clients Yet"
              action={can("clients.manage") && <Button asChild className="min-h-10"><Link to="/admin/clients/new">Add your first client</Link></Button>}
            >
              Add a client, link their Tavus avatars, and their talk time will start showing here.
            </EmptyState>
          }
        />
      </section>
    </>
  )
}
