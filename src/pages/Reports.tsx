import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { X, MousePointerClick } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/PageHeader"
import { listCompanies, listDeals, listStages } from "@/lib/data"
import type { Company, Deal, PipelineStage } from "@/types/db"

const PIPELINE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(s: string | null) {
  if (!s) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(s + "T00:00:00"))
}

interface Drilldown {
  label: string
  deals: Deal[]
}

const CHART_HEIGHT = 200

export function Reports() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [s, d, co] = await Promise.all([
          listStages(),
          listDeals(),
          listCompanies(),
        ])
        if (!alive) return
        setStages(s)
        setDeals(d)
        setCompanies(co)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages]
  )

  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  )

  const stageData = useMemo(() => {
    return stages.map((s) => {
      const stageDeals = deals.filter((d) => d.stage_id === s.id)
      const value = stageDeals.reduce((sum, d) => sum + (d.amount ?? 0), 0)
      return { name: s.name, count: stageDeals.length, value, stageId: s.id }
    })
  }, [stages, deals])

  const wonLostData = useMemo(() => {
    let won = 0
    let lost = 0
    let open = 0
    for (const d of deals) {
      const s = stageById.get(d.stage_id)
      if (!s) continue
      if (s.is_won) won += 1
      else if (s.is_lost) lost += 1
      else open += 1
    }
    return [
      { name: "Open", value: open },
      { name: "Won", value: won },
      { name: "Lost", value: lost },
    ].filter((x) => x.value > 0)
  }, [deals, stageById])

  const totalValue = useMemo(
    () =>
      stageData
        .filter((s) => {
          const stage = stageById.get(s.stageId)
          return stage && !stage.is_won && !stage.is_lost
        })
        .reduce((sum, s) => sum + s.value, 0),
    [stageData, stageById]
  )

  function drillByStage(data: { name: string; stageId: string }) {
    const stageDeals = deals.filter((d) => d.stage_id === data.stageId)
    setDrilldown({
      label: `${data.name} — ${stageDeals.length} deal${stageDeals.length !== 1 ? "s" : ""}`,
      deals: stageDeals,
    })
  }

  function drillByOutcome(data: { name: string }) {
    const outcome = data.name as "Open" | "Won" | "Lost"
    const filtered = deals.filter((d) => {
      const s = stageById.get(d.stage_id)
      if (!s) return false
      if (outcome === "Won") return s.is_won
      if (outcome === "Lost") return s.is_lost
      return !s.is_won && !s.is_lost
    })
    setDrilldown({ label: `${outcome} deals — ${filtered.length}`, deals: filtered })
  }

  const tooltipStyle = {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Pipeline performance and deal distribution."
      />

      {/* Split layout: charts (left) + drill-down panel (right) */}
      <div className="flex flex-col xl:flex-row gap-4 xl:items-start">

        {/* Charts column */}
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Pipeline value by stage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pipeline value by stage</CardTitle>
              <CardDescription className="text-xs">
                Open: {fmtCurrency(totalValue)} · Click a bar
              </CardDescription>
            </CardHeader>
            <CardContent style={{ height: CHART_HEIGHT }}>
              {loading ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                      tickLine={false} axisLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle}
                      formatter={(v) => typeof v === "number" ? fmtCurrency(v) : String(v)}
                    />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(data) => drillByStage(data as { name: string; stageId: string })}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Deal count by stage */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Deal count by stage</CardTitle>
              <CardDescription className="text-xs">Click a bar to see deals</CardDescription>
            </CardHeader>
            <CardContent style={{ height: CHART_HEIGHT }}>
              {loading ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} cursor="pointer"
                      onClick={(data) => drillByStage(data as { name: string; stageId: string })}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Open vs Won vs Lost — spans full width of charts column */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Open vs Won vs Lost</CardTitle>
              <CardDescription className="text-xs">Click a slice to see those deals</CardDescription>
            </CardHeader>
            <CardContent style={{ height: CHART_HEIGHT }}>
              {loading ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div>
              ) : wonLostData.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">No deals to chart yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Pie
                      data={wonLostData} dataKey="value" nameKey="name"
                      innerRadius={40} outerRadius={75} paddingAngle={2}
                      cursor="pointer"
                      onClick={(data) => drillByOutcome(data as { name: string })}
                      label={(props) => {
                        const { name, value } = props as { name: string; value: number }
                        return `${name}: ${value}`
                      }}
                    >
                      {wonLostData.map((entry, i) => (
                        <Cell key={entry.name} fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Drill-down panel — sticky on xl, full-width below on smaller screens */}
        <div className="w-full xl:w-80 xl:sticky xl:top-6 shrink-0">
          <Card className="min-h-[300px] flex flex-col">
            {drilldown ? (
              <>
                <CardHeader className="flex flex-row items-start justify-between py-3 px-4 border-b">
                  <div>
                    <CardTitle className="text-sm leading-snug">{drilldown.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {drilldown.deals.length === 0 ? "No deals" : `${drilldown.deals.length} deal${drilldown.deals.length !== 1 ? "s" : ""}`}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mr-1 -mt-0.5" onClick={() => setDrilldown(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                  {drilldown.deals.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground text-center">No deals in this category.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Deal</TableHead>
                          <TableHead className="text-xs">Amount</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell xl:hidden 2xl:table-cell">Close</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drilldown.deals.map((d) => {
                          const stage = stageById.get(d.stage_id)
                          const company = d.company_id ? companyById.get(d.company_id) : null
                          return (
                            <TableRow key={d.id}>
                              <TableCell className="py-2">
                                <Link
                                  to={`/deals/${d.id}/edit`}
                                  className="font-medium text-sm hover:text-primary hover:underline underline-offset-2 transition-colors block leading-tight"
                                >
                                  {d.title}
                                </Link>
                                {company && (
                                  <Link
                                    to={`/accounts/${company.id}/edit`}
                                    className="text-xs text-muted-foreground hover:text-primary block mt-0.5"
                                  >
                                    {company.name}
                                  </Link>
                                )}
                                {stage && (
                                  <span className="text-xs text-muted-foreground block mt-0.5">{stage.name}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 text-sm font-medium whitespace-nowrap">
                                {d.amount != null ? fmtCurrency(d.amount) : "—"}
                              </TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground hidden sm:table-cell xl:hidden 2xl:table-cell whitespace-nowrap">
                                {fmtDate(d.expected_close_date)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="h-10 w-10 rounded-full bg-muted grid place-items-center">
                  <MousePointerClick className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Click to explore</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    Click any bar or pie slice to see the deals in that category.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
