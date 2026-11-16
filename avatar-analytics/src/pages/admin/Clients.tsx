import { useQuery } from "@tanstack/react-query"
import { Mail, Phone, Plus, Search } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { Stat } from "@/components/Stat"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { ClientStatusPill, StatusPill } from "@/components/StatusPill"
import { TableScroll } from "@/components/TableScroll"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { listContacts, listCrmClients, type CrmClient } from "@/lib/api"
import { timeAgo } from "@/lib/dates"
import { count, money } from "@/lib/format"

const STATUSES = [["", "Any status"], ["active", "Active"], ["onboarding", "Setting up"], ["paused", "Paused"], ["cancelled", "Cancelled"]] as const
const th = "px-4 py-2.5 font-semibold tracking-wide"

function ClientLogo({ client }: { client: CrmClient }) {
  if (client.logo_url) return <img src={client.logo_url} alt="" className="h-8 w-14 shrink-0 object-contain" />
  return <span aria-hidden="true" className="grid h-8 w-14 shrink-0 place-items-center rounded-sm bg-muted font-display text-sm font-semibold">{client.name.slice(0, 1).toUpperCase()}</span>
}

function ClientsView({ clients, canSeeMoney }: { clients: CrmClient[]; canSeeMoney: boolean }) {
  const [text, setText] = useState("")
  const [status, setStatus] = useState("")
  const needle = text.trim().toLowerCase()
  const rows = clients.filter((c) => (!status || c.status === status) && (!needle || [c.name, c.slug, c.industry, c.plan, c.account_manager, c.primary_contact?.full_name, c.primary_contact?.email].some((v) => v?.toLowerCase().includes(needle))))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full max-w-sm flex-col gap-1.5">
          <Label htmlFor="client-filter">Find a client</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="client-filter" type="search" value={text} onChange={(e) => setText(e.target.value)} className="min-h-10 pl-9" autoComplete="off" placeholder="Name, contact, package or industry" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client-status">Status</Label>
          <select id="client-status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-10 rounded-md border border-input bg-transparent px-3 text-sm">
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{count(rows.length)} of {count(clients.length)} client{clients.length === 1 ? "" : "s"}</p>
      {rows.length === 0 ? <EmptyState title="No clients match">Try a different word or status.</EmptyState> : (
        <TableScroll label="Clients table" className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Clients, with their package, main contact and recent activity</caption>
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <th scope="col" className={th}>Client</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={th}>Package</th>
                <th scope="col" className={th}>Main contact</th>
                <th scope="col" className={`${th} text-right`}>Avatars</th>
                <th scope="col" className={`${th} text-right`}>Minutes, 30 days</th>
                {canSeeMoney && <th scope="col" className={`${th} text-right`}>Paid to date</th>}
                <th scope="col" className={th}>Last call</th>
                <th scope="col" className={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b align-top last:border-0 hover:bg-muted/40">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    <span className="flex items-center gap-3">
                      <ClientLogo client={c} />
                      <span className="min-w-0">
                        <Link to={`/admin/clients/${c.slug}`} className="text-primary-text hover:underline">{c.name}</Link>
                        <span className="block text-xs font-normal text-muted-foreground">{[c.industry, c.account_manager && `with ${c.account_manager}`].filter(Boolean).join(" · ") || "No details yet"}</span>
                      </span>
                    </span>
                  </th>
                  <td className="px-4 py-3"><ClientStatusPill status={c.status} /></td>
                  <td className="px-4 py-3">
                    {c.plan ? <>{c.plan}{canSeeMoney && c.monthly_price_cents > 0 && <span className="tabular block text-xs text-muted-foreground">{money(c.monthly_price_cents)} a month</span>}</> : <span className="text-muted-foreground">None</span>}
                    {c.cancel_at_period_end && <span className="mt-1 block"><StatusPill tone="warn">Ending</StatusPill></span>}
                    {["past_due", "unpaid"].includes(c.billing_status) && <span className="mt-1 block"><StatusPill tone="bad">Payment needed</StatusPill></span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.primary_contact ? <>{c.primary_contact.full_name}{c.primary_contact.email && <span className="block text-xs break-all text-muted-foreground">{c.primary_contact.email}</span>}</> : <span className="text-muted-foreground">None</span>}
                  </td>
                  <td className="tabular px-4 py-3 text-right">{count(c.avatars)}</td>
                  <td className="tabular px-4 py-3 text-right">{count(Math.round(c.minutes_30d))}</td>
                  {canSeeMoney && <td className="tabular px-4 py-3 text-right">{money(c.paid_cents)}</td>}
                  <td className="px-4 py-3 whitespace-nowrap">{c.last_call_at ? timeAgo(c.last_call_at) : <span className="text-muted-foreground">Never</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.notes > 0 ? <>{count(c.notes)}<span className="block text-xs text-muted-foreground">latest {timeAgo(c.last_note_at)}</span></> : <span className="text-muted-foreground">None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  )
}

function ContactsView() {
  const contacts = useQuery({ queryKey: ["client-contacts", "all"], queryFn: () => listContacts() })
  const [text, setText] = useState("")
  if (contacts.isPending) return <LoadingBlock label="Loading contacts" />
  if (contacts.isError) return <ErrorBlock error={contacts.error} onRetry={() => void contacts.refetch()} />
  const needle = text.trim().toLowerCase()
  const rows = contacts.data.filter((c) => !needle || [c.full_name, c.title, c.email, c.phone, c.clients?.name].some((v) => v?.toLowerCase().includes(needle)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
  if (contacts.data.length === 0) return <EmptyState title="No contacts yet">Open a client and add the people you deal with there. They all appear here.</EmptyState>
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full max-w-sm flex-col gap-1.5">
        <Label htmlFor="contact-filter">Find a contact</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="contact-filter" type="search" value={text} onChange={(e) => setText(e.target.value)} className="min-h-10 pl-9" autoComplete="off" placeholder="Name, email or client" />
        </div>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{count(rows.length)} of {count(contacts.data.length)} contact{contacts.data.length === 1 ? "" : "s"}</p>
      {rows.length === 0 ? <EmptyState title="No contacts match">Try a different word.</EmptyState> : (
        <TableScroll label="Contacts table" className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Contacts at every client</caption>
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <th scope="col" className={th}>Name</th><th scope="col" className={th}>Client</th><th scope="col" className={th}>Email</th><th scope="col" className={th}>Phone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium">{c.full_name}{c.is_primary && <span className="ml-2 align-middle"><StatusPill tone="info">Main</StatusPill></span>}{c.title && <span className="block text-xs font-normal text-muted-foreground">{c.title}</span>}</th>
                  <td className="px-4 py-3">{c.clients ? <Link to={`/admin/clients/${c.clients.slug}`} className="text-primary-text hover:underline">{c.clients.name}</Link> : "—"}</td>
                  <td className="px-4 py-3">{c.email ? <a href={`mailto:${c.email}`} className="inline-flex min-h-6 items-center gap-1.5 break-all text-primary-text underline"><Mail className="size-4 shrink-0" aria-hidden="true" />{c.email}</a> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.phone ? <a href={`tel:${c.phone}`} className="inline-flex min-h-6 items-center gap-1.5 text-primary-text underline"><Phone className="size-4" aria-hidden="true" />{c.phone}</a> : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  )
}

/** Every client in one place: who they are, what they are on, who to talk to and what happened last. */
export default function Clients() {
  const { can } = useAuth()
  const clients = useQuery({ queryKey: ["crm-clients"], queryFn: listCrmClients })
  const canSeeMoney = can("finance.view")
  const newClient = can("clients.manage") && (
    <Button asChild className="min-h-10"><Link to="/admin/clients/new"><Plus aria-hidden="true" />New client</Link></Button>
  )
  const all = clients.data ?? []
  return (
    <>
      <PageHeader title="Clients" description="Every client in one view. Open one for their file: avatars, people, contacts, notes and details." actions={newClient} />
      {clients.isPending ? <LoadingBlock label="Loading clients" /> : clients.isError ? <ErrorBlock error={clients.error} onRetry={() => void clients.refetch()} /> : all.length === 0 ? (
        <EmptyState title="No clients yet" action={newClient}>Add a client to get started.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Clients" value={count(all.length)} note={`${count(all.filter((c) => c.status === "active").length)} active`} />
            <Stat label="On a package" value={count(all.filter((c) => c.plan && !["none", "cancelled"].includes(c.billing_status)).length)} note={`${count(all.filter((c) => c.cancel_at_period_end).length)} ending`} />
            <Stat label="Avatars linked" value={count(all.reduce((n, c) => n + c.avatars, 0))} />
            <Stat label="Need attention" value={count(all.filter((c) => c.status === "paused" || ["past_due", "unpaid"].includes(c.billing_status)).length)} note="Paused or payment needed" />
          </div>
          <Tabs defaultValue="clients" className="flex flex-col gap-4">
            <TabsList className="h-auto">
              <TabsTrigger value="clients" className="min-h-10 px-4">Clients ({count(all.length)})</TabsTrigger>
              <TabsTrigger value="contacts" className="min-h-10 px-4">Contacts ({count(all.reduce((n, c) => n + c.contacts, 0))})</TabsTrigger>
            </TabsList>
            <TabsContent value="clients"><ClientsView clients={all} canSeeMoney={canSeeMoney} /></TabsContent>
            <TabsContent value="contacts"><ContactsView /></TabsContent>
          </Tabs>
        </>
      )}
    </>
  )
}
