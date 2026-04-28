/**
 * Bank Provider Abstraction Layer
 *
 * All bank integrations normalise data into NormalizedAccount and
 * NormalizedTransaction before storing in bank_accounts / bank_transactions.
 * API credentials (tokens, access keys) are NEVER handled client-side —
 * they live exclusively in Supabase Edge Function environment variables and
 * are referenced here only as documentation for the Edge Function layer.
 *
 * Supported providers:
 *   mercury   — Mercury Native API (direct, no aggregator)
 *   plaid     — Plaid (aggregator, supports BoA and 12,000+ other institutions)
 *   finicity  — Finicity / Mastercard Open Banking (aggregator alternative)
 *   manual    — User-entered cashflow_transactions (always present as fallback)
 */

import type { BankProvider, BankTransactionCategory } from "@/types/db"
import { classifyTransaction } from "@/lib/transaction-classifier"

// ─────────────────────────────────────────────────────────────────────────────
// Normalized shapes (internal canonical format)
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedAccount {
  provider: BankProvider
  external_account_id: string
  name: string
  type: "checking" | "savings" | "credit" | "investment" | "other"
  subtype: string | null
  balance_current: number | null
  balance_available: number | null
  currency: string
  institution_name: string
}

export interface NormalizedTransaction {
  provider: BankProvider
  external_transaction_id: string
  date: string
  description: string
  amount: number
  currency: string
  pending: boolean
  merchant_name: string | null
  raw_category: string | null
  category: BankTransactionCategory
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider interface — Edge Functions implement this contract
// ─────────────────────────────────────────────────────────────────────────────

export interface BankProviderAdapter {
  readonly provider: BankProvider
  /** Verify credentials and return list of accounts */
  fetchAccounts(): Promise<NormalizedAccount[]>
  /** Fetch transactions for a given account in a date range */
  fetchTransactions(
    accountId: string,
    opts: { start: string; end: string; cursor?: string }
  ): Promise<{ transactions: NormalizedTransaction[]; nextCursor: string | null }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Mercury adapter (normaliser — actual HTTP calls happen in Edge Function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mercury API Response → Normalized shapes
 * Base URL: https://app.mercury.com/api/v1
 * Auth:     Authorization: api-key <MERCURY_API_KEY>
 *
 * Edge Function env vars required:
 *   MERCURY_API_KEY — read-only API token from Mercury Settings > API
 */
export function normalizeMercuryAccount(raw: MercuryAccountRaw): NormalizedAccount {
  return {
    provider: "mercury",
    external_account_id: raw.id,
    name: raw.name,
    type: raw.kind === "checking" ? "checking" : raw.kind === "savings" ? "savings" : "other",
    subtype: raw.kind ?? null,
    balance_current: raw.currentBalance ?? null,
    balance_available: raw.availableBalance ?? null,
    currency: raw.currencyCode ?? "USD",
    institution_name: "Mercury",
  }
}

export function normalizeMercuryTransaction(raw: MercuryTransactionRaw): NormalizedTransaction {
  const amount = raw.kind === "credit" ? Math.abs(raw.amount) : -Math.abs(raw.amount)
  const category = classifyTransaction({
    description: raw.note ?? raw.counterpartyName ?? raw.kind,
    merchant_name: raw.counterpartyName,
    raw_category: raw.externalMemo,
    amount,
  })
  return {
    provider: "mercury",
    external_transaction_id: raw.id,
    date: raw.postedAt?.slice(0, 10) ?? raw.estimatedDeliveryDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    description: raw.note ?? raw.counterpartyName ?? "Mercury transaction",
    amount,
    currency: "USD",
    pending: raw.status !== "sent" && raw.status !== "failed",
    merchant_name: raw.counterpartyName ?? null,
    raw_category: raw.externalMemo ?? null,
    category,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plaid adapter (normaliser — HTTP calls in Edge Function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plaid aggregator — supports Bank of America, Chase, Wells Fargo, and 12,000+
 * other US institutions.
 *
 * Flow:
 *  1. Frontend calls /functions/plaid-link-token  → receives link_token
 *  2. Frontend opens Plaid Link widget
 *  3. User authenticates with their bank
 *  4. Frontend receives public_token from Plaid Link
 *  5. Frontend calls /functions/plaid-exchange-token with public_token
 *  6. Edge Function exchanges for access_token and stores in bank_connections
 *  7. Edge Function calls /functions/plaid-sync to import transactions
 *
 * Edge Function env vars required:
 *   PLAID_CLIENT_ID  — from Plaid Dashboard
 *   PLAID_SECRET     — from Plaid Dashboard (use Sandbox/Development/Production key)
 *   PLAID_ENV        — "sandbox" | "development" | "production"
 */
export function normalizePlaidAccount(raw: PlaidAccountRaw): NormalizedAccount {
  const typeMap: Record<string, NormalizedAccount["type"]> = {
    depository: "checking",
    credit: "credit",
    investment: "investment",
    loan: "other",
  }
  const subtypeMap: Record<string, NormalizedAccount["type"]> = {
    checking: "checking",
    savings: "savings",
    "money market": "savings",
    cd: "savings",
  }
  return {
    provider: "plaid",
    external_account_id: raw.account_id,
    name: raw.name,
    type: subtypeMap[raw.subtype ?? ""] ?? typeMap[raw.type] ?? "other",
    subtype: raw.subtype ?? null,
    balance_current: raw.balances.current ?? null,
    balance_available: raw.balances.available ?? null,
    currency: raw.balances.iso_currency_code ?? "USD",
    institution_name: raw.institution_name ?? "Unknown Bank",
  }
}

export function normalizePlaidTransaction(raw: PlaidTransactionRaw): NormalizedTransaction {
  const amount = -raw.amount // Plaid uses positive = debit, negative = credit
  const primaryCat = raw.personal_finance_category?.primary ?? raw.category?.[0] ?? ""
  const category = classifyTransaction({
    description: raw.name,
    merchant_name: raw.merchant_name,
    raw_category: primaryCat,
    amount,
  })
  return {
    provider: "plaid",
    external_transaction_id: raw.transaction_id,
    date: raw.date,
    description: raw.name,
    amount,
    currency: raw.iso_currency_code ?? "USD",
    pending: raw.pending,
    merchant_name: raw.merchant_name ?? null,
    raw_category: primaryCat || null,
    category,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Finicity adapter (normaliser — HTTP calls in Edge Function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finicity / Mastercard Open Banking — alternative aggregator.
 *
 * Edge Function env vars required:
 *   FINICITY_APP_KEY   — from Finicity Developer Portal
 *   FINICITY_PARTNER_ID
 *   FINICITY_PARTNER_SECRET
 */
export function normalizeFincityTransaction(raw: FinicityTransactionRaw): NormalizedTransaction {
  const amount = raw.amount
  const category = classifyTransaction({
    description: raw.description,
    merchant_name: raw.merchant?.name,
    raw_category: raw.categorization?.category,
    amount,
  })
  return {
    provider: "finicity",
    external_transaction_id: String(raw.id),
    date: new Date(raw.transactionDate * 1000).toISOString().slice(0, 10),
    description: raw.description,
    amount,
    currency: "USD",
    pending: raw.status === "pending",
    merchant_name: raw.merchant?.name ?? null,
    raw_category: raw.categorization?.category ?? null,
    category,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw API response shapes (typed for the normalisers above)
// ─────────────────────────────────────────────────────────────────────────────

export interface MercuryAccountRaw {
  id: string
  name: string
  kind: string
  currentBalance: number
  availableBalance: number
  currencyCode: string
  status: string
}

export interface MercuryTransactionRaw {
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

export interface PlaidAccountRaw {
  account_id: string
  name: string
  type: string
  subtype: string | null
  institution_name?: string
  balances: {
    current: number | null
    available: number | null
    iso_currency_code: string | null
  }
}

export interface PlaidTransactionRaw {
  transaction_id: string
  account_id: string
  name: string
  merchant_name: string | null
  amount: number
  date: string
  pending: boolean
  iso_currency_code: string | null
  category?: string[]
  personal_finance_category?: { primary: string; detailed: string } | null
}

export interface FinicityTransactionRaw {
  id: number
  amount: number
  description: string
  status: "active" | "pending"
  transactionDate: number
  merchant?: { name: string }
  categorization?: { category: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider label helpers
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_LABELS: Record<BankProvider, string> = {
  mercury: "Mercury",
  plaid: "Plaid",
  finicity: "Finicity",
  manual: "Manual",
}

export const PROVIDER_BADGE_COLORS: Record<BankProvider, string> = {
  mercury: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-200",
  plaid: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200",
  finicity: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200",
  manual: "bg-muted text-muted-foreground",
}
