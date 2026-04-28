import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { TeamRole } from "@/types/db"

const PREVIEW_MODE = import.meta.env.VITE_PREVIEW_MODE === "true"

export function useRole() {
  const [role, setRole] = useState<TeamRole | null>(PREVIEW_MODE ? "super_user" : null)
  const [loading, setLoading] = useState(!PREVIEW_MODE)

  useEffect(() => {
    if (PREVIEW_MODE) return
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
            setRole((profile?.role as TeamRole | null) ?? null)
            setLoading(false)
          }
        })
    })
    return () => { alive = false }
  }, [])

  return {
    role,
    isOwner: role === "owner" || role === "super_user",
    isSuperUser: role === "super_user",
    loading,
  }
}
