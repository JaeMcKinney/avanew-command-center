import { useEffect, useState } from "react"
import { Loader2, Send, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { reinviteRa } from "@/lib/data"
import { toast } from "sonner"
import type { RaAssociate } from "@/types/db"

type Props = {
  ra: RaAssociate | null
  open: boolean
  onClose: () => void
  onResent?: () => void
}

/**
 * Resend a sign-in link to an existing RA. Email is prefilled with the RA's
 * current address but editable — admins use this to correct typos at invite
 * time without having to delete and re-invite.
 */
export function ReinviteRaModal({ ra, open, onClose, onResent }: Props) {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && ra) setEmail(ra.email ?? "")
  }, [open, ra])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const emailChanged = ra ? email.trim().toLowerCase() !== (ra.email ?? "").trim().toLowerCase() : false

  function handleClose() {
    if (submitting) return
    onClose()
  }

  async function handleSubmit() {
    if (!ra || !emailValid) return
    setSubmitting(true)
    try {
      const result = await reinviteRa({
        ra_id: ra.id,
        new_email: emailChanged ? email.trim() : null,
      })
      const headline = result.email_changed
        ? `Email updated and re-invite sent to ${result.email}`
        : `Re-invite sent to ${result.email}`
      toast.success(headline, {
        description: result.mode === "recovery"
          ? "They already had an account — we sent a password reset link they can use to sign in."
          : "They'll get a new magic-link email shortly.",
      })
      onResent?.()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to re-invite")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Re-invite {ra?.display_name ?? "this RA"}</DialogTitle>
          <DialogDescription>
            Resend the sign-in link. Edit the email below if you need to send it to a different address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reinvite-email" className="text-xs">Email</Label>
            <Input
              id="reinvite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="name@example.com"
            />
            {emailChanged && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                This will update {ra?.display_name ?? "the RA"}'s account email from
                {" "}<span className="font-mono">{ra?.email ?? "—"}</span> to <span className="font-mono">{email.trim()}</span>.
              </p>
            )}
          </div>

          <div className="rounded-md border bg-muted/40 p-3 flex items-start gap-2.5 text-xs">
            <Mail className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              The RA will receive a fresh sign-in email and can resume onboarding from where they left off.
              If they've already accepted, they'll get a password-reset link instead.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!emailValid || submitting || !ra}>
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              : <><Send className="h-3.5 w-3.5" /> {emailChanged ? "Update email & resend" : "Resend invite"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
