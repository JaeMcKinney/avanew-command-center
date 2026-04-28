/**
 * Plaid Sync Edge Function
 *
 * Steps 2-4 of the Plaid flow:
 *   POST { action: "exchange", public_token, institution_name } → stores access_token, returns connection_id
 *   POST { action: "sync",     connection_id }                  → syncs transactions
 *
 * Required environment variables:
 *   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected)
 *
 * NOTE: access_token is stored in a separate secure table (bank_connection_tokens)
 * that is NEVER returned to the frontend and is excluded from all select policies.
 */

import { requireAuth } from "../_shared/auth.ts"
import { corsHeaders } from "../_shared/cors.ts"

const SYNC_DAYS = 90

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const auth = await requireAuth(req, ["owner", "super_user"])
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const body = await req.json() as { action: string; public_token?: string; institution_name?: string; connection_id?: string }
  const plaidEnv = Deno.env.get("PLAID_ENV") ?? "sandbox"
  const plaidBase = plaidEnv === "production" ? "https://production.plaid.com"
    : plaidEnv === "development" ? "https://development.plaid.com"
    : "https://sandbox.plaid.com"

  const plaidPost = async (path: string, body: object) => fetch(`${plaidBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: Deno.env.get("PLAID_CLIENT_ID"), secret: Deno.env.get("PLAID_SECRET"), ...body }),
  })

  // ── Action: exchange public_token for access_token ───────────────────────
  if (body.action === "exchange") {
    const { public_token, institution_name } = body
    if (!public_token || !institution_name) return json({ error: "public_token and institution_name required" }, 400)

    const res = await plaidPost("/item/public_token/exchange", { public_token })
    if (!res.ok) return json({ error: "Token exchange failed" }, 502)
    const { access_token, item_id } = await res.json() as { access_token: string; item_id: string }

    // Create bank_connection row (no access_token column in bank_connections — stored securely below)
    const { data: conn } = await supabase.from("bank_connections").insert({
      provider: "plaid",
      institution_name,
      institution_id: item_id,
      status: "pending",
    }).select().single()

    if (!conn) return json({ error: "Failed to create connection" }, 500)

    // Store access_token in a locked-down table (not exposed via any frontend policy)
    await supabase.from("bank_connection_tokens").insert({ connection_id: conn.id, access_token })

    return json({ connection_id: conn.id })
  }

  // ── Action: sync transactions ─────────────────────────────────────────────
  if (body.action === "sync") {
    const { connection_id } = body
    if (!connection_id) return json({ error: "connection_id required" }, 400)

    // Retrieve access_token (service role only — never reachable from frontend)
    const { data: tokenRow } = await supabase.from("bank_connection_tokens").select("access_token").eq("connection_id", connection_id).single()
    if (!tokenRow) return json({ error: "No access token for this connection" }, 404)

    const { data: conn } = await supabase.from("bank_connections").select("*").eq("id", connection_id).single()
    if (!conn) return json({ error: "Connection not found" }, 404)

    const syncStarted = new Date().toISOString()
    let totalImported = 0
    let totalSkipped = 0
    const errors: string[] = []

    // Fetch accounts from Plaid
    const accRes = await plaidPost("/accounts/get", { access_token: tokenRow.access_token })
    if (!accRes.ok) return json({ error: "Failed to fetch accounts" }, 502)
    const { accounts } = await accRes.json() as { accounts: PlaidAccount[] }

    // Fetch institution name
    const itemRes = await plaidPost("/item/get", { access_token: tokenRow.access_token })
    const institutionName = itemRes.ok ? ((await itemRes.json()) as { item: { institution_id: string } }).item.institution_id : "Unknown Bank"

    for (const acct of accounts) {
      await supabase.from("bank_accounts").upsert({
        bank_connection_id: connection_id,
        external_account_id: acct.account_id,
        name: acct.name,
        type: acct.subtype === "checking" ? "checking" : acct.subtype === "savings" ? "savings" : acct.type === "credit" ? "credit" : "other",
        subtype: acct.subtype,
        balance_current: acct.balances.current,
        balance_available: acct.balances.available,
        currency: acct.balances.iso_currency_code ?? "USD",
        institution_name: institutionName,
        is_active: true,
        last_updated: new Date().toISOString(),
      }, { onConflict: "bank_connection_id,external_account_id" })
    }

    const { data: dbAccounts } = await supabase.from("bank_accounts").select("id,external_account_id").eq("bank_connection_id", connection_id)

    // Use Plaid transactions/sync for incremental updates
    let cursor: string | null = null
    const startDate = conn.last_sync_at
      ? new Date(conn.last_sync_at).toISOString().slice(0, 10)
      : new Date(Date.now() - SYNC_DAYS * 864e5).toISOString().slice(0, 10)
    const endDate = new Date().toISOString().slice(0, 10)

    let hasMore = true
    while (hasMore) {
      const txRes = await plaidPost("/transactions/get", {
        access_token: tokenRow.access_token,
        start_date: startDate,
        end_date: endDate,
        options: { count: 500, offset: totalImported },
      })
      if (!txRes.ok) { errors.push("Failed to fetch transactions"); break }

      const txData = await txRes.json() as { transactions: PlaidTransaction[]; total_transactions: number }
      hasMore = totalImported + txData.transactions.length < txData.total_transactions

      for (const tx of txData.transactions) {
        const dbAcct = dbAccounts?.find((a) => a.external_account_id === tx.account_id)
        if (!dbAcct) continue

        const amount = -tx.amount
        const category = classifyTransaction({
          description: tx.name,
          merchant_name: tx.merchant_name,
          raw_category: tx.personal_finance_category?.primary ?? tx.category?.[0],
          amount,
        })

        const { error: upsertErr } = await supabase.from("bank_transactions").upsert({
          bank_connection_id: connection_id,
          bank_account_id: dbAcct.id,
          provider: "plaid",
          external_transaction_id: tx.transaction_id,
          date: tx.date,
          description: tx.name,
          amount,
          currency: tx.iso_currency_code ?? "USD",
          category,
          pending: tx.pending,
          merchant_name: tx.merchant_name ?? null,
          raw_category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
          is_excluded: category === "Transfer",
        }, { onConflict: "bank_connection_id,external_transaction_id", ignoreDuplicates: false })

        if (upsertErr) { if (upsertErr.code === "23505") totalSkipped++; else errors.push(upsertErr.message) }
        else totalImported++
      }
    }

    const status = errors.length === 0 ? "success" : totalImported > 0 ? "partial" : "error"
    await supabase.from("bank_connections").update({
      last_sync_at: new Date().toISOString(),
      status: errors.length === 0 ? "active" : "error",
      error_message: errors[0] ?? null,
    }).eq("id", connection_id)

    await supabase.from("cashflow_sync_logs").insert({
      bank_connection_id: connection_id,
      provider: "plaid",
      status,
      transactions_imported: totalImported,
      transactions_skipped: totalSkipped,
      error_message: errors.join("; ") || null,
      started_at: syncStarted,
      completed_at: new Date().toISOString(),
    })

    return json({ imported: totalImported, skipped: totalSkipped, errors })
  }

  return json({ error: "Unknown action" }, 400)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
}

function classifyTransaction(input: { description: string; merchant_name?: string | null; raw_category?: string | null; amount: number }): string {
  const combined = `${input.description} ${input.merchant_name ?? ""} ${input.raw_category ?? ""}`.toLowerCase()
  if (/transfer|wire|zelle|internal/i.test(combined)) return "Transfer"
  if (/payroll|gusto|rippling|adp|paychex|salary|wages/i.test(combined)) return "Payroll"
  if (/irs|state tax|federal tax|estimated tax/i.test(combined)) return "Tax Payment"
  if (/amazon web services|aws|google cloud|digitalocean|cloudflare|datadog/i.test(combined)) return "Infrastructure"
  if (/github|figma|slack|notion|linear|vercel|stripe|zoom|dropbox|atlassian/i.test(combined)) return "Software"
  if (/loan|credit facility|line of credit|financing/i.test(combined)) return "Loan / Financing"
  if (/refund|reversal|chargeback/i.test(combined)) return "Refund"
  if (input.amount > 0 && /owner contribution|capital contribution/i.test(combined)) return "Owner Contribution"
  if (input.amount < 0 && /contractor|freelance|consulting fee|1099/i.test(combined)) return "Contractor"
  if (input.amount < 0 && /vendor|supplier|invoice/i.test(combined)) return "Vendor Payment"
  return input.amount > 0 ? "Revenue" : "Expense"
}

interface PlaidAccount {
  account_id: string; name: string; type: string; subtype: string | null
  balances: { current: number | null; available: number | null; iso_currency_code: string | null }
}
interface PlaidTransaction {
  transaction_id: string; account_id: string; name: string; merchant_name: string | null
  amount: number; date: string; pending: boolean; iso_currency_code: string | null
  category?: string[]; personal_finance_category?: { primary: string } | null
}
