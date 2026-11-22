import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LifeBuoy } from "lucide-react"
import { useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { NewTicketDialog, NoTickets, TicketList, TicketThread } from "@/components/Support"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { getTicket, listTickets } from "@/lib/api"
import { usePortalClient } from "@/pages/portal/PortalLayout"
import { COMPANY } from "@/lib/edition"

/** The client's side of the support desk: their tickets, and a way to open one. */
export default function Support() {
  const client = usePortalClient()
  const { access, can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [opening, setOpening] = useState(false)
  const staff = access?.side === "divigner"
  const tickets = useQuery({ queryKey: ["tickets", client.id], queryFn: () => listTickets(client.id) })
  const linkTo = (number: number) => (staff ? `/admin/support/${number}` : `/c/${client.slug}/support/${number}`)
  const canOpen = staff ? can("support.manage") : can("support.use")

  return (
    <>
      <PageHeader
        title="Support"
        description={`Ask the ${COMPANY} team for help, report a problem or request a change to your avatar. Every reply is kept here, so nothing gets lost in email.`}
        actions={canOpen && <Button className="min-h-10" onClick={() => setOpening(true)}><LifeBuoy aria-hidden="true" />New ticket</Button>}
      />
      {tickets.isPending ? (
        <LoadingBlock label="Loading tickets" />
      ) : tickets.isError ? (
        <ErrorBlock error={tickets.error} onRetry={() => void tickets.refetch()} />
      ) : (
        <TicketList tickets={tickets.data} viewer="client" linkTo={(t) => linkTo(t.number)} empty={<NoTickets viewer="client" />} />
      )}
      {opening && (
        <NewTicketDialog
          client={client}
          onClose={(ticket) => {
            setOpening(false)
            if (ticket) {
              void queryClient.invalidateQueries({ queryKey: ["tickets"] })
              navigate(linkTo(ticket.number))
            }
          }}
        />
      )}
    </>
  )
}

export function SupportTicket() {
  const client = usePortalClient()
  const { access } = useAuth()
  const { number = "" } = useParams()
  const ticket = useQuery({ queryKey: ["ticket", Number(number)], queryFn: () => getTicket(Number(number)), enabled: /^\d+$/.test(number) })
  const back = { to: `/c/${client.slug}/support`, label: "All tickets" }

  // Staff answer tickets on the support desk, where the internal notes are.
  if (access?.side === "divigner") return <Navigate to={`/admin/support/${number}`} replace />
  if (!/^\d+$/.test(number)) return <Navigate to={back.to} replace />
  if (ticket.isPending) return <LoadingBlock label="Loading ticket" />
  if (ticket.isError) return <ErrorBlock error={ticket.error} onRetry={() => void ticket.refetch()} />
  if (!ticket.data || ticket.data.client_id !== client.id) {
    return <><PageHeader title="Ticket Not Found" back={back} /><EmptyState title="This Ticket Is Not Available">It may belong to another account, or the number may be wrong.</EmptyState></>
  }
  return (
    <>
      <PageHeader title={`Ticket #${ticket.data.number}: ${ticket.data.subject}`} back={back} />
      <TicketThread ticket={ticket.data} timeZone={client.timezone} onChanged={() => void ticket.refetch()} />
    </>
  )
}
