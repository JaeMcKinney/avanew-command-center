import { useQuery } from "@tanstack/react-query"
import { TableScroll } from "@/components/TableScroll"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { listAudit, listClients, listProfiles, type AuditEntry } from "@/lib/api"
import { formatDateTime } from "@/lib/dates"

const ACTIONS: Record<string, string> = {
  "client.created": "Created a client",
  "avatar.linked": "Linked an avatar",
  "avatar.unlinked": "Unlinked an avatar",
  "user.invited": "Invited a user",
  "user.activated": "Restored a user's access",
  "user.deactivated": "Removed a user's access",
  "user.role_changed": "Changed a user's role",
  "user.assignments_changed": "Changed a user's assigned clients",
  "tavus.synced": "Refreshed the Tavus list",
}

function detailText(entry: AuditEntry): string {
  const d = (entry.detail ?? {}) as Record<string, unknown>
  return [d.name, d.email, d.role && `role: ${d.role}`, d.pal_id, d.pals != null && `${d.pals} avatars`].filter(Boolean).join(" · ")
}

export default function Activity() {
  const log = useQuery({ queryKey: ["audit"], queryFn: () => listAudit(200) })
  const people = useQuery({ queryKey: ["profiles", "divigner"], queryFn: () => listProfiles({ side: "divigner" }) })
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients })
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const who = (id: string | null) => people.data?.find((p) => p.id === id)?.full_name || people.data?.find((p) => p.id === id)?.email || (id ? "A client user" : "The system")

  return (
    <>
      <PageHeader title="Activity" description="Who changed what. The newest 200 entries." />
      {log.isPending ? (
        <LoadingBlock label="Loading activity" />
      ) : log.isError ? (
        <ErrorBlock error={log.error} onRetry={() => void log.refetch()} />
      ) : log.data.length === 0 ? (
        <EmptyState title="Nothing Yet">Changes to clients, avatars and users will be listed here.</EmptyState>
      ) : (
        <TableScroll label="Activity table" className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Activity log</caption>
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">When</th>
                <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Who</th>
                <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">What</th>
                <th scope="col" className="hidden px-4 py-2.5 font-semibold tracking-wide sm:table-cell">Client</th>
              </tr>
            </thead>
            <tbody>
              {log.data.map((entry) => (
                <tr key={entry.id} className="border-b align-top last:border-0">
                  <td className="tabular px-4 py-3 whitespace-nowrap">{formatDateTime(entry.created_at, zone)}</td>
                  <td className="px-4 py-3">{who(entry.actor_id)}</td>
                  <td className="px-4 py-3">
                    {ACTIONS[entry.action] ?? entry.action}
                    <span className="block text-xs break-all text-muted-foreground">{detailText(entry)}</span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{clients.data?.find((c) => c.id === entry.client_id)?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </>
  )
}
