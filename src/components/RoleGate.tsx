import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useRole } from "@/hooks/useRole"
import { usePermissions } from "@/hooks/usePermissions"
import type { TeamRole } from "@/types/db"
import type { PermissionKey } from "@/lib/permissions"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

/**
 * Route-level enforcement gate.
 *
 * Usage:
 *   <RoleGate permission="cashflow.view">  — permissions-matrix driven
 *   <RoleGate allow={["owner","super_user"]}>  — explicit role list
 *
 * Prefer `permission` so the matrix can expand access without code changes.
 */
export function RoleGate({
  allow,
  permission,
  children,
}: {
  allow?: TeamRole[]
  permission?: PermissionKey
  children: ReactNode
}) {
  const { role, loading } = useRole()
  const { can } = usePermissions()

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
