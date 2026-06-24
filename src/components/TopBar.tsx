import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Menu, LogOut, Sun, Moon, Eye, Check, Building2, ChevronsUpDown, UserCircle2, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AppSidebar } from "@/components/AppSidebar"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/lib/theme"
import { useRole } from "@/hooks/useRole"
import { useViewAsRa } from "@/hooks/useViewAsRa"
import { useOrganization } from "@/contexts/OrganizationContext"
import { getMyProfile, listRaAssociates } from "@/lib/data"
import type { RaAssociate, TeamRole } from "@/types/db"

function deriveDisplay(user: ReturnType<typeof useAuth>["user"]) {
  const meta = user?.user_metadata as { full_name?: string } | undefined
  const fullName = meta?.full_name ?? user?.email ?? "User"
  const initials =
    fullName
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
  return { fullName, initials }
}

const VIEW_AS_ROLES: { value: TeamRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "bd", label: "BD" },
  { value: "partner", label: "Partner" },
]

export function TopBar() {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const { fullName, initials } = deriveDisplay(user)
  const { role, canViewAs, canViewAsRa, viewAs, setViewAsRole } = useRole()
  const { viewAsRa, setViewAsRa, clear: clearViewAsRa } = useViewAsRa()
  const { currentOrg, orgs } = useOrganization()

  // RAs available for impersonation. Loaded lazily once when the admin opens
  // the dropdown — the list rarely changes during a session and the user has
  // to click through to see it anyway.
  const [raList, setRaList] = useState<RaAssociate[] | null>(null)
  const [raQuery, setRaQuery] = useState("")
  async function loadRas() {
    if (raList !== null) return
    try {
      const rows = await listRaAssociates()
      setRaList(rows)
    } catch {
      setRaList([])
    }
  }
  const raResults = useMemo(() => {
    if (!raList) return []
    const q = raQuery.trim().toLowerCase()
    const sorted = [...raList].sort((a, b) => a.display_name.localeCompare(b.display_name))
    if (!q) return sorted.slice(0, 25)
    return sorted.filter((r) =>
      r.display_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q)
    ).slice(0, 25)
  }, [raList, raQuery])

  function pickRa(ra: RaAssociate) {
    setViewAsRa({ userId: ra.user_id, displayName: ra.display_name, slug: ra.slug })
    navigate("/ra/dashboard")
  }

  useEffect(() => {
    getMyProfile()
      .then((p) => setAvatarUrl(p.avatar_url ?? null))
      .catch(() => { /* silently ignore */ })
  }, [user?.id])

  const ROLE_LABELS: Record<string, string> = {
    super_user: "Super",
    owner: "Owner",
    admin: "Admin",
    bd: "BD",
    partner: "Partner",
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-2 border-b bg-background px-4 md:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      {/* Current org display — click to switch if the user has multiple */}
      {currentOrg && (
        orgs.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex items-center gap-1.5 text-muted-foreground text-xs px-2"
            onClick={() => navigate("/select-org")}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[120px] truncate">{currentOrg.name}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0" />
          </Button>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground text-xs px-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[120px] truncate">{currentOrg.name}</span>
          </div>
        )
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm">{fullName}</span>
            {role && (
              <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] px-1.5 py-0">
                {ROLE_LABELS[role] ?? role}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">
            {user?.email}
          </DropdownMenuLabel>
          {currentOrg && (
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate pt-0">
              {currentOrg.name}
            </DropdownMenuLabel>
          )}
          <DropdownMenuSeparator />
          {orgs.length > 1 && (
            <>
              <DropdownMenuItem onClick={() => navigate("/select-org")}>
                <Building2 className="h-4 w-4" />
                Switch workspace
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {canViewAs && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Eye className="h-4 w-4" />
                  View as…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem onClick={() => setViewAsRole(null)}>
                    {!viewAs && <Check className="h-4 w-4" />}
                    <span className={viewAs ? "ml-6" : ""}>Super User (you)</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {VIEW_AS_ROLES.map((r) => (
                    <DropdownMenuItem
                      key={r.value}
                      onClick={() => setViewAsRole(r.value)}
                    >
                      {viewAs === r.value && <Check className="h-4 w-4" />}
                      <span className={viewAs === r.value ? "" : "ml-6"}>
                        {r.label}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}
          {canViewAsRa && (
            <>
              <DropdownMenuSub onOpenChange={(o) => { if (o) void loadRas() }}>
                <DropdownMenuSubTrigger>
                  <UserCircle2 className="h-4 w-4" />
                  View as RA…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-72 p-0">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search RAs…"
                        value={raQuery}
                        onChange={(e) => setRaQuery(e.target.value)}
                        className="h-8 pl-7 text-xs"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1">
                    {viewAsRa && (
                      <DropdownMenuItem onClick={clearViewAsRa} className="text-destructive focus:text-destructive">
                        <X className="h-3.5 w-3.5" />
                        Exit RA view (currently: {viewAsRa.displayName})
                      </DropdownMenuItem>
                    )}
                    {raList === null && (
                      <div className="p-3 text-xs text-muted-foreground text-center">Loading…</div>
                    )}
                    {raList !== null && raResults.length === 0 && (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        {raQuery ? "No RAs match." : "No RAs in this workspace."}
                      </div>
                    )}
                    {raResults.map((ra) => {
                      const isMe = user?.id === ra.user_id
                      return (
                        <DropdownMenuItem key={ra.id} onClick={() => pickRa(ra)}>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="truncate">
                              {ra.display_name}
                              {isMe && <span className="ml-1.5 text-[10px] text-primary">(your RA)</span>}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">{ra.email}</span>
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
