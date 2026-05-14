import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { listMyOrganizations, setCurrentOrg } from "@/lib/data"
import { supabase } from "@/lib/supabase"
import type { OrgWithRole } from "@/types/db"

const ORG_KEY = "avanew-crm.current-org-id"

interface OrgContextValue {
  orgs: OrgWithRole[]
  currentOrg: OrgWithRole | null
  selectOrg: (org: OrgWithRole) => void
  loading: boolean
  refresh: () => Promise<void>
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<OrgWithRole[]>([])
  const [currentOrg, setCurrentOrgState] = useState<OrgWithRole | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const list = await listMyOrganizations()
      setOrgs(list)

      // Restore persisted org selection
      const savedId = localStorage.getItem(ORG_KEY)
      const saved = list.find((o) => o.id === savedId) ?? null

      if (saved) {
        setCurrentOrgState(saved)
        setCurrentOrg(saved.id)
      } else if (list.length === 1) {
        // Auto-select if user only belongs to one org
        setCurrentOrgState(list[0])
        setCurrentOrg(list[0].id)
        localStorage.setItem(ORG_KEY, list[0].id)
      } else {
        setCurrentOrgState(null)
        setCurrentOrg(null)
      }
    } catch {
      // ignore — user may not be authenticated yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    // Re-fetch orgs when auth state changes (sign-in / sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void refresh()
      } else if (event === "SIGNED_OUT") {
        setOrgs([])
        setCurrentOrgState(null)
        setCurrentOrg(null)
        localStorage.removeItem(ORG_KEY)
      }
    })

    return () => subscription.unsubscribe()
  }, [refresh])

  const selectOrg = useCallback((org: OrgWithRole) => {
    setCurrentOrgState(org)
    setCurrentOrg(org.id)
    localStorage.setItem(ORG_KEY, org.id)
  }, [])

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, selectOrg, loading, refresh }}>
      {children}
    </OrgContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrganization() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider")
  return ctx
}
