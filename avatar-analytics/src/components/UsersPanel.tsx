// The list of people who can sign in, for the Divigner team or for one
// client, with invite, role change and deactivate.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, MinusCircle, UserPlus } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States"
import { StatusPill } from "@/components/StatusPill"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import {
  inviteUser, listAssignments, listClients, listProfiles, listRoles, setAssignments, setUserActive, setUserRole,
  type Profile, type Role,
} from "@/lib/api"

type Scope = { side: "divigner" } | { clientId: string; clientName: string }

const selectClass = "min-h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-60"

function ClientChecklist({ value, onChange }: { value: Set<string>; onChange: (next: Set<string>) => void }) {
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients })
  if (clients.isPending) return <LoadingBlock />
  if (!clients.data?.length) return <p className="text-sm text-muted-foreground">There are no clients yet.</p>
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Clients This Person Can See</legend>
      {clients.data.map((c) => (
        <label key={c.id} className="flex min-h-9 items-center gap-2 text-sm">
          <Checkbox
            checked={value.has(c.id)}
            onCheckedChange={(on) => {
              const next = new Set(value)
              if (on === true) next.add(c.id)
              else next.delete(c.id)
              onChange(next)
            }}
          />
          {c.name}
        </label>
      ))}
    </fieldset>
  )
}

function InviteDialog({ scope, roles, open, onOpenChange }: { scope: Scope; roles: Role[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [roleId, setRoleId] = useState(roles.find((r) => r.key === ("side" in scope ? "admin" : "client_member"))?.id ?? roles[0]?.id ?? "")
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const role = roles.find((r) => r.id === roleId)

  const invite = useMutation({
    mutationFn: () =>
      inviteUser({
        email,
        full_name: name,
        role_id: roleId,
        client_id: "clientId" in scope ? scope.clientId : undefined,
        assigned_client_ids: role?.client_scope === "assigned" ? [...assigned] : undefined,
      }),
    onSuccess: () => {
      toast.success(`Invite sent to ${email.trim()}.`)
      setName("")
      setEmail("")
      setAssigned(new Set())
      setError(null)
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ["profiles"] })
      void queryClient.invalidateQueries({ queryKey: ["assignments"] })
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"side" in scope ? "Invite a Divigner User" : `Invite Someone at ${scope.clientName}`}</DialogTitle>
          <DialogDescription>They get an email with a link to choose a password.</DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            invite.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className="min-h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className="min-h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-role`}>Role</Label>
            <select id={`${id}-role`} className={selectClass} value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-describedby={`${id}-role-help`}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <p id={`${id}-role-help`} className="text-xs text-muted-foreground">{role?.description}</p>
          </div>
          {role?.client_scope === "assigned" && <ClientChecklist value={assigned} onChange={setAssigned} />}
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" className="min-h-10" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} className="min-h-10" disabled={invite.isPending}>
            {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignmentsDialog({ person, current, onClose }: { person: Profile; current: Set<string>; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(current)
  const save = useMutation({
    mutationFn: () => setAssignments(person.id, [...value]),
    onSuccess: () => {
      toast.success(`Updated the clients ${person.full_name || person.email} can see.`)
      void queryClient.invalidateQueries({ queryKey: ["assignments"] })
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clients for {person.full_name || person.email}</DialogTitle>
          <DialogDescription>Their role only lets them see the clients ticked here.</DialogDescription>
        </DialogHeader>
        <ClientChecklist value={value} onChange={setValue} />
        <DialogFooter>
          <Button variant="outline" className="min-h-10" onClick={onClose}>Cancel</Button>
          <Button className="min-h-10" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsersPanel({ scope, canManage }: { scope: Scope; canManage: boolean }) {
  const { access } = useAuth()
  const queryClient = useQueryClient()
  const isTeam = "side" in scope
  const key = isTeam ? "divigner" : scope.clientId
  const people = useQuery({ queryKey: ["profiles", key], queryFn: () => listProfiles(isTeam ? { side: "divigner" } : { clientId: scope.clientId }) })
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: listRoles })
  const assignments = useQuery({ queryKey: ["assignments"], queryFn: listAssignments, enabled: isTeam && access?.side === "divigner" })
  const [inviting, setInviting] = useState(false)
  const [assigning, setAssigning] = useState<Profile | null>(null)

  const roles = (rolesQuery.data ?? []).filter((r) => r.side === (isTeam ? "divigner" : "client"))
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["profiles", key] })
  const changeRole = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) => setUserRole(id, roleId),
    onSuccess: () => { toast.success("Role updated."); refresh() },
    onError: (err: Error) => { toast.error(err.message); refresh() },
  })
  const changeActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setUserActive(id, active),
    onSuccess: (_d, v) => { toast.success(v.active ? "Access restored." : "Access removed. They can no longer sign in to this app."); refresh() },
    onError: (err: Error) => toast.error(err.message),
  })

  if (people.isPending || rolesQuery.isPending) return <LoadingBlock label="Loading people" />
  if (people.isError) return <ErrorBlock error={people.error} onRetry={() => void people.refetch()} />

  const assignedTo = (userId: string) => new Set((assignments.data ?? []).filter((a) => a.user_id === userId).map((a) => a.client_id))

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div>
          <Button className="min-h-10" onClick={() => setInviting(true)}>
            <UserPlus aria-hidden="true" />
            {isTeam ? "Invite a Divigner user" : "Invite a user"}
          </Button>
        </div>
      )}

      {people.data.length === 0 ? (
        <EmptyState title="Nobody Yet">{isTeam ? "Invite your team." : "Invite someone at this client so they can sign in and see their dashboard."}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.data.map((person) => {
            const self = person.id === access?.user_id
            const role = roles.find((r) => r.id === person.role_id)
            const editable = canManage && !self
            return (
              <li key={person.id} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    {person.full_name || person.email} {self && <span className="text-sm font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-sm break-all text-muted-foreground">{person.email}</p>
                  {isTeam && role?.client_scope === "assigned" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sees {assignedTo(person.id).size} assigned client{assignedTo(person.id).size === 1 ? "" : "s"}
                      {canManage && (
                        <>
                          {" · "}
                          <button type="button" className="text-primary-text underline" onClick={() => setAssigning(person)}>Change</button>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  {editable ? (
                    <>
                      <label htmlFor={`role-${person.id}`} className="sr-only">Role for {person.full_name || person.email}</label>
                      <select
                        id={`role-${person.id}`}
                        className={selectClass}
                        value={person.role_id}
                        disabled={changeRole.isPending}
                        onChange={(e) => changeRole.mutate({ id: person.id, roleId: e.target.value })}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <p className="text-sm">{role?.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  {person.is_active ? (
                    <StatusPill tone="ok" icon={<CheckCircle2 />}>Active</StatusPill>
                  ) : (
                    <StatusPill tone="neutral" icon={<MinusCircle />}>No access</StatusPill>
                  )}
                  {editable && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      disabled={changeActive.isPending}
                      aria-label={`${person.is_active ? "Remove access for" : "Restore access for"} ${person.full_name || person.email}`}
                      onClick={() => changeActive.mutate({ id: person.id, active: !person.is_active })}
                    >
                      {person.is_active ? "Remove access" : "Restore access"}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {inviting && roles.length > 0 && <InviteDialog scope={scope} roles={roles} open={inviting} onOpenChange={setInviting} />}
      {assigning && <AssignmentsDialog person={assigning} current={assignedTo(assigning.id)} onClose={() => setAssigning(null)} />}
    </div>
  )
}
