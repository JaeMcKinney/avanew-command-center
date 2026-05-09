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
import { createContact } from "@/lib/data"
import type { Contact } from "@/types/db"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultCompanyId?: string | null
  onCreated: (contact: Contact) => void
}

export function QuickCreateContactDialog({
  open,
  onOpenChange,
  defaultCompanyId,
  onCreated,
}: Props) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [title, setTitle] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setTitle("")
    }
  }, [open])

  async function handleCreate() {
    if (!firstName.trim()) {
      toast.error("First name is required")
      return
    }
    setSubmitting(true)
    try {
      const contact = await createContact({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        title: title.trim() || null,
        company_id: defaultCompanyId ?? null,
      })
      toast.success("Contact created")
      onCreated(contact)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
          <DialogDescription>
            Quick-create. You can edit the rest later from the contact page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-first">First name</Label>
              <Input
                id="qc-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-last">Last name</Label>
              <Input
                id="qc-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-email">Email</Label>
            <Input
              id="qc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-phone">Phone</Label>
            <Input
              id="qc-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-title">Title</Label>
            <Input
              id="qc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. VP of Sales"
            />
          </div>
          {defaultCompanyId && (
            <p className="text-xs text-muted-foreground">
              This contact will be linked to the selected account.
            </p>
          )}
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
