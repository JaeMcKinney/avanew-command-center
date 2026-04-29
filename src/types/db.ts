export type ActivityType = "call" | "email" | "note" | "meeting" | "task"

export type TeamRole = "super_user" | "owner" | "admin" | "member" | "viewer" | "bd" | "partner"

export type BankProvider = "mercury" | "plaid" | "finicity" | "manual"

export type BankTransactionCategory =
  | "Revenue"
  | "Expense"
  | "Transfer"
  | "Refund"
  | "Owner Contribution"
  | "Loan / Financing"
  | "Tax Payment"
  | "Payroll"
  | "Software"
  | "Infrastructure"
  | "Contractor"
  | "Vendor Payment"
  | "Partner Payment"
  | "Other"

export type BankConnection = {
  id: string
  provider: BankProvider
  institution_name: string
  institution_id: string | null
  status: "active" | "error" | "disconnected" | "pending"
  last_sync_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type BankAccount = {
  id: string
  bank_connection_id: string
  external_account_id: string
  name: string
  type: "checking" | "savings" | "credit" | "investment" | "other"
  subtype: string | null
  balance_current: number | null
  balance_available: number | null
  currency: string
  institution_name: string
  is_active: boolean
  last_updated: string | null
  created_at: string
  updated_at: string
}

export type BankTransaction = {
  id: string
  bank_connection_id: string
  bank_account_id: string
  provider: BankProvider
  external_transaction_id: string
  date: string
  description: string
  amount: number
  currency: string
  category: BankTransactionCategory
  pending: boolean
  merchant_name: string | null
  vendor_id: string | null
  partner_id: string | null
  notes: string | null
  is_excluded: boolean
  override_category: BankTransactionCategory | null
  raw_category: string | null
  created_at: string
  updated_at: string
}

export type CashflowSyncLog = {
  id: string
  bank_connection_id: string
  bank_account_id: string | null
  provider: string
  status: "success" | "error" | "partial"
  transactions_imported: number
  transactions_skipped: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export type TeamMember = {
  id: string
  email: string
  full_name: string | null
  role: TeamRole
  status: "active" | "invited"
  created_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: TeamRole
  created_at: string
}

export type Invitation = {
  id: string
  email: string
  full_name: string | null
  role: TeamRole
  invited_by: string | null
  created_at: string
}

export type Company = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  notes: string | null
  owner_id: string | null
  phone: string | null
  fax: string | null
  website: string | null
  ticker_symbol: string | null
  ownership: string | null
  employees: number | null
  sic_code: string | null
  rating: string | null
  account_type: string | null
  account_number: string | null
  account_site: string | null
  annual_revenue: number | null
  billing_street: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zip: string | null
  billing_country: string | null
  shipping_street: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_country: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export type Contact = {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  title: string | null
  company_id: string | null
  owner_id: string | null
  notes: string | null
  mobile: string | null
  fax: string | null
  website: string | null
  secondary_email: string | null
  twitter: string | null
  skype_id: string | null
  email_opt_out: boolean
  date_of_birth: string | null
  assistant: string | null
  asst_phone: string | null
  department: string | null
  lead_source: string | null
  description: string | null
  mailing_street: string | null
  mailing_city: string | null
  mailing_state: string | null
  mailing_zip: string | null
  mailing_country: string | null
  other_street: string | null
  other_city: string | null
  other_state: string | null
  other_zip: string | null
  other_country: string | null
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  owner_id: string | null
  first_name: string
  last_name: string | null
  company: string | null
  title: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  fax: string | null
  website: string | null
  lead_source: string | null
  lead_status: string | null
  industry: string | null
  annual_revenue: number | null
  no_of_employees: number | null
  rating: string | null
  email_opt_out: boolean
  street: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  description: string | null
  converted: boolean
  created_at: string
  updated_at: string
}

export type Task = {
  id: string
  subject: string
  status: string
  priority: string
  owner_id: string | null
  contact_id: string | null
  company_id: string | null
  deal_id: string | null
  lead_id: string | null
  due_date: string | null
  description: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type PipelineStage = {
  id: string
  name: string
  position: number
  is_won: boolean
  is_lost: boolean
  created_at: string
}

export type Deal = {
  id: string
  title: string
  amount: number | null
  currency: string
  stage_id: string
  contact_id: string | null
  company_id: string | null
  owner_id: string | null
  partner_id: string | null
  expected_close_date: string | null
  closed_at: string | null
  position: number
  type: string | null
  next_step: string | null
  lead_source: string | null
  probability: number | null
  campaign_source: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export type Activity = {
  id: string
  type: ActivityType
  subject: string
  body: string | null
  contact_id: string | null
  company_id: string | null
  deal_id: string | null
  owner_id: string | null
  due_at: string | null
  completed_at: string | null
  created_at: string
}

export type CashflowTransaction = {
  id: string
  type: "income" | "expense"
  category: string
  description: string | null
  amount: number
  date: string
  is_recurring: boolean
  recurrence_period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | null
  partner_id: string | null
  vendor_id: string | null
  reference: string | null
  created_at: string
  updated_at: string
}

export type Partner = {
  id: string
  name: string
  type: string | null
  email: string | null
  phone: string | null
  website: string | null
  agreement_start_date: string | null
  contract_terms: string | null
  revenue_share: string | null
  key_contacts: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Vendor = {
  id: string
  name: string
  service: string | null
  email: string | null
  phone: string | null
  website: string | null
  contract_terms: string | null
  payment_terms: string | null
  cost_structure: string | null
  cost_amount: number | null
  cost_frequency: "monthly" | "quarterly" | "annually" | null
  performance_notes: string | null
  status: string
  created_at: string
  updated_at: string
}

type TableSchema<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: TableSchema<
        Profile,
        Partial<Profile> & Pick<Profile, "id">,
        Partial<Profile>
      >
      companies: TableSchema<
        Company,
        Partial<Company> & Pick<Company, "name">,
        Partial<Company>
      >
      contacts: TableSchema<
        Contact,
        Partial<Contact> & Pick<Contact, "first_name">,
        Partial<Contact>
      >
      pipeline_stages: TableSchema<
        PipelineStage,
        Partial<PipelineStage> & Pick<PipelineStage, "name" | "position">,
        Partial<PipelineStage>
      >
      deals: TableSchema<
        Deal,
        Partial<Deal> & Pick<Deal, "title" | "stage_id">,
        Partial<Deal>
      >
      activities: TableSchema<
        Activity,
        Partial<Activity> & Pick<Activity, "type" | "subject">,
        Partial<Activity>
      >
      invitations: TableSchema<
        Invitation,
        Partial<Invitation> & Pick<Invitation, "email" | "role">,
        Partial<Invitation>
      >
      leads: TableSchema<
        Lead,
        Partial<Lead> & Pick<Lead, "first_name">,
        Partial<Lead>
      >
      tasks: TableSchema<
        Task,
        Partial<Task> & Pick<Task, "subject">,
        Partial<Task>
      >
      partners: TableSchema<
        Partner,
        Partial<Partner> & Pick<Partner, "name">,
        Partial<Partner>
      >
      vendors: TableSchema<
        Vendor,
        Partial<Vendor> & Pick<Vendor, "name">,
        Partial<Vendor>
      >
      cashflow_transactions: TableSchema<
        CashflowTransaction,
        Partial<CashflowTransaction> &
          Pick<CashflowTransaction, "type" | "category" | "amount" | "date">,
        Partial<CashflowTransaction>
      >
      bank_connections: TableSchema<
        BankConnection,
        Partial<BankConnection> &
          Pick<BankConnection, "provider" | "institution_name">,
        Partial<BankConnection>
      >
      bank_accounts: TableSchema<
        BankAccount,
        Partial<BankAccount> &
          Pick<BankAccount, "bank_connection_id" | "name" | "type">,
        Partial<BankAccount>
      >
      bank_transactions: TableSchema<
        BankTransaction,
        Partial<BankTransaction> &
          Pick<
            BankTransaction,
            "bank_account_id" | "amount" | "date" | "description"
          >,
        Partial<BankTransaction>
      >
      cashflow_sync_logs: TableSchema<
        CashflowSyncLog,
        Partial<CashflowSyncLog> &
          Pick<CashflowSyncLog, "bank_connection_id" | "status">,
        Partial<CashflowSyncLog>
      >
      role_permissions: TableSchema<
        { permission_key: string; role: TeamRole; enabled: boolean; updated_at: string },
        { permission_key: string; role: TeamRole; enabled: boolean; updated_at?: string },
        Partial<{ permission_key: string; role: TeamRole; enabled: boolean; updated_at: string }>
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: { activity_type: ActivityType; team_role: TeamRole }
    CompositeTypes: Record<string, never>
  }
}
