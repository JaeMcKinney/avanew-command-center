import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { UserPlus, Users, Search, MoreHorizontal, Eye, CheckCircle2, XCircle, Trash2, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/PageHeader"
import {
  listRaAssociates,
  updateRaStatus,
  deleteRa,
  canManageRaProgram,
} from "@/lib/data"
import { toast } from "sonner"
import type { RaAssociate, RaStatus } from "@/types/db"
import { InviteRaModal } from "@/components/ra/InviteRaModal"
import { BulkInviteRaModal } from "@/components/ra/BulkInviteRaModal"

const STATUS_META: Record<RaStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:       { label: "Pending onboarding", variant: "outline" },
  verification:  { label: "Pending review",     variant: "secondary" },
  needs_changes: { label: "Changes requested",  variant: "outline" },
  active:        { label: "Active",             variant: "default" },
  suspended:     { label: "Suspended",          variant: "destructive" },
  declined:      { label: "Declined",           variant: "destructive" },
  terminated:    { label: "Terminated",         variant: "destructive" },
}

// Each status gets its own filter bucket so admins can audit every lifecycle
// state independently — especially Terminated, which is the entry point for
// permanent deletion + archival.
const FILTERS: { value: RaStatus | "all"; label: string }[] = [
  { value: "all",           label: "All" },
  { value: "pending",       label: "Pending" },
  { value: "verification",  label: "Review" },
  { value: "needs_changes", label: "Changes" },
  { value: "active",        label: "Active" },
  { value: "suspended",     label: "Suspended" },
  { value: "declined",      label: "Declined" },
  { value: "terminated",    label: "Terminated" },
]

export function SettingsRA() {
  const navigate = useNavigate()
  const [list, setList] = useState<RaAssociate[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<RaStatus | "all">("all")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<RaAssociate | null>(null)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [canManage, setCanManage] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setList(await listRaAssociates())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load RAs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    void canManageRaProgram().then(setCanManage)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.display_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q)
      )
    })
  }, [list, query, statusFilter])

  const counts = useMemo(() => {
    const c = { all: list.length } as Record<RaStatus | "all", number>
    for (const s of Object.keys(STATUS_META) as RaStatus[]) c[s] = 0
    for (const r of list) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [list])

  async function quickApprove(ra: RaAssociate) {
    // Compliance gate: an RA can't be paid without a signed agreement + W-9 on
    // file, so never activate an incomplete application from the quick menu —
    // send the admin to the full Review page to finish the checklist.
    const complete =
      ra.agreement_completed && ra.w9_completed &&
      ra.photo_completed && ra.contact_completed && ra.banking_completed
    if (!complete) {
      toast.info(`${ra.display_name}'s onboarding is incomplete — review before activating`)
      navigate(`/settings/ra/${ra.slug}/review`)
      return
    }
    try {
      await updateRaStatus(ra.id, {
        status: "active",
        verified_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
      })
      toast.success(`${ra.display_name} is now live`)
      void refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate")
    }
  }

  async function quickDecline(ra: RaAssociate) {
    try {
      await updateRaStatus(ra.id, { status: "declined" })
      toast.success(`${ra.display_name} declined`)
      void refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline")
    }
  }

  function openDelete(ra: RaAssociate) {
    setConfirmDelete(ra)
    setConfirmName("")
  }

  async function handleDelete() {
    if (!confirmDelete) return
    if (confirmName.trim() !== confirmDelete.display_name) {
      toast.error("Confirmation name does not match")
      return
    }
    setDeleting(true)
    try {
      const result = await deleteRa(confirmDelete.id, {
        confirmName: confirmDelete.display_name,
      })
      toast.success(
        `${result.display_name} deleted — prospect & client data preserved in archive`,
        {
          action: {
            label: "View archive",
            onClick: () => navigate("/settings/ra/archive"),
          },
        }
      )
      setConfirmDelete(null)
      setConfirmName("")
      void refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Referral Associates"
          description="Invite, review, and manage referral associates."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/ra/archive")}>
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Users className="h-3.5 w-3.5" />
            Bulk Invite
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Invite RA
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or slug…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(f.value)}
                  className="h-8"
                >
                  {f.label}
                  <span className="ml-1.5 text-[10px] opacity-70">{counts[f.value] ?? 0}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      No associates match the current filter.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((ra) => {
                  const meta = STATUS_META[ra.status]
                  const isReview = ra.status === "verification"
                  return (
                    <TableRow
                      key={ra.id}
                      className="cursor-pointer"
                      onClick={() => navigate(isReview ? `/settings/ra/${ra.slug}/review` : `/settings/ra/${ra.slug}`)}
                    >
                      <TableCell className="font-medium">{ra.display_name}</TableCell>
                      <TableCell className="text-muted-foreground">{ra.email}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">/refer/{ra.slug}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ra.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/settings/ra/${ra.slug}`)}>
                              <Eye className="h-3.5 w-3.5" />
                              View detail
                            </DropdownMenuItem>
                            {isReview && (
                              <DropdownMenuItem onClick={() => navigate(`/settings/ra/${ra.slug}/review`)}>
                                <Eye className="h-3.5 w-3.5" />
                                Open review
                              </DropdownMenuItem>
                            )}
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                {ra.status !== "active" && (
                                  <DropdownMenuItem onClick={() => quickApprove(ra)}>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                {ra.status !== "declined" && ra.status !== "terminated" && (
                                  <DropdownMenuItem onClick={() => quickDecline(ra)} className="text-destructive focus:text-destructive">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Decline
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDelete(ra)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete permanently
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} of {list.length} associates</span>
            <Link to="/settings/landing-pages" className="text-primary hover:underline">
              Landing page templates →
            </Link>
          </div>
        </CardContent>
      </Card>

      <InviteRaModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => { void refresh() }}
      />

      <BulkInviteRaModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onInvited={() => { void refresh() }}
      />

      {/* Typed-confirmation delete dialog. Prospect/client data is preserved
          in the archive, but the RA identity (auth, profile, agreement
          history, banking) is destroyed. Require typing the name. */}
      <AlertDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDelete(null)
            setConfirmName("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this RA?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This will permanently remove <strong>{confirmDelete?.display_name}</strong>'s
                  account, agreement audit trail, banking, and W-9.
                </p>
                <p>
                  <strong>All prospect and client data (leads, deals, check-ins, commission history)
                  is preserved in the archive</strong> — never discarded. You can view it later at
                  Settings → Referral Associates → Archive.
                </p>
                <p className="text-destructive">This cannot be undone.</p>
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="confirm-name" className="text-foreground">
                    Type <span className="font-mono font-bold">{confirmDelete?.display_name}</span> to confirm:
                  </Label>
                  <Input
                    id="confirm-name"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={confirmDelete?.display_name}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                deleting ||
                confirmName.trim() !== (confirmDelete?.display_name ?? "")
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
