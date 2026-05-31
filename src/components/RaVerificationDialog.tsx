import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Phone,
  Mail,
  Link2,
  Calendar,
  Landmark,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { approveRa, requestRaChanges, declineRa } from "@/lib/data"
import type { RaAssociate } from "@/types/db"

type Props = {
  ra: RaAssociate | null
  open: boolean
  onClose: () => void
  onActionComplete: () => void
}

type Mode = "review" | "request_changes" | "confirm_decline"

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// ── Row helper ───────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
      <div>
        <span className="text-xs text-muted-foreground uppercase tracking-wide mr-1.5">
          {label}
        </span>
        <span className="text-foreground">{value}</span>
      </div>
    </div>
  )
}

// ── Main dialog ──────────────────────────────────────────────────────────────

export function RaVerificationDialog({ ra, open, onClose, onActionComplete }: Props) {
  const [mode, setMode] = useState<Mode>("review")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Reset local state whenever a new RA is opened
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setMode("review")
      setNotes("")
      setSaving(false)
      onClose()
    }
  }

  async function handleApprove() {
    if (!ra) return
    setSaving(true)
    try {
      await approveRa(ra.id)
      toast.success(`${ra.display_name} has been approved and is now active!`)
      handleOpenChange(false)
      onActionComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve")
    } finally {
      setSaving(false)
    }
  }

  async function handleRequestChanges() {
    if (!ra) return
    if (!notes.trim()) {
      toast.error("Please describe what needs to be changed.")
      return
    }
    setSaving(true)
    try {
      await requestRaChanges(ra.id, notes)
      toast.success(`Change request sent to ${ra.display_name}.`)
      handleOpenChange(false)
      onActionComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send request")
    } finally {
      setSaving(false)
    }
  }

  async function handleDecline() {
    if (!ra) return
    setSaving(true)
    try {
      await declineRa(ra.id)
      toast.success(`${ra.display_name}'s application has been declined.`)
      handleOpenChange(false)
      onActionComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline")
    } finally {
      setSaving(false)
    }
  }

  if (!ra) return null

  const bankingDetail =
    ra.banking_completed && ra.ach_bank_name
      ? `${ra.ach_bank_name}${ra.ach_account ? ` ···${ra.ach_account.slice(-4)}` : ""}`
      : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <DialogTitle>Review Application</DialogTitle>
        </DialogHeader>

        {/* ── RA identity block ── */}
        <div className="flex items-center gap-4 py-2">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
            {ra.photo_url ? (
              <img
                src={ra.photo_url}
                alt={ra.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xl font-semibold text-muted-foreground">
                {ra.display_name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold leading-tight">
                {ra.display_name}
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200"
              >
                Pending Verification
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{ra.email}</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              /refer/{ra.slug}
            </p>
          </div>
        </div>

        {/* ── Submitted date ── */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground -mt-1">
          <Calendar className="h-3 w-3" />
          Submitted {formatDate(ra.submitted_at)}
        </div>

        <hr className="border-border" />

        {/* ── Section checklist ── */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Completion
          </p>
          {[
            { label: "Profile photo", done: ra.photo_completed },
            { label: "Contact info", done: ra.contact_completed },
            { label: "Banking details", done: ra.banking_completed },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              {s.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              )}
              <span className={s.done ? "text-foreground" : "text-muted-foreground"}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <hr className="border-border" />

        {/* ── Contact details ── */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact
          </p>
          <InfoRow icon={Phone} label="Phone" value={ra.contact_phone} />
          <InfoRow icon={Mail} label="Email" value={ra.contact_email} />
          <InfoRow icon={Link2} label="Ref URL" value={`/refer/${ra.slug}`} />
          {ra.bio && (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Bio
              </p>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {ra.bio}
              </p>
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* ── Banking details ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Banking
          </p>
          {ra.banking_completed ? (
            <InfoRow icon={Landmark} label="ACH" value={bankingDetail} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Not completed</p>
          )}
        </div>

        {/* ── Inline action UI ── */}
        {mode === "request_changes" && (
          <>
            <hr className="border-border" />
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-medium">Describe what needs to change</p>
              </div>
              <Textarea
                placeholder="e.g. Your profile photo is too small. Please upload a clear headshot at least 400×400px."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[96px] resize-none"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This message will be shown to the RA when they re-enter the onboarding flow.
              </p>
            </div>
          </>
        )}

        {mode === "confirm_decline" && (
          <>
            <hr className="border-border" />
            <div className="rounded-md bg-destructive/10 border border-destructive/25 p-3 text-sm text-destructive">
              <strong>Confirm decline?</strong> This will mark the application as declined.{" "}
              {ra.display_name} will not be activated. This action can be reversed by an admin if needed.
            </div>
          </>
        )}

        {/* ── Footer actions ── */}
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {/* Left: destructive / back actions */}
          <div className="flex gap-2 mr-auto">
            {mode === "review" && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setMode("confirm_decline")}
                disabled={saving}
              >
                <XCircle className="h-3.5 w-3.5" />
                Decline
              </Button>
            )}
            {(mode === "request_changes" || mode === "confirm_decline") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("review")}
                disabled={saving}
              >
                Back
              </Button>
            )}
          </div>

          {/* Right: primary actions */}
          {mode === "review" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setNotes(""); setMode("request_changes") }}
                disabled={saving}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Request Changes
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleApprove}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approve
              </Button>
            </>
          )}

          {mode === "request_changes" && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50"
              onClick={handleRequestChanges}
              disabled={saving || !notes.trim()}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              Send Request
            </Button>
          )}

          {mode === "confirm_decline" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDecline}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Yes, decline
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
