import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Receipt, Search, MoreHorizontal, Pencil, Trash2, Landmark, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { Pagination } from "@/components/Pagination"
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  deleteTransaction,
  listBankAccounts,
  listBankTransactions,
  listPartners,
  listTransactions,
  listVendors,
  updateBankTransaction,
} from "@/lib/data"
import { BANK_TRANSACTION_CATEGORIES } from "@/lib/transaction-classifier"
import type { BankAccount, BankTransaction, BankTransactionCategory, CashflowTransaction, Partner, Vendor } from "@/types/db"
import { cn } from "@/lib/utils"

type SourceFilter = "all" | "manual" | "bank"
type TxPeriod = "all" | "mtd" | "qtd" | "ytd" | "custom"

interface UnifiedRow {
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
  partner_id?: string | null
  vendor_id?: string | null
  reference?: string | null
  // bank-specific
  override_category?: BankTransactionCategory | null
  original_category?: string
}

const PROVIDER_LABELS: Record<string, string> = {
  mercury: "Mercury",
  plaid: "Plaid",
  finicity: "Finicity",
  manual: "Manual",
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(s + "T00:00:00"))
}

function sourceBadge(source: "manual" | "bank", provider?: string) {
  if (source === "manual") return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">Manual</Badge>
  )
  const label = provider ? (PROVIDER_LABELS[provider] ?? provider) : "Bank"
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
      <Landmark className="h-2.5 w-2.5" />{label}
    </Badge>
  )
}

export function Transactions() {
  const navigate = useNavigate()
  const [manualTxns, setManualTxns] = useState<CashflowTransaction[]>([])
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [accountFilter, setAccountFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date_desc")
  const [period, setPeriod] = useState<TxPeriod>("all")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [confirmDelete, setConfirmDelete] = useState<CashflowTransaction | null>(null)
  const [savingCategory, setSavingCategory] = useState<string | null>(null)

  async function refresh(acctId?: string) {
    setLoading(true)
    try {
      const activeAcct = acctId ?? (accountFilter !== "all" ? accountFilter : undefined)
      const [manual, bank, accts, p, v] = await Promise.all([
        listTransactions(),
        listBankTransactions({ accountId: activeAcct }),
        listBankAccounts(),
        listPartners(),
        listVendors(),
      ])
      setManualTxns(manual)
      setBankTxns(bank)
      setAccounts(accts)
      setPartners(p)
      setVendors(v)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  async function handleAccountChange(value: string) {
    setAccountFilter(value)
    setPage(1)
    setLoading(true)
    try {
      const bank = await listBankTransactions({ accountId: value !== "all" ? value : undefined })
      setBankTxns(bank)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const partnerById = useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners])
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors])

  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    const today = now.toISOString().slice(0, 10)
    if (period === "mtd") return { periodStart: `${y}-${String(m + 1).padStart(2, "0")}-01`, periodEnd: today }
    if (period === "qtd") return { periodStart: new Date(y, Math.floor(m / 3) * 3, 1).toISOString().slice(0, 10), periodEnd: today }
    if (period === "ytd") return { periodStart: `${y}-01-01`, periodEnd: today }
    if (period === "custom") return { periodStart: customFrom || null, periodEnd: customTo || null }
    return { periodStart: null, periodEnd: null }
  }, [period, customFrom, customTo])

  const unified = useMemo<UnifiedRow[]>(() => {
    const fromManual: UnifiedRow[] = manualTxns.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description ?? "",
      source: "manual",
      is_recurring: t.is_recurring,
      partner_id: t.partner_id,
      vendor_id: t.vendor_id,
      reference: t.reference,
    }))
    const fromBank: UnifiedRow[] = bankTxns
      .filter((t) => !t.is_excluded)
      .map((t) => ({
        id: t.id,
        date: t.date,
        type: t.amount > 0 ? ("income" as const) : ("expense" as const),
        amount: Math.abs(t.amount),
        category: t.override_category ?? t.category,
        description: t.description ?? "",
        source: "bank" as const,
        provider: t.provider,
        pending: t.pending,
        partner_id: t.partner_id,
        vendor_id: t.vendor_id,
        override_category: t.override_category,
        original_category: t.category,
      }))
    return [...fromManual, ...fromBank]
  }, [manualTxns, bankTxns])

  const allCategories = useMemo(() => {
    if (sourceFilter === "bank") return [...BANK_TRANSACTION_CATEGORIES]
    if (typeFilter === "income") return [...INCOME_CATEGORIES]
    if (typeFilter === "expense") return [...EXPENSE_CATEGORIES]
    return [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...BANK_TRANSACTION_CATEGORIES])]
  }, [typeFilter, sourceFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = unified.filter((t) => {
      if (periodStart && t.date < periodStart) return false
      if (periodEnd && t.date > periodEnd) return false
      if (sourceFilter !== "all" && t.source !== sourceFilter) return false
      if (typeFilter !== "all" && t.type !== typeFilter) return false
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false
      if (!q) return true
      return (
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.reference ?? "").toLowerCase().includes(q)
      )
    })
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "date_desc": return b.date.localeCompare(a.date)
        case "date_asc": return a.date.localeCompare(b.date)
        case "amount_desc": return b.amount - a.amount
        case "amount_asc": return a.amount - b.amount
        default: return 0
      }
    })
    return result
  }, [unified, sourceFilter, typeFilter, categoryFilter, search, sortBy])

  // Running balance only meaningful for manual transactions
  const balanceMap = useMemo(() => {
    const sorted = [...manualTxns].sort((a, b) => a.date.localeCompare(b.date))
    const map = new Map<string, number>()
    let running = 0
    for (const t of sorted) {
      running += t.type === "income" ? t.amount : -t.amount
      map.set(t.id, running)
    }
    return map
  }, [manualTxns])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [search, typeFilter, categoryFilter, sourceFilter, accountFilter, sortBy, period, customFrom, customTo])

  const bankAccounts = useMemo(() => accounts.filter((a) => a.type !== "credit"), [accounts])
  const selectedAccount = useMemo(() => accounts.find((a) => a.id === accountFilter) ?? null, [accounts, accountFilter])

  function accountLabel(a: BankAccount) {
    // Extract last 4 if present in name (e.g. "Mercury Checking ••9036")
    return `${a.name}${a.institution_name && !a.name.toLowerCase().includes(a.institution_name.toLowerCase()) ? ` · ${a.institution_name}` : ""}`
  }

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    const expenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    return { income, expenses, net: income - expenses }
  }, [filtered])

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteTransaction(confirmDelete.id)
      toast.success("Transaction deleted")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  async function handleCategoryOverride(bankTxId: string, newCategory: BankTransactionCategory) {
    setSavingCategory(bankTxId)
    try {
      await updateBankTransaction(bankTxId, { override_category: newCategory })
      setBankTxns((prev) => prev.map((t) => t.id === bankTxId ? { ...t, override_category: newCategory } : t))
      toast.success("Category updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setSavingCategory(null)
    }
  }

  const hasBankRows = bankTxns.length > 0

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={
          selectedAccount
            ? `Showing ${selectedAccount.name} · ${selectedAccount.institution_name ?? "Bank"}`
            : "All cashflow transactions — manual and bank-synced."
        }
        actions={
          <div className="flex items-center gap-2">
            {hasBankRows && (
              <Button variant="outline" size="sm" onClick={() => navigate("/cashflow/bank-connections")}>
                <Landmark className="h-4 w-4" />
                Bank Connections
              </Button>
            )}
            <Button onClick={() => navigate("/cashflow/transactions/new")}>
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3 flex-wrap mb-3">
        <Tabs value={period} onValueChange={(v) => { setPeriod(v as TxPeriod); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="all">All time</TabsTrigger>
            <TabsTrigger value="mtd">MTD</TabsTrigger>
            <TabsTrigger value="qtd">QTD</TabsTrigger>
            <TabsTrigger value="ytd">YTD</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(1) }}
              className="h-8 w-[140px] text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(1) }}
              className="h-8 w-[140px] text-xs"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search description, category…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {accounts.length > 0 && (
          <Select value={accountFilter} onValueChange={handleAccountChange}>
            <SelectTrigger className="w-[200px]">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {bankAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="truncate">{accountLabel(a)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v as SourceFilter); setCategoryFilter("all") }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="All sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="bank">Bank synced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCategoryFilter("all") }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Date: Newest</SelectItem>
            <SelectItem value="date_asc">Date: Oldest</SelectItem>
            <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
            <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-3 text-sm">
          <span className="text-green-600 dark:text-green-400 font-medium">Income: {fmtCurrency(totals.income)}</span>
          <span className="text-destructive font-medium">Expenses: {fmtCurrency(totals.expenses)}</span>
          <span className={cn("font-medium", totals.net >= 0 ? "text-primary" : "text-destructive")}>Net: {totals.net >= 0 ? "+" : ""}{fmtCurrency(totals.net)}</span>
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading...</Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={unified.length === 0 ? "No transactions yet" : "No matches"}
          description={unified.length === 0 ? "Record your first income or expense, or connect a bank account." : "Try adjusting your filters."}
          action={unified.length === 0 ? <Button onClick={() => navigate("/cashflow/transactions/new")}><Plus className="h-4 w-4" />New Transaction</Button> : undefined}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Linked</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Balance</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((t) => {
                  const partner = t.partner_id ? partnerById.get(t.partner_id) : null
                  const vendor = t.vendor_id ? vendorById.get(t.vendor_id) : null
                  const balance = t.source === "manual" ? (balanceMap.get(t.id) ?? null) : null
                  const isBank = t.source === "bank"

                  return (
                    <TableRow key={t.id} className={cn(t.pending && "opacity-60")}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {fmtDate(t.date)}
                        {t.pending && <span className="block text-[10px] text-amber-600 dark:text-amber-400">Pending</span>}
                      </TableCell>
                      <TableCell className="font-medium max-w-[140px] sm:max-w-none">
                        {isBank ? (
                          <span className="text-sm truncate block">{t.description || t.category}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/cashflow/transactions/${t.id}/edit`)}
                            className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors text-sm truncate"
                          >
                            {t.description || t.category}
                          </button>
                        )}
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <Badge variant={t.type === "income" ? "default" : "secondary"} className={cn("text-[10px] px-1.5 py-0", t.type === "income" ? "bg-green-500/15 text-green-700 border-green-200" : "bg-red-500/15 text-red-700 border-red-200")}>
                            {t.type}
                          </Badge>
                          {t.is_recurring && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Recurring</Badge>}
                          {sourceBadge(t.source, t.provider)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {isBank ? (
                          <Select
                            value={t.override_category ?? t.original_category ?? t.category}
                            onValueChange={(v) => void handleCategoryOverride(t.id, v as BankTransactionCategory)}
                            disabled={savingCategory === t.id}
                          >
                            <SelectTrigger className="h-7 text-xs w-[150px] border-dashed">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {savingCategory === t.id && <RefreshCw className="h-3 w-3 animate-spin shrink-0" />}
                                {t.override_category && t.override_category !== t.original_category && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" title="Overridden" />
                                )}
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {BANK_TRANSACTION_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground">{t.category}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                        {partner ? partner.name : vendor ? vendor.name : "—"}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium whitespace-nowrap", t.type === "income" ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                        {t.type === "income" ? "+" : "−"}{fmtCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right text-muted-foreground text-sm whitespace-nowrap">
                        {balance !== null ? fmtCurrency(balance) : "—"}
                      </TableCell>
                      <TableCell>
                        {!isBank ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Row actions"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/cashflow/transactions/${t.id}/edit`)}>
                                <Pencil className="h-4 w-4" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => {
                                const manual = manualTxns.find((m) => m.id === t.id)
                                if (manual) setConfirmDelete(manual)
                              }}>
                                <Trash2 className="h-4 w-4" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <div className="w-9" />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="border-t">
              <Pagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          </Card>
        </>
      )}

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.description ?? confirmDelete?.category}" will be removed permanently. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
