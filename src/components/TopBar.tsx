import { useEffect, useState } from "react"
import { Menu, LogOut, Sun, Moon, Eye, Check } from "lucide-react"
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
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/lib/theme"
import { useRole } from "@/hooks/useRole"
import { getMyProfile } from "@/lib/data"
import type { TeamRole } from "@/types/db"

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
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const { fullName, initials } = deriveDisplay(user)
  const { role, canViewAs, viewAs, setViewAsRole } = useRole()

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
          <DropdownMenuSeparator />
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
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
