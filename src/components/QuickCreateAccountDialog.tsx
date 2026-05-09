import { useEffect, useState } from "react"
import { toast } from "sonner"
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
import { createCompany } from "@/lib/data"
import type { Company } from "@/types/db"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName?: string
  onCreated: (account: Company) => void
}

export function QuickCreateAccountDialog({ open, onOpenChange, initialName, onCreated }: Props) {
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initialName ?? "")
      setWebsite("")
      setPhone("")
    }
  }, [open, initialName])

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSubmitting(true)
    try {
      const account = await createCompany({
        name: name.trim(),
        website: website.trim() || null,
        phone: phone.trim() || null,
      })
      toast.success("Account created")
      onCreated(account)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>
            Quick-create. You can edit the rest later from the account page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qa-name">Name</Label>
            <Input
              id="qa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Company name"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-website">Website</Label>
            <Input
              id="qa-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-phone">Phone</Label>
            <Input
              id="qa-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
