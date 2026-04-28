import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/PageHeader"
import { PARTNER_TYPES, createPartner, deletePartner, listPartners, updatePartner } from "@/lib/data"
import type { Partner } from "@/types/db"

const STATUSES = ["Active", "Inactive", "Pending"] as const

export function PartnerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [name, setName] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("Active")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [agreementStartDate, setAgreementStartDate] = useState("")
  const [contractTerms, setContractTerms] = useState("")
  const [revenueShare, setRevenueShare] = useState("")
  const [keyContacts, setKeyContacts] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [existing, setExisting] = useState<Partner | null>(null)

  useEffect(() => {
    if (!id) return
    listPartners().then((rows) => {
      const p = rows.find((r) => r.id === id)
      if (p) {
        setExisting(p)
        setName(p.name)
        setType(p.type ?? "")
        setStatus(p.status)
        setEmail(p.email ?? "")
        setPhone(p.phone ?? "")
        setWebsite(p.website ?? "")
        setAgreementStartDate(p.agreement_start_date ?? "")
        setContractTerms(p.contract_terms ?? "")
        setRevenueShare(p.revenue_share ?? "")
        setKeyContacts(p.key_contacts ?? "")
        setNotes(p.notes ?? "")
      }
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const input = {
        name: name.trim(),
        type: type || null,
        status,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        agreement_start_date: agreementStartDate || null,
        contract_terms: contractTerms.trim() || null,
        revenue_share: revenueShare.trim() || null,
        key_contacts: keyContacts.trim() || null,
        notes: notes.trim() || null,
      }
      if (isEdit && id) {
        await updatePartner(id, input)
        toast.success("Partner updated")
      } else {
        await createPartner(input)
        toast.success("Partner created")
      }
      navigate("/partners")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    try {
      await deletePartner(id)
      toast.success("Partner deleted")
      navigate("/partners")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Partner" : "New Partner"}
        description={isEdit ? existing?.name ?? "" : "Add a strategic, financial, or reseller partner."}
      />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="name">Partner Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Partner Type</Label>
                <Select value={type || "none"} onValueChange={(v) => setType(v === "none" ? "" : v)}>
                  <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No type</SelectItem>
                    {PARTNER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agreement_start">Agreement Start Date</Label>
                <Input id="agreement_start" type="date" value={agreementStartDate} onChange={(e) => setAgreementStartDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="key_contacts">Key Contacts</Label>
              <Input id="key_contacts" value={keyContacts} onChange={(e) => setKeyContacts(e.target.value)} placeholder="Jane Smith (VP Partnerships)" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="revenue_share">Revenue Share / Financial Terms</Label>
              <Input id="revenue_share" value={revenueShare} onChange={(e) => setRevenueShare(e.target.value)} placeholder="e.g. 15% revenue share on referred deals" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contract_terms">Contract Terms</Label>
              <Textarea id="contract_terms" rows={3} value={contractTerms} onChange={(e) => setContractTerms(e.target.value)} placeholder="Describe the key terms of the partnership agreement…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this partner…" />
            </div>
          </CardContent>

          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div>
              {isEdit && !confirmDelete && (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">Are you sure?</span>
                  <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>Yes, delete</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create partner"}</Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
