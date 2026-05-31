import { useEffect, useState, useCallback } from "react"
import type { FormEvent } from "react"
import {
  Plus,
  Link2,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserCheck,
  Loader2,
  Check,
  X,
  Trash2,
  ClipboardCheck,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  listRaAssociates,
  inviteRa,
  revokeRa,
  generateRaSlug,
  checkSlugAvailable,
} from "@/lib/data"
import { RaVerificationDialog } from "@/components/RaVerificationDialog"
import type { RaAssociate, RaStatus } from "@/types/db"

// ── Status display config ────────────────────────────────────────────────────

type StatusMeta = {
  label: string
  badge: string          // Tailwind classes for the Badge
  icon: typeof Clock
}

const STATUS_META: Record<RaStatus, StatusMeta> = {
  pending: {
    label: "Pending",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    icon: Clock,
  },
  verification: {
    label: "Pending Verification",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    icon: UserCheck,
  },
  needs_changes: {
    label: "Needs Changes",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertCircle,
  },
  active: {
    label: "Active",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  suspended: {
    label: "Suspended",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    icon: AlertCircle,
  },
  declined: {
    label: "Declined",
    badge: "bg-red-100 text-red-600 border-red-200",
    icon: XCircle,
  },
  terminated: {
    label: "Terminated",
    badge: "bg-red-100 text-red-600 border-red-200",
    icon: XCircle,
  },
}

type TabFilter = "all" | "verification" | "active" | "needs_changes" | "declined"

const TABS: { value: TabFilter; label: string }[] = [
  { value: "all",           label: "All" },
  { value: "verification",  label: "Pending Verification" },
  { value: "active",        label: "Active" },
  { value: "needs_changes", label: "Needs Changes" },
  { value: "declined",      label: "Declined" },
]

function filterRas(ras: RaAssociate[], tab: TabFilter): RaAssociate[] {
  if (tab === "all") return ras
  if (tab === "declined") return ras.filter((r) => r.status === "declined" || r.status === "terminated")
  return ras.filter((r) => r.status === tab)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

// ── Slug availability indicator ──────────────────────────────────────────────

type SlugState = "idle" | "checking" | "available" | "taken"

// ── Main component ───────────────────────────────────────────────────────────

export function RaSection() {
  const [ras, setRas] = useState<RaAssociate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabFilter>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  // Dialog form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [slug, setSlug] = useState("")
  const [slugState, setSlugState] = useState<SlugState>("idle")
  const [submitting, setSubmitting] = useState(false)

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<RaAssociate | null>(null)
  const [revoking, setRevoking] = useState(false)

  // Verification review dialog
  const [reviewTarget, setReviewTarget] = useState<RaAssociate | null>(null)

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await revokeRa(revokeTarget.id)
      toast.success(`${revokeTarget.display_name}'s invite has been revoked.`)
      setRevokeTarget(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invite")
    } finally {
      setRevoking(false)
    }
  }

  async function refresh() {
    setLoading(true)
    try {
      setRas(await listRaAssociates())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load RAs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  // Auto-generate slug from first + last name
  useEffect(() => {
    const full = [firstName, lastName].filter(Boolean).join(" ")
    if (full) {
      const generated = generateRaSlug(full)
      setSlug(generated)
      setSlugState("idle")
    }
  }, [firstName, lastName])

  // Debounced slug availability check
  const checkSlug = useCallback(async (value: string) => {
    if (!value || value.length < 2) { setSlugState("idle"); return }
    setSlugState("checking")
    const available = await checkSlugAvailable(value)
    setSlugState(available ? "available" : "taken")
  }, [])

  useEffect(() => {
    if (!slug) { setSlugState("idle"); return }
    const timer = setTimeout(() => void checkSlug(slug), 400)
    return () => clearTimeout(timer)
  }, [slug, checkSlug])

  function resetDialog() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setSlug("")
    setSlugState("idle")
    setSubmitting(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (slugState === "taken") { toast.error("That slug is already taken — choose another."); return }
    setSubmitting(true)
    try {
      await inviteRa({ email, first_name: firstName, last_name: lastName, slug })
      toast.success(`Invite sent to ${email}`)
      setDialogOpen(false)
      resetDialog()
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite")
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = filterRas(ras, tab)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Referral Associates
              </CardTitle>
              <CardDescription className="mt-1">
                Invite and manage RAs who refer prospects via their personal landing page.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add RA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status filter tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
            <TabsList className="flex-wrap h-auto gap-1">
              {TABS.map((t) => {
                const count = filterRas(ras, t.value).length
                return (
                  <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                    {t.label}
                    {count > 0 && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>

          {/* RA list */}
          <div className="rounded-md border divide-y">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {tab === "all"
                  ? 'No referral associates yet. Click "Add RA" to invite the first one.'
                  : `No RAs with status "${STATUS_META[tab as RaStatus]?.label ?? tab}".`}
              </div>
            ) : (
              filtered.map((ra) => {
                const meta = STATUS_META[ra.status]
                const Icon = meta.icon
                return (
                  <div key={ra.id} className="p-3 flex items-center gap-3 flex-wrap">
                    {/* Avatar / photo */}
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {ra.photo_url ? (
                        <img src={ra.photo_url} alt={ra.display_name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">
                          {ra.display_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{ra.display_name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${meta.badge}`}>
                          <Icon className="h-2.5 w-2.5" />
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ra.email}
                        <span className="mx-1.5 opacity-40">·</span>
                        <span className="font-mono opacity-70">/refer/{ra.slug}</span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {ra.submitted_at
                        ? `Submitted ${formatDate(ra.submitted_at)}`
                        : `Added ${formatDate(ra.created_at)}`}
                    </div>

                    {/* Review button — only for verification status */}
                    {ra.status === "verification" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                        onClick={() => setReviewTarget(ra)}
                      >
                        <ClipboardCheck className="h-3 w-3" />
                        Review
                      </Button>
                    )}

                    {/* Revoke action — hidden for already-terminated/declined */}
                    {ra.status !== "terminated" && ra.status !== "declined" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setRevokeTarget(ra)}
                        title="Revoke invite"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Revoke confirmation dialog ── */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revokeTarget && ["pending", "verification", "needs_changes"].includes(revokeTarget.status)
                ? "Cancel invite?"
                : "Terminate RA?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget && ["pending", "verification", "needs_changes"].includes(revokeTarget.status)
                ? <>
                    The invite link sent to <strong>{revokeTarget.email}</strong> will be permanently invalidated.
                    {" "}{revokeTarget.display_name} will not be able to complete onboarding.
                  </>
                : <>
                    <strong>{revokeTarget?.display_name}</strong> will be removed from the Referral Associate program.
                    Their attribution history will be preserved.
                  </>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revoking}
              onClick={handleRevoke}
            >
              {revoking ? <><Loader2 className="h-4 w-4 animate-spin" /> Revoking…</> : "Yes, revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Verification review dialog ── */}
      <RaVerificationDialog
        ra={reviewTarget}
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onActionComplete={() => { setReviewTarget(null); void refresh() }}
      />

      {/* ── Add RA dialog (Z2) ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Referral Associate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ra-first-name">First name</Label>
                <Input
                  id="ra-first-name"
                  placeholder="Maria"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ra-last-name">Last name</Label>
                <Input
                  id="ra-last-name"
                  placeholder="Lopez"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ra-email">Email</Label>
              <Input
                id="ra-email"
                type="email"
                placeholder="maria@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A magic-link invite will be sent here.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ra-slug">Referral slug</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md overflow-hidden flex-1">
                  <span className="px-2.5 py-2 text-xs text-muted-foreground bg-muted border-r whitespace-nowrap">
                    /refer/
                  </span>
                  <Input
                    id="ra-slug"
                    className="border-0 rounded-none focus-visible:ring-0"
                    placeholder="maria-lopez"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  />
                </div>
                {/* Availability indicator */}
                <div className="w-6 shrink-0 flex items-center justify-center">
                  {slugState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {slugState === "available" && <Check className="h-4 w-4 text-emerald-600" />}
                  {slugState === "taken" && <X className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              {slugState === "taken" && (
                <p className="text-xs text-destructive">That slug is already taken.</p>
              )}
              {slugState === "available" && (
                <p className="text-xs text-emerald-600">Available!</p>
              )}
              {slugState === "idle" && (
                <p className="text-xs text-muted-foreground">
                  Auto-suggested from display name. Lowercase letters, numbers, and hyphens only.
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setDialogOpen(false); resetDialog() }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || slugState === "taken" || slugState === "checking" || !slug || !email || !firstName || !lastName}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  "Send invite"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
