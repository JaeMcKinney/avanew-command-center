import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Plus,
  Link,
  Landmark,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/PageHeader"
import {
  PREVIEW_DATA_MODE,
  listBankConnections,
  listBankAccounts,
  listSyncLogs,
  createBankConnection,
  deleteBankConnection,
  triggerMercurySync,
  triggerPlaidSync,
  getPlaidLinkToken,
} from "@/lib/data"
import type { BankConnection, BankAccount, CashflowSyncLog } from "@/types/db"

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_ICON = {
  active: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  disconnected: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-500/15 text-green-700 border-green-200",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  disconnected: "bg-amber-500/15 text-amber-700 border-amber-200",
  pending: "bg-muted text-muted-foreground",
}

export function BankConnections() {
  const navigate = useNavigate()
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [logs, setLogs] = useState<CashflowSyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BankConnection | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showLogsFor, setShowLogsFor] = useState<string | null>(null)

  // Mercury connect dialog
  const [mercuryOpen, setMercuryOpen] = useState(false)
  const [mercuryKey, setMercuryKey] = useState("")
  const [connecting, setConnecting] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [c, a, l] = await Promise.all([listBankConnections(), listBankAccounts(), listSyncLogs()])
      setConnections(c)
      setAccounts(a)
      setLogs(l)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function handleSync(conn: BankConnection) {
    setSyncing(conn.id)
    try {
      const result = conn.provider === "mercury"
        ? await triggerMercurySync(conn.id)
        : await triggerPlaidSync(conn.id)
      toast.success(
        result.imported > 0
          ? `Synced ${result.imported} new transactions`
          : "Already up to date — no new transactions"
      )
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(null)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteBankConnection(confirmDelete.id)
      toast.success("Bank connection removed")
      setConfirmDelete(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove")
    }
  }

  async function handleConnectMercury() {
    if (!mercuryKey.trim()) return
    setConnecting(true)
    try {
      if (!PREVIEW_DATA_MODE) {
        // In production: pass key to Edge Function to verify & store securely
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercury-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${mercuryKey}` },
          body: JSON.stringify({ action: "verify" }),
        })
        if (!res.ok) throw new Error("Invalid API key or Mercury is unreachable")
      }
      await createBankConnection({
        provider: "mercury",
        institution_name: "Mercury",
        institution_id: "mercury",
        status: "pending",
        last_sync_at: null,
        error_message: null,
      })
      toast.success("Mercury connected — running initial sync…")
      setMercuryOpen(false)
      setMercuryKey("")
      await refresh()
      // Trigger first sync
      const conn = (await listBankConnections()).find((c) => c.provider === "mercury")
      if (conn) await handleSync(conn)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setConnecting(false)
    }
  }

  async function handleConnectPlaid() {
    try {
      if (PREVIEW_DATA_MODE) {
        toast.info("Plaid Link would open here in production. Add PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV to your Supabase Edge Function secrets.")
        return
      }
      const linkToken = await getPlaidLinkToken()
      // In production: open Plaid Link with link_token
      // import { PlaidLink } from 'react-plaid-link' or use window.Plaid.create
      // After user authenticates: exchange public_token via plaid-sync Edge Function
      toast.info(`Plaid link token received (${linkToken.slice(0, 20)}…). Integrate react-plaid-link to open the widget.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Plaid flow")
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const accountsForConn = (id: string) => accounts.filter((a) => a.bank_connection_id === id)
  const logsForConn = (id: string) => logs.filter((l) => l.bank_connection_id === id).slice(0, 5)
  const totalBalance = accounts.filter((a) => a.is_active && a.type !== "credit").reduce((s, a) => s + (a.balance_current ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bank Connections"
        description="Read-only bank data sync — balances and transactions import automatically."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMercuryOpen(true)}>
              <Landmark className="h-4 w-4" />
              Connect Mercury
            </Button>
            <Button onClick={handleConnectPlaid}>
              <Link className="h-4 w-4" />
              Connect via Plaid
            </Button>
          </div>
        }
      />

      {PREVIEW_DATA_MODE && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-primary">Preview mode:</strong> showing seeded Mercury connection. Real syncs require{" "}
          <code className="text-[11px]">MERCURY_API_KEY</code> (Mercury) or{" "}
          <code className="text-[11px]">PLAID_CLIENT_ID / PLAID_SECRET</code> (Plaid) in Supabase Edge Function secrets.
        </div>
      )}

      {/* Cash position summary */}
      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Total Cash Position</p>
            <p className="text-xl font-semibold mt-0.5">{fmtCurrency(totalBalance)}</p>
          </Card>
          {accounts.slice(0, 3).map((a) => (
            <Card key={a.id} className="px-4 py-3">
              <p className="text-xs text-muted-foreground truncate">{a.name}</p>
              <p className="text-lg font-semibold mt-0.5">{fmtCurrency(a.balance_current ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{a.type}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Connections list */}
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : connections.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No bank connections yet</p>
          <p className="text-xs text-muted-foreground mt-1">Connect Mercury directly or use Plaid for Bank of America and 12,000+ other institutions.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" size="sm" onClick={() => setMercuryOpen(true)}>Connect Mercury</Button>
            <Button size="sm" onClick={handleConnectPlaid}>Connect via Plaid</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => {
            const connAccounts = accountsForConn(conn.id)
            const connLogs = logsForConn(conn.id)
            const isExpanded = expanded.has(conn.id)
            const isSyncing = syncing === conn.id

            return (
              <Card key={conn.id} className="overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{conn.institution_name}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[conn.status] ?? ""}`}>
                        <span className="flex items-center gap-1">
                          {STATUS_ICON[conn.status]}
                          {conn.status.charAt(0).toUpperCase() + conn.status.slice(1)}
                        </span>
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground capitalize">
                        {conn.provider}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {conn.last_sync_at ? `Last synced ${fmtRelative(conn.last_sync_at)}` : "Never synced"}
                      {conn.error_message && <span className="ml-2 text-destructive">· {conn.error_message}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(conn)}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Syncing…" : "Sync now"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleExpand(conn.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(conn)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded: accounts + sync logs */}
                {isExpanded && (
                  <div className="border-t bg-muted/30 px-4 py-3 space-y-4">
                    {connAccounts.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Accounts</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {connAccounts.map((a) => (
                            <div key={a.id} className="rounded-md border bg-card px-3 py-2 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{a.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{a.type}{a.subtype && a.subtype !== a.type ? ` · ${a.subtype}` : ""}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{fmtCurrency(a.balance_current ?? 0)}</p>
                                {a.balance_available != null && a.balance_available !== a.balance_current && (
                                  <p className="text-[10px] text-muted-foreground">{fmtCurrency(a.balance_available)} available</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {connLogs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Recent sync history</p>
                        <div className="space-y-1">
                          {connLogs.map((log) => (
                            <div key={log.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                              {log.status === "success" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              ) : log.status === "partial" ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              <span>{fmtRelative(log.started_at)}</span>
                              <span>·</span>
                              <span className={log.status === "success" ? "text-green-600 dark:text-green-400" : log.status === "error" ? "text-destructive" : "text-amber-600"}>
                                {log.status === "success" ? `${log.transactions_imported} imported` : log.status === "partial" ? `${log.transactions_imported} imported, partial` : "Failed"}
                              </span>
                              {log.error_message && <span className="text-destructive truncate max-w-[200px]">· {log.error_message}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Mercury connect dialog */}
      <Dialog open={mercuryOpen} onOpenChange={setMercuryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Connect Mercury
            </DialogTitle>
            <DialogDescription>
              Enter your Mercury read-only API key. Keys are stored securely in Supabase Edge Function secrets — never exposed to the browser after setup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mercury-key">Mercury API Key</Label>
              <Input
                id="mercury-key"
                type="password"
                placeholder="mercury_api_…"
                value={mercuryKey}
                onChange={(e) => setMercuryKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Find this in Mercury → Settings → API → Create read-only token. This token is write-protected and cannot move funds.
              </p>
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Security notes</p>
              <p>· Read-only access only — no payments or transfers</p>
              <p>· Key stored server-side in Supabase secrets, not in the database</p>
              <p>· Only Owner-role users can access synced data</p>
              <p>· All sync events are logged for audit</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMercuryOpen(false)}>Cancel</Button>
            <Button onClick={handleConnectMercury} disabled={!mercuryKey.trim() || connecting}>
              {connecting ? "Connecting…" : "Connect Mercury"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this bank connection?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing <strong>{confirmDelete?.institution_name}</strong> will delete all synced accounts and transactions from this connection. Manual cashflow transactions are not affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove connection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
