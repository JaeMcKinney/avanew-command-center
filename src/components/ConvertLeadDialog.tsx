import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRightLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { convertLead, listStages } from "@/lib/data"
import type { Lead, PipelineStage } from "@/types/db"

type Props = {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConverted?: () => void
}

export function ConvertLeadDialog({ lead, open, onOpenChange, onConverted }: Props) {
  const navigate = useNavigate()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [accountName, setAccountName] = useState("")
  const [createDeal, setCreateDeal] = useState(true)
  const [dealTitle, setDealTitle] = useState("")
  const [dealAmount, setDealAmount] = useState("")
  const [dealStageId, setDealStageId] = useState("")
  const [dealCloseDate, setDealCloseDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const s = await listStages()
        const openStages = s.filter((x) => !x.is_won && !x.is_lost)
        setStages(s)
        setDealStageId((prev) => prev || openStages[0]?.id || s[0]?.id || "")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load stages")
      }
    })()
  }, [open])

  useEffect(() => {
    if (!lead) return
    setAccountName(lead.company ?? "")
    const fullName = `${lead.first_name} ${lead.last_name ?? ""}`.trim()
    setDealTitle(`${lead.company ?? fullName} — new opportunity`)
    setDealAmount("")
    setDealCloseDate("")
    setCreateDeal(true)
  }, [lead])

  async function handleConvert() {
    if (!lead) return
    if (!accountName.trim()) {
      toast.error("Account name is required")
      return
    }
    if (createDeal) {
      if (!dealTitle.trim()) {
        toast.error("Deal name is required")
        return
      }
      if (!dealStageId) {
        toast.error("Please pick a stage")
        return
      }
    }
    setSubmitting(true)
    try {
      const parsedAmount = dealAmount.trim() ? Number(dealAmount) : null
      const result = await convertLead(lead, {
        account_name: accountName,
        create_deal: createDeal,
        deal_title: dealTitle,
        deal_amount:
          parsedAmount !== null && !Number.isNaN(parsedAmount) ? parsedAmount : null,
        deal_stage_id: dealStageId,
        deal_close_date: dealCloseDate || null,
      })
      toast.success("Lead converted")
      onOpenChange(false)
      onConverted?.()
      if (result.deal) {
        navigate(`/deals/${result.deal.id}/edit`)
      } else {
        navigate(`/accounts/${result.company.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to convert")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Convert Lead
          </DialogTitle>
          <DialogDescription>
            Creates an Account and a Contact from this lead. Optionally
            kicks off a Deal at the same time. The lead is marked as converted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Company name"
            />
            <p className="text-xs text-muted-foreground">
              Industry, address, revenue, and description are copied from the lead.
              You can edit them on the Account afterward.
            </p>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium text-foreground">Contact created</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lead && (
                <>
                  {lead.first_name} {lead.last_name ?? ""}
                  {lead.email ? ` · ${lead.email}` : ""}
                </>
              )}
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={createDeal}
              onChange={(e) => setCreateDeal(e.target.checked)}
              className="h-4 w-4 mt-0.5 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Also create a Deal</p>
              <p className="text-xs text-muted-foreground">
                Open an opportunity for this account right away.
              </p>
            </div>
          </label>

          {createDeal && (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-title">Deal name</Label>
                <Input
                  id="deal-title"
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="deal-amount">Amount</Label>
                  <Input
                    id="deal-amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="$"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deal-close">Close date</Label>
                  <Input
                    id="deal-close"
                    type="date"
                    value={dealCloseDate}
                    onChange={(e) => setDealCloseDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deal-stage">Stage</Label>
                <Select value={dealStageId} onValueChange={setDealStageId}>
                  <SelectTrigger id="deal-stage" className="w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConvert} disabled={submitting}>
            {submitting ? "Converting..." : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
