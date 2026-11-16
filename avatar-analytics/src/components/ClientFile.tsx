import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Mail, Phone, Pin, PinOff, Plus, Star } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import {
  addNote, deleteContact, deleteNote, listContacts, listNotes, listProfiles, saveContact, updateClientAccount, updateNote,
  type Client, type ClientContact, type ContactInput,
} from "@/lib/api"
import { formatDateTime } from "@/lib/dates"

const KINDS = [["note", "Note"], ["call", "Call"], ["meeting", "Meeting"], ["email", "Email"], ["task", "To do"]] as const
const kindLabel = (kind: string) => KINDS.find(([value]) => value === kind)?.[1] ?? "Note"
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone

/** Notes kept on a client: calls, meetings, things to remember. Staff only. */
export function ClientNotes({ client }: { client: Client }) {
  const id = useId()
  const { access, can } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = can("crm.manage")
  const notes = useQuery({ queryKey: ["client-notes", client.id], queryFn: () => listNotes(client.id) })
  const staff = useQuery({ queryKey: ["profiles", "divigner"], queryFn: () => listProfiles({ side: "divigner" }) })
  const [body, setBody] = useState("")
  const [kind, setKind] = useState("note")
  const [problem, setProblem] = useState("")
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["client-notes", client.id] })
    void queryClient.invalidateQueries({ queryKey: ["crm-clients"] })
  }
  const add = useMutation({
    mutationFn: () => addNote(client.id, access!.user_id, body.trim(), kind),
    onSuccess: () => { setBody(""); setKind("note"); toast.success("Note added"); refresh() },
    onError: (err) => setProblem((err as Error).message),
  })
  const change = useMutation({
    mutationFn: (v: { id: string; pinned?: boolean; remove?: boolean }) => (v.remove ? deleteNote(v.id) : updateNote(v.id, { pinned: v.pinned })),
    onSuccess: (_, v) => { toast.success(v.remove ? "Note removed" : v.pinned ? "Note pinned to the top" : "Note unpinned"); refresh() },
    onError: (err) => toast.error((err as Error).message),
  })
  const authorOf = (userId: string | null) => staff.data?.find((p) => p.id === userId)?.full_name ?? "A former team member"
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return setProblem("Write the note first.")
    setProblem("")
    add.mutate()
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-body`}>Add a note to {client.name}'s file</Label>
            <textarea id={`${id}-body`} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={10000} aria-invalid={problem ? true : undefined} aria-describedby={`${id}-help${problem ? ` ${id}-problem` : ""}`} className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
            <p id={`${id}-help`} className="text-xs text-muted-foreground">Only Divigner staff can see notes. The client never does.</p>
            {problem && <p id={`${id}-problem`} role="alert" className="text-sm font-medium text-bad">{problem}</p>}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-kind`}>Kind</Label>
              <select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value)} className="min-h-10 rounded-md border border-input bg-transparent px-3 text-sm">
                {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <Button type="submit" className="min-h-10" disabled={add.isPending}>{add.isPending ? "Adding…" : "Add note"}</Button>
          </div>
        </form>
      )}
      {notes.isPending ? <LoadingBlock label="Loading notes" /> : notes.isError ? <ErrorBlock error={notes.error} /> : notes.data.length === 0 ? (
        <EmptyState title="No Notes Yet">Keep a record of calls, meetings and anything worth remembering about this client.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.data.map((note) => {
            const mine = note.author_id === access?.user_id || can("team.manage")
            return (
              <li key={note.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <p className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="neutral">{kindLabel(note.kind)}</StatusPill>
                    {note.pinned && <StatusPill tone="info" icon={<Pin />}>Pinned</StatusPill>}
                    <span>{authorOf(note.author_id)} · {formatDateTime(note.created_at, zone)}</span>
                  </p>
                  {canWrite && mine && (
                    <span className="flex gap-1">
                      <Button variant="ghost" size="sm" className="min-h-9" disabled={change.isPending} onClick={() => change.mutate({ id: note.id, pinned: !note.pinned })}>
                        {note.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}{note.pinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button variant="ghost" size="sm" className="min-h-9" disabled={change.isPending} onClick={() => change.mutate({ id: note.id, remove: true })}>Remove</Button>
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const emptyContact: ContactInput = { full_name: "", title: null, email: null, phone: null, is_primary: false, notes: null }

function ContactDialog({ client, contact, onClose }: { client: Client; contact: ClientContact | "new"; onClose: (saved: boolean) => void }) {
  const id = useId()
  const { access } = useAuth()
  const [draft, setDraft] = useState<ContactInput>(contact === "new" ? emptyContact : { full_name: contact.full_name, title: contact.title, email: contact.email, phone: contact.phone, is_primary: contact.is_primary, notes: contact.notes })
  const [errors, setErrors] = useState<{ full_name?: string; email?: string }>({})
  const save = useMutation({
    mutationFn: () => saveContact(client.id, contact === "new" ? null : contact.id, { ...draft, full_name: draft.full_name.trim() }, access!.user_id),
    onSuccess: () => { toast.success(contact === "new" ? "Contact added" : "Contact saved"); onClose(true) },
    onError: (err) => toast.error((err as Error).message),
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (!draft.full_name.trim()) found.full_name = "Enter their name"
    if (draft.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) found.email = "Enter an email address like name@example.com"
    setErrors(found)
    if (!Object.keys(found).length) save.mutate()
  }
  const field = (key: "full_name" | "title" | "email" | "phone", label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input id={`${id}-${key}`} value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value || (key === "full_name" ? "" : null) })} className="min-h-11" aria-invalid={errors[key as "full_name"] ? true : undefined} aria-describedby={errors[key as "full_name"] ? `${id}-${key}-error` : undefined} {...props} />
      {errors[key as "full_name"] && <p id={`${id}-${key}-error`} role="alert" className="text-sm font-medium text-bad">{errors[key as "full_name"]}</p>}
    </div>
  )
  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose(false)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact === "new" ? `Add a Contact at ${client.name}` : `Edit ${contact.full_name}`}</DialogTitle>
          <DialogDescription>A person to remember at this client. This does not give them a sign-in; invite them under People for that.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {field("full_name", "Name", { autoComplete: "off" })}
          {field("title", "Job title (optional)", { autoComplete: "off" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("email", "Email (optional)", { type: "email", autoComplete: "off" })}
            {field("phone", "Phone (optional)", { type: "tel", autoComplete: "off" })}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-notes`}>About them (optional)</Label>
            <textarea id={`${id}-notes`} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })} rows={2} maxLength={2000} className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id={`${id}-primary`} className="size-5" checked={draft.is_primary} onCheckedChange={(on) => setDraft({ ...draft, is_primary: on === true })} />
            <Label htmlFor={`${id}-primary`}>Main contact for this client</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-10" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save contact"}</Button>
            <Button type="button" variant="outline" className="min-h-10" disabled={save.isPending} onClick={() => onClose(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The people Divigner deals with at a client, whether or not they have a sign-in. */
export function ClientContacts({ client }: { client: Client }) {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = can("crm.manage")
  const contacts = useQuery({ queryKey: ["client-contacts", client.id], queryFn: () => listContacts(client.id) })
  const [editing, setEditing] = useState<ClientContact | "new" | null>(null)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["client-contacts"] })
    void queryClient.invalidateQueries({ queryKey: ["crm-clients"] })
  }
  const remove = useMutation({ mutationFn: deleteContact, onSuccess: () => { toast.success("Contact removed"); refresh() }, onError: (err) => toast.error((err as Error).message) })
  const add = canWrite && <Button className="min-h-10" onClick={() => setEditing("new")}><Plus aria-hidden="true" />Add a contact</Button>
  return (
    <div className="flex flex-col gap-4">
      {contacts.isPending ? <LoadingBlock label="Loading contacts" /> : contacts.isError ? <ErrorBlock error={contacts.error} /> : contacts.data.length === 0 ? (
        <EmptyState title="No Contacts Yet" action={add}>Add the people you deal with at {client.name}.</EmptyState>
      ) : (
        <>
          <div>{add}</div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {contacts.data.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{c.full_name}</h3>
                    {c.title && <p className="text-muted-foreground">{c.title}</p>}
                  </div>
                  {c.is_primary && <StatusPill tone="info" icon={<Star />}>Main contact</StatusPill>}
                </div>
                {c.email && <p><a href={`mailto:${c.email}`} className="inline-flex min-h-6 items-center gap-1.5 text-primary-text underline"><Mail className="size-4" aria-hidden="true" />{c.email}</a></p>}
                {c.phone && <p><a href={`tel:${c.phone}`} className="inline-flex min-h-6 items-center gap-1.5 text-primary-text underline"><Phone className="size-4" aria-hidden="true" />{c.phone}</a></p>}
                {c.notes && <p className="whitespace-pre-wrap text-muted-foreground">{c.notes}</p>}
                {canWrite && (
                  <div className="mt-auto flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="min-h-9" onClick={() => setEditing(c)} aria-label={`Edit ${c.full_name}`}>Edit</Button>
                    <Button variant="outline" size="sm" className="min-h-9" disabled={remove.isPending} onClick={() => remove.mutate(c.id)} aria-label={`Remove ${c.full_name}`}>Remove</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {editing && <ContactDialog client={client} contact={editing} onClose={(saved) => { setEditing(null); if (saved) refresh() }} />}
    </div>
  )
}

/** Account details kept on the client's file: website, industry, phone, address and who looks after them. */
export function ClientAccount({ client }: { client: Client }) {
  const id = useId()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const staff = useQuery({ queryKey: ["profiles", "divigner"], queryFn: () => listProfiles({ side: "divigner" }) })
  const [draft, setDraft] = useState({ website: client.website ?? "", industry: client.industry ?? "", phone: client.phone ?? "", address: client.address ?? "", account_manager_id: client.account_manager_id ?? "" })
  const [problem, setProblem] = useState("")
  const save = useMutation({
    mutationFn: () => updateClientAccount(client.id, { website: draft.website.trim() || null, industry: draft.industry.trim() || null, phone: draft.phone.trim() || null, address: draft.address.trim() || null, account_manager_id: draft.account_manager_id || null }),
    onSuccess: () => {
      toast.success("Account details saved")
      void queryClient.invalidateQueries({ queryKey: ["client", client.slug] })
      void queryClient.invalidateQueries({ queryKey: ["crm-clients"] })
    },
    onError: (err) => toast.error((err as Error).message),
  })
  const editable = can("crm.manage")
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (draft.website.trim() && !/^https?:\/\/\S+$/.test(draft.website.trim())) return setProblem("The website must start with https://")
    setProblem("")
    save.mutate()
  }
  const input = (key: "website" | "industry" | "phone", label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input id={`${id}-${key}`} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className="min-h-11" autoComplete="off" disabled={!editable} {...props} />
    </div>
  )
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="text-base font-semibold">Account Details</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {input("website", "Website", { type: "url", placeholder: "https://", "aria-describedby": problem ? `${id}-problem` : undefined })}
        {input("industry", "Industry")}
        {input("phone", "Main phone", { type: "tel" })}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-manager`}>Looked after by</Label>
          <select id={`${id}-manager`} value={draft.account_manager_id} onChange={(e) => setDraft({ ...draft, account_manager_id: e.target.value })} disabled={!editable} className="min-h-11 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="">Nobody yet</option>
            {(staff.data ?? []).filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-address`}>Address</Label>
        <textarea id={`${id}-address`} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} rows={2} maxLength={300} disabled={!editable} className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      </div>
      {problem && <p id={`${id}-problem`} role="alert" className="text-sm font-medium text-bad">{problem}</p>}
      {editable && <div><Button type="submit" className="min-h-10" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save account details"}</Button></div>}
    </form>
  )
}
