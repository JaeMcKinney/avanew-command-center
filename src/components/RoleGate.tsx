import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { usePermissions } from "@/hooks/usePermissions"
import type { TeamRole } from "@/types/db"
import type { PermissionKey } from "@/lib/permissions"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

export function RoleGate({
  allow,
  permission,
  children,
}: {
  allow?: TeamRole[]
  permission?: PermissionKey
  children: ReactNode
}) {
  const { role, loading, can } = usePermissions()

  if (PREVIEW_MODE) return <>{children}</>

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  const allowed = permission
    ? can(permission)
    : allow
      ? role !== null && allow.includes(role)
      : false

  if (!role || !allowed) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
