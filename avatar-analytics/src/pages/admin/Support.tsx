import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LifeBuoy } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { Stat } from "@/components/Stat"
import { NewTicketDialog, NoTickets, TicketList, TicketThread } from "@/components/Support"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { getTicket, listClients, listTickets, type Client } from "@/lib/api"
import { count } from "@/lib/format"
import { cn } from "@/lib/utils"
import { COMPANY } from "@/lib/edition"

const VIEWS = [
  { key: "open", label: "Needs Reply" },
  { key: "waiting", label: "Waiting on Client" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
] as const
type View = (typeof VIEWS)[number]["key"]

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * The Divigner support desk: every client's tickets in one queue. Inside a
 * client's file (pass `client` and `embedded`) it shows that client's only.
 */
export default function SupportDesk({ client, embedded = false }: { client?: Client; embedded?: boolean } = {}) {
  const id = useId()
  const { access } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [opening, setOpening] = useState(false)
  const [mine, setMine] = useState(false)
  const view = (VIEWS.find((v) => v.key === params.get("view"))?.key ?? "open") as View
  const clientFilter = client?.id ?? params.get("client") ?? ""
  const tickets = useQuery({ queryKey: ["tickets", client?.id ?? "all"], queryFn: () => listTickets(client?.id) })
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients, enabled: !client })

  const all = useMemo(() => tickets.data ?? [], [tickets.data])
  const scoped = all.filter((t) => (!clientFilter || t.client_id === clientFilter) && (!mine || t.assignee_id === access?.user_id))
  const shown = scoped.filter((t) => view === "all" || t.status === view)
  const live = scoped.filter((t) => t.status !== "resolved")
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      {!embedded && (
        <PageHeader
          title="Support Desk"
          description="Every client's tickets. Answer them here: the client is emailed each reply, and the whole thread stays in Avalytics."
          actions={<Button className="min-h-10" onClick={() => setOpening(true)}><LifeBuoy aria-hidden="true" />New ticket</Button>}
        />
      )}
      {embedded && client && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-sm text-muted-foreground">Tickets from {client.name}. Open one to answer it or add an internal note.</p>
          <Button variant="outline" className="min-h-10" onClick={() => setOpening(true)}><LifeBuoy aria-hidden="true" />New ticket</Button>
        </div>
      )}
      {tickets.isPending ? (
        <LoadingBlock label="Loading tickets" />
      ) : tickets.isError ? (
        <ErrorBlock error={tickets.error} onRetry={() => void tickets.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Needs Reply" value={count(live.filter((t) => t.status === "open").length)} note={`Waiting on ${COMPANY}`} />
            <Stat label="Urgent" value={count(live.filter((t) => t.priority === "urgent").length)} note="Open and marked urgent" />
            <Stat label="Unassigned" value={count(live.filter((t) => !t.assignee_id).length)} note="Open with nobody on it" />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div role="group" aria-label="Which tickets to show" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setParam("view", v.key === "open" ? "" : v.key)}
                  className={cn("min-h-9 rounded-md px-3 text-sm font-medium", view === v.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {v.label} ({count(v.key === "all" ? scoped.length : scoped.filter((t) => t.status === v.key).length)})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              {!client && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-client`}>Client</Label>
                  <select id={`${id}-client`} value={clientFilter} onChange={(e) => setParam("client", e.target.value)} className="min-h-10 rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="">All clients</option>
                    {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex min-h-10 items-center gap-2">
                <Checkbox id={`${id}-mine`} className="size-5" checked={mine} onCheckedChange={(on) => setMine(on === true)} />
                <Label htmlFor={`${id}-mine`}>Assigned to me</Label>
              </div>
            </div>
          </div>
          <TicketList tickets={shown} viewer="divigner" showClient={!client} linkTo={(t) => `/admin/support/${t.number}`} empty={<NoTickets viewer="divigner" />} />
        </>
      )}
      {opening && (
        <NewTicketDialog
          client={client}
          clients={clients.data}
          onClose={(ticket) => {
            setOpening(false)
            if (ticket) {
              void queryClient.invalidateQueries({ queryKey: ["tickets"] })
              navigate(`/admin/support/${ticket.number}`)
            }
          }}
        />
      )}
    </>
  )
}

export function SupportDeskTicket() {
  const { number = "" } = useParams()
  const ticket = useQuery({ queryKey: ["ticket", Number(number)], queryFn: () => getTicket(Number(number)), enabled: /^\d+$/.test(number) })
  const back = { to: "/admin/support", label: "Support desk" }

  if (!/^\d+$/.test(number)) return <Navigate to={back.to} replace />
  if (ticket.isPending) return <LoadingBlock label="Loading ticket" />
  if (ticket.isError) return <ErrorBlock error={ticket.error} onRetry={() => void ticket.refetch()} />
  if (!ticket.data) {
    return <><PageHeader title="Ticket Not Found" back={back} /><EmptyState title="This Ticket Is Not Available">It may belong to a client you are not assigned to, or the number may be wrong.</EmptyState></>
  }
  const t = ticket.data
  return (
    <>
      <PageHeader
        title={`Ticket #${t.number}: ${t.subject}`}
        description={t.clients && <>From <Link to={`/admin/clients/${t.clients.slug}`} className="font-medium text-primary-text hover:underline">{t.clients.name}</Link></>}
        back={back}
      />
      <TicketThread ticket={t} timeZone={browserZone()} onChanged={() => void ticket.refetch()} />
    </>
  )
}
