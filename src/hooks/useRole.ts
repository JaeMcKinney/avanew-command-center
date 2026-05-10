import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { TeamRole } from "@/types/db"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"
const VIEW_AS_KEY = "avanew-crm.view-as-role"

const VIEW_AS_EVENT = "avanew-crm:view-as-changed"

function readViewAs(): TeamRole | null {
  if (typeof localStorage === "undefined") return null
  const v = localStorage.getItem(VIEW_AS_KEY)
  if (!v) return null
  if (
    v === "owner" ||
    v === "admin" ||
    v === "bd" ||
    v === "partner" ||
    v === "super_user"
  ) {
    return v
  }
  return null
}

function writeViewAs(role: TeamRole | null) {
  if (typeof localStorage === "undefined") return
  if (role) localStorage.setItem(VIEW_AS_KEY, role)
  else localStorage.removeItem(VIEW_AS_KEY)
  window.dispatchEvent(new Event(VIEW_AS_EVENT))
}

let cachedActualRole: TeamRole | null = null

export function useRole() {
  const [actualRole, setActualRole] = useState<TeamRole | null>(
    PREVIEW_MODE ? "super_user" : cachedActualRole
  )
  const [loading, setLoading] = useState(!PREVIEW_MODE && cachedActualRole === null)
  const [viewAs, setViewAs] = useState<TeamRole | null>(() => readViewAs())

  useEffect(() => {
    if (PREVIEW_MODE) return
    if (cachedActualRole !== null) return
    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        if (alive) setLoading(false)
        return
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (alive) {
            const role = (profile?.role as TeamRole | null) ?? null
            cachedActualRole = role
            setActualRole(role)
            setLoading(false)
          }
        })
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    function sync() { setViewAs(readViewAs()) }
    window.addEventListener(VIEW_AS_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(VIEW_AS_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const canViewAs = actualRole === "super_user"
  const effectiveRole: TeamRole | null =
    canViewAs && viewAs ? viewAs : actualRole

  const setViewAsRole = useCallback((next: TeamRole | null) => {
    if (next === actualRole) {
      writeViewAs(null)
    } else {
      writeViewAs(next)
    }
  }, [actualRole])

  return {
    role: effectiveRole,
    actualRole,
    viewAs: canViewAs && viewAs && viewAs !== actualRole ? viewAs : null,
    canViewAs,
    setViewAsRole,
    isOwner: effectiveRole === "owner" || effectiveRole === "super_user",
    isSuperUser: effectiveRole === "super_user",
    loading,
  }
}
