import { NavLink } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Kanban,
  ClipboardList,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Mirror of the staff AppSidebar chrome, but scoped to the Referral Associate
// portal: only Dashboard / Deals / Activities / Settings. No Leads, Accounts,
// Contacts, Reports, Cashflow, or Relationships — RAs only ever see their own
// referred pipeline, never org-wide CRM or company financials.

const DIVIGNER_LOGO_LIGHT = "/logos/divigner-logo-light.png"
const DIVIGNER_LOGO_DARK = "/logos/divigner-logo-dark.png"
const DIVIGNER_ICON = "/logos/divigner-icon-clean.png"

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const DASHBOARD_ITEM: NavItem = { to: "/ra/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }

const MODULE_ITEMS: NavItem[] = [
  { to: "/ra/deals", label: "Deals", icon: Kanban },
  { to: "/ra/activities", label: "Activities", icon: ClipboardList },
]

const SETTINGS_ITEM: NavItem = { to: "/ra/settings", label: "Settings", icon: Settings }

function RailTooltip({ show, label, children }: { show: boolean; label: string; children: React.ReactNode }) {
  if (!show) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarLink({ to, label, icon: Icon, end, collapsed, onNavigate }: NavItem & { collapsed?: boolean; onNavigate?: () => void }) {
  // See AppSidebar SidebarLink for why collapsed links go through a flex
  // wrapper instead of relying on mx-auto on the NavLink directly.
  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center rounded-md py-2 text-sm font-medium transition-colors",
          collapsed ? "h-10 w-10 justify-center px-0" : "gap-3 px-3",
          isActive
            ? "bg-sidebar-accent text-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
          {!collapsed && label}
        </>
      )}
    </NavLink>
  )
  if (collapsed) {
    return (
      <RailTooltip show label={label}>
        <div className="flex justify-center">{link}</div>
      </RailTooltip>
    )
  }
  return link
}

function SectionLabel({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) return <div className="my-3 mx-auto h-px w-8 bg-sidebar-border" />
  return (
    <div className="pt-2 pb-1 px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">
      {label}
    </div>
  )
}

export function RaSidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { theme } = useTheme()

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative flex h-full flex-col bg-sidebar text-sidebar-foreground">
        {onToggleCollapse && (
          <RailTooltip show={collapsed} label="Expand sidebar">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "absolute top-2.5 z-20 grid h-8 w-8 place-items-center rounded-md",
                "border border-sidebar-border bg-sidebar-accent text-sidebar-foreground",
                "shadow-sm hover:bg-primary/15 hover:text-primary hover:border-primary/40 transition-colors",
                collapsed ? "left-1/2 -translate-x-1/2" : "right-2"
              )}
            >
              {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            </button>
          </RailTooltip>
        )}

        <div className={cn("flex items-center justify-center border-b border-sidebar-border", collapsed ? "h-24 px-2 pt-12 pb-3" : "h-28 px-4")}>
          {collapsed ? (
            <img src={DIVIGNER_ICON} alt="Divigner" className="mx-auto h-10 w-10 rounded-md object-contain" />
          ) : (
            <div className="relative flex h-20 w-full max-w-[200px] items-center justify-center">
              <img
                src={DIVIGNER_LOGO_LIGHT}
                alt="Divigner"
                className={cn("absolute h-20 w-auto max-w-[200px] object-contain transition-opacity duration-150", theme === "light" ? "opacity-100" : "opacity-0")}
              />
              <img
                src={DIVIGNER_LOGO_DARK}
                alt="Divigner"
                className={cn("absolute h-20 w-auto max-w-[200px] object-contain transition-opacity duration-150", theme === "dark" ? "opacity-100" : "opacity-0")}
              />
            </div>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto", collapsed ? "space-y-1.5 px-2 pt-5 pb-3" : "space-y-1 p-3")}>
          <SidebarLink {...DASHBOARD_ITEM} collapsed={collapsed} onNavigate={onNavigate} />
          <SectionLabel label="Modules" collapsed={collapsed} />
          {MODULE_ITEMS.map((item) => (
            <SidebarLink key={item.to} {...item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
          <SectionLabel label="System" collapsed={collapsed} />
          <SidebarLink {...SETTINGS_ITEM} collapsed={collapsed} onNavigate={onNavigate} />
        </nav>

        {!collapsed && (
          <div className="border-t border-sidebar-border p-2">
            <div className="px-3 pt-1 text-xs text-sidebar-foreground/40">Referral Associate Portal</div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
