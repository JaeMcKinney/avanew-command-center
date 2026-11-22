import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Session } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { fetchAccess, type Access } from "@/lib/api"
import { setUserBrand } from "@/lib/brand"
import { supabase } from "@/lib/supabase"

type AuthValue = {
  /** True until we know whether someone is signed in and what they may do. */
  loading: boolean
  session: Session | null
  /** Who the person is and what they may do. Null if signed out or not set up. */
  access: Access | null
  can: (permission: string) => boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionLoaded(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  const accessQuery = useQuery({
    queryKey: ["access", userId],
    queryFn: fetchAccess,
    enabled: Boolean(userId),
    staleTime: 60_000,
  })

  // The signed-in person settles whose name and look the app wears: their
  // agency's, or Divigner's. Signed out, the address the page was opened at decides.
  const known = !userId || accessQuery.isFetched
  const agency = userId ? (accessQuery.data?.is_active ? accessQuery.data.agency : null) : undefined
  useEffect(() => {
    if (known) setUserBrand(agency)
  }, [known, agency])

  const value = useMemo<AuthValue>(() => {
    const access = userId ? (accessQuery.data ?? null) : null
    return {
      loading: !sessionLoaded || (Boolean(userId) && accessQuery.isPending),
      session,
      access: access?.is_active ? access : null,
      can: (permission) => Boolean(access?.is_active && access.permissions.includes(permission)),
      signOut: async () => {
        await supabase.auth.signOut()
        queryClient.clear()
      },
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: ["access"] })
      },
    }
  }, [session, sessionLoaded, userId, accessQuery.data, accessQuery.isPending, queryClient])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
