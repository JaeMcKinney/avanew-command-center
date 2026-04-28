import type { BankTransactionCategory } from "@/types/db"

export const BANK_TRANSACTION_CATEGORIES: BankTransactionCategory[] = [
  "Revenue",
  "Expense",
  "Transfer",
  "Refund",
  "Owner Contribution",
  "Loan / Financing",
  "Tax Payment",
  "Payroll",
  "Software",
  "Infrastructure",
  "Contractor",
  "Vendor Payment",
  "Partner Payment",
  "Other",
]

// Categories excluded from revenue/expense calculations (internal movements)
export const EXCLUDED_FROM_CALCULATIONS: BankTransactionCategory[] = [
  "Transfer",
  "Owner Contribution",
  "Loan / Financing",
]

// Categories that count as revenue (inflow)
export const REVENUE_CATEGORIES: BankTransactionCategory[] = [
  "Revenue",
  "Refund",
]

// Categories that count as expenses (outflow)
export const EXPENSE_CATEGORIES: BankTransactionCategory[] = [
  "Expense",
  "Tax Payment",
  "Payroll",
  "Software",
  "Infrastructure",
  "Contractor",
  "Vendor Payment",
  "Partner Payment",
  "Other",
]

interface ClassifyInput {
  description: string
  merchant_name?: string | null
  raw_category?: string | null
  amount: number
}

const PAYROLL_KEYWORDS = ["payroll", "gusto", "rippling", "adp", "paychex", "salary", "wages", "direct deposit"]
const TRANSFER_KEYWORDS = ["transfer", "wire", "ach", "zelle", "venmo", "paypal transfer", "internal"]
const TAX_KEYWORDS = ["irs", "state tax", "federal tax", "estimated tax", "quarterly tax", "sales tax", "payroll tax"]
const SOFTWARE_KEYWORDS = [
  "github", "figma", "slack", "notion", "linear", "vercel", "netlify",
  "sendgrid", "twilio", "stripe", "intercom", "hubspot", "salesforce",
  "zoom", "dropbox", "jira", "atlassian", "adobe", "microsoft 365",
  "google workspace", "1password", "loom", "grammarly", "calendly",
]
const INFRA_KEYWORDS = [
  "amazon web services", "aws", "google cloud", "gcp", "digitalocean",
  "linode", "cloudflare", "datadog", "new relic", "supabase", "railway",
  "render", "heroku", "mongodb atlas", "planetscale",
]
const LOAN_KEYWORDS = ["loan", "credit facility", "line of credit", "financing", "svb", "brex", "invoice capital"]
const CONTRACTOR_KEYWORDS = ["contractor", "freelance", "consulting fee", "professional services", "1099"]
const VENDOR_KEYWORDS = ["vendor", "supplier", "purchase order", "invoice"]
const REFUND_KEYWORDS = ["refund", "reversal", "chargeback", "credit memo", "returned"]
const OWNER_KEYWORDS = ["owner contribution", "capital contribution", "personal", "owner draw", "shareholder"]

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw))
}

export function classifyTransaction(input: ClassifyInput): BankTransactionCategory {
  const desc = input.description.toLowerCase()
  const merchant = (input.merchant_name ?? "").toLowerCase()
  const rawCat = (input.raw_category ?? "").toLowerCase()
  const combined = `${desc} ${merchant} ${rawCat}`

  // Explicit transfer check first (highest priority — prevent revenue/expense misclassification)
  if (matchesAny(combined, TRANSFER_KEYWORDS)) return "Transfer"

  // Payroll
  if (matchesAny(combined, PAYROLL_KEYWORDS)) return "Payroll"

  // Tax
  if (matchesAny(combined, TAX_KEYWORDS)) return "Tax Payment"

  // Infrastructure (check before Software — AWS matches both)
  if (matchesAny(combined, INFRA_KEYWORDS)) return "Infrastructure"

  // Software / SaaS
  if (matchesAny(combined, SOFTWARE_KEYWORDS)) return "Software"

  // Loan / financing
  if (matchesAny(combined, LOAN_KEYWORDS)) return "Loan / Financing"

  // Refund (inflow that was previously an expense)
  if (matchesAny(combined, REFUND_KEYWORDS)) return "Refund"

  // Owner contribution (inflow)
  if (input.amount > 0 && matchesAny(combined, OWNER_KEYWORDS)) return "Owner Contribution"

  // Contractor / freelancer payment
  if (input.amount < 0 && matchesAny(combined, CONTRACTOR_KEYWORDS)) return "Contractor"

  // Vendor payment
  if (input.amount < 0 && matchesAny(combined, VENDOR_KEYWORDS)) return "Vendor Payment"

  // Raw category hints from provider
  if (rawCat.includes("payroll")) return "Payroll"
  if (rawCat.includes("tax")) return "Tax Payment"
  if (rawCat.includes("transfer")) return "Transfer"
  if (rawCat.includes("loan") || rawCat.includes("credit")) return "Loan / Financing"
  if (rawCat.includes("refund")) return "Refund"
  if (rawCat.includes("software") || rawCat.includes("saas")) return "Software"
  if (rawCat.includes("infrastructure") || rawCat.includes("cloud")) return "Infrastructure"
  if (rawCat.includes("contractor") || rawCat.includes("freelance")) return "Contractor"

  // Direction-based fallback
  if (input.amount > 0) return "Revenue"
  return "Expense"
}

export function isExcludedFromCalculations(category: BankTransactionCategory): boolean {
  return EXCLUDED_FROM_CALCULATIONS.includes(category)
}

export function isRevenue(category: BankTransactionCategory): boolean {
  return REVENUE_CATEGORIES.includes(category)
}

export function isExpense(category: BankTransactionCategory): boolean {
  return EXPENSE_CATEGORIES.includes(category)
}

export function categoryBadgeColor(category: BankTransactionCategory): string {
  if (isRevenue(category)) return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-200"
  if (category === "Transfer") return "bg-blue-500/15 text-blue-700 border-blue-200"
  if (category === "Owner Contribution" || category === "Loan / Financing") return "bg-violet-500/15 text-violet-700 border-violet-200"
  return "bg-destructive/10 text-destructive border-destructive/20"
}
