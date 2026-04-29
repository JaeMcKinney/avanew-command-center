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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/hooks/usePermissions"

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

function SidebarLink({
  to,
  label,
  icon: Icon,
  sub,
  onNavigate,
}: NavItem & { sub?: boolean; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === "/cashflow"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
          sub ? "pl-8 pr-3" : "px-3",
          isActive
            ? "bg-sidebar-accent text-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
          {label}
        </>
      )}
    </NavLink>
  )
}

function ModuleGroup({
  label,
  icon: Icon,
  items,
  defaultOpen,
  onNavigate,
}: {
  label: string
  icon: LucideIcon
  items: NavItem[]
  defaultOpen?: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
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

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  const { can } = usePermissions()
  const crmActive = CRM_PATHS.some((p) => location.pathname.startsWith(p))
  const cashflowActive = location.pathname.startsWith("/cashflow")

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-4 gap-2">
        <div className="h-7 w-7 rounded-md bg-primary grid place-items-center shrink-0">
          <span className="text-xs font-bold text-primary-foreground">AC</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            Avanew<span className="text-primary"> Command</span>
          </p>
          <p className="text-[10px] text-sidebar-foreground/50 leading-tight tracking-wide uppercase">
            Center
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <SidebarLink to="/dashboard" label="Dashboard" icon={LayoutDashboard} onNavigate={onNavigate} />

        <div className="pt-2 pb-1 px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">
          Modules
        </div>

        <ModuleGroup label="CRM" icon={Briefcase} items={CRM_ITEMS} defaultOpen={crmActive} onNavigate={onNavigate} />

        <SidebarLink to="/tasks" label="Tasks" icon={CheckSquare} onNavigate={onNavigate} />

        {can("cashflow.view") && (
          <ModuleGroup label="Cashflow" icon={TrendingUp} items={CASHFLOW_ITEMS} defaultOpen={cashflowActive} onNavigate={onNavigate} />
        )}

        <div className="pt-2 pb-1 px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">
          Relationships
        </div>

        <SidebarLink to="/partners" label="Partners" icon={Handshake} onNavigate={onNavigate} />
        <SidebarLink to="/vendors" label="Vendors" icon={Truck} onNavigate={onNavigate} />

        <div className="pt-2 pb-1 px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">
          System
        </div>

        <SidebarLink to="/settings" label="Settings" icon={Settings} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
        v0.1 · ACC
      </div>
    </div>
  )
}
