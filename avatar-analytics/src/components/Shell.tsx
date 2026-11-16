// Page frames. On a phone the navigation is a tab bar at the bottom of the
// screen; on a wider screen it is a sidebar (staff) or a row of tabs (clients).

import { Ellipsis, LogOut, type LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/useAuth"
import logoOnDark from "@/assets/divigner-logo-on-dark.webp"
import logoOnLight from "@/assets/divigner-logo-on-light.webp"
import { cn } from "@/lib/utils"

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

function SkipLink() {
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
      Skip to main content
    </a>
  )
}

/** The Divigner Group logo, in the version that suits the surface it sits on. */
export function DivignerLogo({ on = "auto", className }: { on?: "dark" | "auto"; className?: string }) {
  if (on === "dark") return <img src={logoOnDark} alt="Divigner Group" width={626} height={200} className={cn("h-12 w-auto", className)} />
  return (
    <>
      <img src={logoOnLight} alt="Divigner Group" width={626} height={200} className={cn("h-12 w-auto dark:hidden", className)} />
      <img src={logoOnDark} alt="Divigner Group" width={626} height={200} className={cn("hidden h-12 w-auto dark:block", className)} />
    </>
  )
}

const TAB_CLASS = "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium"

/** Phone navigation. Five places fit; with more, the last tab becomes "More" and opens the rest. */
function BottomTabs({ items, label }: { items: NavItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const shown = items.length > 5 ? items.slice(0, 4) : items
  const rest = items.slice(shown.length)
  const inRest = rest.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {shown.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink to={item.to} end={item.end} className={({ isActive }) => cn(TAB_CLASS, isActive ? "text-primary-text" : "text-muted-foreground")}>
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          </li>
        ))}
        {rest.length > 0 && (
          <li className="flex-1">
            <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={cn(TAB_CLASS, inRest ? "text-primary-text" : "text-muted-foreground")}>
              <Ellipsis className="size-5" aria-hidden="true" />
              More
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>More</DialogTitle>
                  <DialogDescription className="sr-only">Other pages</DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col">
                  {rest.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to} end={item.end} onClick={() => setOpen(false)}
                        className={({ isActive }) => cn("flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-medium", isActive ? "bg-muted text-primary-text" : "text-foreground")}
                      >
                        <item.icon className="size-5" aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </DialogContent>
            </Dialog>
          </li>
        )}
      </ul>
    </nav>
  )
}

function UserBlock({ tone }: { tone: "sidebar" | "plain" }) {
  const { access, signOut } = useAuth()
  if (!access) return null
  return (
    <div className="flex items-center gap-3">
      <div className="hidden min-w-0 text-right sm:block md:text-left">
        <p className="truncate text-sm font-medium">{access.full_name || access.email}</p>
        <p className={cn("truncate text-xs", tone === "sidebar" ? "text-sidebar-muted" : "text-muted-foreground")}>{access.role.name}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void signOut()}
        className={cn("min-h-10 shrink-0", tone === "sidebar" && "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground")}
      >
        <LogOut aria-hidden="true" />
        Sign out
      </Button>
    </div>
  )
}

export function StaffShell({ items, children }: { items: NavItem[]; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <SkipLink />
      <aside className="hidden border-r border-sidebar-border bg-linear-to-b from-[#081521] via-[#0b1c2b] to-[#14374b] text-sidebar-foreground md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-6 md:p-4">
        <div className="flex flex-col items-start gap-1.5 px-2 pt-2">
          <DivignerLogo on="dark" className="h-14" />
          <p className="text-xs font-medium tracking-[0.18em] text-sidebar-muted uppercase">Avatar Analytics</p>
        </div>
        <nav aria-label="Main" className="flex-1">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn("flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
                      isActive ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")
                  }
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-sidebar-border pt-4">
          <UserBlock tone="sidebar" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="site-header md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-3">
              <DivignerLogo className="h-9" />
              <span className="sr-only">Avatar Analytics</span>
            </div>
            <UserBlock tone="plain" />
          </div>
          <div aria-hidden="true" className="edge-line" />
        </header>
        <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-24 outline-none *:min-w-0 sm:px-6 md:pb-10">
          {children}
        </main>
      </div>
      <BottomTabs items={items} label="Main" />
    </div>
  )
}

export function PortalShell({
  clientName,
  logoUrl,
  items,
  banner,
  children,
}: {
  clientName: string
  logoUrl: string | null
  items: NavItem[]
  banner?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      {banner}
      <header className="site-header border-b">
        {/* The client's colour, as a thin band across the top. */}
        <div aria-hidden="true" className="h-1.5 bg-brand" />
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 max-w-36 object-contain" />
            ) : (
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md bg-brand font-display text-lg font-semibold text-brand-foreground">
                {clientName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <p className="truncate font-display text-lg font-semibold">{clientName}</p>
          </div>
          <UserBlock tone="plain" />
        </div>
        <nav aria-label="Main" className="mx-auto hidden w-full max-w-6xl px-4 sm:px-6 md:block">
          <ul className="flex gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn("flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium",
                      isActive ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-10 outline-none *:min-w-0 sm:px-6">
        {children}
      </main>
      <footer className="mb-16 md:mb-0">
        <div aria-hidden="true" className="edge-line" />
        <div className="flex flex-col items-center gap-1.5 px-4 py-5 text-xs text-muted-foreground">
          <DivignerLogo className="h-11" />
          <p className="tracking-[0.14em] uppercase">Avatar analytics by Divigner Group</p>
        </div>
      </footer>
      <BottomTabs items={items} label="Main" />
    </div>
  )
}
