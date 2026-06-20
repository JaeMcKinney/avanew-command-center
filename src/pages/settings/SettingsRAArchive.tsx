import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Archive as ArchiveIcon, Search, FileText, Users, ListChecks, Receipt, FileSignature, RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { listArchivedRas, getArchivedRa, restoreRa } from "@/lib/data"
import { toast } from "sonner"
import type { ArchivedRaAssociate, ArchivedRaDetail, RaStatus } from "@/types/db"

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
                  This re-creates the RA at <span className="font-mono">/refer/{archive.slug}</span>,
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

const STATUS_LABELS: Record<RaStatus, string> = {
  pending: "Pending onboarding",
  verification: "Pending review",
  needs_changes: "Changes requested",
  active: "Active",
  suspended: "Suspended",
  declined: "Declined",
  terminated: "Terminated",
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
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search archived RAs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      Loading archive…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      {query ? "No archived RAs match your search." : "No RAs have been archived yet."}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((r) => {
                  const total =
                    r.archived_leads_count + r.archived_deals_count +
                    r.archived_checkins_count + r.archived_payouts_count
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpen(r.id)}>
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
                        <RestoreControl
                          archive={{ id: r.id, display_name: r.display_name, slug: r.slug }}
                          onRestored={() => { setRows((prev) => prev.filter((x) => x.id !== r.id)); onRestored() }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ArchiveDetail({ id, onBack, onRestored }: { id: string; onBack: () => void; onRestored: () => void }) {
  const [detail, setDetail] = useState<ArchivedRaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={ra.display_name}
        description={`Archived ${new Date(ra.archived_at).toLocaleString()} · /refer/${ra.slug}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to archive
            </Button>
            <RestoreControl
              archive={{ id: ra.id, display_name: ra.display_name, slug: ra.slug }}
              onRestored={onRestored}
            />
          </div>
        }
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
