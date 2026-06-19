export type ActivityType = "call" | "email" | "note" | "meeting" | "task"

export type TeamRole = "super_user" | "owner" | "admin" | "bd" | "partner"

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
  organization_id: string
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
  organization_id: string
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
  organization_id: string
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
  organization_id: string
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
  // True when this member is designated as a Program Admin for the org —
  // receives RA application notifications and may approve/decline submissions.
  // Only meaningful when role === "admin".
  is_program_admin?: boolean
}

export type RaStatus =
  | "pending"
  | "verification"
  | "needs_changes"
  | "active"
  | "suspended"
  | "declined"
  | "terminated"

export type RaAssociate = {
  id: string
  organization_id: string
  user_id: string
  slug: string
  display_name: string
  status: RaStatus
  photo_url: string | null
  contact_phone: string | null
  contact_email: string | null
  bio: string | null
  // Banking — only populated when the RA is editing their own record
  // (RLS prevents SELECT by other non-admin users)
  ach_account_holder: string | null
  ach_bank_name: string | null
  ach_routing: string | null
  ach_account: string | null
  photo_completed: boolean
  contact_completed: boolean
  banking_completed: boolean
  // W-9 upload (R4b — uploaded PDF, not raw SSN). Optional until PR-3.
  w9_completed?: boolean
  w9_document_url?: string | null
  w9_uploaded_at?: string | null
  w9_reviewed_at?: string | null
  w9_reviewed_by?: string | null
  // Agreement acceptance (R0 — captured at /onboarding/agreement step).
  // Optional until PR-3 migration adds the columns; localStorage-backed before then.
  agreement_completed?: boolean
  agreement_version?: string | null
  agreement_accepted_at?: string | null
  agreement_ip_address?: string | null
  agreement_user_agent?: string | null
  agreement_signed_name?: string | null
  submitted_at: string | null
  verification_notes: string | null
  verified_at: string | null
  activated_at: string | null
  template_id: string | null
  // Individual vs Company. Set at invite, editable after. Drives which
  // type-default landing template the public pages resolve to.
  ra_type?: RaType
  // Optional partner/company branding (populated for Company RAs).
  partner_company_name?: string | null
  partner_logo_url?: string | null
  partner_website?: string | null
  linkedin_url?: string | null
  ra_title?: string | null
  created_at: string
  updated_at: string
  // joined from profiles
  email: string
  full_name: string | null
}

// ── RA Archive (preserved when an RA is permanently deleted) ────────────────

export type ArchivedRaAssociate = {
  id: string
  organization_id: string
  original_ra_id: string
  original_user_id: string | null
  slug: string
  display_name: string
  email: string | null
  status_at_archive: RaStatus
  archived_at: string
  archived_by: string | null
  archive_reason: string | null
  archived_leads_count: number
  archived_deals_count: number
  archived_checkins_count: number
  archived_payouts_count: number
  // Full row dump of the original ra_associates record at the moment of archival.
  snapshot: Record<string, unknown>
}

export type ArchivedRaRow = {
  id: string
  archived_ra_associate_id: string
  organization_id: string
  archived_at: string
  snapshot: Record<string, unknown>
  // Each child table has its own original_*_id column, name varies.
  original_lead_id?: string
  original_deal_id?: string
  original_checkin_id?: string
  original_payout_id?: string
  original_acceptance_id?: string
}

export type ArchivedRaDetail = {
  ra: ArchivedRaAssociate
  leads: ArchivedRaRow[]
  deals: ArchivedRaRow[]
  checkins: ArchivedRaRow[]
  payouts: ArchivedRaRow[]
  agreements: ArchivedRaRow[]
}

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: TeamRole
  created_at: string
}

// ── RA Program / Commission Configuration ────────────────────────────────────
// Configurable per-organization. Drives commission display in admin views,
// RA dashboards, public referral pages, and the signed agreement document.

export type CommissionMode = "flat" | "percent"

export type RecurringDuration =
  | { kind: "indefinite" }
  | { kind: "months"; months: number }

export type CommissionConfig = {
  // One-time referral commission paid when implementation fee is fully collected.
  one_time_mode: CommissionMode
  one_time_value: number              // dollars if flat, percent (0-100) if percent
  // Reference base for percent calculation
  implementation_fee: number          // e.g. 6000

  // Recurring monthly commission paid while client remains active.
  recurring_mode: CommissionMode
  recurring_value: number             // dollars/month if flat, percent if percent
  monthly_service_fee: number         // e.g. 600
  recurring_duration: RecurringDuration

  // Attribution window: how long a submitted lead remains attributed to the RA.
  attribution_window_days: number     // e.g. 30

  // Operational thresholds (agreement §6 + §7) — surfaced here so all numbers
  // referenced in the agreement and admin views live in one place.
  annual_minimum_referrals: number    // e.g. 4
  checkin_interval_days: number       // e.g. 90
  checkin_warning_days: number        // e.g. 90  (warning email at this point)
  checkin_suspension_days: number     // e.g. 150 (commission suspended at this point)

  // Versioning — bump when the underlying agreement terms change so existing
  // RAs are prompted to re-accept.
  agreement_version: string           // e.g. "v2.0"

  updated_at: string
}

export type Invitation = {
  id: string
  organization_id: string
  email: string
  full_name: string | null
  role: TeamRole
  invited_by: string | null
  created_at: string
}

export type Company = {
  id: string
  organization_id: string
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
  linkedin: string | null
  instagram: string | null
  twitter: string | null
  youtube: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export type Contact = {
  id: string
  organization_id: string
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
  linkedin: string | null
  twitter: string | null
  instagram: string | null
  youtube: string | null
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
  organization_id: string
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
  converted_company_id: string | null
  converted_contact_id: string | null
  converted_deal_id: string | null
  referred_by_ra_id: string | null
  attribution_expires_at: string | null
  prospect_intent: "learning" | "interested" | "sold" | null
  created_at: string
  updated_at: string
}

export type RaType = "individual" | "company"

export type RaLandingTemplate = {
  id: string
  organization_id: string
  name: string
  /** HTML body for the public /refer/:slug page. */
  html: string
  /** HTML body for the public /demo/:slug page. */
  demo_html: string
  is_default: boolean
  /** When set, this template is the org default for that RA type. */
  default_for_type: RaType | null
  created_at: string
  updated_at: string
}

export type Task = {
  id: string
  organization_id: string
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
  organization_id: string
  name: string
  position: number
  is_won: boolean
  is_lost: boolean
  created_at: string
}

export type Deal = {
  id: string
  organization_id: string
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
  organization_id: string
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
  organization_id: string
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
  organization_id: string
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
  organization_id: string
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
      documents: TableSchema<
        {
          id: string
          organization_id: string
          entity_type: string
          entity_id: string
          file_name: string
          file_size: number
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
          created_at: string
          description: string | null
        },
        {
          organization_id: string
          entity_type: string
          entity_id: string
          file_name: string
          file_size: number
          storage_path: string
          mime_type?: string | null
          uploaded_by?: string | null
          description?: string | null
        },
        Partial<{
          organization_id: string
          entity_type: string
          entity_id: string
          file_name: string
          file_size: number
          storage_path: string
          mime_type: string | null
          uploaded_by: string | null
          description: string | null
        }>
      >
      organizations: TableSchema<
        Organization,
        Pick<Organization, "name" | "slug"> & Partial<Pick<Organization, "logo_url">>,
        Partial<Organization>
      >
      organization_members: TableSchema<
        OrganizationMember,
        Pick<OrganizationMember, "organization_id" | "user_id" | "role">,
        Partial<OrganizationMember>
      >
      ra_associates: TableSchema<
        RaAssociate,
        Partial<RaAssociate> & Pick<RaAssociate, "organization_id" | "user_id" | "slug" | "display_name">,
        Partial<RaAssociate>
      >
      ra_landing_templates: TableSchema<
        RaLandingTemplate,
        Partial<RaLandingTemplate> & Pick<RaLandingTemplate, "organization_id" | "name">,
        Partial<RaLandingTemplate>
      >
    }
    Views: Record<string, never>
    Functions: {
      get_ra_landing_page: {
        Args: { p_slug: string }
        Returns: {
          slug:          string
          display_name:  string
          first_name:    string | null
          last_name:     string | null
          photo_url:     string | null
          contact_phone: string | null
          contact_email: string | null
          bio:           string | null
          is_active:     boolean
          template_html: string | null
          template_name: string | null
        }[]
      }
      record_ra_page_view: {
        Args: { p_slug: string; p_ip_hash?: string | null; p_user_agent?: string | null }
        Returns: void
      }
      record_ra_lead: {
        Args: {
          p_slug:       string
          p_first_name: string
          p_last_name?: string | null
          p_email?:     string | null
          p_phone?:     string | null
          p_company?:   string | null
          p_website?:   string | null
          p_message?:   string | null
        }
        Returns: string
      }
      get_ra_dashboard_stats: {
        Args: Record<string, never>
        Returns: { total_leads: number; active_leads: number; deals_closed: number }[]
      }
    }
    Enums: { activity_type: ActivityType; team_role: TeamRole }
    CompositeTypes: Record<string, never>
  }
}

// ── Organizations ────────────────────────────────────────────────────────────

export type Organization = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
}

export type OrganizationMember = {
  id: string
  organization_id: string
  user_id: string
  role: TeamRole
  created_at: string
  is_program_admin?: boolean
}

/** Organization with the current user's role in it — returned by listMyOrganizations */
export type OrgWithRole = Organization & { role: TeamRole }

// ── Documents ────────────────────────────────────────────────────────────────

export type EntityType = "account" | "deal" | "lead" | "task"

export type DocumentRecord = {
  id: string
  entity_type: EntityType
  entity_id: string
  file_name: string
  file_size: number
  mime_type: string | null
  storage_path: string
  uploaded_by: string | null
  created_at: string
  description: string | null
  /** Joined from profiles — populated by listDocuments / uploadDocument */
  uploader_name?: string | null
}
