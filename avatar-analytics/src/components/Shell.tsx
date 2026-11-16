// Page frames. On a phone the navigation is a tab bar at the bottom of the
// screen; on a wider screen it is a sidebar (staff) or a row of tabs (clients).

import { LogOut, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

function SkipLink() {
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
      Skip to main content
    </a>
  )
}

export function DivignerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="6" fill="#2F5BFF" />
      <path d="M10 8h6a8 8 0 0 1 0 16h-6z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

function BottomTabs({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {items.slice(0, 5).map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn("flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                  isActive ? "text-primary-text" : "text-muted-foreground")
              }
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          </li>
        ))}
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
      <aside className="hidden bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-6 md:p-4">
        <div className="flex items-center gap-2 px-2 pt-1">
          <DivignerMark />
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold">Divigner</p>
            <p className="text-xs text-sidebar-muted">Avatar Analytics</p>
          </div>
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
        <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <DivignerMark />
            <span className="font-display text-base font-semibold">Avatar Analytics</span>
          </div>
          <UserBlock tone="plain" />
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
      <header className="border-b bg-card">
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
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-24 outline-none *:min-w-0 sm:px-6 md:pb-10">
        {children}
      </main>
      <footer className="hidden items-center justify-center gap-2 border-t py-4 text-xs text-muted-foreground md:flex">
        <DivignerMark className="size-4" /> Avatar analytics by Divigner
      </footer>
      <BottomTabs items={items} label="Main" />
    </div>
  )
}
