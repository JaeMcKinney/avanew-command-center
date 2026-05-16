/**
 * Mercury Sync Edge Function
 *
 * Triggered by the frontend (Owner role only) to pull accounts and transactions
 * from the Mercury API and upsert them into bank_accounts / bank_transactions.
 *
 * Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   MERCURY_API_KEY   — read-only API token from Mercury Settings > API
 *   SUPABASE_URL      — auto-injected by Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
 *
 * Mercury API docs: https://app.mercury.com/api/v1 (OpenAPI spec available in dashboard)
 */

import { requireAuth } from "../_shared/auth.ts"
import { corsHeaders } from "../_shared/cors.ts"

const MERCURY_BASE = "https://backend.mercury.com/api/v1"
const SYNC_DAYS = 90  // how many days back to sync on first run

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const auth = await requireAuth(req, ["owner", "super_user"])
    if (!auth.ok) return auth.response
    const { supabase } = auth

    // ── Parse request body ───────────────────────────────────────────────────
    const { connection_id } = await req.json() as { connection_id: string }
    if (!connection_id) return json({ error: "connection_id required" }, 400)

    // Fetch connection record to validate it's a Mercury connection
    const { data: conn, error: connErr } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("id", connection_id)
      .eq("provider", "mercury")
      .single()
    if (connErr || !conn) return json({ error: "Mercury connection not found" }, 404)

    const apiKey = Deno.env.get("MERCURY_API_KEY")
    if (!apiKey) return json({ error: "MERCURY_API_KEY not configured" }, 500)

    const syncStarted = new Date().toISOString()
    let totalImported = 0
    let totalSkipped = 0
    const errors: string[] = []

    // ── Fetch Mercury accounts ───────────────────────────────────────────────
    const accountsRes = await mercuryGet("/accounts", apiKey)
    if (!accountsRes.ok) {
      const err = `Mercury accounts fetch failed: ${accountsRes.status} ${accountsRes.statusText}`
      await markConnectionError(supabase, connection_id, err)
      return json({ error: err }, 502)
    }
    const accountsText = await accountsRes.text()
    let accountsData: { accounts: MercuryAccount[] }
    try {
      accountsData = JSON.parse(accountsText)
    } catch {
      const preview = accountsText.slice(0, 120).replace(/\s+/g, " ")
      const err = `Mercury returned non-JSON (bad API key?): ${preview}`
      await markConnectionError(supabase, connection_id, err)
      return json({ error: err }, 502)
    }

    for (const account of accountsData.accounts) {
      // Upsert bank_account record
      await supabase.from("bank_accounts").upsert({
        bank_connection_id: connection_id,
        external_account_id: account.id,
        name: account.name,
        type: account.kind === "checking" ? "checking" : account.kind === "savings" ? "savings" : "other",
        subtype: account.kind,
        balance_current: account.currentBalance,
        balance_available: account.availableBalance,
        currency: account.currencyCode ?? "USD",
        institution_name: "Mercury",
        is_active: account.status === "active",
        last_updated: new Date().toISOString(),
      }, { onConflict: "bank_connection_id,external_account_id" })

      // Determine account ID in our DB
      const { data: dbAccount } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("bank_connection_id", connection_id)
        .eq("external_account_id", account.id)
        .single()
      if (!dbAccount) continue

      // ── Fetch transactions for this account ────────────────────────────────
      const since = conn.last_sync_at
        ? new Date(conn.last_sync_at).toISOString().slice(0, 10)
        : new Date(Date.now() - SYNC_DAYS * 864e5).toISOString().slice(0, 10)

      let offset = 0
      const limit = 500

      while (true) {
        const txRes = await mercuryGet(
          `/account/${account.id}/transactions?limit=${limit}&offset=${offset}&start=${since}`,
          apiKey,
        )
        if (!txRes.ok) {
          errors.push(`Transactions fetch failed for account ${account.id}: ${txRes.status}`)
          break
        }

        const txData = await txRes.json() as { transactions: MercuryTransaction[]; total: number }
        if (!txData.transactions?.length) break

        for (const tx of txData.transactions) {
          const amount = tx.kind === "credit" ? Math.abs(tx.amount) : -Math.abs(tx.amount)
          const category = classifyTransaction({
            description: tx.note ?? tx.counterpartyName ?? tx.kind,
            merchant_name: tx.counterpartyName,
            raw_category: tx.externalMemo,
            amount,
          })

          const { error: upsertErr } = await supabase.from("bank_transactions").upsert({
            bank_connection_id: connection_id,
            bank_account_id: dbAccount.id,
            provider: "mercury",
            external_transaction_id: tx.id,
            date: (tx.postedAt ?? tx.estimatedDeliveryDate ?? new Date().toISOString()).slice(0, 10),
            description: tx.note ?? tx.counterpartyName ?? "Mercury transaction",
            amount,
            currency: "USD",
            category,
            pending: tx.status !== "sent" && tx.status !== "failed",
            merchant_name: tx.counterpartyName ?? null,
            raw_category: tx.externalMemo ?? null,
            is_excluded: category === "Transfer",
          }, { onConflict: "bank_connection_id,external_transaction_id", ignoreDuplicates: false })

          if (upsertErr) {
            if (upsertErr.code === "23505") { totalSkipped++; continue }
            errors.push(upsertErr.message)
          } else {
            totalImported++
          }
        }

        if (offset + limit >= txData.total) break
        offset += limit
      }
    }

    // ── Update connection status + log ───────────────────────────────────────
    const status = errors.length === 0 ? "success" : totalImported > 0 ? "partial" : "error"
    await supabase.from("bank_connections").update({
      last_sync_at: new Date().toISOString(),
      status: errors.length === 0 ? "active" : "error",
      error_message: errors.length > 0 ? errors[0] : null,
    }).eq("id", connection_id)

    await supabase.from("cashflow_sync_logs").insert({
      bank_connection_id: connection_id,
      bank_account_id: null,
      provider: "mercury",
      status,
      transactions_imported: totalImported,
      transactions_skipped: totalSkipped,
      error_message: errors.length > 0 ? errors.join("; ") : null,
      started_at: syncStarted,
      completed_at: new Date().toISOString(),
    })

    return json({ imported: totalImported, skipped: totalSkipped, errors })
  } catch (err) {
    console.error("mercury-sync error:", err)
    return json({ error: String(err) }, 500)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function mercuryGet(path: string, apiKey: string): Promise<Response> {
  return fetch(`${MERCURY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  })
}

// deno-lint-ignore no-explicit-any
async function markConnectionError(supabase: any, id: string, msg: string) {
  await supabase.from("bank_connections").update({ status: "error", error_message: msg }).eq("id", id)
}

// Inline classifier (edge functions can't import from src/)
function classifyTransaction(input: { description: string; merchant_name?: string | null; raw_category?: string | null; amount: number }): string {
  const combined = `${input.description} ${input.merchant_name ?? ""} ${input.raw_category ?? ""}`.toLowerCase()
  if (/transfer|wire|ach(?! transfer)|zelle|internal/i.test(combined)) return "Transfer"
  if (/payroll|gusto|rippling|adp|paychex|salary|wages/i.test(combined)) return "Payroll"
  if (/irs|state tax|federal tax|estimated tax|quarterly tax|sales tax/i.test(combined)) return "Tax Payment"
  if (/amazon web services|aws|google cloud|digitalocean|cloudflare|datadog/i.test(combined)) return "Infrastructure"
  if (/github|figma|slack|notion|linear|vercel|stripe|zoom|dropbox|atlassian|microsoft 365|google workspace/i.test(combined)) return "Software"
  if (/loan|credit facility|line of credit|financing|svb|brex/i.test(combined)) return "Loan / Financing"
  if (/refund|reversal|chargeback|credit memo/i.test(combined)) return "Refund"
  if (input.amount > 0 && /owner contribution|capital contribution/i.test(combined)) return "Owner Contribution"
  if (input.amount < 0 && /contractor|freelance|consulting fee|1099/i.test(combined)) return "Contractor"
  if (input.amount < 0 && /vendor|supplier|invoice/i.test(combined)) return "Vendor Payment"
  return input.amount > 0 ? "Revenue" : "Expense"
}

// ─────────────────────────────────────────────────────────────────────────────
// Mercury API response types
// ─────────────────────────────────────────────────────────────────────────────

interface MercuryAccount {
  id: string
  name: string
  kind: string
  status: string
  currentBalance: number
  availableBalance: number
  currencyCode: string
}

interface MercuryTransaction {
  id: string
  amount: number
  kind: "credit" | "debit"
  status: "pending" | "sent" | "failed" | "cancelled"
  note: string | null
  counterpartyName: string | null
  externalMemo: string | null
  postedAt: string | null
  estimatedDeliveryDate: string | null
}
