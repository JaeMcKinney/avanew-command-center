import { useEffect, useMemo, useState } from "react"
import { Loader2, Send, CheckCircle2, Mail, Link as LinkIcon, User, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { RaType } from "@/types/db"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { inviteRa } from "@/lib/data"
import { toast } from "sonner"

type Props = {
  open: boolean
  onClose: () => void
  onInvited: () => void
}

type Sent = { name: string; email: string; slug: string }

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function InviteRaModal({ open, onClose, onInvited }: Props) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [slug, setSlug] = useState("")
  const [raType, setRaType] = useState<RaType>("individual")
  const [slugTouched, setSlugTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)

  useEffect(() => {
    if (!slugTouched) {
      const base = [firstName, lastName].filter(Boolean).join(" ").trim()
      setSlug(base ? slugify(base) : "")
    }
  }, [firstName, lastName, slugTouched])

  function reset() {
    setFirstName(""); setLastName(""); setEmail(""); setSlug("")
    setRaType("individual")
    setSlugTouched(false); setSubmitting(false); setSent(null)
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const slugValid = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 2 && slug.length <= 60
  const formValid = firstName.trim().length > 0 && lastName.trim().length > 0 && emailValid && slugValid

  async function handleSubmit() {
    if (!formValid) return
    setSubmitting(true)
    try {
      const created = await inviteRa({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        slug,
        ra_type: raType,
      })
      setSent({ name: created.display_name, email: created.email, slug: created.slug })
      onInvited()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite")
    } finally {
      setSubmitting(false)
    }
  }

  const referralUrl = useMemo(() => {
    if (typeof window === "undefined" || !sent) return ""
    return `${window.location.origin}/refer/${sent.slug}`
  }, [sent])

  // ── Sent confirmation (A3) ─────────────────────────────────────────────────
  if (sent) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-3 py-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle>Invite sent to {sent.name}</DialogTitle>
              <DialogDescription>
                We emailed <span className="text-foreground">{sent.email}</span> a sign-in link. They'll be guided
                through the 6-step onboarding (agreement, photo, contact, banking, W-9, review).
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Mail className="h-3.5 w-3.5 text-primary" /> What happens next
              </div>
              <ul className="space-y-1 text-muted-foreground list-disc pl-5">
                <li>They sign in and set a password</li>
                <li>Complete onboarding & submit for review</li>
                <li>You receive a notification when their application is ready to verify</li>
              </ul>
            </div>
            <div className="rounded-md border p-3 flex items-start gap-2.5 text-xs">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Their referral URL (active once approved)</p>
                <p className="font-mono text-muted-foreground truncate">{referralUrl}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setSent(null); reset() }}>
              Invite another
            </Button>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Invite form (A2) ───────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a Referral Associate</DialogTitle>
          <DialogDescription>
            They'll receive an email link to sign in and complete onboarding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">RA type</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "individual" as const, label: "Individual", icon: User, hint: "A single named partner" },
                { value: "company" as const, label: "Company", icon: Building2, hint: "A partner brand / org" },
              ]).map((opt) => {
                const Icon = opt.icon
                const active = raType === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRaType(opt.value)}
                    disabled={submitting}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={submitting}
                placeholder="Jordan"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={submitting}
                placeholder="Lee"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="jordan@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-xs">Referral URL slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono shrink-0">/refer/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true) }}
                onBlur={() => { if (!slug && firstName) setSlug(slugify(`${firstName} ${lastName}`)) }}
                disabled={submitting}
                placeholder="jordan-lee"
                className="font-mono"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              2–60 chars, lowercase letters, numbers, and hyphens.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formValid || submitting}>
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              : <><Send className="h-3.5 w-3.5" /> Send invite</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
