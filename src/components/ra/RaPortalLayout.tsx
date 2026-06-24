import { useEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { getRaAssociate } from "@/lib/data"
import { useTheme } from "@/lib/theme"
import { RaSidebar } from "@/components/ra/RaSidebar"
import { ScrollToTopButton } from "@/components/ScrollToTopButton"
import { ViewAsBanner } from "@/components/ViewAsBanner"
import type { RaAssociate } from "@/types/db"

function getInitials(name: string | null | undefined) {
  if (!name) return "RA"
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function ScrollToTopOnNavigate() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }) }, [pathname])
  return null
}

/**
 * Light staff-CRM-style shell for the Referral Associate portal: collapsible
 * sidebar + slim topbar + scrollable content. Mirrors AppLayout structure so
 * the RA's portal feels like the same product as the staff CRM, while only
 * exposing RA-appropriate navigation and data.
 */
export function RaPortalLayout() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("ra-sidebar:collapsed") === "1"
  )

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem("ra-sidebar:collapsed", next ? "1" : "0")
      return next
    })

  useEffect(() => {
    void getRaAssociate().then((r) => setRa(r)).catch(() => {})
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <ScrollToTopOnNavigate />
      <aside
        className={cn(
          "hidden md:flex md:flex-col border-r border-sidebar-border transition-[width] duration-200",
          collapsed ? "md:w-[72px]" : "md:w-64"
        )}
      >
        <RaSidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ViewAsBanner />
        {/* Topbar */}
        <header className="flex h-14 items-center justify-end gap-2 border-b bg-background px-4 md:px-6">
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-2.5 pl-1">
            {ra?.photo_url ? (
              <img src={ra.photo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {getInitials(ra?.full_name ?? ra?.display_name)}
              </div>
            )}
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-sm font-medium">{ra?.display_name ?? ra?.full_name ?? "Referral Associate"}</span>
              <span className="text-[11px] text-muted-foreground">Referral Associate</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="ml-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <ScrollToTopButton />
    </div>
  )
}
