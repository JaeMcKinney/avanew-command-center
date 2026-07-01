import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Archive as ArchiveIcon, Search, FileText, Users, ListChecks, Receipt, FileSignature, RotateCcw, Loader2, ArrowRightLeft, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { listArchivedRas, getArchivedRa, restoreRa, hardDeleteArchivedRa } from "@/lib/data"
import { toast } from "sonner"
import type { ArchivedRaAssociate, ArchivedRaDetail, RaStatus } from "@/types/db"
import { TransferRaLeadsModal } from "@/components/ra/TransferRaLeadsModal"

/** Restore button + confirmation. Re-creates the RA from its archive snapshot. */
function RestoreControl({
  archive,
  size = "sm",
  onRestored,
}: {
  archive: { id: string; display_name: string; slug: string }
  size?: "sm" | "default"
  onRestored: (slug: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function handleRestore() {
    setRestoring(true)
    try {
      const r = await restoreRa(archive.id)
      const bits = [
        r.leads_relinked ? `${r.leads_relinked} lead${r.leads_relinked === 1 ? "" : "s"}` : null,
        r.deals_relinked ? `${r.deals_relinked} deal${r.deals_relinked === 1 ? "" : "s"}` : null,
        r.payouts_restored ? `${r.payouts_restored} payout${r.payouts_restored === 1 ? "" : "s"}` : null,
        r.checkins_restored ? `${r.checkins_restored} check-in${r.checkins_restored === 1 ? "" : "s"}` : null,
      ].filter(Boolean)
      toast.success(
        `${r.display_name} restored${bits.length ? ` — re-linked ${bits.join(", ")}` : ""}`,
        { description: "They may need to reset their password to sign in again." }
      )
      setOpen(false)
      onRestored(archive.slug)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore")
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className="gap-1.5"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restore
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) setOpen(false) }}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {archive.display_name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This re-creates the RA at <span className="font-mono">/demo/{archive.slug}</span>,
                  re-links their leads &amp; deals, and restores their payout and check-in history.
                </p>
                <p>
                  Their login is re-created (email-confirmed, no password) — they'll use
                  <strong> Forgot password</strong> to get back in. The archive entry is removed.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleRestore() }} disabled={restoring}>
              {restoring ? <><Loader2 className="h-4 w-4 animate-spin" /> Restoring…</> : "Restore RA"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Two-step permanent-delete confirmation. Warns about transfer first, then
 *  requires typed-confirmation of the archived display name. */
function HardDeleteControl({
  archive,
  hasLiveLeads,
  onDeleted,
}: {
  archive: { id: string; display_name: string; leads_count: number; deals_count: number }
  hasLiveLeads: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await hardDeleteArchivedRa(archive.id, archive.display_name)
      toast.success(`${archive.display_name}'s archive entry permanently deleted`)
      setOpen(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); setOpen(true); setConfirmName("") }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete archive
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => { if (!o && !deleting) { setOpen(false); setConfirmName("") } }}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this archive?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This destroys <strong>{archive.display_name}</strong>'s archived snapshot
                  — every preserved lead, deal, check-in, payout, and agreement record
                  ({archive.leads_count} leads · {archive.deals_count} deals).
                </p>
                {hasLiveLeads && (
                  <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                    <p className="text-amber-800 dark:text-amber-300 text-xs">
                      You still have {archive.leads_count} live lead{archive.leads_count === 1 ? "" : "s"} (and {archive.deals_count} deal{archive.deals_count === 1 ? "" : "s"})
                      with their original referrer unset. Consider <strong>transferring them to another RA</strong> first —
                      after delete, the link back to the original attribution is gone forever.
                    </p>
                  </div>
                )}
                <p className="text-destructive font-medium">This cannot be undone — no Restore option after this point.</p>
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="archive-confirm" className="text-foreground">
                    Type <span className="font-mono font-bold">{archive.display_name}</span> to confirm:
                  </Label>
                  <Input
                    id="archive-confirm"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={archive.display_name}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete() }}
              disabled={deleting || confirmName.trim() !== archive.display_name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const STATUS_LABELS: Record<RaStatus, string> = {
  pending: "Pending onboarding",
  verification: "Pending review",
  needs_changes: "Changes requested",
  active: "Active",
  suspended: "Suspended",
  declined: "Declined",
  terminated: "Terminated",
  invite_expired: "Invite expired",
  onboarding_expired: "Onboarding expired",
}

/**
 * Read-only viewer for permanently deleted RAs and the prospect/client data
 * preserved at the moment of deletion. Two views, routed via ?id= query param:
 *
 *   • List view (no id):     /settings/ra/archive
 *   • Detail view (?id=…):   /settings/ra/archive?id=<archive_id>
 */
export function SettingsRAArchive() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const archiveId = params.get("id")

  if (archiveId) {
    return (
      <ArchiveDetail
        id={archiveId}
        onBack={() => setParams({})}
        onRestored={() => navigate("/settings/team")}
      />
    )
  }
  return (
    <ArchiveList
      onOpen={(id) => setParams({ id })}
      onBackToList={() => navigate("/settings/team")}
      onRestored={() => {}}
    />
  )
}

function ArchiveList({
  onOpen,
  onBackToList,
  onRestored,
}: {
  onOpen: (id: string) => void
  onBackToList: () => void
  onRestored: () => void
}) {
  const [rows, setRows] = useState<ArchivedRaAssociate[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState("")

  useEffect(() => {
    let alive = true
    listArchivedRas()
      .then((data) => { if (alive) { setRows(data); setLoading(false) } })
      .catch((err) => {
        if (alive) {
          toast.error(err instanceof Error ? err.message : "Failed to load archive")
          setLoading(false)
        }
      })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.display_name.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.archive_reason ?? "").toLowerCase().includes(q)
    )
  }, [rows, query])

  // Prune selected entries when the visible (filtered) list shrinks — otherwise
  // the toolbar would show "N selected" for rows the user can no longer see.
  useEffect(() => {
    const visibleIds = new Set(filtered.map((r) => r.id))
    setSelected((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [filtered])

  const allFilteredChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id))
  const someFilteredChecked = filtered.some((r) => selected.has(r.id)) && !allFilteredChecked

  function toggleOne(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) filtered.forEach((r) => next.add(r.id))
      else filtered.forEach((r) => next.delete(r.id))
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function handleBulkDelete() {
    if (bulkConfirm.trim().toUpperCase() !== "DELETE") {
      toast.error("Type DELETE to confirm")
      return
    }
    const targets = rows.filter((r) => selected.has(r.id))
    if (targets.length === 0) return
    setBulkDeleting(true)
    const deletedIds = new Set<string>()
    const failed: string[] = []
    for (const r of targets) {
      try {
        await hardDeleteArchivedRa(r.id, r.display_name)
        deletedIds.add(r.id)
      } catch (err) {
        failed.push(`${r.display_name}: ${err instanceof Error ? err.message : "unknown error"}`)
      }
    }
    setBulkDeleting(false)
    if (deletedIds.size > 0) {
      setRows((prev) => prev.filter((r) => !deletedIds.has(r.id)))
      setSelected((prev) => {
        const next = new Set(prev)
        deletedIds.forEach((id) => next.delete(id))
        return next
      })
      toast.success(`Permanently deleted ${deletedIds.size} archive${deletedIds.size === 1 ? "" : "s"}`)
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} failed to delete`, {
        description: failed.slice(0, 3).join(" · "),
      })
    }
    setBulkOpen(false)
    setBulkConfirm("")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="RA Archive"
        description="Permanently deleted associates. Banking and W-9 are gone; prospect and client history is preserved here forever."
        actions={
          <Button variant="outline" size="sm" onClick={onBackToList}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to RA list
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search archived RAs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-destructive/30 bg-destructive/5">
                <span className="text-xs text-foreground">
                  <strong>{selected.size}</strong> selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => { setBulkConfirm(""); setBulkOpen(true) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete selected
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearSelection} title="Clear selection">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredChecked ? true : someFilteredChecked ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all archived RAs"
                      disabled={loading || filtered.length === 0}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status when archived</TableHead>
                  <TableHead className="text-right">Preserved records</TableHead>
                  <TableHead>Archived</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      Loading archive…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      {query ? "No archived RAs match your search." : "No RAs have been archived yet."}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((r) => {
                  const total =
                    r.archived_leads_count + r.archived_deals_count +
                    r.archived_checkins_count + r.archived_payouts_count
                  const isSelected = selected.has(r.id)
                  return (
                    <TableRow key={r.id} className="cursor-pointer" data-state={isSelected ? "selected" : undefined} onClick={() => onOpen(r.id)}>
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) => toggleOne(r.id, v === true)}
                          aria-label={`Select ${r.display_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.display_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {STATUS_LABELS[r.status_at_archive]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {total}
                        <span className="ml-1 opacity-60">
                          ({r.archived_leads_count} leads · {r.archived_deals_count} deals)
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.archived_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <RestoreControl
                            archive={{ id: r.id, display_name: r.display_name, slug: r.slug }}
                            onRestored={() => { setRows((prev) => prev.filter((x) => x.id !== r.id)); onRestored() }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={(e) => { e.stopPropagation(); onOpen(r.id) }}
                            title="Open detail to transfer leads or permanently delete"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            Manage
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk delete confirmation — typed "DELETE" instead of per-row name so
          admins can clear out test/dev archives quickly without typing each one. */}
      <AlertDialog open={bulkOpen} onOpenChange={(o) => { if (!o && !bulkDeleting) { setBulkOpen(false); setBulkConfirm("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {selected.size} archive{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This destroys every selected archived RA's snapshot — including all preserved
                  leads, deals, check-ins, payouts, and agreement records. Any live leads that were
                  still attached lose their attribution.
                </p>
                <p className="text-destructive font-medium">This cannot be undone — no Restore option after this point.</p>
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="bulk-confirm" className="text-foreground">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </Label>
                  <Input
                    id="bulk-confirm"
                    value={bulkConfirm}
                    onChange={(e) => setBulkConfirm(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleBulkDelete() }}
              disabled={bulkDeleting || bulkConfirm.trim().toUpperCase() !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : `Delete ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ArchiveDetail({ id, onBack, onRestored }: { id: string; onBack: () => void; onRestored: () => void }) {
  const [detail, setDetail] = useState<ArchivedRaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferred, setTransferred] = useState<{ name: string; leads: number; deals: number } | null>(null)

  useEffect(() => {
    let alive = true
    getArchivedRa(id)
      .then((data) => { if (alive) { setDetail(data); setLoading(false) } })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Failed to load")
          setLoading(false)
        }
      })
    return () => { alive = false }
  }, [id])

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
  }
  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {error ?? "Archive entry not found."}
        </CardContent></Card>
      </div>
    )
  }

  const { ra } = detail
  const leadsCount = detail.leads.length
  const dealsCount = detail.deals.length
  const hasLiveLeads = leadsCount > 0 || dealsCount > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={ra.display_name}
        description={`Archived ${new Date(ra.archived_at).toLocaleString()} · /demo/${ra.slug}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to archive
            </Button>
            <RestoreControl
              archive={{ id: ra.id, display_name: ra.display_name, slug: ra.slug }}
              onRestored={onRestored}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setTransferOpen(true)}
              disabled={!hasLiveLeads}
              title={hasLiveLeads ? "Re-assign live leads to another RA" : "No leads to transfer"}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Transfer leads
            </Button>
            <HardDeleteControl
              archive={{ id: ra.id, display_name: ra.display_name, leads_count: leadsCount, deals_count: dealsCount }}
              hasLiveLeads={hasLiveLeads && !transferred}
              onDeleted={onBack}
            />
          </div>
        }
      />

      {transferred && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-sm">
            <strong>{transferred.leads} lead{transferred.leads === 1 ? "" : "s"}</strong>
            {transferred.deals > 0 && <> and <strong>{transferred.deals} deal{transferred.deals === 1 ? "" : "s"}</strong></>}
            {" "}transferred to <strong>{transferred.name}</strong>. The archive snapshot is unchanged.
          </CardContent>
        </Card>
      )}

      <TransferRaLeadsModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        archive={{ id: ra.id, display_name: ra.display_name, leads_count: leadsCount, deals_count: dealsCount }}
        onTransferred={(r) => setTransferred({
          name: r.target_display_name,
          leads: r.leads_transferred,
          deals: r.deals_transferred,
        })}
      />

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <ArchiveIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Status when archived:</span>
            <Badge variant="outline">{STATUS_LABELS[ra.status_at_archive]}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Email at archive time: <span className="font-mono">{ra.email ?? "—"}</span>
          </div>
          {ra.archive_reason && (
            <div className="text-sm text-muted-foreground">
              Reason: <span>{ra.archive_reason}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Leads <span className="ml-1 opacity-60">{detail.leads.length}</span>
          </TabsTrigger>
          <TabsTrigger value="deals">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Deals <span className="ml-1 opacity-60">{detail.deals.length}</span>
          </TabsTrigger>
          <TabsTrigger value="checkins">
            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
            Check-ins <span className="ml-1 opacity-60">{detail.checkins.length}</span>
          </TabsTrigger>
          <TabsTrigger value="payouts">
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
            Payouts <span className="ml-1 opacity-60">{detail.payouts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="agreements">
            <FileSignature className="h-3.5 w-3.5 mr-1.5" />
            Agreements <span className="ml-1 opacity-60">{detail.agreements.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads"><SnapshotTable rows={detail.leads} kind="lead" /></TabsContent>
        <TabsContent value="deals"><SnapshotTable rows={detail.deals} kind="deal" /></TabsContent>
        <TabsContent value="checkins"><SnapshotTable rows={detail.checkins} kind="checkin" /></TabsContent>
        <TabsContent value="payouts"><SnapshotTable rows={detail.payouts} kind="payout" /></TabsContent>
        <TabsContent value="agreements"><SnapshotTable rows={detail.agreements} kind="agreement" /></TabsContent>
      </Tabs>
    </div>
  )
}

/** Generic JSONB snapshot renderer. Picks a few well-known fields per kind for
 *  a tidy summary; full payload is in `snapshot`. */
function SnapshotTable({
  rows,
  kind,
}: {
  rows: import("@/types/db").ArchivedRaRow[]
  kind: "lead" | "deal" | "checkin" | "payout" | "agreement"
}) {
  if (rows.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        No {kind} records were archived for this RA.
      </CardContent></Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Summary</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Original ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const s = r.snapshot as Record<string, unknown>
              const summary = summarize(kind, s)
              const originalId =
                (r.original_lead_id ?? r.original_deal_id ?? r.original_checkin_id ??
                 r.original_payout_id ?? r.original_acceptance_id ?? "") as string
              const createdAt = (s.created_at ?? s.checkin_at ?? s.accepted_at ?? r.archived_at) as string
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{summary}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {createdAt ? new Date(createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                    {originalId.slice(0, 8)}…
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function summarize(
  kind: "lead" | "deal" | "checkin" | "payout" | "agreement",
  s: Record<string, unknown>
): string {
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "")
  const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : null)
  switch (kind) {
    case "lead":
      return [str("contact_name") || str("name"), str("contact_email") || str("email"), str("company_name") || str("company"), str("stage")]
        .filter(Boolean).join(" · ") || "Lead"
    case "deal":
      return [str("name") || str("title"), num("amount") != null ? `$${num("amount")?.toLocaleString()}` : "", str("stage")]
        .filter(Boolean).join(" · ") || "Deal"
    case "checkin":
      return [str("client_name"), str("method"), str("notes")?.slice(0, 60)]
        .filter(Boolean).join(" · ") || "Check-in"
    case "payout":
      return [str("type"), num("amount") != null ? `$${num("amount")?.toLocaleString()}` : "", str("status")]
        .filter(Boolean).join(" · ") || "Payout"
    case "agreement":
      return [str("agreement_version"), str("signed_legal_name")]
        .filter(Boolean).join(" · ") || "Agreement"
  }
}
