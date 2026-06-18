import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { TopBar } from "@/components/TopBar"
// import { AVE } from "@/components/AVE"
import { ViewAsBanner } from "@/components/ViewAsBanner"
import { ScrollToTopButton } from "@/components/ScrollToTopButton"
import { getRaPortalRedirect } from "@/lib/data"

/**
 * Forces window scroll to top whenever the route pathname changes — so
 * opening a record always anchors the view at the page header instead of
 * inheriting the scroll position from the previous page (or being yanked
 * down by an auto-focused field).
 */
function ScrollToTopOnNavigate() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [pathname])
  return null
}

export function AppLayout() {
  const navigate = useNavigate()
  // Gate the entire staff CRM behind an RA check. Referral Associates must never
  // see CRM chrome OR data — and because CRM tables aren't RLS-isolated, we block
  // render (not just redirect from an effect) so an RA who lands here sees a
  // loader, never a flash of real pipeline/contact data, before the bounce.
  // Resolves instantly to "staff" in preview mode and fails open to staff on error.
  const [gate, setGate] = useState<"checking" | "staff" | "ra">("checking")

  useEffect(() => {
    let alive = true
    getRaPortalRedirect()
      .then((path) => {
        if (!alive) return
        if (path) { setGate("ra"); navigate(path, { replace: true }) }
        else setGate("staff")
      })
      .catch(() => { if (alive) setGate("staff") })
    return () => { alive = false }
  }, [navigate])

  if (gate !== "staff") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <ScrollToTopOnNavigate />
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-sidebar-border">
        <AppSidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ViewAsBanner />
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      {/* <AVE /> */}
      <ScrollToTopButton />
    </div>
  )
}
