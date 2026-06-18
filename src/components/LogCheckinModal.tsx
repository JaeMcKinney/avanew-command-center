import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { logClientCheckin, type ClientCheckin } from "@/lib/data"

const METHODS: { value: ClientCheckin["method"]; label: string }[] = [
  { value: "phone",     label: "Phone" },
  { value: "video",     label: "Video" },
  { value: "in_person", label: "In person" },
  { value: "email",     label: "Email" },
]

interface Props {
  open: boolean
  onClose: () => void
  raSlug: string
  leadId: string | null
  clientName: string
  variant?: "light" | "dark"
  onLogged?: (c: ClientCheckin) => void
}

export function LogCheckinModal({
  open, onClose, raSlug, leadId, clientName, variant = "light", onLogged,
}: Props) {
  const [method, setMethod] = useState<ClientCheckin["method"]>("phone")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  function reset() { setMethod("phone"); setNotes(""); setSaving(false) }

  async function submit() {
    setSaving(true)
    try {
      const row = await logClientCheckin({
        ra_slug: raSlug, lead_id: leadId, client_name: clientName,
        method, notes: notes.trim() || null,
      })
      onLogged?.(row)
      toast.success(`Check-in logged for ${clientName}`)
      reset(); onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log check-in")
      setSaving(false)
    }
  }

  const isDark = variant === "dark"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent
        className={isDark ? "border-white/10 bg-[#0B1422] text-white" : ""}
      >
        <DialogHeader>
          <DialogTitle className={isDark ? "text-white" : ""}>
            Log check-in — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className={["text-xs font-medium uppercase tracking-wider block mb-2",
              isDark ? "text-white/60" : "text-muted-foreground"].join(" ")}>
              Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={[
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    method === m.value
                      ? (isDark ? "border-[#34D6C2] bg-[#34D6C2]/10 text-white" : "border-primary bg-primary/5")
                      : (isDark ? "border-white/10 text-white/70 hover:bg-white/[.04]" : "border-border hover:bg-muted/40"),
                  ].join(" ")}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={["text-xs font-medium uppercase tracking-wider block mb-2",
              isDark ? "text-white/60" : "text-muted-foreground"].join(" ")}>
              Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you discuss? Any blockers or follow-ups?"
              rows={4}
              className={isDark ? "border-white/10 bg-white/[.04] text-white placeholder:text-white/30" : ""}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant={isDark ? "ghost" : "outline"}
            onClick={() => { reset(); onClose() }}
            disabled={saving}
            className={isDark ? "text-white/70 hover:bg-white/[.06] hover:text-white" : ""}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Logging…" : "Log check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
