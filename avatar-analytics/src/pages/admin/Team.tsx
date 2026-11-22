import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { TableScroll } from "@/components/TableScroll"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/PageHeader"
import { ErrorBlock, LoadingBlock } from "@/components/States"
import { Checkbox } from "@/components/ui/checkbox"
import { UsersPanel } from "@/components/UsersPanel"
import { useAuth } from "@/hooks/useAuth"
import { listPermissions, listRolePermissions, listRoles, setRolePermission } from "@/lib/api"
import { COMPANY } from "@/lib/edition"

/** Which role may do what. Tick or untick to change it. */
function PermissionsMatrix({ editable }: { editable: boolean }) {
  const queryClient = useQueryClient()
  const { refresh } = useAuth()
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles })
  const permissions = useQuery({ queryKey: ["permissions"], queryFn: listPermissions })
  const granted = useQuery({ queryKey: ["role-permissions"], queryFn: listRolePermissions })
  // A tick shows the moment it is clicked; the saved value replaces it once the server answers.
  const [unsaved, setUnsaved] = useState<Record<string, boolean>>({})
  const change = useMutation({
    mutationFn: (v: { roleId: string; permission: string; on: boolean }) => setRolePermission(v.roleId, v.permission, v.on),
    onSuccess: () => toast.success("Permission updated."),
    onError: (err: Error) => toast.error(err.message),
    onSettled: async (_data, _error, v) => {
      await queryClient.invalidateQueries({ queryKey: ["role-permissions"] })
      setUnsaved((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== `${v.roleId}:${v.permission}`)))
      void refresh()
    },
  })

  if (roles.isPending || permissions.isPending || granted.isPending) return <LoadingBlock label="Loading permissions" />
  if (roles.isError) return <ErrorBlock error={roles.error} />
  const has = (roleId: string, permission: string) =>
    unsaved[`${roleId}:${permission}`] ?? (granted.data ?? []).some((g) => g.role_id === roleId && g.permission === permission)

  return (
    <TableScroll label="Table of what each role may do" className="rounded-lg border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Permissions for each role</caption>
        <thead>
          <tr className="border-b bg-muted/60 text-left text-xs">
            <th scope="col" className="min-w-52 px-4 py-2.5 font-semibold">Permission</th>
            {roles.data.map((r) => (
              <th key={r.id} scope="col" className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">
                {r.name}
                <span className="block font-normal text-muted-foreground">{r.side === "client" ? "Client" : r.client_scope === "assigned" ? "Assigned clients" : "All clients"}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(permissions.data ?? []).map((p) => (
            <tr key={p.key} className="border-b last:border-0">
              <th scope="row" className="px-4 py-3 text-left font-normal">
                <span className="font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{p.description}</span>
              </th>
              {roles.data.map((r) => {
                const allowed = p.side === "both" || p.side === r.side
                const locked = !editable || r.key === "owner" || !allowed
                return (
                  <td key={r.id} className="px-3 py-3 text-center">
                    {allowed ? (
                      <Checkbox
                        className="size-5"
                        aria-label={`${r.name}: ${p.label}`}
                        checked={has(r.id, p.key)}
                        disabled={locked}
                        onCheckedChange={(on) => {
                          setUnsaved((prev) => ({ ...prev, [`${r.id}:${p.key}`]: on === true }))
                          change.mutate({ roleId: r.id, permission: p.key, on: on === true })
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground" title="Not available for this kind of role">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Not available</span>
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )
}

export default function Team() {
  const { can } = useAuth()
  const manage = can("team.manage")
  return (
    <>
      <PageHeader title="Team" description={`The ${COMPANY} people who can sign in, and what each role may do.`} />
      <section aria-labelledby="people-heading" className="flex flex-col gap-3">
        <h2 id="people-heading" className="text-xl font-semibold">{COMPANY} Users</h2>
        <UsersPanel scope={{ side: "divigner" }} canManage={manage} />
      </section>
      <section aria-labelledby="roles-heading" className="flex flex-col gap-3">
        <h2 id="roles-heading" className="text-xl font-semibold">Roles and Permissions</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          {manage ? "Tick a box to let a role do something. Changes apply straight away. The Owner role always has everything." : "Only people who manage the team can change these."}
        </p>
        <PermissionsMatrix editable={manage} />
      </section>
    </>
  )
}
