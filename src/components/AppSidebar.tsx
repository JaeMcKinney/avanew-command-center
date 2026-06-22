import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  ClipboardList,
  BarChart3,
  Settings,
  UserPlus,
  CheckSquare,
  TrendingUp,
  ChevronDown,
  Briefcase,
  Receipt,
  Handshake,
  Truck,
  BarChart2,
  Landmark,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"
import { useRole } from "@/hooks/useRole"
import { useOrganization } from "@/contexts/OrganizationContext"
import { useTheme } from "@/lib/theme"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Per-org branding config keyed by slug
const ORG_BRANDING: Record<string, {
  logoLight: string   // shown in light mode
  logoDark: string    // shown in dark mode
  icon: string        // square icon for fallback
  name: string
  wordmark?: boolean  // true = logo is a wordmark (use img), false = use icon + text
}> = {
  avanew: {
    logoLight: "/logos/avanew-logo.svg",
    logoDark: "/logos/avanew-logo-white.svg",
    icon: "/logos/avanew-icon.svg",
    name: "Avanew Command Center",
    wordmark: true,
  },
  divigner: {
    logoLight: "/logos/divigner-logo-light.png",
    logoDark: "/logos/divigner-logo-dark.png",
    icon: "/logos/divigner-icon-clean.png",
    name: "Divigner",
    wordmark: true,
  },
}

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const CRM_ITEMS: NavItem[] = [
  { to: "/leads", label: "Leads", icon: UserPlus },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/deals", label: "Deals", icon: Kanban },
  { to: "/activities", label: "Activities", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: BarChart3 },
]

const CASHFLOW_ITEMS: NavItem[] = [
  { to: "/cashflow", label: "Dashboard", icon: BarChart2 },
  { to: "/cashflow/transactions", label: "Transactions", icon: Receipt },
  { to: "/cashflow/bank-connections", label: "Bank Connections", icon: Landmark },
]

const CRM_PATHS = CRM_ITEMS.map((i) => i.to)

/** Wraps a trigger with a right-side tooltip — only when the rail is collapsed. */
function RailTooltip({
  show,
  label,
  children,
}: {
  show: boolean
  label: string
  children: React.ReactNode
}) {
  if (!show) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  sub,
  collapsed,
  onNavigate,
}: NavItem & { sub?: boolean; collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <RailTooltip show={!!collapsed} label={label}>
      <NavLink
        to={to}
        end={to === "/cashflow"}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "group flex items-center rounded-md py-2 text-sm font-medium transition-colors",
            collapsed
              ? "mx-auto h-9 w-9 justify-center px-0"
              : sub
                ? "gap-3 pl-8 pr-3"
                : "gap-3 px-3",
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
    </RailTooltip>
  )
}

function ModuleGroup({
  label,
  icon: Icon,
  items,
  defaultOpen,
  collapsed,
  onExpand,
  onNavigate,
}: {
  label: string
  icon: LucideIcon
  items: NavItem[]
  defaultOpen?: boolean
  collapsed?: boolean
  onExpand?: () => void
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  // Collapsed: a single icon. Clicking expands the rail so the user can drill in.
  if (collapsed) {
    return (
      <RailTooltip show label={label}>
        <button
          type="button"
          onClick={onExpand}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
        </button>
      </RailTooltip>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform text-sidebar-foreground/40", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <SidebarLink key={item.to} {...item} sub onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Section header in the nav — text label when expanded, a thin divider when collapsed. */
function SectionLabel({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) {
    return <div className="my-2 mx-auto h-px w-6 bg-sidebar-border" />
  }
  return (
    <div className="pt-2 pb-1 px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">
      {label}
    </div>
  )
}

export function AppSidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const location = useLocation()
  const { can } = usePermissions()
  const { role } = useRole()
  const { currentOrg } = useOrganization()
  const { theme } = useTheme()
  // Referral Associates never belong in the staff CRM (AppLayout bounces them
  // out), but if one briefly renders here, hide the Relationship module + Tasks.
  const isRa = role != null && (role as string) === "referral_associate"
  const isLimitedRole = role === "bd" || role === "partner" || isRa
  const crmActive = CRM_PATHS.some((p) => location.pathname.startsWith(p))
  const cashflowActive = location.pathname.startsWith("/cashflow")

  const slug = currentOrg?.slug ?? ""
  const branding = ORG_BRANDING[slug]
  const expand = () => { if (collapsed) onToggleCollapse?.() }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative flex h-full flex-col bg-sidebar text-sidebar-foreground">
        {/* Collapse toggle — pinned top, double-arrow, high contrast so it's
            easy to spot. Centered in the collapsed rail. */}
        {onToggleCollapse && (
          <RailTooltip show={collapsed} label="Expand sidebar">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "absolute top-2 z-20 grid h-7 w-7 place-items-center rounded-md",
                "border border-sidebar-border bg-sidebar-accent/70 text-sidebar-foreground",
                "shadow-sm hover:bg-sidebar-accent hover:text-primary transition-colors",
                collapsed ? "left-1/2 -translate-x-1/2" : "right-2"
              )}
            >
              {collapsed
                ? <ChevronsRight className="h-4 w-4" />
                : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </RailTooltip>
        )}
        <div
          className={cn(
            "flex items-center justify-center border-b border-sidebar-border",
            collapsed ? "h-16 px-2 pt-8" : "h-28 px-4"
          )}
        >
          {collapsed ? (
            // Collapsed rail: square icon only (or initials fallback).
            branding ? (
              <img
                src={branding.icon}
                alt={branding.name}
                className="h-9 w-9 rounded-md object-contain"
              />
            ) : (
              <div className="h-9 w-9 rounded-md bg-primary grid place-items-center shrink-0">
                <span className="text-sm font-bold text-primary-foreground">
                  {currentOrg?.name?.slice(0, 2).toUpperCase() ?? "AC"}
                </span>
              </div>
            )
          ) : branding?.wordmark ? (
            // Render BOTH variants always so they're decoded on mount.
            // Toggle is pure CSS opacity — zero fetch/decode lag on switch.
            <div className="relative flex h-20 w-full max-w-[200px] items-center justify-center">
              <img
                src={branding.logoLight}
                alt={branding.name}
                className={cn(
                  "absolute h-20 w-auto max-w-[200px] object-contain transition-opacity duration-150",
                  theme === "light" ? "opacity-100" : "opacity-0"
                )}
              />
              <img
                src={branding.logoDark}
                alt={branding.name}
                className={cn(
                  "absolute h-20 w-auto max-w-[200px] object-contain transition-opacity duration-150",
                  theme === "dark" ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          ) : branding ? (
            <div className="flex flex-col items-center gap-1">
              <img src={branding.icon} alt={branding.name} className="h-10 w-10 rounded-md object-cover" />
              <p className="text-xs font-semibold leading-tight truncate">{branding.name}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-md bg-primary grid place-items-center shrink-0">
                <span className="text-sm font-bold text-primary-foreground">
                  {currentOrg?.name?.slice(0, 2).toUpperCase() ?? "AC"}
                </span>
              </div>
              <p className="text-sm font-semibold leading-tight truncate">{currentOrg?.name ?? "Command Center"}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <SidebarLink to="/dashboard" label="Dashboard" icon={LayoutDashboard} collapsed={collapsed} onNavigate={onNavigate} />

          <SectionLabel label="Modules" collapsed={collapsed} />

          <ModuleGroup label="CRM" icon={Briefcase} items={CRM_ITEMS} defaultOpen={crmActive} collapsed={collapsed} onExpand={expand} onNavigate={onNavigate} />

          {!isLimitedRole && (
            <SidebarLink to="/tasks" label="Tasks" icon={CheckSquare} collapsed={collapsed} onNavigate={onNavigate} />
          )}

          {can("cashflow.view") && (
            <ModuleGroup
              label="Cashflow"
              icon={TrendingUp}
              items={CASHFLOW_ITEMS.filter((i) => i.to !== "/cashflow/bank-connections" || can("cashflow.bank_connections"))}
              defaultOpen={cashflowActive}
              collapsed={collapsed}
              onExpand={expand}
              onNavigate={onNavigate}
            />
          )}

          {!isLimitedRole && (
            <>
              <SectionLabel label="Relationships" collapsed={collapsed} />
              <SidebarLink to="/partners" label="Partners" icon={Handshake} collapsed={collapsed} onNavigate={onNavigate} />
              <SidebarLink to="/vendors" label="Vendors" icon={Truck} collapsed={collapsed} onNavigate={onNavigate} />
            </>
          )}

          <SectionLabel label="System" collapsed={collapsed} />

          <SidebarLink to="/settings" label="Settings" icon={Settings} collapsed={collapsed} onNavigate={onNavigate} />
        </nav>

        {!collapsed && (
          <div className="border-t border-sidebar-border p-2">
            <div className="px-3 pt-1 text-xs text-sidebar-foreground/40">v0.1 · ACC</div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
