import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Archive,
  Inbox,
  Loader2,
  UserPlus,
  Users,
  User,
  Building2,
  Link2,
  ClipboardCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  listRaAssociates,
  updateRaStatus,
  updateRaType,
  deleteRa,
  canManageRaProgram,
  listLeadsForRa,
  listRaLandingTemplates,
  setRaTemplate,
} from "@/lib/data"
import { toast } from "sonner"
import type { RaAssociate, RaStatus, RaType, RaLandingTemplate, Lead } from "@/types/db"
import { InviteRaModal } from "@/components/ra/InviteRaModal"
import { BulkInviteRaModal } from "@/components/ra/BulkInviteRaModal"
import { RaChangeRequestsCard } from "@/components/ra/RaChangeRequestsCard"
import { RaVerificationDialog } from "@/components/RaVerificationDialog"

const STATUS_META: Record<RaStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:       { label: "Pending onboarding", variant: "outline" },
  verification:  { label: "Pending review",     variant: "secondary" },
  needs_changes: { label: "Changes requested",  variant: "outline" },
  active:        { label: "Active",             variant: "default" },
  suspended:     { label: "Suspended",          variant: "destructive" },
  declined:      { label: "Declined",           variant: "destructive" },
  terminated:    { label: "Terminated",         variant: "destructive" },
}

// Each lifecycle state gets its own bucket so admins can audit every state
// independently — Suspended and Terminated each get their own tab, separate
// from Declined.
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

/**
 * Resolve the page template that's actually in effect for an RA, mirroring the
 * get_ra_landing_page() cascade: explicit per-RA override → org default for the
 * RA's type → legacy is_default → built-in Divigner fallback.
 */
function effectiveTemplate(
  ra: RaAssociate,
  templates: RaLandingTemplate[],
): { label: string; explicit: boolean } {
  if (ra.template_id) {
    const t = templates.find((x) => x.id === ra.template_id)
    if (t) return { label: t.name, explicit: true }
  }
  const typeDefault = templates.find((x) => x.default_for_type === (ra.ra_type ?? "individual"))
  if (typeDefault) return { label: typeDefault.name, explicit: false }
  const legacyDefault = templates.find((x) => x.is_default)
  if (legacyDefault) return { label: legacyDefault.name, explicit: false }
  return { label: "Built-in default", explicit: false }
}

/**
 * Single source of truth for managing Referral Associates. Renders inside
 * the "Referral Associates" tab on /settings/team. Owns the full RA list +
 * filter buckets + invite / bulk-invite + delete + archive entry + per-row
 * actions (Leads drill-down, template assignment, Review dialog).
 */
export function RaSection() {
  const navigate = useNavigate()
  const [list, setList] = useState<RaAssociate[]>([])
  const [templates, setTemplates] = useState<RaLandingTemplate[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<RaStatus | "all">("all")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<RaAssociate | null>(null)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Per-RA leads drill-down
  const [leadsTarget, setLeadsTarget] = useState<RaAssociate | null>(null)
  const [leadsForRa, setLeadsForRa] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)

  // Verification review dialog (modal — for quick reviews without leaving page)
  const [reviewTarget, setReviewTarget] = useState<RaAssociate | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [raList, tplList] = await Promise.all([
        listRaAssociates(),
        listRaLandingTemplates().catch(() => []),
      ])
      setList(raList)
      setTemplates(tplList)
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

  // Load leads when the drill-down opens
  useEffect(() => {
    if (!leadsTarget) { setLeadsForRa([]); return }
    let cancelled = false
    setLoadingLeads(true)
    listLeadsForRa(leadsTarget.user_id)
      .then((rows) => { if (!cancelled) setLeadsForRa(rows) })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load leads"))
      .finally(() => { if (!cancelled) setLoadingLeads(false) })
    return () => { cancelled = true }
  }, [leadsTarget])

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
    // Compliance gate: never activate an incomplete application from the
    // quick menu — send to full Review page to finish the checklist.
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

  async function changeType(ra: RaAssociate, next: RaType) {
    try {
      await updateRaType(ra.id, next)
      toast.success(`${ra.display_name} is now ${next === "company" ? "a Company" : "an Individual"} RA`)
      void refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change type")
    }
  }

  async function handleTemplateChange(raId: string, templateId: string | null) {
    try {
      await setRaTemplate(raId, templateId)
      toast.success("Template updated")
      setList((prev) => prev.map((r) => (r.id === raId ? { ...r, template_id: templateId } : r)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update template")
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
    <>
      <div className="space-y-4">
      {canManage && <RaChangeRequestsCard />}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Referral Associates
              </CardTitle>
              <CardDescription className="mt-1">
                Invite, review, and manage RAs who refer prospects via their personal landing page.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
        </CardHeader>
        <CardContent className="space-y-4">
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
                  <TableHead>Page template</TableHead>
                  <TableHead className="text-center w-[360px] sticky right-0 bg-card border-l shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.10)]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      No associates match the current filter.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((ra) => {
                  const meta = STATUS_META[ra.status]
                  const isReview = ra.status === "verification"
                  const isActiveOrInflight = ra.status !== "declined" && ra.status !== "terminated"
                  return (
                    <TableRow
                      key={ra.id}
                      className="group cursor-pointer"
                      onClick={() => navigate(isReview ? `/settings/ra/${ra.slug}/review` : `/settings/ra/${ra.slug}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {ra.photo_url ? (
                              <img src={ra.photo_url} alt={ra.display_name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {ra.display_name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span>{ra.display_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ra.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          <Badge variant="outline" className="gap-1 text-[10px] font-normal text-muted-foreground">
                            {ra.ra_type === "company"
                              ? <><Building2 className="h-2.5 w-2.5" /> Company</>
                              : <><User className="h-2.5 w-2.5" /> Individual</>}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">/refer/{ra.slug}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ra.submitted_at
                          ? `Submitted ${formatDate(ra.submitted_at)}`
                          : formatDate(ra.created_at)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const t = effectiveTemplate(ra, templates)
                          return (
                            <span
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-muted-foreground"
                              title={t.explicit ? "Explicitly assigned" : "Resolved from defaults"}
                            >
                              <Link2 className="h-3 w-3 opacity-60" />
                              {t.label}
                              {!t.explicit && <span className="opacity-50">(auto)</span>}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-center w-[360px] sticky right-0 bg-card group-hover:bg-muted/50 border-l shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.10)]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 flex-nowrap">
                          {/* Template assignment — only meaningful for active RAs */}
                          {ra.status === "active" && templates.length > 0 && (
                            <select
                              value={ra.template_id ?? ""}
                              onChange={(e) => handleTemplateChange(ra.id, e.target.value || null)}
                              className="h-7 shrink-0 text-xs rounded-md border bg-background px-2 max-w-[140px]"
                              title="Landing page template"
                            >
                              <option value="">Org default</option>
                              {templates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}{t.is_default ? " (default)" : ""}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Leads drill-down — for any active or in-flight RA */}
                          {isActiveOrInflight && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => setLeadsTarget(ra)}
                              title={`View leads referred by ${ra.display_name}`}
                            >
                              <Inbox className="h-3 w-3" />
                              Leads
                            </Button>
                          )}

                          {/* Inline Review button — quick verification dialog */}
                          {isReview && canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                              onClick={() => setReviewTarget(ra)}
                            >
                              <ClipboardCheck className="h-3 w-3" />
                              Review
                            </Button>
                          )}

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
                                  <ClipboardCheck className="h-3.5 w-3.5" />
                                  Open full review
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {ra.ra_type === "company" ? (
                                <DropdownMenuItem onClick={() => changeType(ra, "individual")}>
                                  <User className="h-3.5 w-3.5" />
                                  Change to Individual
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => changeType(ra, "company")}>
                                  <Building2 className="h-3.5 w-3.5" />
                                  Change to Company
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
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground">
            {filtered.length} of {list.length} associates
          </div>
        </CardContent>
      </Card>
      </div>

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

      {/* Inline review dialog (alternative to navigating to /settings/ra/:slug/review) */}
      <RaVerificationDialog
        ra={reviewTarget}
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onActionComplete={() => { setReviewTarget(null); void refresh() }}
      />

      {/* Per-RA leads drill-down */}
      <Dialog open={!!leadsTarget} onOpenChange={(open) => { if (!open) setLeadsTarget(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              Leads referred by {leadsTarget?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Submissions via{" "}
                <span className="font-mono">/refer/{leadsTarget?.slug}</span>
              </span>
              {!loadingLeads && (
                <span>{leadsForRa.length} {leadsForRa.length === 1 ? "lead" : "leads"}</span>
              )}
            </div>
            {loadingLeads ? (
              <div className="p-6 text-sm text-muted-foreground flex items-center gap-2 justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : leadsForRa.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground border rounded-md">
                No leads yet for this RA.
              </div>
            ) : (
              <div className="rounded-md border divide-y">
                {leadsForRa.map((lead) => (
                  <div key={lead.id} className="p-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {lead.first_name} {lead.last_name ?? ""}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            lead.converted
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {lead.converted ? "Closed" : (lead.lead_status ?? "New")}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {lead.email ?? lead.phone ?? "—"}
                        {lead.company && (
                          <>
                            <span className="mx-1.5 opacity-40">·</span>
                            <span>{lead.company}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(lead.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadsTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  Settings → Team → Referral Associates → Archive.
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
    </>
  )
}
