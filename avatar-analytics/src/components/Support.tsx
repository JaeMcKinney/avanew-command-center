// The support desk's shared pieces: the ticket list, the form that opens a
// ticket, and the thread. Clients and Divigner staff use the same pieces; what
// each may see and do is decided by the database, and the labels here change
// with who is looking.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Clock, Lock, Mail, MessageSquareReply, Paperclip, X } from "lucide-react"
import { useId, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CopyId } from "@/components/CopyId"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { TableScroll } from "@/components/TableScroll"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import {
  assignTicket, listSupportStaff, listTicketMessages, MAX_TICKET_FILE_BYTES, MAX_TICKET_FILES, openTicket, replyToTicket, setTicketStatus,
  TICKET_CATEGORIES, TICKET_PRIORITIES, ticketFileUrl, updateTicket, uploadTicketFiles,
  type Ticket, type TicketFile, type TicketMessage, type TicketWithClient,
} from "@/lib/api"
import { formatDateTime, timeAgo } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { company } from "@/lib/brand"

export type Viewer = "client" | "divigner"

const SELECT_CLASS = "min-h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
const TEXTAREA_CLASS = "min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"

const categoryLabel = (value: string) => TICKET_CATEGORIES.find((c) => c.value === value)?.label ?? value
const priorityLabel = (value: string) => TICKET_PRIORITIES.find((p) => p.value === value)?.label ?? value

/** Whose turn it is, in the words of the person looking. */
export function TicketStatusPill({ status, viewer }: { status: string; viewer: Viewer }) {
  if (status === "resolved") return <StatusPill tone="ok" icon={<CheckCircle2 />}>Resolved</StatusPill>
  if (status === "waiting") {
    return viewer === "client"
      ? <StatusPill tone="warn" icon={<MessageSquareReply />}>Waiting on You</StatusPill>
      : <StatusPill tone="neutral" icon={<Clock />}>Waiting on Client</StatusPill>
  }
  return viewer === "client"
    ? <StatusPill tone="info" icon={<Clock />}>With {company()}</StatusPill>
    : <StatusPill tone="warn" icon={<MessageSquareReply />}>Needs Reply</StatusPill>
}

export function PriorityPill({ priority }: { priority: string }) {
  if (priority === "urgent") return <StatusPill tone="bad" icon={<AlertTriangle />}>Urgent</StatusPill>
  if (priority === "high") return <StatusPill tone="warn" icon={<AlertTriangle />}>High</StatusPill>
  return <span className="text-sm text-muted-foreground">{priorityLabel(priority)}</span>
}

/** Shows which side someone is on, so nobody has to guess who wrote what. */
function SidePill({ side, clientName }: { side: string; clientName: string }) {
  return side === "divigner"
    ? <span className="rounded-sm bg-sidebar px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-sidebar-foreground uppercase">{company()}</span>
    : <span className="rounded-sm border px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{clientName}</span>
}

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Picks files to attach to a message, and lists the ones picked. */
function FilePicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const add = (list: FileList | null) => {
    const picked = [...(list ?? [])]
    const tooBig = picked.find((f) => f.size > MAX_TICKET_FILE_BYTES)
    if (tooBig) toast.error(`"${tooBig.name}" is larger than 10 MB.`)
    const next = [...files, ...picked.filter((f) => f.size <= MAX_TICKET_FILE_BYTES)]
    if (next.length > MAX_TICKET_FILES) toast.error(`A message can carry at most ${MAX_TICKET_FILES} files.`)
    onChange(next.slice(0, MAX_TICKET_FILES))
    if (input.current) input.current.value = ""
  }
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,.docx,.xlsx"
        onChange={(e) => add(e.target.files)}
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fileSize(file.size)}</span>
              <button type="button" className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm hover:bg-muted" aria-label={`Remove ${file.name}`} onClick={() => onChange(files.filter((_, n) => n !== i))}>
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button type="button" variant="outline" size="sm" className="min-h-9" disabled={disabled || files.length >= MAX_TICKET_FILES} onClick={() => input.current?.click()}>
          <Paperclip aria-hidden="true" />Attach files
        </Button>
      </div>
    </div>
  )
}

/** Opens a ticket. Staff pick the client; a client's own people never see that choice. */
export function NewTicketDialog({ client, clients, conversationId, onClose }: {
  client?: { id: string; name: string }
  clients?: Array<{ id: string; name: string }>
  conversationId?: string | null
  onClose: (ticket?: Ticket) => void
}) {
  const id = useId()
  const { access } = useAuth()
  const [clientId, setClientId] = useState(client?.id ?? "")
  const [subject, setSubject] = useState(conversationId ? "A problem with a conversation" : "")
  const [category, setCategory] = useState<string>("question")
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<{ client?: string; subject?: string; body?: string }>({})
  const save = useMutation({
    mutationFn: async () => {
      const stored = files.length ? await uploadTicketFiles(clientId, access!.user_id, files) : []
      return openTicket({ clientId, subject: subject.trim(), body: body.trim(), category, conversationId, files: stored })
    },
    onSuccess: (ticket) => { toast.success(`Ticket #${ticket.number} opened`); onClose(ticket) },
    onError: (err) => toast.error((err as Error).message),
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (!clientId) found.client = "Choose the client this ticket is for"
    if (!subject.trim()) found.subject = "Enter a short subject"
    if (!body.trim()) found.body = "Describe what you need"
    setErrors(found)
    if (!Object.keys(found).length) save.mutate()
  }
  const staff = access?.side === "divigner"
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Support Ticket</DialogTitle>
          <DialogDescription>
            {staff ? "Opens a ticket on the client's behalf. They are emailed and can reply in their portal." : `Tell us what you need. The ${company()} team is emailed straight away and replies here.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {!client && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-client`}>Client</Label>
              <select id={`${id}-client`} value={clientId} onChange={(e) => setClientId(e.target.value)} className={SELECT_CLASS} aria-invalid={errors.client ? true : undefined}>
                <option value="">Choose a client</option>
                {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.client && <p role="alert" className="text-sm font-medium text-bad">{errors.client}</p>}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-category`}>What Is This About?</Label>
            <select id={`${id}-category`} value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT_CLASS}>
              {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {category === "avatar_down" && <p className="text-sm text-muted-foreground">This is marked urgent and the {company()} team is alerted at once.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-subject`}>Subject</Label>
            <Input id={`${id}-subject`} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} className="min-h-11" aria-invalid={errors.subject ? true : undefined} />
            {errors.subject && <p role="alert" className="text-sm font-medium text-bad">{errors.subject}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-body`}>Details</Label>
            <textarea id={`${id}-body`} value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} className={TEXTAREA_CLASS} aria-invalid={errors.body ? true : undefined} />
            {errors.body && <p role="alert" className="text-sm font-medium text-bad">{errors.body}</p>}
          </div>
          {conversationId && <CopyId label="Conversation ID" value={conversationId} />}
          <FilePicker files={files} onChange={setFiles} disabled={save.isPending} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-10" disabled={save.isPending} onClick={() => onClose()}>Cancel</Button>
            <Button type="submit" className="min-h-10" disabled={save.isPending}>{save.isPending ? "Opening…" : "Open ticket"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A table of tickets. Staff also see the client, the priority and who has it. */
export function TicketList({ tickets, viewer, linkTo, showClient = false, empty }: {
  tickets: TicketWithClient[]
  viewer: Viewer
  linkTo: (ticket: TicketWithClient) => string
  showClient?: boolean
  empty: React.ReactNode
}) {
  if (tickets.length === 0) return <>{empty}</>
  return (
    <TableScroll label="Support tickets table" className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Support tickets, newest activity first</caption>
        <thead>
          <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground uppercase">
            <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Ticket</th>
            {showClient && <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Client</th>}
            {viewer === "divigner" && <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Priority</th>}
            <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Status</th>
            {viewer === "divigner" && <th scope="col" className="hidden px-4 py-2.5 font-semibold tracking-wide sm:table-cell">Assigned To</th>}
            <th scope="col" className="px-4 py-2.5 font-semibold tracking-wide">Last Reply</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <Link to={linkTo(t)} className="font-medium text-primary-text hover:underline">
                  <span className="tabular text-muted-foreground">#{t.number}</span> {t.subject}
                </Link>
                <span className="block text-xs text-muted-foreground">{categoryLabel(t.category)} · {t.message_count} repl{t.message_count === 1 ? "y" : "ies"}</span>
              </td>
              {showClient && <td className="px-4 py-3">{t.clients?.name ?? ""}</td>}
              {viewer === "divigner" && <td className="px-4 py-3"><PriorityPill priority={t.priority} /></td>}
              <td className="px-4 py-3"><TicketStatusPill status={t.status} viewer={viewer} /></td>
              {viewer === "divigner" && <td className="hidden px-4 py-3 sm:table-cell">{t.assignee_name ?? <span className="text-muted-foreground">Nobody</span>}</td>}
              <td className="px-4 py-3 whitespace-nowrap">
                {timeAgo(t.last_message_at)}
                <span className="block text-xs text-muted-foreground">by {t.last_message_side === "divigner" ? `${company()}` : (viewer === "client" ? "your team" : "the client")}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )
}

function Attachments({ files }: { files: TicketFile[] }) {
  const open = async (file: TicketFile) => {
    try {
      window.open(await ticketFileUrl(file.path), "_blank", "noopener")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }
  if (!files?.length) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {files.map((file) => (
        <li key={file.path}>
          <Button type="button" variant="outline" size="sm" className="min-h-9 max-w-full" onClick={() => void open(file)}>
            <Paperclip aria-hidden="true" /><span className="truncate">{file.name}</span><span className="text-xs text-muted-foreground">{fileSize(file.size)}</span>
          </Button>
        </li>
      ))}
    </ul>
  )
}

function MessageItem({ message, clientName, timeZone }: { message: TicketMessage; clientName: string; timeZone: string }) {
  const when = formatDateTime(message.created_at, timeZone)
  if (message.kind === "event") {
    return (
      <li className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{message.author_name || (message.author_side === "divigner" ? `${company()}` : clientName)}</span>
        <SidePill side={message.author_side} clientName={clientName} />
        <span>{message.body} · {when}</span>
        {message.is_internal && <span className="inline-flex items-center gap-1 font-semibold text-warn"><Lock className="size-3" aria-hidden="true" />Internal</span>}
      </li>
    )
  }
  return (
    <li className={cn("rounded-lg border p-3", message.is_internal ? "border-warn/50 bg-warn-soft" : message.author_side === "divigner" ? "bg-muted" : "bg-card")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold">{message.author_name || (message.author_side === "divigner" ? `${company()}` : clientName)}</span>
        <SidePill side={message.author_side} clientName={clientName} />
        {message.is_internal && <StatusPill tone="warn" icon={<Lock />}>Internal Note · Not Shown to the Client</StatusPill>}
        {message.via === "email" && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3.5" aria-hidden="true" />Sent by email</span>}
        <span className="tabular text-xs text-muted-foreground">{when}</span>
      </div>
      <p className="mt-1.5 text-sm whitespace-pre-wrap">{message.body}</p>
      <Attachments files={message.attachments} />
    </li>
  )
}

/** One ticket: its details, every reply, and the form to add another. */
export function TicketThread({ ticket, timeZone, onChanged }: { ticket: TicketWithClient; timeZone: string; onChanged: () => void }) {
  const id = useId()
  const { access, can } = useAuth()
  const queryClient = useQueryClient()
  const staff = access?.side === "divigner"
  const viewer: Viewer = staff ? "divigner" : "client"
  const canWrite = staff ? can("support.manage") : can("support.use")
  const clientName = ticket.clients?.name ?? "Client"
  const [body, setBody] = useState("")
  const [internal, setInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [problem, setProblem] = useState("")

  const messages = useQuery({ queryKey: ["ticket-messages", ticket.id], queryFn: () => listTicketMessages(ticket.id) })
  const team = useQuery({ queryKey: ["support-staff", ticket.client_id], queryFn: () => listSupportStaff(ticket.client_id), enabled: staff && canWrite })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticket.id] })
    void queryClient.invalidateQueries({ queryKey: ["tickets"] })
    onChanged()
  }
  const send = useMutation({
    mutationFn: async () => {
      const stored = files.length ? await uploadTicketFiles(ticket.client_id, access!.user_id, files) : []
      await replyToTicket(ticket.id, body.trim(), internal, stored)
    },
    onSuccess: () => {
      toast.success(internal ? "Internal note added" : "Reply sent")
      setBody(""); setFiles([]); setInternal(false); setProblem("")
      refresh()
    },
    onError: (err) => setProblem((err as Error).message),
  })
  const change = useMutation({
    mutationFn: async (action: { status?: "open" | "waiting" | "resolved"; assignee?: string | null; priority?: string; category?: string }) => {
      if (action.status) await setTicketStatus(ticket.id, action.status)
      if (action.assignee !== undefined) await assignTicket(ticket.id, action.assignee)
      if (action.priority || action.category) await updateTicket(ticket.id, { priority: action.priority, category: action.category })
    },
    onSuccess: () => { toast.success("Ticket updated"); refresh() },
    onError: (err) => toast.error((err as Error).message),
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return setProblem(internal ? "Write the note first" : "Write your reply first")
    send.mutate()
  }
  const via = ticket.opened_via === "email" ? "by email" : ticket.opened_via === "staff" ? `by ${company()} for the client` : "in the portal"

  return (
    <>
      <section aria-label="Ticket details" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusPill status={ticket.status} viewer={viewer} />
          {staff && <PriorityPill priority={ticket.priority} />}
          <span className="text-sm text-muted-foreground">{categoryLabel(ticket.category)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Opened by <span className="font-medium text-foreground">{ticket.opened_by_name || clientName}</span> {via} on {formatDateTime(ticket.created_at, timeZone)}.{" "}
          {ticket.assignee_name
            ? <>Assigned to <span className="font-medium text-foreground">{ticket.assignee_name}</span> at {company()}.</>
            : (staff ? "Not assigned to anyone yet." : `The ${company()} team has it.`)}
        </p>
        {ticket.conversation_id && <CopyId label="Conversation ID" value={ticket.conversation_id} />}
        {staff && canWrite && (
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-assignee`}>Assigned To</Label>
              <select id={`${id}-assignee`} className={SELECT_CLASS} value={ticket.assignee_id ?? ""} disabled={change.isPending} onChange={(e) => change.mutate({ assignee: e.target.value || null })}>
                <option value="">Nobody</option>
                {(team.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-priority`}>Priority</Label>
              <select id={`${id}-priority`} className={SELECT_CLASS} value={ticket.priority} disabled={change.isPending} onChange={(e) => change.mutate({ priority: e.target.value })}>
                {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-category`}>Category</Label>
              <select id={`${id}-category`} className={SELECT_CLASS} value={ticket.category} disabled={change.isPending} onChange={(e) => change.mutate({ category: e.target.value })}>
                {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby={`${id}-thread`} className="flex flex-col gap-3">
        <h2 id={`${id}-thread`} className="text-lg font-semibold">Conversation With {staff ? clientName : `${company()}`}</h2>
        {messages.isPending ? (
          <LoadingBlock label="Loading replies" />
        ) : messages.isError ? (
          <ErrorBlock error={messages.error} onRetry={() => void messages.refetch()} />
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.data.map((m) => <MessageItem key={m.id} message={m} clientName={clientName} timeZone={timeZone} />)}
          </ol>
        )}
      </section>

      {canWrite && (
        <form onSubmit={submit} noValidate className={cn("flex flex-col gap-3 rounded-lg border p-4", internal ? "border-warn/50 bg-warn-soft" : "bg-card")}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-reply`}>{internal ? "Internal Note" : staff ? `Reply to ${clientName}` : `Reply to ${company()}`}</Label>
            <textarea id={`${id}-reply`} value={body} maxLength={20000} onChange={(e) => { setBody(e.target.value); setProblem("") }} className={TEXTAREA_CLASS} aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-problem` : undefined} />
            {problem && <p id={`${id}-problem`} role="alert" className="text-sm font-medium text-bad">{problem}</p>}
          </div>
          <FilePicker files={files} onChange={setFiles} disabled={send.isPending} />
          {staff && (
            <div className="flex items-center gap-2">
              <Checkbox id={`${id}-internal`} className="size-5" checked={internal} onCheckedChange={(on) => setInternal(on === true)} />
              <Label htmlFor={`${id}-internal`}>Internal note. Only {company()} staff see it, and the client is not emailed.</Label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" className="min-h-10" disabled={send.isPending}>{send.isPending ? "Sending…" : internal ? "Add internal note" : "Send reply"}</Button>
            {ticket.status === "resolved" ? (
              <Button type="button" variant="outline" className="min-h-10" disabled={change.isPending} onClick={() => change.mutate({ status: "open" })}>Reopen ticket</Button>
            ) : (
              <Button type="button" variant="outline" className="min-h-10" disabled={change.isPending} onClick={() => change.mutate({ status: "resolved" })}>
                <CheckCircle2 aria-hidden="true" />Mark as resolved
              </Button>
            )}
            {staff && ticket.status === "open" && (
              <Button type="button" variant="ghost" className="min-h-10" disabled={change.isPending} onClick={() => change.mutate({ status: "waiting" })}>Set to waiting on client</Button>
            )}
          </div>
          {!internal && <p className="text-xs text-muted-foreground">{staff ? `${clientName} is emailed your reply and can answer in their portal.` : `The ${company()} team is emailed your reply.`}</p>}
        </form>
      )}
    </>
  )
}

export function NoTickets({ viewer }: { viewer: Viewer }) {
  return (
    <EmptyState title="No Tickets Here">
      {viewer === "client" ? `When you need something from ${company()}, open a ticket and the whole conversation stays on this page.` : "Nothing matches this view right now."}
    </EmptyState>
  )
}
