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
import { COST_FREQUENCY_OPTIONS, PAYMENT_TERMS_OPTIONS, createVendor, deleteVendor, listVendors, updateVendor } from "@/lib/data"
import type { Vendor } from "@/types/db"

export function VendorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [name, setName] = useState("")
  const [service, setService] = useState("")
  const [status, setStatus] = useState("Active")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [contractTerms, setContractTerms] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")
  const [costStructure, setCostStructure] = useState("")
  const [costAmount, setCostAmount] = useState("")
  const [costFrequency, setCostFrequency] = useState("")
  const [performanceNotes, setPerformanceNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [existing, setExisting] = useState<Vendor | null>(null)

  useEffect(() => {
    if (!id) return
    listVendors().then((rows) => {
      const v = rows.find((r) => r.id === id)
      if (v) {
        setExisting(v)
        setName(v.name)
        setService(v.service ?? "")
        setStatus(v.status)
        setEmail(v.email ?? "")
        setPhone(v.phone ?? "")
        setWebsite(v.website ?? "")
        setContractTerms(v.contract_terms ?? "")
        setPaymentTerms(v.payment_terms ?? "")
        setCostStructure(v.cost_structure ?? "")
        setCostAmount(v.cost_amount != null ? String(v.cost_amount) : "")
        setCostFrequency(v.cost_frequency ?? "")
        setPerformanceNotes(v.performance_notes ?? "")
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
        service: service.trim() || null,
        status,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        contract_terms: contractTerms.trim() || null,
        payment_terms: paymentTerms || null,
        cost_structure: costStructure.trim() || null,
        cost_amount: costAmount.trim() ? Number(costAmount.trim()) : null,
        cost_frequency: (costFrequency || null) as "monthly" | "quarterly" | "annually" | null,
        performance_notes: performanceNotes.trim() || null,
      }
      if (isEdit && id) {
        await updateVendor(id, input)
        toast.success("Vendor updated")
      } else {
        await createVendor(input)
        toast.success("Vendor created")
      }
      navigate("/vendors")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    try {
      await deleteVendor(id)
      toast.success("Vendor deleted")
      navigate("/vendors")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Vendor" : "New Vendor"}
        description={isEdit ? existing?.name ?? "" : "Add a vendor or service provider."}
      />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-6 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="name">Vendor Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Software Inc." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="service">Service / Product Provided</Label>
                <Input id="service" value={service} onChange={(e) => setService(e.target.value)} placeholder="Cloud infrastructure, SaaS tools…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@vendor.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="vendor.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Select value={paymentTerms || "none"} onValueChange={(v) => setPaymentTerms(v === "none" ? "" : v)}>
                  <SelectTrigger id="payment_terms"><SelectValue placeholder="Select terms" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {PAYMENT_TERMS_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cost_amount">Cost Amount ($)</Label>
                <Input id="cost_amount" type="number" min="0" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost_frequency">Billing Frequency</Label>
                <Select value={costFrequency || "none"} onValueChange={(v) => setCostFrequency(v === "none" ? "" : v)}>
                  <SelectTrigger id="cost_frequency"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {COST_FREQUENCY_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cost_structure">Cost Notes</Label>
              <Input id="cost_structure" value={costStructure} onChange={(e) => setCostStructure(e.target.value)} placeholder="e.g. EC2 + RDS + S3, 25 seats" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contract_terms">Contract Terms</Label>
              <Textarea id="contract_terms" rows={3} value={contractTerms} onChange={(e) => setContractTerms(e.target.value)} placeholder="Key contract terms, renewal dates, SLAs…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="performance_notes">Performance Notes</Label>
              <Textarea id="performance_notes" rows={3} value={performanceNotes} onChange={(e) => setPerformanceNotes(e.target.value)} placeholder="Notes on reliability, support quality, issues…" />
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
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create vendor"}</Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
