import { useCallback, useEffect, useState } from "react"
import { useRole } from "@/hooks/useRole"
import { supabase } from "@/lib/supabase"
import {
  hasPermission,
  loadPermissionsMatrix,
  savePermissionsMatrix,
  resetPermissionsMatrix,
  fetchPermissionsFromDB,
  persistPermissionsToDB,
  type PermissionKey,
  type PermissionsMatrix,
} from "@/lib/permissions"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

export function usePermissions() {
  const { role } = useRole()
  const [matrix, setMatrix] = useState<PermissionsMatrix>(() => loadPermissionsMatrix())

  useEffect(() => {
    if (PREVIEW_MODE) return
    fetchPermissionsFromDB(supabase).then((remote) => {
      if (remote) setMatrix(remote)
    })
  }, [])

  const can = useCallback(
    (key: PermissionKey): boolean => {
      if (!role) return false
      return hasPermission(matrix, role, key)
    },
    [role, matrix]
  )

  function toggle(key: PermissionKey, targetRole: string, value: boolean) {
    setMatrix((prev) => {
      const next = structuredClone(prev)
      next[key][targetRole as keyof (typeof next)[typeof key]] = value
      savePermissionsMatrix(next)
      if (!PREVIEW_MODE) void persistPermissionsToDB(supabase, next)
      return next
    })
  }

  function reset() {
    const fresh = resetPermissionsMatrix()
    if (!PREVIEW_MODE) void persistPermissionsToDB(supabase, fresh)
    setMatrix(fresh)
  }

  return { can, matrix, toggle, reset }
}
