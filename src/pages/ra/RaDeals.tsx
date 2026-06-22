import { useEffect, useMemo, useState } from "react"
import { List, LayoutGrid, Search, Inbox } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PipelineBoard } from "@/components/PipelineBoard"
import { usePipelineView } from "@/lib/usePipelineView"
import { getRaAssociate, listLeadsForRaSlug } from "@/lib/data"
import type { RaLead } from "@/lib/data"

const STAGE_LABEL: Record<RaLead["stage"], string> = {
  new: "New", qualified: "Qualified", proposal_sent: "Proposal Sent",
  call_booked: "Call Booked", closed_won: "Closed Won", closed_lost: "Closed Lost",
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

export function RaDeals() {
  const [leads, setLeads] = useState<RaLead[]>([])
  const [view, setView] = usePipelineView("ra-deals")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await getRaAssociate()
        if (r?.slug) setLeads(await listLeadsForRaSlug(r.slug))
      } finally { setLoading(false) }
    })()
  }, [])

  const boardLeads = leads.filter((l) => l.stage !== "closed_lost")
  const lostLeads = leads.filter((l) => l.stage === "closed_lost")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return leads
    return leads.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      (l.company ?? "").toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q))
  }, [leads, query])

  const pipelineValue = boardLeads.filter((l) => l.stage !== "closed_won").reduce((s, l) => s + (l.value ?? 0), 0)
  const wonValue = leads.filter((l) => l.stage === "closed_won").reduce((s, l) => s + (l.value ?? 0), 0)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Deals</h1>
          <p className="text-sm text-muted-foreground mt-1">Every prospect you've referred, by stage.</p>
        </div>
        <div className="inline-flex rounded-md border p-0.5">
          <button onClick={() => setView("board")} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${view === "board" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <LayoutGrid className="h-3.5 w-3.5" /> Board
          </button>
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${view === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total deals</p><p className="text-xl font-semibold">{leads.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pipeline value</p><p className="text-xl font-semibold">{fmtCurrency(pipelineValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Won value</p><p className="text-xl font-semibold">{fmtCurrency(wonValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active clients</p><p className="text-xl font-semibold">{leads.filter((l) => l.stage === "closed_won").length}</p></CardContent></Card>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center mb-4"><Inbox className="h-6 w-6 text-primary" /></div>
          <p className="font-medium">No deals yet</p>
          <p className="text-sm text-muted-foreground">Share your demo link to start tracking referrals.</p>
        </CardContent></Card>
      ) : view === "board" ? (
        <Card><CardContent className="p-4">
          <PipelineBoard leads={boardLeads} onLeadsChange={(next) => setLeads([...next, ...lostLeads])} />
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search deals…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>
                        <Badge variant={l.stage === "closed_won" ? "default" : l.stage === "closed_lost" ? "destructive" : "secondary"}>
                          {STAGE_LABEL[l.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.company ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.value ? fmtCurrency(l.value) : "—"}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{new Date(l.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
