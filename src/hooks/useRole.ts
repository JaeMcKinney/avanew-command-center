import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { TeamRole } from "@/types/db"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"
const VIEW_AS_KEY = "avanew-crm.view-as-role"
const ORG_KEY = "avanew-crm.current-org-id"
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

export function useRole() {
  const [actualRole, setActualRole] = useState<TeamRole | null>(
    PREVIEW_MODE ? "super_user" : null
  )
  const [loading, setLoading] = useState(!PREVIEW_MODE)
  const [viewAs, setViewAs] = useState<TeamRole | null>(() => readViewAs())

  useEffect(() => {
    if (PREVIEW_MODE) return
    let alive = true

    async function fetchRole() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        if (alive) setLoading(false)
        return
      }
      const userId = userData.user.id

      // 1. Check platform-level super_user first
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle()
      const platformRole = (profile?.role as TeamRole | null) ?? null

      if (platformRole === "super_user") {
        if (alive) { setActualRole("super_user"); setLoading(false) }
        return
      }

      // 2. Read role from organization_members for the current org
      const orgId = typeof localStorage !== "undefined" ? localStorage.getItem(ORG_KEY) : null
      if (!orgId) {
        if (alive) { setActualRole(platformRole); setLoading(false) }
        return
      }

      const { data: member } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .maybeSingle()

      const orgRole = (member?.role as TeamRole | null) ?? platformRole
      if (alive) { setActualRole(orgRole); setLoading(false) }
    }

    void fetchRole()
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
  // View-as-RA is allowed for admin+ so program admins can QA the portal
  // their own RAs experience without needing super_user.
  const canViewAsRa = actualRole === "super_user" || actualRole === "owner" || actualRole === "admin"
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
    canViewAsRa,
    setViewAsRole,
    isOwner: effectiveRole === "owner" || effectiveRole === "super_user",
    isSuperUser: effectiveRole === "super_user",
    loading,
  }
}
