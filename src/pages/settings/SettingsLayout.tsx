import { useState } from "react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  User,
  Building2,
  Users,
  Kanban,
  Landmark,
  Handshake,
  ShieldCheck,
  Bell,
  Palette,
  Plug2,
  Lock,
  LayoutTemplate,
  ScrollText,
  Database,
  Server,
  Menu,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"
import type { TeamRole } from "@/types/db"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  description: string
  allow?: TeamRole[]
}

type NavGroup = {
  group: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: "Account",
    items: [
      {
        to: "/settings/profile",
        label: "User Management",
        icon: User,
        description: "Profile and preferences",
      },
      {
        to: "/settings/company",
        label: "Company Profile",
        icon: Building2,
        description: "Business identity and info",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/team",
        label: "Team / Organization",
        icon: Users,
        description: "Members, roles, and structure",
        allow: ["super_user", "admin"],
      },
    ],
  },
  {
    group: "Configuration",
    items: [
      {
        to: "/settings/pipeline",
        label: "Pipeline / Deal Settings",
        icon: Kanban,
        description: "Stage management and deal flow",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/financial",
        label: "Financial Settings",
        icon: Landmark,
        description: "Bank connections and sync",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/partners-vendors",
        label: "Partner & Vendor Settings",
        icon: Handshake,
        description: "External relationship config",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/landing-pages",
        label: "RA Page Templates",
        icon: LayoutTemplate,
        description: "Demo & refer page templates",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/roles",
        label: "Roles & Permissions",
        icon: ShieldCheck,
        description: "Role matrix and access control",
        allow: ["super_user", "admin"],
      },
    ],
  },
  {
    group: "Preferences",
    items: [
      {
        to: "/settings/notifications",
        label: "Notifications",
        icon: Bell,
        description: "Alert channels and preferences",
      },
      {
        to: "/settings/branding",
        label: "Branding / UI Settings",
        icon: Palette,
        description: "Visual theme and appearance",
        allow: ["super_user", "admin"],
      },
    ],
  },
  {
    group: "System",
    items: [
      {
        to: "/settings/integrations",
        label: "Integrations",
        icon: Plug2,
        description: "Third-party API credentials",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/security",
        label: "Security",
        icon: Lock,
        description: "Authentication and session policies",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/audit-logs",
        label: "Audit Logs",
        icon: ScrollText,
        description: "Activity and access history",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/data",
        label: "Data Management",
        icon: Database,
        description: "Import, export, and cleanup",
        allow: ["super_user", "admin"],
      },
      {
        to: "/settings/system",
        label: "System Preferences",
        icon: Server,
        description: "Platform-level configuration",
        allow: ["super_user", "admin"],
      },
    ],
  },
]

const COLLAPSE_KEY = "settings-sidebar:collapsed"

function canSee(item: NavItem, role: TeamRole | null): boolean {
  if (!role) return false
  if (role === "super_user") return true
  if (!item.allow) return true
  return item.allow.includes(role)
}

function NavItemLink({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  const link = (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-md text-sm transition-colors",
          collapsed ? "justify-center p-2" : "px-3 py-2",
          isActive
            ? "bg-sidebar-accent text-primary font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-primary" : "text-sidebar-foreground/50"
            )}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarNav({ role, collapsed, onNavigate }: { role: TeamRole | null; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <TooltipProvider>
      <nav className={collapsed ? "space-y-3" : "space-y-4"}>
        {NAV_GROUPS.map((group, gi) => {
          const visible = group.items.filter((item) => canSee(item, role))
          if (!visible.length) return null
          return (
            <div key={group.group}>
              {collapsed
                ? gi > 0 && <div className="mx-2 mb-2 border-t border-border/50" aria-hidden />
                : (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group.group}
                  </p>
                )}
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavItemLink key={item.to} item={item} collapsed={collapsed} onClick={onNavigate} />
                ))}
              </div>
            </div>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}

function MobileNav({ role }: { role: TeamRole | null }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const allItems = NAV_GROUPS.flatMap((g) => g.items).filter((i) => canSee(i, role))
  const current = allItems.find((i) => location.pathname === i.to || location.pathname.startsWith(i.to + "/"))

  return (
    <div className="lg:hidden flex items-center gap-3 mb-4 pb-4 border-b border-border">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Menu className="h-4 w-4" />
            {current ? current.label : "Settings"}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 py-4 border-b border-border">
            <SheetTitle className="text-base">Settings</SheetTitle>
          </SheetHeader>
          <div className="p-3 overflow-y-auto">
            <SidebarNav role={role} collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      {current && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <span className="text-muted-foreground/50">Settings</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          <span className="font-medium text-foreground truncate">{current.label}</span>
        </div>
      )}
    </div>
  )
}

export function SettingsLayout() {
  const { role } = useRole()
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(COLLAPSE_KEY) === "1"
  )

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0") } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div>
      <MobileNav role={role} />
      <div className="flex gap-8 items-start">
        <aside
          className={cn(
            "hidden lg:block sticky top-0 self-start shrink-0 transition-[width] duration-200",
            collapsed ? "w-14" : "w-52 xl:w-56"
          )}
        >
          <div className={cn("flex items-center mb-3", collapsed ? "justify-center" : "justify-between px-3")}>
            {!collapsed && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Settings
              </p>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand settings sidebar" : "Collapse settings sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
            >
              {collapsed
                ? <ChevronsRight className="h-3.5 w-3.5" />
                : <ChevronsLeft className="h-3.5 w-3.5" />}
            </button>
          </div>
          <SidebarNav role={role} collapsed={collapsed} />
        </aside>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
