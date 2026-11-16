import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { ClientStatusPill } from "@/components/StatusPill"
import { listAvatars, listClients, usageByClient } from "@/lib/api"
import { browserToday, presetRange } from "@/lib/dates"
import { count, minutes } from "@/lib/format"

/** Every client the signed-in person can see, with talk time today and this month. */
export function ClientsTable({ filter = "", empty }: { filter?: string; empty?: React.ReactNode }) {
  const today = browserToday()
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients })
  const avatars = useQuery({ queryKey: ["avatars", "all"], queryFn: () => listAvatars() })
  const todayUsage = useQuery({ queryKey: ["usage-by-client", "today", today], queryFn: () => usageByClient(presetRange("today", today)) })
  const monthUsage = useQuery({ queryKey: ["usage-by-client", "month", today], queryFn: () => usageByClient(presetRange("month", today)) })

  if (clients.isPending) return <LoadingBlock label="Loading clients" />
  if (clients.isError) return <ErrorBlock error={clients.error} onRetry={() => void clients.refetch()} />

  const needle = filter.trim().toLowerCase()
  const rows = clients.data.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.slug.includes(needle))
  if (clients.data.length === 0) return <>{empty ?? <EmptyState title="No clients yet" />}</>
  if (rows.length === 0) return <EmptyState title="No clients match">Try a different name.</EmptyState>

  const avatarCount = (clientId: string) => (avatars.data ?? []).filter((a) => a.client_id === clientId).length

  return (
    <div className="relative overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Clients, with talk time today and this month</caption>
        <thead>
          <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
            <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Client</th>
            <th scope="col" className="hidden px-4 py-2.5 font-semibold tracking-wide sm:table-cell">Status</th>
            <th scope="col" className="hidden px-4 py-2.5 text-right font-semibold tracking-wide md:table-cell">Avatars</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide">Today</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold tracking-wide">This month</th>
            <th scope="col" className="hidden px-4 py-2.5 text-right font-semibold tracking-wide lg:table-cell">Calls this month</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
              <th scope="row" className="px-4 py-3 text-left font-medium">
                <Link to={`/admin/clients/${c.slug}`} className="text-primary-text hover:underline">{c.name}</Link>
                <span className="mt-1 block sm:hidden"><ClientStatusPill status={c.status} /></span>
              </th>
              <td className="hidden px-4 py-3 sm:table-cell"><ClientStatusPill status={c.status} /></td>
              <td className="tabular hidden px-4 py-3 text-right md:table-cell">{avatarCount(c.id)}</td>
              <td className="tabular px-4 py-3 text-right">{minutes(todayUsage.data?.get(c.id)?.billable_seconds)} min</td>
              <td className="tabular px-4 py-3 text-right font-semibold">{minutes(monthUsage.data?.get(c.id)?.billable_seconds)} min</td>
              <td className="tabular hidden px-4 py-3 text-right lg:table-cell">{count(monthUsage.data?.get(c.id)?.conversations)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
