import { Activity as ActivityIcon, Bot, Building2, LayoutDashboard, Users } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { StaffShell, type NavItem } from "@/components/Shell"
import { EmptyState, LoadingBlock } from "@/components/States"
import { useAuth } from "@/hooks/useAuth"
import AcceptInvite from "@/pages/AcceptInvite"
import Login from "@/pages/Login"
import Activity from "@/pages/admin/Activity"
import Avatars from "@/pages/admin/Avatars"
import ClientDetail from "@/pages/admin/ClientDetail"
import ClientNew from "@/pages/admin/ClientNew"
import Clients from "@/pages/admin/Clients"
import Overview from "@/pages/admin/Overview"
import Team from "@/pages/admin/Team"
import Conversations from "@/pages/portal/Conversations"
import Questions from "@/pages/portal/Questions"
import Dashboard from "@/pages/portal/Dashboard"
import PortalAvatars from "@/pages/portal/PortalAvatars"
import PortalLayout from "@/pages/portal/PortalLayout"
import PortalTeam from "@/pages/portal/PortalTeam"

/** After moving to another page, puts keyboard focus at the start of its content. */
function FocusOnNavigate() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.getElementById("main")?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, access } = useAuth()
  if (loading) return <LoadingBlock label="Loading" />
  if (!access) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Sends each person to their own home: staff to admin, clients to their portal. */
function Home() {
  const { access } = useAuth()
  if (access?.side === "client" && access.client) return <Navigate to={`/c/${access.client.slug}`} replace />
  return <Navigate to="/admin" replace />
}

function Need({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(permission)) return <EmptyState title="You do not have access to this page">Ask an Owner if you need it.</EmptyState>
  return <>{children}</>
}

function AdminLayout() {
  const { access, can } = useAuth()
  if (access?.side !== "divigner") return <Navigate to="/" replace />
  const items: NavItem[] = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/clients", label: "Clients", icon: Building2 },
    ...(can("avatars.link") ? [{ to: "/admin/avatars", label: "Avatars", icon: Bot }] : []),
    { to: "/admin/team", label: "Team", icon: Users },
    ...(can("audit.view") ? [{ to: "/admin/activity", label: "Activity", icon: ActivityIcon }] : []),
  ]
  return (
    <StaffShell items={items}>
      <Outlet />
    </StaffShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <FocusOnNavigate />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Need permission="analytics.view"><Overview /></Need>} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/new" element={<Need permission="clients.manage"><ClientNew /></Need>} />
          <Route path="clients/:slug" element={<ClientDetail />} />
          <Route path="avatars" element={<Need permission="avatars.link"><Avatars /></Need>} />
          <Route path="team" element={<Team />} />
          <Route path="activity" element={<Need permission="audit.view"><Activity /></Need>} />
        </Route>
        <Route path="/c/:slug" element={<RequireAuth><PortalLayout /></RequireAuth>}>
          <Route index element={<Need permission="analytics.view"><Dashboard /></Need>} />
          <Route path="conversations" element={<Need permission="transcripts.view"><Conversations /></Need>} />
          <Route path="questions" element={<Questions />} />
          <Route path="avatars" element={<Need permission="embeds.view"><PortalAvatars /></Need>} />
          <Route path="team" element={<Need permission="client_users.manage"><PortalTeam /></Need>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
