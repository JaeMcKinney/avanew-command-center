import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileSignature,
  Camera,
  Phone,
  Landmark,
  FileText,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
  Eye,
  EyeOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { getRaBySlug, updateRaStatus, listRaSectionComments, getRaW9SignedUrl, listRaChangeRequests } from "@/lib/data"
import { RaReviewSection } from "@/components/ra/RaReviewSection"
import { RaActivityThread } from "@/components/ra/RaActivityThread"
import type { RaAssociate, RaStatus, RaSectionComment, RaCommentSection, RaChangeRequest } from "@/types/db"

const STATUS_LABEL: Record<RaStatus, string> = {
  pending:       "Pending onboarding",
  verification:  "Pending review",
  needs_changes: "Changes requested",
  active:        "Active",
  suspended:     "Suspended",
  declined:      "Declined",
  terminated:    "Terminated",
}

type SectionMeta = { key: RaCommentSection; label: string; icon: React.ReactNode }

const SECTIONS: SectionMeta[] = [
  { key: "agreement", label: "Agreement",   icon: <FileSignature className="h-4 w-4 text-muted-foreground" /> },
  { key: "photo",     label: "Profile photo", icon: <Camera className="h-4 w-4 text-muted-foreground" /> },
  { key: "bio",       label: "Bio",          icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
  { key: "contact",   label: "Contact info", icon: <Phone className="h-4 w-4 text-muted-foreground" /> },
  { key: "banking",   label: "ACH banking",  icon: <Landmark className="h-4 w-4 text-muted-foreground" /> },
  { key: "w9",        label: "IRS Form W-9", icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
]

export function SettingsRAReview() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [ra, setRa] = useState<RaAssociate | null>(null)
  const [comments, setComments] = useState<RaSectionComment[]>([])
  const [changeRequests, setChangeRequests] = useState<RaChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestNotes, setRequestNotes] = useState("")
  const [declineOpen, setDeclineOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const [approvedSummary, setApprovedSummary] = useState<RaAssociate | null>(null)
  const [showAccount, setShowAccount] = useState(false)

  useEffect(() => {
    if (!slug) return
    void (async () => {
      const r = await getRaBySlug(slug)
      setRa(r)
      if (r) {
        const [c, cr] = await Promise.all([
          listRaSectionComments(r.id).catch(() => []),
          listRaChangeRequests(r.id).catch(() => []),
        ])
        setComments(c)
        setChangeRequests(cr)
      }
      setLoading(false)
    })()
  }, [slug])

  const doneBySection: Record<RaCommentSection, boolean> = useMemo(() => ({
    agreement: Boolean(ra?.agreement_completed),
    photo:     Boolean(ra?.photo_completed),
    bio:       Boolean(ra?.bio?.trim()),
    contact:   Boolean(ra?.contact_completed),
    banking:   Boolean(ra?.banking_completed),
    w9:        Boolean(ra?.w9_completed),
    profile:   true,
    other:     true,
  }), [ra])

  const checklistDone = SECTIONS.filter((s) => doneBySection[s.key]).length
  const allComplete = checklistDone === SECTIONS.length

  const openCommentCount = comments.filter((c) => !c.resolved_at).length

  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>
  if (!ra) return (
    <div className="p-6 space-y-3">
      <p className="text-sm">Associate not found.</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/settings/team")}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to list
      </Button>
    </div>
  )

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

  // Helpers shared by review sections
  const commentsBySection = comments
  const onCommentsChange = (next: RaSectionComment[]) => setComments(next)

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/settings/team" className="hover:text-foreground">Referral Associates</Link>
        <span>›</span>
        <span className="text-foreground">Review · {ra.display_name}</span>
      </div>

      {/* Header */}
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
            <p className="text-xs text-muted-foreground">{ra.email} · /demo/{ra.slug}</p>
          </div>
        </div>
        <Badge variant={ra.status === "verification" ? "secondary" : "outline"}>
          {STATUS_LABEL[ra.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Left: stacked review sections */}
        <div className="space-y-5">
          {/* Agreement */}
          <RaReviewSection
            raId={ra.id}
            section="agreement"
            title="Referral Associate Agreement"
            description="Electronically signed by the RA"
            icon={<FileSignature className="h-4 w-4" />}
            done={doneBySection.agreement}
            comments={commentsBySection}
            onCommentsChange={onCommentsChange}
          >
            {ra.agreement_completed ? (
              <dl className="text-sm grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Signed name</dt>
                  <dd className="font-medium">{ra.agreement_signed_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Accepted at</dt>
                  <dd>{ra.agreement_accepted_at ? new Date(ra.agreement_accepted_at).toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Version</dt>
                  <dd className="font-mono text-xs">{ra.agreement_version ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">IP address</dt>
                  <dd className="font-mono text-xs">{ra.agreement_ip_address ?? "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">User agent</dt>
                  <dd className="text-xs text-muted-foreground truncate">{ra.agreement_user_agent ?? "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground italic">Agreement not yet signed.</p>
            )}
          </RaReviewSection>

          {/* Photo */}
          <RaReviewSection
            raId={ra.id}
            section="photo"
            title="Profile photo"
            description="Headshot used on the public referral page"
            icon={<Camera className="h-4 w-4" />}
            done={doneBySection.photo}
            comments={commentsBySection}
            onCommentsChange={onCommentsChange}
          >
            {ra.photo_url ? (
              <div className="flex items-center gap-4">
                <img src={ra.photo_url} alt="" className="h-24 w-24 rounded-md object-cover border" />
                <Button asChild variant="outline" size="sm">
                  <a href={ra.photo_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open full size
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No photo uploaded.</p>
            )}
          </RaReviewSection>

          {/* Bio */}
          <RaReviewSection
            raId={ra.id}
            section="bio"
            title="Bio"
            description="Short intro displayed on the referral page"
            icon={<FileText className="h-4 w-4" />}
            done={doneBySection.bio}
            comments={commentsBySection}
            onCommentsChange={onCommentsChange}
          >
            {ra.bio?.trim() ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{ra.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No bio provided.</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              {(ra.bio ?? "").length}/500 characters
            </p>
          </RaReviewSection>

          {/* Contact */}
          <RaReviewSection
            raId={ra.id}
            section="contact"
            title="Contact info"
            description="Public phone and email displayed on the referral page"
            icon={<Phone className="h-4 w-4" />}
            done={doneBySection.contact}
            comments={commentsBySection}
            onCommentsChange={onCommentsChange}
          >
            <dl className="text-sm grid grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="font-medium">{ra.contact_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Public email</dt>
                <dd className="font-medium">{ra.contact_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Login email</dt>
                <dd className="text-muted-foreground">{ra.email || "—"}</dd>
              </div>
            </dl>
          </RaReviewSection>

          {/* Banking */}
          <RaReviewSection
            raId={ra.id}
            section="banking"
            title="ACH banking"
            description="Disbursement target (only visible to admins)"
            icon={<Landmark className="h-4 w-4" />}
            done={doneBySection.banking}
            comments={commentsBySection}
            onCommentsChange={onCommentsChange}
          >
            <dl className="text-sm grid grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">Account holder</dt>
                <dd className="font-medium">{ra.ach_account_holder || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Bank</dt>
                <dd className="font-medium">{ra.ach_bank_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Routing number</dt>
                <dd className="font-mono">{ra.ach_routing || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Account number</dt>
                <dd className="font-mono flex items-center gap-1.5">
                  {ra.ach_account
                    ? showAccount ? ra.ach_account : `···${ra.ach_account.slice(-4)}`
                    : "—"}
                  {ra.ach_account && (
                    <button
                      type="button"
                      onClick={() => setShowAccount((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showAccount ? "Hide account number" : "Show account number"}
                    >
                      {showAccount ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </dd>
              </div>
            </dl>
          </RaReviewSection>

          {/* W-9 */}
          <RaReviewSection
            raId={ra.id}
            section="w9"
            title="IRS Form W-9"
            description="Signed PDF (private bucket — admins only)"
            icon={<FileText className="h-4 w-4" />}
            done={doneBySection.w9}
            comments={commentsBySection}
            onCommentsChange={onCommentsChange}
          >
            {ra.w9_completed ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Uploaded{ra.w9_uploaded_at ? ` on ${new Date(ra.w9_uploaded_at).toLocaleDateString()}` : ""}
                  {ra.w9_reviewed_at && <> · marked reviewed</>}
                </p>
                {ra.w9_document_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const url = await getRaW9SignedUrl(ra.w9_document_url!)
                        window.open(url, "_blank", "noopener,noreferrer")
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to open W-9")
                      }
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open W-9 PDF
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No W-9 on file.</p>
            )}
          </RaReviewSection>
        </div>

        {/* Right: sticky checklist + actions */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Verification
              </CardTitle>
              <CardDescription>
                {checklistDone} of {SECTIONS.length} complete
                {openCommentCount > 0 && (
                  <> · <span className="text-amber-600 dark:text-amber-500 font-medium">{openCommentCount} open comment{openCommentCount === 1 ? "" : "s"}</span></>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {SECTIONS.map((s) => {
                const done = doneBySection[s.key]
                const sectionCount = comments.filter((c) => c.section === s.key).length
                return (
                  <a key={s.key} href={`#review-${s.key}`} className="flex items-center gap-2 text-sm hover:text-foreground/90">
                    {done
                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      : <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                    <span className="flex-1 truncate">{s.label}</span>
                    {sectionCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {sectionCount}
                      </span>
                    )}
                  </a>
                )
              })}

              {/* Decision panel — only meaningful while the RA is awaiting a
                  verdict. Once they're active / declined / terminated /
                  suspended, View Detail reuses this screen as read-only. */}
              {(ra.status === "pending" || ra.status === "verification" || ra.status === "needs_changes") && (
                <div className="pt-3 border-t space-y-2">
                  <Button className="w-full" disabled={!allComplete || acting} onClick={approve}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve &amp; Activate
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
              )}
            </CardContent>
          </Card>

          {ra.verification_notes && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Earlier reviewer note
                </CardTitle>
                {ra.verification_notes_at && (
                  <CardDescription className="text-[11px]">
                    Sent {new Date(ra.verification_notes_at).toLocaleString()}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs whitespace-pre-wrap leading-relaxed">{ra.verification_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Communication & activity thread — every program-admin ↔ RA event,
          newest first. Paginates after the first 12. */}
      <RaActivityThread ra={ra} comments={comments} changeRequests={changeRequests} />

      {/* Request changes modal */}
      <Dialog open={requestOpen} onOpenChange={(v) => !v && setRequestOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              {ra.display_name} will see this overall note plus all per-section comments and remain in onboarding until they re-submit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs">Summary note (sent in the email)</Label>
            <Textarea
              id="notes"
              rows={5}
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="e.g. Please re-upload your W-9 — the prior copy was unsigned. See per-section comments for details."
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

      {/* Approval confirmation */}
      <Dialog open={!!approvedSummary} onOpenChange={(v) => !v && navigate("/settings/team")}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-3 py-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle>{approvedSummary?.display_name} is live!</DialogTitle>
              <DialogDescription>
                Their demo page is now active and they can start sharing it with prospects.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="rounded-md border bg-primary/5 p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">Their demo link</p>
            <p className="font-mono text-muted-foreground break-all">
              {typeof window !== "undefined" && approvedSummary
                ? `${window.location.origin}/demo/${approvedSummary.slug}`
                : ""}
            </p>
            <p className="text-[11px] text-muted-foreground pt-1">
              Prospects click "Get in touch" on the demo to reach the referral form.
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
