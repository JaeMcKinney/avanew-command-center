import { useEffect, useMemo, useState } from "react"
import { Loader2, Search, ArrowRight, Send, User, Building2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { listRaAssociates, transferArchivedLeads } from "@/lib/data"
import type { RaAssociate } from "@/types/db"

type Props = {
  open: boolean
  onClose: () => void
  archive: {
    id: string
    display_name: string
    leads_count: number
    deals_count: number
  }
  onTransferred: (result: {
    leads_transferred: number
    deals_transferred: number
    target_display_name: string
  }) => void
}

/**
 * Lets a Program Admin pick an active RA to receive every live lead/deal
 * that was originally attributed to an archived (deleted) RA. The picker is
 * a typeahead over listRaAssociates, scoped to active/in-flight RAs only —
 * declined and terminated RAs are filtered out as transfer targets.
 */
export function TransferRaLeadsModal({ open, onClose, archive, onTransferred }: Props) {
  const [list, setList] = useState<RaAssociate[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<RaAssociate | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listRaAssociates()
      .then((rows) => {
        setList(rows.filter((r) => r.status !== "terminated" && r.status !== "declined"))
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load RAs"))
      .finally(() => setLoading(false))
  }, [open])

  function reset() {
    setQuery(""); setSelected(null); setSubmitting(false)
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) =>
      r.display_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q)
    )
  }, [list, query])

  async function handleTransfer() {
    if (!selected) return
    setSubmitting(true)
    try {
      const result = await transferArchivedLeads(archive.id, selected.user_id)
      toast.success(
        `Transferred ${result.leads_transferred} lead${result.leads_transferred === 1 ? "" : "s"}` +
        (result.deals_transferred > 0 ? ` and ${result.deals_transferred} deal${result.deals_transferred === 1 ? "" : "s"}` : "") +
        ` to ${result.target_display_name}`
      )
      onTransferred(result)
      reset()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transfer {archive.display_name}'s leads</DialogTitle>
          <DialogDescription>
            Pick an active RA to take over every live lead and deal that originated from{" "}
            <strong className="text-foreground">{archive.display_name}</strong>. The archive snapshot stays in place — only the live records move.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-xs flex items-center gap-3 flex-wrap">
          <span className="font-medium text-foreground">{archive.display_name}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={cn("font-medium", selected ? "text-primary" : "text-muted-foreground italic")}>
            {selected ? selected.display_name : "Pick an RA below…"}
          </span>
          <span className="ml-auto text-muted-foreground">
            {archive.leads_count} lead{archive.leads_count === 1 ? "" : "s"} · {archive.deals_count} deal{archive.deals_count === 1 ? "" : "s"}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search active RAs by name, email, or slug…"
            className="pl-8"
            disabled={loading || submitting}
          />
        </div>

        <div className="flex-1 overflow-y-auto rounded-md border divide-y -mx-1 px-1">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground text-center inline-flex items-center gap-2 justify-center w-full">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading RAs…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              {query ? "No active RAs match your search." : "No other active RAs found."}
            </div>
          ) : (
            filtered.map((ra) => {
              const isPicked = selected?.id === ra.id
              return (
                <button
                  key={ra.id}
                  type="button"
                  onClick={() => setSelected(ra)}
                  disabled={submitting}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isPicked ? "bg-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    {ra.photo_url ? (
                      <img src={ra.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {ra.display_name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ra.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ra.email} · <span className="font-mono">/demo/{ra.slug}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    {ra.ra_type === "company"
                      ? <><Building2 className="h-2.5 w-2.5" /> Company</>
                      : <><User className="h-2.5 w-2.5" /> Individual</>}
                  </Badge>
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleTransfer} disabled={!selected || submitting}>
            {submitting
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transferring…</>
              : <><Send className="h-3.5 w-3.5" /> Transfer leads</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
