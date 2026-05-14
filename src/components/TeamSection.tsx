import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
  Users,
  Plus,
  Trash2,
  Shield,
  ShieldCheck,
  Crown,
  Briefcase,
  Mail,
  Target,
  Handshake,
} from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  PREVIEW_DATA_MODE,
  inviteTeamMember,
  listTeamMembers,
  removeTeamMember,
  updateTeamMemberRole,
} from "@/lib/data"
import { useRole } from "@/hooks/useRole"
import type { TeamMember, TeamRole } from "@/types/db"
import { cn } from "@/lib/utils"

const ROLE_META: Record<
  TeamRole,
  { label: string; description: string; icon: typeof Shield }
> = {
  super_user: {
    label: "Super User",
    description: "Platform-level authority. Full visibility and control over all CRM, financial, AI, integrations, users, audit logs, and system configuration.",
    icon: Crown,
  },
  owner: {
    label: "Owner",
    description: "Business intelligence authority. Full CRM access, Cashflow, AI Insights, AVE (AI Voice Experience), financial dashboards, and personal notification configuration. Cannot modify system-level settings or API credentials.",
    icon: Briefcase,
  },
  admin: {
    label: "Admin",
    description: "Operations control. Full access to all CRM modules, user management, system configuration, and non-financial notifications and reports. No access to Cashflow, financial dashboards, or bank integrations.",
    icon: ShieldCheck,
  },
  bd: {
    label: "BD",
    description: "Business Development. Create and edit assigned leads, contacts, and deals only. No access to financial data, AI, or reports.",
    icon: Target,
  },
  partner: {
    label: "Partner",
    description: "External partner. Access limited to shared or assigned partner-visible data only. No internal CRM, financial, or system access.",
    icon: Handshake,
  },
}

const STANDARD_ROLES: TeamRole[] = ["admin", "bd", "partner"]
const ALL_ROLES: TeamRole[] = ["super_user", "owner", "admin", "bd", "partner"]

const ROLE_BADGE_COLORS: Partial<Record<TeamRole, string>> = {
  super_user: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-300",
  owner: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300",
}

function initialsOf(name: string | null, email: string) {
  const source = (name && name.trim()) || email
  return (
    source
      .split(/[\s@]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
  )
}

export function TeamSection() {
  const { isSuperUser } = useRole()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const assignableRoles = isSuperUser ? ALL_ROLES : STANDARD_ROLES
  const [role, setRole] = useState<TeamRole>(() => {
    const saved = localStorage.getItem("avanew-crm.invite-role") as TeamRole | null
    return saved && ALL_ROLES.includes(saved) ? saved : "admin"
  })
  const [submitting, setSubmitting] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setMembers(await listTeamMembers())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load team")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    try {
      await inviteTeamMember({ email, full_name: name || null, role })
      toast.success(
        PREVIEW_DATA_MODE
          ? `Added ${email} (preview only)`
          : `Invite sent to ${email}`
      )
      setEmail("")
      setName("")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(member: TeamMember, next: TeamRole) {
    if (member.role === next) return
    try {
      await updateTeamMemberRole(member.id, next, member.status)
      toast.success(`${member.email} is now ${ROLE_META[next].label}`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role")
    }
  }

  async function handleRemove() {
    if (!confirmRemove) return
    try {
      await removeTeamMember(confirmRemove.id)
      toast.success(`Removed ${confirmRemove.email}`)
      setConfirmRemove(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team
        </CardTitle>
        <CardDescription>
          Add teammates and assign permissions. Roles control what each user
          can do in the workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {PREVIEW_DATA_MODE && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-primary font-medium">Preview mode:</strong>{" "}
            invites are local-only — no real emails are sent and no auth users
            are created. Disable preview mode and deploy the{" "}
            <code className="text-[11px]">invite-user</code> Supabase Edge
            Function (template included) to enable real invites.
          </div>
        )}

        <form
          onSubmit={handleInvite}
          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px_auto] gap-2 items-end"
        >
          <div className="space-y-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@avanew.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                const r = v as TeamRole
                setRole(r)
                localStorage.setItem("avanew-crm.invite-role", r)
              }}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    <span className="inline-flex items-center gap-2">
                      {ROLE_META[r].label}
                      {(r === "super_user" || r === "owner") && (
                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0", ROLE_BADGE_COLORS[r])}>
                          {r === "super_user" ? "Platform" : "Financial"}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={submitting || !email.trim()}>
            <Plus className="h-4 w-4" />
            {submitting ? "Adding..." : "Invite"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground -mt-2">
          {ROLE_META[role].description}
        </p>

        <div className="rounded-md border divide-y">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : members.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No teammates yet.
            </div>
          ) : (
            members.map((m) => {
              const roleMeta = ROLE_META[m.role] ?? ROLE_META.admin
              const RoleIcon = roleMeta.icon
              const display = m.full_name?.trim() || m.email
              const isHighPrivilege = m.role === "super_user" || m.role === "owner"
              return (
                <div
                  key={m.id}
                  className={cn("p-3 flex items-center gap-3 flex-wrap", isHighPrivilege && "bg-muted/30")}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>
                      {initialsOf(m.full_name, m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{display}</span>
                      {m.status === "invited" && (
                        <Badge variant="secondary" className="gap-1">
                          <Mail className="h-3 w-3" />
                          Invited
                        </Badge>
                      )}
                      {isHighPrivilege && (
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1", ROLE_BADGE_COLORS[m.role])}>
                          <RoleIcon className="h-2.5 w-2.5" />
                          {roleMeta.label}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.email}
                    </div>
                  </div>
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      void handleRoleChange(m, v as TeamRole)
                    }
                    disabled={!isSuperUser && isHighPrivilege}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue>
                        <span className="inline-flex items-center gap-2">
                          <RoleIcon className="h-3.5 w-3.5" />
                          {roleMeta.label}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => {
                        const Icon = ROLE_META[r].icon
                        return (
                          <SelectItem key={r} value={r}>
                            <span className="inline-flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5" />
                              {ROLE_META[r].label}
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmRemove(m)}
                    aria-label="Remove member"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={!isSuperUser && isHighPrivilege}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })
          )}
        </div>

        <AlertDialog
          open={Boolean(confirmRemove)}
          onOpenChange={(open) => !open && setConfirmRemove(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmRemove?.status === "invited"
                  ? "Cancel this invite?"
                  : "Remove this teammate?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmRemove?.status === "invited"
                  ? `The invite for ${confirmRemove?.email} will be cancelled.`
                  : `${confirmRemove?.email} will lose access to the workspace.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
