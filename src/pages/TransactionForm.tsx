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
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RECURRENCE_PERIODS,
  createTransaction,
  deleteTransaction,
  listPartners,
  listTransactions,
  listVendors,
  updateTransaction,
} from "@/lib/data"
import type { CashflowTransaction, Partner, Vendor } from "@/types/db"

export function TransactionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [type, setType] = useState<"income" | "expense">("income")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePeriod, setRecurrencePeriod] = useState("monthly")
  const [partnerId, setPartnerId] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [reference, setReference] = useState("")
  const [partners, setPartners] = useState<Partner[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [existing, setExisting] = useState<CashflowTransaction | null>(null)

  useEffect(() => {
    Promise.all([listPartners(), listVendors()]).then(([p, v]) => {
      setPartners(p)
      setVendors(v)
    })
    if (id) {
      listTransactions().then((txns) => {
        const txn = txns.find((t) => t.id === id)
        if (txn) {
          setExisting(txn)
          setType(txn.type)
          setCategory(txn.category)
          setDescription(txn.description ?? "")
          setAmount(String(txn.amount))
          setDate(txn.date)
          setIsRecurring(txn.is_recurring)
          setRecurrencePeriod(txn.recurrence_period ?? "monthly")
          setPartnerId(txn.partner_id ?? "")
          setVendorId(txn.vendor_id ?? "")
          setReference(txn.reference ?? "")
        }
      })
    }
  }, [id])

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  // Reset category when type changes
  useEffect(() => {
    if (!isEdit) setCategory("")
  }, [type, isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) { toast.error("Please select a category"); return }
    const amtNum = parseFloat(amount)
    if (!amount || isNaN(amtNum) || amtNum <= 0) { toast.error("Enter a valid amount"); return }
    setSaving(true)
    try {
      const input = {
        type,
        category,
        description: description.trim() || null,
        amount: amtNum,
        date,
        is_recurring: isRecurring,
        recurrence_period: isRecurring ? (recurrencePeriod as CashflowTransaction["recurrence_period"]) : null,
        partner_id: partnerId || null,
        vendor_id: vendorId || null,
        reference: reference.trim() || null,
      }
      if (isEdit && id) {
        await updateTransaction(id, input)
        toast.success("Transaction updated")
      } else {
        await createTransaction(input)
        toast.success("Transaction created")
      }
      navigate("/cashflow/transactions")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    try {
      await deleteTransaction(id)
      toast.success("Transaction deleted")
      navigate("/cashflow/transactions")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Transaction" : "New Transaction"}
        description={isEdit ? existing ? `${existing.type === "income" ? "Income" : "Expense"} · ${existing.category}` : "" : "Record an income or expense transaction."}
      />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-6 space-y-5">
            {/* Type toggle */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex rounded-md border overflow-hidden w-fit">
                {(["income", "expense"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-5 py-2 text-sm font-medium capitalize transition-colors ${type === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                  >
                    {t === "income" ? "Income" : "Expense"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (USD) *</Label>
                <Input id="amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" placeholder="Brief description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference">Reference / Invoice #</Label>
                <Input id="reference" placeholder="INV-001" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>

            {/* Recurring */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="recurring"
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border accent-primary"
                />
                <Label htmlFor="recurring" className="cursor-pointer">Recurring transaction</Label>
              </div>
              {isRecurring && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="recurrence">Recurrence Period</Label>
                  <Select value={recurrencePeriod} onValueChange={setRecurrencePeriod}>
                    <SelectTrigger id="recurrence" className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_PERIODS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Linked partner */}
            {partners.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="partner">Linked Partner (optional)</Label>
                <Select value={partnerId || "none"} onValueChange={(v) => setPartnerId(v === "none" ? "" : v)}>
                  <SelectTrigger id="partner">
                    <SelectValue placeholder="No partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No partner</SelectItem>
                    {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Linked vendor (expense only) */}
            {type === "expense" && vendors.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="vendor">Linked Vendor (optional)</Label>
                <Select value={vendorId || "none"} onValueChange={(v) => setVendorId(v === "none" ? "" : v)}>
                  <SelectTrigger id="vendor">
                    <SelectValue placeholder="No vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No vendor</SelectItem>
                    {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create transaction"}</Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
