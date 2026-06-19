import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  CircleDot,
  FileSignature,
  Camera,
  Phone,
  Landmark,
  FileText,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { getRaBySlug, updateRaStatus } from "@/lib/data"
import type { RaAssociate, RaStatus } from "@/types/db"

type ChecklistItem = {
  key: string
  label: string
  description: string
  icon: typeof CheckCircle2
  done: boolean
  detail: string
}

const STATUS_LABEL: Record<RaStatus, string> = {
  pending:       "Pending onboarding",
  verification:  "Pending review",
  needs_changes: "Changes requested",
  active:        "Active",
  suspended:     "Suspended",
  declined:      "Declined",
  terminated:    "Terminated",
}

export function SettingsRAReview() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestNotes, setRequestNotes] = useState("")
  const [declineOpen, setDeclineOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const [approvedSummary, setApprovedSummary] = useState<RaAssociate | null>(null)

  useEffect(() => {
    if (!slug) return
    void getRaBySlug(slug).then((r) => {
      setRa(r)
      setLoading(false)
    })
  }, [slug])

  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>
  if (!ra) return (
    <div className="p-6 space-y-3">
      <p className="text-sm">Associate not found.</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/settings/team")}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to list
      </Button>
    </div>
  )

  const checklist: ChecklistItem[] = [
    {
      key: "agreement",
      label: "Referral Associate Agreement",
      description: "Electronically signed",
      icon: FileSignature,
      done: Boolean(ra.agreement_completed),
      detail: ra.agreement_completed
        ? `${ra.agreement_signed_name ?? "Signed"}${
            ra.agreement_accepted_at ? ` · ${new Date(ra.agreement_accepted_at).toLocaleString()}` : ""
          }${ra.agreement_version ? ` · ${ra.agreement_version}` : ""}`
        : "Not yet signed",
    },
    {
      key: "photo",
      label: "Profile photo",
      description: "Headshot for referral page",
      icon: Camera,
      done: ra.photo_completed,
      detail: ra.photo_url ? "Uploaded" : "Not yet uploaded",
    },
    {
      key: "bio",
      label: "Bio",
      description: "Short blurb",
      icon: FileText,
      done: Boolean(ra.bio?.trim()),
      detail: ra.bio?.trim() ? `${(ra.bio ?? "").length} chars` : "Empty",
    },
    {
      key: "contact",
      label: "Contact info",
      description: "Phone, public email",
      icon: Phone,
      done: ra.contact_completed,
      detail: ra.contact_completed
        ? [ra.contact_phone, ra.contact_email].filter(Boolean).join(" · ")
        : "Incomplete",
    },
    {
      key: "banking",
      label: "ACH banking",
      description: "Mercury disbursement target",
      icon: Landmark,
      done: ra.banking_completed,
      detail: ra.banking_completed
        ? `${ra.ach_bank_name ?? "Bank"} ···${(ra.ach_account ?? "").slice(-4)}`
        : "Not provided",
    },
    {
      key: "w9",
      label: "IRS Form W-9",
      description: "Signed PDF on file",
      icon: FileText,
      done: Boolean(ra.w9_completed),
      detail: ra.w9_completed
        ? `Uploaded${ra.w9_uploaded_at ? ` · ${new Date(ra.w9_uploaded_at).toLocaleDateString()}` : ""}${
            ra.w9_reviewed_at ? " · reviewed" : ""
          }`
        : "Not yet uploaded",
    },
  ]

  const completedCount = checklist.filter((c) => c.done).length
  const allComplete = completedCount === checklist.length

  async function approve() {
    if (!allComplete) return
    setActing(true)
    try {
      await updateRaStatus(ra!.id, {
        status: "active",
        verified_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
      })
      setApprovedSummary({ ...ra!, status: "active" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed")
    } finally {
      setActing(false)
    }
  }

  async function submitRequestChanges() {
    if (!requestNotes.trim()) { toast.error("Please describe what needs to change"); return }
    setActing(true)
    try {
      await updateRaStatus(ra!.id, {
        status: "needs_changes",
        verification_notes: requestNotes.trim(),
      })
      toast.success(`${ra!.display_name} notified of requested changes`)
      setRequestOpen(false)
      navigate("/settings/team")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setActing(false)
    }
  }

  async function confirmDecline() {
    setActing(true)
    try {
      await updateRaStatus(ra!.id, { status: "declined" })
      toast.success(`${ra!.display_name} declined`)
      setDeclineOpen(false)
      navigate("/settings/team")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/settings/team" className="hover:text-foreground">Referral Associates</Link>
        <span>›</span>
        <span className="text-foreground">Review · {ra.display_name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {ra.photo_url ? (
            <img src={ra.photo_url} alt="" className="h-14 w-14 rounded-full object-cover border" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-muted border flex items-center justify-center text-base font-medium">
              {ra.display_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">{ra.display_name}</h1>
            <p className="text-xs text-muted-foreground">{ra.email} · /refer/{ra.slug}</p>
          </div>
        </div>
        <Badge variant={ra.status === "verification" ? "secondary" : "outline"}>
          {STATUS_LABEL[ra.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: profile preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile preview</CardTitle>
              <CardDescription>How this RA will appear on their public referral page once active.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Display name</p>
                  <p className="font-medium">{ra.display_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Public email</p>
                  <p className="font-medium">{ra.contact_email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{ra.contact_phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Referral URL</p>
                  <p className="font-mono text-xs">/refer/{ra.slug}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bio</p>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {ra.bio || <span className="text-muted-foreground italic">No bio provided</span>}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Banking
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Account holder</p>
                  <p className="font-medium">{ra.ach_account_holder || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bank</p>
                  <p className="font-medium">{ra.ach_bank_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Routing</p>
                  <p className="font-mono">{ra.ach_routing ? `···${ra.ach_routing.slice(-4)}` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account</p>
                  <p className="font-mono">{ra.ach_account ? `···${ra.ach_account.slice(-4)}` : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                W-9
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ra.w9_completed ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Uploaded{ra.w9_uploaded_at ? ` on ${new Date(ra.w9_uploaded_at).toLocaleDateString()}` : ""}
                  </p>
                  {ra.w9_document_url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={ra.w9_document_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Open W-9 PDF
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No W-9 on file.</p>
              )}
            </CardContent>
          </Card>

          {ra.verification_notes && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Earlier verification notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ra.verification_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: checklist + actions */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Verification checklist
              </CardTitle>
              <CardDescription>
                {completedCount} of {checklist.length} complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.map((c) => {
                const Icon = c.icon
                return (
                  <div key={c.key} className="flex items-start gap-2.5">
                    {c.done
                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      : <CircleDot className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        {c.label}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{c.detail}</p>
                    </div>
                  </div>
                )
              })}

              <div className="pt-3 border-t space-y-2">
                <Button className="w-full" disabled={!allComplete || acting} onClick={approve}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve & Activate
                </Button>
                <Button variant="outline" className="w-full" disabled={acting} onClick={() => setRequestOpen(true)}>
                  Request changes
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={acting}
                  onClick={() => setDeclineOpen(true)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Decline application
                </Button>
                {!allComplete && (
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    Approve unlocks once all items are checked.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Request changes modal */}
      <Dialog open={requestOpen} onOpenChange={(v) => !v && setRequestOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              {ra.display_name} will see this note and remain in onboarding until they address it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs">Notes for the RA</Label>
            <Textarea
              id="notes"
              rows={5}
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="e.g. ACH routing number looks invalid. Please double-check and re-submit."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={acting}>Cancel</Button>
            <Button onClick={submitRequestChanges} disabled={acting || !requestNotes.trim()}>
              Send to {ra.display_name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline modal */}
      <Dialog open={declineOpen} onOpenChange={(v) => !v && setDeclineOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline application?</DialogTitle>
            <DialogDescription>
              This will mark {ra.display_name} as declined and notify them by email. This action can be reversed
              later from the list view.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={acting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDecline} disabled={acting}>
              Decline application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval confirmation (A5) */}
      <Dialog open={!!approvedSummary} onOpenChange={(v) => !v && navigate("/settings/team")}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-3 py-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle>{approvedSummary?.display_name} is live!</DialogTitle>
              <DialogDescription>
                Their referral page is now active and they can start submitting referrals.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="rounded-md border p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">Public referral URL</p>
            <p className="font-mono text-muted-foreground break-all">
              {typeof window !== "undefined" && approvedSummary
                ? `${window.location.origin}/refer/${approvedSummary.slug}`
                : ""}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => navigate(`/settings/ra/${approvedSummary!.slug}`)}>
              View RA detail
            </Button>
            <Button onClick={() => navigate("/settings/team")}>Back to list</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
