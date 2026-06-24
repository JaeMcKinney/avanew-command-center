import { useEffect, useState, useCallback } from "react"

const VIEW_AS_RA_KEY = "avanew-crm.view-as-ra-user-id"
const VIEW_AS_RA_NAME_KEY = "avanew-crm.view-as-ra-name"
const VIEW_AS_RA_SLUG_KEY = "avanew-crm.view-as-ra-slug"
const VIEW_AS_RA_EVENT = "avanew-crm:view-as-ra-changed"

type ViewAsRa = {
  userId: string
  displayName: string
  slug: string
} | null

function read(): ViewAsRa {
  if (typeof localStorage === "undefined") return null
  const userId = localStorage.getItem(VIEW_AS_RA_KEY)
  if (!userId) return null
  return {
    userId,
    displayName: localStorage.getItem(VIEW_AS_RA_NAME_KEY) ?? "RA",
    slug: localStorage.getItem(VIEW_AS_RA_SLUG_KEY) ?? "",
  }
}

function write(next: ViewAsRa) {
  if (typeof localStorage === "undefined") return
  if (next) {
    localStorage.setItem(VIEW_AS_RA_KEY, next.userId)
    localStorage.setItem(VIEW_AS_RA_NAME_KEY, next.displayName)
    localStorage.setItem(VIEW_AS_RA_SLUG_KEY, next.slug)
  } else {
    localStorage.removeItem(VIEW_AS_RA_KEY)
    localStorage.removeItem(VIEW_AS_RA_NAME_KEY)
    localStorage.removeItem(VIEW_AS_RA_SLUG_KEY)
  }
  window.dispatchEvent(new Event(VIEW_AS_RA_EVENT))
}

/**
 * Admin-side hook for impersonating a Referral Associate in the RA portal.
 * Persists in localStorage so the impersonation survives full page reloads
 * (the data layer reads from the same key synchronously to override which
 * user_id is used in RA queries).
 */
export function useViewAsRa() {
  const [viewAsRa, setViewAsRaState] = useState<ViewAsRa>(() => read())

  useEffect(() => {
    function sync() { setViewAsRaState(read()) }
    window.addEventListener(VIEW_AS_RA_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(VIEW_AS_RA_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const setViewAsRa = useCallback((next: ViewAsRa) => { write(next) }, [])
  const clear = useCallback(() => { write(null) }, [])

  return { viewAsRa, setViewAsRa, clear }
}
