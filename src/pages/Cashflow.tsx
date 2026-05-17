import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Receipt,
  Plus,
  Landmark,
} from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/PageHeader"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listTransactions, listBankTransactions, listBankAccounts } from "@/lib/data"
import type { BankAccount, CashflowTransaction, BankTransaction } from "@/types/db"
import { cn } from "@/lib/utils"

type Period = "mtd" | "qtd" | "ytd" | "custom"

interface UnifiedTx {
  id: string
  date: string
  type: "income" | "expense"
  amount: number
  category: string
  description: string
  source: "manual" | "bank"
  provider?: string
  pending?: boolean
  is_recurring?: boolean
}

const PIE_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "#6366f1", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6",
]

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function periodBounds(period: Period, customFrom?: string, customTo?: string) {
  if (period === "custom") return { start: customFrom ?? "", end: customTo ?? "" }
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const today = now.toISOString().slice(0, 10)
  if (period === "mtd") return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: today }
  if (period === "qtd") {
    const qs = new Date(y, Math.floor(m / 3) * 3, 1)
    return { start: qs.toISOString().slice(0, 10), end: today }
  }
  return { start: `${y}-01-01`, end: today }
}

function prevPeriodBounds(period: Period): { start: string; end: string } | null {
  if (period === "custom") return null  // no comparison period for custom ranges
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  if (period === "mtd") {
    const prev = new Date(y, m - 1, 1), prevEnd = new Date(y, m, 0)
    return { start: prev.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) }
  }
  if (period === "qtd") {
    const cqs = Math.floor(m / 3) * 3
    const pqs = new Date(y, cqs - 3, 1), pqe = new Date(y, cqs, 0)
    return { start: pqs.toISOString().slice(0, 10), end: pqe.toISOString().slice(0, 10) }
  }
  return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
}

function inPeriod(t: { date: string }, b: { start: string; end: string }) {
  return t.date >= b.start && t.date <= b.end
}

function pctChange(cur: number, prev: number) {
  if (prev === 0) return null
  return ((cur - prev) / prev) * 100
}

function bankTxToUnified(t: BankTransaction): UnifiedTx | null {
  if (t.is_excluded || t.amount === 0) return null
  return {
    id: t.id,
    date: t.date,
    type: t.amount > 0 ? "income" : "expense",
    amount: Math.abs(t.amount),
    category: t.override_category ?? t.category,
    description: t.description ?? "",
    source: "bank",
    provider: t.provider,
    pending: t.pending,
  }
}

function TrendBadge({ pct, inv = false }: { pct: number | null; inv?: boolean }) {
  if (pct === null) return null
  const good = inv ? pct < 0 : pct > 0
  if (Math.abs(pct) < 2) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />{Math.abs(pct).toFixed(1)}%</span>
  return (
    <span className={cn("text-xs flex items-center gap-0.5", good ? "text-green-600 dark:text-green-400" : "text-destructive")}>
      {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function KPICard({ label, value, sub, trend, inv = false }: { label: string; value: string; sub?: string; trend?: number | null; inv?: boolean }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className="text-xl font-semibold mt-1 leading-tight truncate">{value}</p>
      <div className="flex items-center gap-1.5 mt-0.5 min-h-[16px]">
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        {trend != null && <TrendBadge pct={trend} inv={inv} />}
      </div>
    </Card>
  )
}

const CHART_H = 200

const PROVIDER_LABELS: Record<string, string> = {
  mercury: "Mercury",
  plaid: "Plaid",
  finicity: "Finicity",
  manual: "Manual",
}

export function Cashflow() {
  const navigate = useNavigate()
  const [manualTxns, setManualTxns] = useState<CashflowTransaction[]>([])
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [accountId, setAccountId] = useState("all")
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("mtd")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  async function loadData(acctId: string) {
    setLoading(true)
    try {
      const [manual, bank, accts] = await Promise.all([
        listTransactions(),
        listBankTransactions({ accountId: acctId !== "all" ? acctId : undefined }),
        listBankAccounts(),
      ])
      setManualTxns(manual)
      setBankTxns(bank)
      setAccounts(accts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData("all") }, [])

  async function handleAccountChange(value: string) {
    setAccountId(value)
    const bank = await listBankTransactions({ accountId: value !== "all" ? value : undefined })
    setBankTxns(bank)
  }

  const unified = useMemo<UnifiedTx[]>(() => {
    const fromManual: UnifiedTx[] = manualTxns.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description ?? "",
      source: "manual" as const,
      is_recurring: t.is_recurring,
    }))
    const fromBank: UnifiedTx[] = bankTxns.flatMap((t) => {
      const u = bankTxToUnified(t)
      return u ? [u] : []
    })
    return [...fromManual, ...fromBank].sort((a, b) => b.date.localeCompare(a.date))
  }, [manualTxns, bankTxns])

  const bounds = useMemo(() => periodBounds(period, customFrom, customTo), [period, customFrom, customTo])
  const prevBounds = useMemo(() => prevPeriodBounds(period), [period])

  const { revenue, expenses, netFlow, prevRevenue, prevExpenses } = useMemo(() => {
    const cur = unified.filter((t) => inPeriod(t, bounds))
    const prev = prevBounds ? unified.filter((t) => inPeriod(t, prevBounds)) : []
    const sum = (arr: UnifiedTx[], type: "income" | "expense") =>
      arr.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
    return {
      revenue: sum(cur, "income"),
      expenses: sum(cur, "expense"),
      netFlow: sum(cur, "income") - sum(cur, "expense"),
      prevRevenue: sum(prev, "income"),
      prevExpenses: sum(prev, "expense"),
    }
  }, [unified, bounds, prevBounds])

  // Real bank balance: sum of balance_current from Mercury API (authoritative, set on each sync).
  // Filtered to the selected account when one is chosen; otherwise all active non-credit accounts.
  const bankBalance = useMemo(() => {
    const relevant = accountId !== "all"
      ? accounts.filter((a) => a.id === accountId)
      : accounts.filter((a) => a.type !== "credit")
    // balance_available = settled funds (excludes holds/pending); preferred over balance_current
    return relevant.reduce((s, a) => s + (a.balance_available ?? a.balance_current ?? 0), 0)
  }, [accounts, accountId])

  const balanceLastUpdated = useMemo(() => {
    const relevant = accountId !== "all"
      ? accounts.filter((a) => a.id === accountId)
      : accounts.filter((a) => a.type !== "credit")
    return relevant.reduce((latest, a) => {
      if (!a.last_updated) return latest
      return !latest || a.last_updated > latest ? a.last_updated : latest
    }, null as string | null)
  }, [accounts, accountId])

  function fmtBalanceAge(iso: string | null) {
    if (!iso) return "as of last sync"
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return "just synced"
    if (min < 60) return `synced ${min}m ago`
    const h = Math.floor(min / 60)
    if (h < 24) return `synced ${h}h ago`
    return `synced ${Math.floor(h / 24)}d ago`
  }

  const burnRate = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 3 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
    return unified.filter((t) => t.type === "expense" && months.some((m) => t.date.startsWith(m))).reduce((s, t) => s + t.amount, 0) / 3
  }, [unified])

  const runway = burnRate > 0 ? bankBalance / burnRate : null

  const monthlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const mk = monthKey(d)
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
      const income = unified.filter((t) => t.type === "income" && t.date.startsWith(mk)).reduce((s, t) => s + t.amount, 0)
      const exp = unified.filter((t) => t.type === "expense" && t.date.startsWith(mk)).reduce((s, t) => s + t.amount, 0)
      return { label, income, expenses: exp, net: income - exp }
    })
  }, [unified])

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    unified.filter((t) => t.type === "expense" && inPeriod(t, bounds))
      .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount))
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [unified, bounds])

  const insights = useMemo(() => {
    if (loading || unified.length === 0) return []
    const periodWord = period === "mtd" ? "month" : period === "qtd" ? "quarter" : "year"
    const msgs: { text: string; type: "positive" | "negative" | "neutral" }[] = []

    if (netFlow > 0) msgs.push({ text: `Your business is cash-flow positive this ${periodWord} with a net gain of ${fmtCurrency(netFlow)}.`, type: "positive" })
    else if (netFlow < 0) msgs.push({ text: `Your business had a net outflow of ${fmtCurrency(Math.abs(netFlow))} this ${periodWord}.`, type: "negative" })

    const ep = pctChange(expenses, prevExpenses)
    if (ep !== null && Math.abs(ep) >= 5) msgs.push({ text: `Expenses ${ep > 0 ? "increased" : "decreased"} ${Math.abs(ep).toFixed(0)}% compared to last ${periodWord}.`, type: ep > 0 ? "negative" : "positive" })

    if (runway != null && runway > 0) msgs.push({ text: `At the current burn rate of ${fmtCurrency(burnRate)}/mo, you have ${runway.toFixed(1)} months of runway remaining.`, type: runway < 3 ? "negative" : runway < 6 ? "neutral" : "positive" })

    // Top expense category by dollar amount
    if (expenseByCategory.length > 0 && expenses > 0) {
      const top = expenseByCategory[0]
      const pct = (top.value / expenses) * 100
      msgs.push({
        text: `Your largest expense category this ${periodWord} is ${top.name} at ${fmtCurrency(top.value)} — ${pct.toFixed(0)}% of total outflows.`,
        type: "neutral",
      })
    }

    // Operating expense ratio (how many cents of every dollar earned is spent)
    if (revenue > 0 && expenses > 0) {
      const ratio = (expenses / revenue) * 100
      const margin = 100 - ratio
      if (margin >= 0) {
        msgs.push({
          text: `Your operating expense ratio is ${ratio.toFixed(0)}% this ${periodWord} — you keep ${margin.toFixed(0)} cents of every dollar earned.`,
          type: margin >= 30 ? "positive" : margin >= 10 ? "neutral" : "negative",
        })
      } else {
        msgs.push({
          text: `You're spending ${fmtCurrency(expenses - revenue)} more than you earn this ${periodWord} (expense ratio: ${ratio.toFixed(0)}%).`,
          type: "negative",
        })
      }
    }

    return msgs
  }, [loading, unified, netFlow, expenses, prevExpenses, period, customFrom, customTo, runway, burnRate, expenseByCategory, revenue])

  const recentTxns = useMemo(() => unified.slice(0, 8), [unified])

  const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }
  const periodLabels: Record<Period, string> = { mtd: "Month to Date", qtd: "Quarter to Date", ytd: "Year to Date", custom: "Custom Range" }
  const periodShort: Record<Period, string> = { mtd: "vs last month", qtd: "vs last quarter", ytd: "vs last year", custom: "" }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cashflow"
        description={
          accounts.length > 0 && accountId !== "all"
            ? `Showing ${accounts.find((a) => a.id === accountId)?.name ?? "selected account"}`
            : "Real-time financial overview — owner restricted."
        }
        actions={
          <div className="flex items-center gap-2">
            {accounts.length > 0 && (
              <Select value={accountId} onValueChange={handleAccountChange}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/cashflow/bank-connections")}>
              <Landmark className="h-4 w-4" />
              <span className="hidden sm:inline">Bank Connections</span>
            </Button>
            <Button size="sm" onClick={() => navigate("/cashflow/transactions/new")}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Transaction</span>
            </Button>
          </div>
        }
      />

      {!loading && insights.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium">Insights · {periodLabels[period]}</span>
          </div>
          {insights.map((ins, i) => (
            <p key={i} className={cn("text-sm pl-6", ins.type === "positive" && "text-green-700 dark:text-green-400", ins.type === "negative" && "text-destructive", ins.type === "neutral" && "text-muted-foreground")}>
              {ins.text}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="mtd">MTD</TabsTrigger>
            <TabsTrigger value="qtd">QTD</TabsTrigger>
            <TabsTrigger value="ytd">YTD</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
        {period !== "custom" && <span className="text-xs text-muted-foreground">{periodShort[period]}</span>}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Revenue" value={loading ? "…" : fmtCurrency(revenue)} trend={pctChange(revenue, prevRevenue)} />
        <KPICard label="Expenses" value={loading ? "…" : fmtCurrency(expenses)} trend={pctChange(expenses, prevExpenses)} inv />
        <KPICard label="Net Cash Flow" value={loading ? "…" : fmtCurrency(netFlow)} sub={netFlow >= 0 ? "Positive" : "Negative"} trend={pctChange(netFlow, prevRevenue - prevExpenses)} />
        <KPICard label="Available Balance" value={loading ? "…" : fmtCurrency(bankBalance)} sub={fmtBalanceAge(balanceLastUpdated)} />
        <KPICard label="Burn Rate" value={loading ? "…" : fmtCurrency(burnRate)} sub="per month" />
        <KPICard label="Runway" value={loading ? "…" : runway != null ? `${runway.toFixed(1)} mo` : "—"} sub={runway != null ? (runway < 3 ? "⚠ Critical" : runway < 6 ? "Low" : "Healthy") : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Inflow vs Outflow (12 months)</CardTitle></CardHeader>
          <CardContent style={{ height: CHART_H }}>
            {loading ? <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? fmtCurrency(v) : String(v)} />
                  <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expense Breakdown · {periodLabels[period]}</CardTitle></CardHeader>
          <CardContent style={{ height: CHART_H }}>
            {loading ? <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div>
              : expenseByCategory.length === 0 ? <div className="h-full grid place-items-center text-sm text-muted-foreground">No expenses in period.</div>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? fmtCurrency(v) : String(v)} />
                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} label={({ name, percent }) => (percent as number) > 0.08 ? `${name} ${((percent as number) * 100).toFixed(0)}%` : ""} labelLine={false}>
                      {expenseByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Trend (12 months)</CardTitle></CardHeader>
          <CardContent style={{ height: CHART_H }}>
            {loading ? <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? fmtCurrency(v) : String(v)} />
                  <Line type="monotone" dataKey="income" name="Revenue" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Net Cash Flow Trend (12 months)</CardTitle></CardHeader>
          <CardContent style={{ height: CHART_H }}>
            {loading ? <div className="h-full grid place-items-center text-sm text-muted-foreground">Loading…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => typeof v === "number" ? fmtCurrency(v) : String(v)} />
                  <Bar dataKey="net" name="Net Flow" radius={[3, 3, 0, 0]}>
                    {monthlyData.map((e, i) => <Cell key={i} fill={e.net >= 0 ? "var(--chart-1)" : "var(--chart-5)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Recent Transactions</CardTitle>
          <Link to="/cashflow/transactions" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Receipt className="h-3.5 w-3.5" />
            View all →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Loading…</p>
          ) : recentTxns.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No transactions yet. <Link to="/cashflow/transactions/new" className="text-primary underline">Add one</Link>.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTxns.map((t) => (
                  <TableRow
                    key={t.id}
                    className={cn("cursor-pointer", t.pending && "opacity-60")}
                    onClick={() => t.source === "manual" ? navigate(`/cashflow/transactions/${t.id}/edit`) : navigate("/cashflow/bank-connections")}
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap py-2">
                      {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(t.date + "T00:00:00"))}
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      <span className="truncate block max-w-[180px]">{t.description || t.category}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {t.is_recurring && <Badge variant="secondary" className="text-[10px] px-1 py-0">Recurring</Badge>}
                        {t.pending && <Badge variant="outline" className="text-[10px] px-1 py-0">Pending</Badge>}
                        {t.source === "bank" && t.provider && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 capitalize">{PROVIDER_LABELS[t.provider] ?? t.provider}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell py-2 text-xs text-muted-foreground">{t.category}</TableCell>
                    <TableCell className={cn("py-2 text-sm font-medium text-right whitespace-nowrap", t.type === "income" ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                      {t.type === "income" ? "+" : "−"}{fmtCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
