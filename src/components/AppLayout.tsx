import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { TopBar } from "@/components/TopBar"
// import { AVE } from "@/components/AVE"
import { ViewAsBanner } from "@/components/ViewAsBanner"
import { ScrollToTopButton } from "@/components/ScrollToTopButton"

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
