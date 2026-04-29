import { useState } from "react"
import { RotateCcw, Lock, Info } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { PageHeader } from "@/components/PageHeader"
import {
  ALL_PERMISSIONS,
  DEFAULT_MATRIX,
  EDITABLE_ROLES,
  PERMISSION_CATEGORIES,
  type EditableRole,
  type PermissionKey,
} from "@/lib/permissions"
import { usePermissions } from "@/hooks/usePermissions"
import { useRole } from "@/hooks/useRole"
import { cn } from "@/lib/utils"

const ROLE_LABELS: Record<string, string> = {
  super_user: "Super User",
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  bd: "BD",
  partner: "Partner",
}

const ROLE_COLORS: Record<string, string> = {
  super_user: "text-yellow-600 dark:text-yellow-400",
  owner: "text-blue-600 dark:text-blue-400",
  admin: "text-primary",
  member: "text-muted-foreground",
  viewer: "text-muted-foreground",
  bd: "text-emerald-600 dark:text-emerald-400",
  partner: "text-purple-600 dark:text-purple-400",
}

function PermToggle({
  checked,
  disabled,
  locked,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  locked: boolean
  onChange: (v: boolean) => void
}) {
  if (locked) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex h-5 w-9 items-center justify-center rounded-full bg-primary/20">
          <Lock className="h-3 w-3 text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          checked ? "bg-primary" : "bg-input",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-md ring-0 transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  )
}

function DiffDot({ changed }: { changed: boolean }) {
  if (!changed) return null
  return <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" title="Modified from default" />
}

export function PermissionsMatrix() {
  const { isSuperUser } = useRole()
  const { matrix, toggle, reset } = usePermissions()
  const [confirmReset, setConfirmReset] = useState(false)

  const isEditable = isSuperUser

  function handleToggle(key: PermissionKey, role: EditableRole, value: boolean) {
    toggle(key, role, value)
  }

  function handleReset() {
    reset()
    setConfirmReset(false)
    toast.success("Permissions reset to defaults")
  }

  function countChanges(): number {
    let n = 0
    for (const perm of ALL_PERMISSIONS) {
      for (const role of EDITABLE_ROLES) {
        if (matrix[perm.key][role] !== DEFAULT_MATRIX[perm.key][role]) n++
      }
    }
    return n
  }

  const changes = countChanges()

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <PageHeader
          title="Role Permissions"
          description={
            isEditable
              ? "Control exactly what each role can access. Toggle permissions on or off per role. Super User permissions are always locked on."
              : "Read-only view of role permissions. Super User access required to edit."
          }
          actions={
            isEditable ? (
              <div className="flex items-center gap-2">
                {changes > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1">
                    {changes} change{changes !== 1 ? "s" : ""} from defaults
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmReset(true)}
                  disabled={changes === 0}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to defaults
                </Button>
              </div>
            ) : undefined
          }
        />

        <Card className="p-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[220px] sticky left-0 bg-muted/50 z-10">
                      Permission
                    </th>
                    {/* Super User — always locked */}
                    <th className="px-4 py-3 text-center min-w-[100px]">
                      <div className={cn("font-semibold text-xs", ROLE_COLORS.super_user)}>Super User</div>
                      <div className="text-[10px] text-muted-foreground font-normal mt-0.5">Platform</div>
                    </th>
                    {EDITABLE_ROLES.map((role) => (
                      <th key={role} className="px-4 py-3 text-center min-w-[100px]">
                        <div className={cn("font-semibold text-xs", ROLE_COLORS[role])}>{ROLE_LABELS[role]}</div>
                        <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                          {role === "owner" ? "Financial" : role === "admin" ? "Ops" : role === "member" ? "Standard" : role === "bd" ? "Sales" : role === "partner" ? "External" : "Read"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_CATEGORIES.map((category) => {
                    const perms = ALL_PERMISSIONS.filter((p) => p.category === category)
                    return (
                      <>
                        {/* Category header row */}
                        <tr key={`cat-${category}`} className="bg-muted/20 border-y border-border/50">
                          <td
                            colSpan={8}
                            className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground sticky left-0 bg-muted/20"
                          >
                            {category}
                          </td>
                        </tr>

                        {/* Permission rows */}
                        {perms.map((perm, idx) => {
                          const isLast = idx === perms.length - 1
                          return (
                            <tr
                              key={perm.key}
                              className={cn(
                                "transition-colors hover:bg-muted/30",
                                !isLast && "border-b border-border/40"
                              )}
                            >
                              {/* Label + description tooltip */}
                              <td className="px-4 py-3 sticky left-0 bg-background hover:bg-muted/30 transition-colors z-10">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-sm">{perm.label}</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                                        <Info className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-[220px] text-xs">
                                      {perm.description}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{perm.key}</div>
                              </td>

                              {/* Super User — always locked ON */}
                              <td className="px-4 py-3">
                                <PermToggle checked locked disabled onChange={() => {}} />
                              </td>

                              {/* Editable role columns */}
                              {EDITABLE_ROLES.map((role) => {
                                const value = matrix[perm.key][role]
                                const defaultValue = DEFAULT_MATRIX[perm.key][role]
                                const changed = value !== defaultValue
                                return (
                                  <td key={role} className="px-4 py-3">
                                    <div className="relative inline-flex items-center justify-center w-full">
                                      <PermToggle
                                        checked={value}
                                        disabled={!isEditable}
                                        locked={false}
                                        onChange={(v) => handleToggle(perm.key, role, v)}
                                      />
                                      {isEditable && <DiffDot changed={changed} />}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span>Locked — always granted</span>
              </div>
              {isEditable && (
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>Modified from default</span>
                </div>
              )}
              {!isEditable && (
                <span className="text-muted-foreground/60 italic">Super User access required to edit permissions</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {EDITABLE_ROLES.map((role) => {
            const granted = ALL_PERMISSIONS.filter((p) => matrix[p.key][role]).length
            const total = ALL_PERMISSIONS.length
            const pct = Math.round((granted / total) * 100)
            return (
              <Card key={role} className="px-4 py-3">
                <p className={cn("text-xs font-semibold", ROLE_COLORS[role])}>{ROLE_LABELS[role]}</p>
                <p className="text-xl font-semibold mt-1">{pct}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{granted} of {total} permissions</p>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-muted-foreground/40")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Card>
            )
          })}
        </div>

        <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all permissions to defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                This will revert all {changes} custom change{changes !== 1 ? "s" : ""} back to the system defaults. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Reset to defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
