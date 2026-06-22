import { supabase } from "@/lib/supabase"
import { calcOneTimeCommission, calcRecurringCommissionPerMonth } from "@/lib/commissions"
import type {
  Activity,
  ActivityType,
  CashflowTransaction,
  Company,
  Contact,
  Deal,
  DocumentRecord,
  EntityType,
  Lead,
  OrgWithRole,
  Partner,
  PipelineStage,
  Task,
  TeamMember,
  TeamRole,
  Vendor,
} from "@/types/db"

export const PREVIEW_DATA_MODE =
  import.meta.env.VITE_PREVIEW_MODE === "true"

const PREVIEW_MODE = PREVIEW_DATA_MODE

// ── Organization context ─────────────────────────────────────────────────────
// Set by OrganizationContext when the user selects their active org.
// All org-scoped queries filter by this ID automatically.
let _currentOrgId: string | null = PREVIEW_MODE ? "preview-org" : null

export function setCurrentOrg(orgId: string | null): void {
  _currentOrgId = orgId
}

export function getCurrentOrg(): string | null {
  return _currentOrgId
}

function requireOrg(): string {
  if (_currentOrgId) return _currentOrgId
  if (PREVIEW_MODE) return "preview-org"
  throw new Error("No organization selected")
}

const MOCK_DATA_VERSION = "v3"
;(() => {
  if (typeof localStorage === "undefined") return
  const key = "avanew-crm.mock.version"
  if (localStorage.getItem(key) !== MOCK_DATA_VERSION) {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("avanew-crm.mock."))
      .forEach((k) => localStorage.removeItem(k))
    localStorage.setItem(key, MOCK_DATA_VERSION)
  }
})()

// ───────────────────────────────────────────────────────────────────────────
// localStorage-backed mock store (used when VITE_PREVIEW_MODE=true)
// Tables seed themselves with sample rows on first read.
// ───────────────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString()
}

function newId() {
  return crypto.randomUUID()
}

function mockKey(table: string) {
  return `avanew-crm.mock.${table}`
}

function loadMock<T>(table: string, seed: () => T[]): T[] {
  try {
    const raw = localStorage.getItem(mockKey(table))
    if (raw) return JSON.parse(raw) as T[]
  } catch {
    /* ignore */
  }
  const initial = seed()
  saveMock(table, initial)
  return initial
}

function saveMock<T>(table: string, rows: T[]) {
  try {
    localStorage.setItem(mockKey(table), JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Owner-based scoping
// BD and Partner roles see only the records they own (owner_id = their id).
// Admin / Owner / Super User see everything.
// In production this is enforced by RLS; the client-side filter below is for
// preview mode only (where there's no real auth).
// ───────────────────────────────────────────────────────────────────────────

const VIEW_AS_KEY = "avanew-crm.view-as-role"

function previewContext(): { userId: string; role: TeamRole; scoping: boolean } {
  let viewAs: TeamRole | null = null
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem(VIEW_AS_KEY)
    if (v === "owner" || v === "admin" || v === "bd" || v === "partner" || v === "super_user") {
      viewAs = v
    }
  }
  const role: TeamRole = viewAs ?? "super_user"
  return {
    userId: `preview-${role}`,
    role,
    scoping: role === "bd" || role === "partner",
  }
}

function previewFilterByOwner<T extends { owner_id: string | null }>(rows: T[]): T[] {
  const ctx = previewContext()
  if (!ctx.scoping) return rows
  return rows.filter((r) => r.owner_id === ctx.userId)
}

function previewOwnerForCreate(inputOwnerId: string | null | undefined): string | null {
  if (inputOwnerId) return inputOwnerId
  const ctx = previewContext()
  return ctx.scoping ? ctx.userId : null
}

// Returns the active "View As" role from localStorage if it scopes data
// (BD or Partner). Used in production to client-side filter Supabase results
// when a Super User is simulating a limited role.
function viewAsScopingRole(): "bd" | "partner" | null {
  if (typeof localStorage === "undefined") return null
  const v = localStorage.getItem(VIEW_AS_KEY)
  return v === "bd" || v === "partner" ? v : null
}

// Cached auth user id so we don't hit getUser on every list call.
let cachedUserId: string | null | undefined = undefined
async function getCurrentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId
  const { data } = await supabase.auth.getUser()
  cachedUserId = data.user?.id ?? null
  return cachedUserId
}

// Production: when a Super User is "Viewing As" BD/Partner, filter results
// client-side to only rows owned by the current user. This simulates how a
// real BD/Partner would see the data (RLS-enforced for actual BD/Partner accounts).
async function applyViewAsFilter<T extends { owner_id: string | null }>(rows: T[]): Promise<T[]> {
  if (PREVIEW_MODE) return rows
  if (!viewAsScopingRole()) return rows
  const uid = await getCurrentUserId()
  if (!uid) return rows
  return rows.filter((r) => r.owner_id === uid)
}

async function ensureOwnerForCreate(
  inputOwnerId: string | null | undefined
): Promise<string | null> {
  if (PREVIEW_MODE) return previewOwnerForCreate(inputOwnerId)
  if (inputOwnerId) return inputOwnerId
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  // View-as override: Super User simulating BD/Partner → assign self as owner
  // so the simulated role can see the record they just created.
  if (viewAsScopingRole()) return data.user.id
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()
  const role = profile?.role as TeamRole | null
  if (role === "bd" || role === "partner") return data.user.id
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Sample data
// ───────────────────────────────────────────────────────────────────────────

const COMPANY_EXTRA_NULLS = {
  phone: null, fax: null, website: null, ticker_symbol: null,
  ownership: null, employees: null, sic_code: null, rating: null,
  account_type: null, account_number: null, account_site: null, annual_revenue: null,
  billing_street: null, billing_city: null, billing_state: null,
  billing_zip: null, billing_country: null,
  shipping_street: null, shipping_city: null, shipping_state: null,
  shipping_zip: null, shipping_country: null,
  linkedin: null, instagram: null, twitter: null, youtube: null,
  description: null,
}

function seedCompanies(): Company[] {
  const t = nowIso()
  return [
    { id: "c-acme", organization_id: "preview-org", name: "Acme Robotics", domain: "acme-robotics.com", industry: "Manufacturing", notes: null, owner_id: null, ...COMPANY_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "c-northwind", organization_id: "preview-org", name: "Northwind Capital", domain: "northwindcap.com", industry: "Finance", notes: null, owner_id: null, ...COMPANY_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "c-helix", organization_id: "preview-org", name: "Helix Bio", domain: "helixbio.io", industry: "Biotech", notes: null, owner_id: null, ...COMPANY_EXTRA_NULLS, created_at: t, updated_at: t },
  ]
}

const CONTACT_EXTRA_NULLS = {
  mobile: null, fax: null, website: null, secondary_email: null,
  linkedin: null, twitter: null, instagram: null, youtube: null,
  skype_id: null, email_opt_out: false as boolean, date_of_birth: null,
  assistant: null, asst_phone: null, department: null, lead_source: null,
  description: null,
  mailing_street: null, mailing_city: null, mailing_state: null, mailing_zip: null, mailing_country: null,
  other_street: null, other_city: null, other_state: null, other_zip: null, other_country: null,
}

function seedContacts(): Contact[] {
  const t = nowIso()
  return [
    { id: "ct-maya", organization_id: "preview-org", first_name: "Maya", last_name: "Reyes", email: "maya.reyes@acme-robotics.com", phone: "+1 415 555 0142", title: "VP of Operations", company_id: "c-acme", owner_id: null, notes: "Met at the Robotics Summit. Interested in pilot program.", ...CONTACT_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "ct-jonas", organization_id: "preview-org", first_name: "Jonas", last_name: "Becker", email: "jonas@northwindcap.com", phone: "+1 212 555 0188", title: "Director, Investments", company_id: "c-northwind", owner_id: null, notes: null, ...CONTACT_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "ct-priya", organization_id: "preview-org", first_name: "Priya", last_name: "Shah", email: "priya.shah@helixbio.io", phone: null, title: "Head of BD", company_id: "c-helix", owner_id: null, notes: "Wants demo of avatar studio next quarter.", ...CONTACT_EXTRA_NULLS, created_at: t, updated_at: t },
  ]
}

function seedStages(): PipelineStage[] {
  const t = nowIso()
  return [
    { id: "s-new", organization_id: "preview-org", name: "New", position: 1, is_won: false, is_lost: false, created_at: t },
    { id: "s-lead", organization_id: "preview-org", name: "Lead", position: 2, is_won: false, is_lost: false, created_at: t },
    { id: "s-qualified", organization_id: "preview-org", name: "Qualified", position: 3, is_won: false, is_lost: false, created_at: t },
    { id: "s-proposal", organization_id: "preview-org", name: "Proposal", position: 4, is_won: false, is_lost: false, created_at: t },
    { id: "s-negotiation", organization_id: "preview-org", name: "Negotiation", position: 5, is_won: false, is_lost: false, created_at: t },
    { id: "s-won", organization_id: "preview-org", name: "Won", position: 6, is_won: true, is_lost: false, created_at: t },
    { id: "s-lost", organization_id: "preview-org", name: "Lost", position: 7, is_won: false, is_lost: true, created_at: t },
  ]
}

function seedDeals(): Deal[] {
  const t = nowIso()
  return [
    {
      id: "d-acme-pilot",
      organization_id: "preview-org",
      title: "Acme — Avatar Studio pilot",
      amount: 24000,
      currency: "USD",
      stage_id: "s-qualified",
      contact_id: "ct-maya",
      company_id: "c-acme",
      owner_id: null,
      partner_id: "partner-acme",
      expected_close_date: null,
      closed_at: null,
      position: 0,
      type: null,
      next_step: null,
      lead_source: null,
      probability: null,
      campaign_source: null,
      description: null,
      created_at: t,
      updated_at: t,
    },
    {
      id: "d-northwind-onboarding",
      organization_id: "preview-org",
      title: "Northwind — Q1 onboarding",
      amount: 48000,
      currency: "USD",
      stage_id: "s-proposal",
      contact_id: "ct-jonas",
      company_id: "c-northwind",
      owner_id: null,
      partner_id: "partner-northwind",
      expected_close_date: null,
      closed_at: null,
      position: 0,
      type: null,
      next_step: null,
      lead_source: null,
      probability: null,
      campaign_source: null,
      description: null,
      created_at: t,
      updated_at: t,
    },
    {
      id: "d-helix-demo",
      organization_id: "preview-org",
      title: "Helix Bio — multi-seat license",
      amount: 12000,
      currency: "USD",
      stage_id: "s-lead",
      contact_id: "ct-priya",
      company_id: "c-helix",
      owner_id: null,
      partner_id: null,
      expected_close_date: null,
      closed_at: null,
      position: 0,
      type: null,
      next_step: null,
      lead_source: null,
      probability: null,
      campaign_source: null,
      description: null,
      created_at: t,
      updated_at: t,
    },
  ]
}

function seedActivities(): Activity[] {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  return [
    {
      id: newId(),
      organization_id: "preview-org",
      type: "meeting",
      subject: "Discovery call with Maya",
      body: "Walked through the Avatar Studio feature. Maya wants to involve her CTO next.",
      contact_id: "ct-maya",
      company_id: "c-acme",
      deal_id: "d-acme-pilot",
      owner_id: null,
      due_at: null,
      completed_at: new Date(now - 2 * day).toISOString(),
      created_at: new Date(now - 2 * day).toISOString(),
    },
    {
      id: newId(),
      organization_id: "preview-org",
      type: "email",
      subject: "Sent proposal to Northwind",
      body: "Q1 onboarding proposal — 50 seats, white-glove rollout.",
      contact_id: "ct-jonas",
      company_id: "c-northwind",
      deal_id: "d-northwind-onboarding",
      owner_id: null,
      due_at: null,
      completed_at: new Date(now - 1 * day).toISOString(),
      created_at: new Date(now - 1 * day).toISOString(),
    },
    {
      id: newId(),
      organization_id: "preview-org",
      type: "task",
      subject: "Follow up with Helix Bio",
      body: "Confirm timeline for multi-seat license.",
      contact_id: "ct-priya",
      company_id: "c-helix",
      deal_id: "d-helix-demo",
      owner_id: null,
      due_at: new Date(now + 2 * day).toISOString(),
      completed_at: null,
      created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: newId(),
      organization_id: "preview-org",
      type: "note",
      subject: "Acme: budget approved",
      body: "Heard from Maya — board approved the pilot budget.",
      contact_id: "ct-maya",
      company_id: "c-acme",
      deal_id: "d-acme-pilot",
      owner_id: null,
      due_at: null,
      completed_at: null,
      created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    },
  ]
}

// ───────────────────────────────────────────────────────────────────────────
// Companies
// ───────────────────────────────────────────────────────────────────────────

export type CompanyInput = {
  name: string
  domain?: string | null
  industry?: string | null
  notes?: string | null
  phone?: string | null
  fax?: string | null
  website?: string | null
  ticker_symbol?: string | null
  ownership?: string | null
  employees?: number | null
  sic_code?: string | null
  rating?: string | null
  account_type?: string | null
  account_number?: string | null
  account_site?: string | null
  annual_revenue?: number | null
  billing_street?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_zip?: string | null
  billing_country?: string | null
  shipping_street?: string | null
  shipping_city?: string | null
  shipping_state?: string | null
  shipping_zip?: string | null
  shipping_country?: string | null
  linkedin?: string | null
  instagram?: string | null
  twitter?: string | null
  youtube?: string | null
  description?: string | null
}

export async function listCompanies(): Promise<Company[]> {
  if (PREVIEW_MODE) {
    const rows = previewFilterByOwner(loadMock<Company>("companies", seedCompanies))
    return [...rows].sort((a, b) => a.name.localeCompare(b.name))
  }
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("name", { ascending: true })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  const owner_id = await ensureOwnerForCreate(
    (input as CompanyInput & { owner_id?: string | null }).owner_id
  )
  if (PREVIEW_MODE) {
    const row: Company = {
      id: newId(),
      organization_id: "preview-org",
      name: input.name,
      domain: input.domain ?? null,
      industry: input.industry ?? null,
      notes: input.notes ?? null,
      owner_id,
      phone: input.phone ?? null,
      fax: input.fax ?? null,
      website: input.website ?? null,
      ticker_symbol: input.ticker_symbol ?? null,
      ownership: input.ownership ?? null,
      employees: input.employees ?? null,
      sic_code: input.sic_code ?? null,
      rating: input.rating ?? null,
      account_type: input.account_type ?? null,
      account_number: input.account_number ?? null,
      account_site: input.account_site ?? null,
      annual_revenue: input.annual_revenue ?? null,
      billing_street: input.billing_street ?? null,
      billing_city: input.billing_city ?? null,
      billing_state: input.billing_state ?? null,
      billing_zip: input.billing_zip ?? null,
      billing_country: input.billing_country ?? null,
      shipping_street: input.shipping_street ?? null,
      shipping_city: input.shipping_city ?? null,
      shipping_state: input.shipping_state ?? null,
      shipping_zip: input.shipping_zip ?? null,
      shipping_country: input.shipping_country ?? null,
      linkedin: input.linkedin ?? null,
      instagram: input.instagram ?? null,
      twitter: input.twitter ?? null,
      youtube: input.youtube ?? null,
      description: input.description ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const rows = loadMock<Company>("companies", seedCompanies)
    saveMock("companies", [row, ...rows])
    return row
  }
  const { data, error } = await supabase
    .from("companies")
    .insert({ ...input, owner_id, organization_id: requireOrg() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCompany(
  id: string,
  input: CompanyInput
): Promise<Company> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Company>("companies", seedCompanies)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Company not found")
    const updated: Company = {
      ...rows[idx],
      name: input.name,
      domain: input.domain ?? null,
      industry: input.industry ?? null,
      notes: input.notes ?? null,
      phone: input.phone ?? null,
      fax: input.fax ?? null,
      website: input.website ?? null,
      ticker_symbol: input.ticker_symbol ?? null,
      ownership: input.ownership ?? null,
      employees: input.employees ?? null,
      sic_code: input.sic_code ?? null,
      rating: input.rating ?? null,
      account_type: input.account_type ?? null,
      account_number: input.account_number ?? null,
      account_site: input.account_site ?? null,
      annual_revenue: input.annual_revenue ?? null,
      billing_street: input.billing_street ?? null,
      billing_city: input.billing_city ?? null,
      billing_state: input.billing_state ?? null,
      billing_zip: input.billing_zip ?? null,
      billing_country: input.billing_country ?? null,
      shipping_street: input.shipping_street ?? null,
      shipping_city: input.shipping_city ?? null,
      shipping_state: input.shipping_state ?? null,
      shipping_zip: input.shipping_zip ?? null,
      shipping_country: input.shipping_country ?? null,
      linkedin: input.linkedin ?? null,
      instagram: input.instagram ?? null,
      twitter: input.twitter ?? null,
      youtube: input.youtube ?? null,
      description: input.description ?? null,
      updated_at: nowIso(),
    }
    rows[idx] = updated
    saveMock("companies", rows)
    return updated
  }
  const { data, error } = await supabase
    .from("companies")
    .update({ ...input, updated_at: nowIso() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCompany(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Company>("companies", seedCompanies)
    saveMock("companies", rows.filter((r) => r.id !== id))
    // Detach contacts and deals from this company
    const contacts = loadMock<Contact>("contacts", seedContacts)
    saveMock(
      "contacts",
      contacts.map((c) => (c.company_id === id ? { ...c, company_id: null } : c))
    )
    const deals = loadMock<Deal>("deals", seedDeals)
    saveMock(
      "deals",
      deals.map((d) => (d.company_id === id ? { ...d, company_id: null } : d))
    )
    return
  }
  const { error } = await supabase.from("companies").delete().eq("id", id)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Contacts
// ───────────────────────────────────────────────────────────────────────────

export type ContactInput = {
  first_name: string
  last_name?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  company_id?: string | null
  notes?: string | null
  mobile?: string | null
  fax?: string | null
  website?: string | null
  secondary_email?: string | null
  linkedin?: string | null
  twitter?: string | null
  instagram?: string | null
  youtube?: string | null
  skype_id?: string | null
  email_opt_out?: boolean
  date_of_birth?: string | null
  assistant?: string | null
  asst_phone?: string | null
  department?: string | null
  lead_source?: string | null
  description?: string | null
  mailing_street?: string | null
  mailing_city?: string | null
  mailing_state?: string | null
  mailing_zip?: string | null
  mailing_country?: string | null
  other_street?: string | null
  other_city?: string | null
  other_state?: string | null
  other_zip?: string | null
  other_country?: string | null
}

export async function listContacts(): Promise<Contact[]> {
  if (PREVIEW_MODE) {
    const rows = previewFilterByOwner(loadMock<Contact>("contacts", seedContacts))
    return [...rows].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("created_at", { ascending: false })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const owner_id = await ensureOwnerForCreate(
    (input as ContactInput & { owner_id?: string | null }).owner_id
  )
  if (PREVIEW_MODE) {
    const row: Contact = {
      id: newId(),
      organization_id: "preview-org",
      first_name: input.first_name,
      last_name: input.last_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      company_id: input.company_id ?? null,
      owner_id,
      notes: input.notes ?? null,
      mobile: input.mobile ?? null,
      fax: input.fax ?? null,
      website: input.website ?? null,
      secondary_email: input.secondary_email ?? null,
      linkedin: input.linkedin ?? null,
      twitter: input.twitter ?? null,
      instagram: input.instagram ?? null,
      youtube: input.youtube ?? null,
      skype_id: input.skype_id ?? null,
      email_opt_out: input.email_opt_out ?? false,
      date_of_birth: input.date_of_birth ?? null,
      assistant: input.assistant ?? null,
      asst_phone: input.asst_phone ?? null,
      department: input.department ?? null,
      lead_source: input.lead_source ?? null,
      description: input.description ?? null,
      mailing_street: input.mailing_street ?? null,
      mailing_city: input.mailing_city ?? null,
      mailing_state: input.mailing_state ?? null,
      mailing_zip: input.mailing_zip ?? null,
      mailing_country: input.mailing_country ?? null,
      other_street: input.other_street ?? null,
      other_city: input.other_city ?? null,
      other_state: input.other_state ?? null,
      other_zip: input.other_zip ?? null,
      other_country: input.other_country ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const rows = loadMock<Contact>("contacts", seedContacts)
    saveMock("contacts", [row, ...rows])
    return row
  }
  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...input, owner_id, organization_id: requireOrg() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContact(
  id: string,
  input: ContactInput
): Promise<Contact> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Contact>("contacts", seedContacts)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Contact not found")
    const updated: Contact = {
      ...rows[idx],
      ...input,
      last_name: input.last_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      title: input.title ?? null,
      company_id: input.company_id ?? null,
      notes: input.notes ?? null,
      updated_at: nowIso(),
    }
    rows[idx] = updated
    saveMock("contacts", rows)
    return updated
  }
  const { data, error } = await supabase
    .from("contacts")
    .update({ ...input, updated_at: nowIso() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteContact(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Contact>("contacts", seedContacts)
    saveMock("contacts", rows.filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("contacts").delete().eq("id", id)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Pipeline stages
// ───────────────────────────────────────────────────────────────────────────

export type StageInput = {
  name: string
  is_won?: boolean
  is_lost?: boolean
}

export async function listStages(): Promise<PipelineStage[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<PipelineStage>("pipeline_stages", seedStages)
    return [...rows].sort((a, b) => a.position - b.position)
  }
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("position", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createStage(input: StageInput): Promise<PipelineStage> {
  if (PREVIEW_MODE) {
    const rows = loadMock<PipelineStage>("pipeline_stages", seedStages)
    const maxPos = rows.reduce((m, r) => Math.max(m, r.position), 0)
    const row: PipelineStage = {
      id: newId(),
      organization_id: "preview-org",
      name: input.name,
      position: maxPos + 1,
      is_won: input.is_won ?? false,
      is_lost: input.is_lost ?? false,
      created_at: nowIso(),
    }
    saveMock("pipeline_stages", [...rows, row])
    return row
  }
  const { data: max } = await supabase
    .from("pipeline_stages")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPos = (max?.position ?? 0) + 1
  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({ ...input, position: nextPos, organization_id: requireOrg() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStage(
  id: string,
  input: Partial<StageInput> & { position?: number }
): Promise<PipelineStage> {
  if (PREVIEW_MODE) {
    const rows = loadMock<PipelineStage>("pipeline_stages", seedStages)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Stage not found")
    rows[idx] = { ...rows[idx], ...input }
    saveMock("pipeline_stages", rows)
    return rows[idx]
  }
  const { data, error } = await supabase
    .from("pipeline_stages")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStage(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<PipelineStage>("pipeline_stages", seedStages)
    if (rows.length <= 1) throw new Error("You need at least one stage")
    const remaining = rows.filter((r) => r.id !== id)
    // Renumber positions
    remaining.forEach((s, i) => (s.position = i + 1))
    saveMock("pipeline_stages", remaining)
    // Move any deals in this stage to the first remaining stage
    const fallback = remaining[0]
    const deals = loadMock<Deal>("deals", seedDeals)
    saveMock(
      "deals",
      deals.map((d) =>
        d.stage_id === id ? { ...d, stage_id: fallback.id } : d
      )
    )
    return
  }
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id)
  if (error) throw error
}

export async function reorderStages(orderedIds: string[]): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<PipelineStage>("pipeline_stages", seedStages)
    const map = new Map(rows.map((r) => [r.id, r]))
    const next = orderedIds
      .map((id, i) => {
        const stage = map.get(id)
        if (!stage) return null
        return { ...stage, position: i + 1 }
      })
      .filter((s): s is PipelineStage => s !== null)
    saveMock("pipeline_stages", next)
    return
  }
  // Production: bulk update positions
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("pipeline_stages").update({ position: i + 1 }).eq("id", id)
    )
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Deals
// ───────────────────────────────────────────────────────────────────────────

export type DealInput = {
  title: string
  amount?: number | null
  currency?: string
  stage_id: string
  contact_id?: string | null
  company_id?: string | null
  owner_id?: string | null
  partner_id?: string | null
  expected_close_date?: string | null
  type?: string | null
  next_step?: string | null
  lead_source?: string | null
  probability?: number | null
  campaign_source?: string | null
  description?: string | null
}

export async function listDeals(): Promise<Deal[]> {
  if (PREVIEW_MODE) {
    return previewFilterByOwner(loadMock<Deal>("deals", seedDeals))
  }
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("position", { ascending: true })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function createDeal(input: DealInput): Promise<Deal> {
  const owner_id = await ensureOwnerForCreate(input.owner_id)
  if (PREVIEW_MODE) {
    const rows = loadMock<Deal>("deals", seedDeals)
    const maxPos = rows
      .filter((d) => d.stage_id === input.stage_id)
      .reduce((m, d) => Math.max(m, d.position), -1)
    const row: Deal = {
      id: newId(),
      organization_id: "preview-org",
      title: input.title,
      amount: input.amount ?? null,
      currency: input.currency ?? "USD",
      stage_id: input.stage_id,
      contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null,
      owner_id,
      partner_id: input.partner_id ?? null,
      expected_close_date: input.expected_close_date ?? null,
      closed_at: null,
      position: maxPos + 1,
      type: input.type ?? null,
      next_step: input.next_step ?? null,
      lead_source: input.lead_source ?? null,
      probability: input.probability ?? null,
      campaign_source: input.campaign_source ?? null,
      description: input.description ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    saveMock("deals", [...rows, row])
    return row
  }
  const { data, error } = await supabase
    .from("deals")
    .insert({ ...input, owner_id, organization_id: requireOrg() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDeal(id: string, input: DealInput): Promise<Deal> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Deal>("deals", seedDeals)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Deal not found")
    rows[idx] = {
      ...rows[idx],
      title: input.title,
      amount: input.amount ?? null,
      currency: input.currency ?? "USD",
      stage_id: input.stage_id,
      contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null,
      owner_id: input.owner_id ?? rows[idx].owner_id,
      partner_id: input.partner_id ?? null,
      expected_close_date: input.expected_close_date ?? null,
      type: input.type ?? null,
      next_step: input.next_step ?? null,
      lead_source: input.lead_source ?? null,
      probability: input.probability ?? null,
      campaign_source: input.campaign_source ?? null,
      description: input.description ?? null,
      updated_at: nowIso(),
    }
    saveMock("deals", rows)
    return rows[idx]
  }
  const { data, error } = await supabase
    .from("deals")
    .update({ ...input, updated_at: nowIso() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDeal(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Deal>("deals", seedDeals)
    saveMock("deals", rows.filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("deals").delete().eq("id", id)
  if (error) throw error
}

/**
 * Move a deal to a new stage and/or position within a stage.
 * Caller passes the full ordered list of deal ids in the destination stage,
 * after the move is applied — that way we just persist that ordering.
 */
export async function moveDeal(
  dealId: string,
  toStageId: string,
  destOrderedIds: string[]
): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Deal>("deals", seedDeals)
    const map = new Map(rows.map((r) => [r.id, r]))
    const deal = map.get(dealId)
    if (!deal) throw new Error("Deal not found")
    deal.stage_id = toStageId
    destOrderedIds.forEach((id, i) => {
      const d = map.get(id)
      if (d) d.position = i
    })
    saveMock("deals", Array.from(map.values()))
    return
  }
  await supabase
    .from("deals")
    .update({ stage_id: toStageId, updated_at: nowIso() })
    .eq("id", dealId)
  await Promise.all(
    destOrderedIds.map((id, i) =>
      supabase.from("deals").update({ position: i }).eq("id", id)
    )
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Activities
// ───────────────────────────────────────────────────────────────────────────

export type ActivityInput = {
  type: ActivityType
  subject: string
  body?: string | null
  contact_id?: string | null
  company_id?: string | null
  deal_id?: string | null
  due_at?: string | null
  completed_at?: string | null
}

export async function listActivities(): Promise<Activity[]> {
  if (PREVIEW_MODE) {
    const rows = previewFilterByOwner(loadMock<Activity>("activities", seedActivities))
    return [...rows].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("created_at", { ascending: false })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function createActivity(input: ActivityInput): Promise<Activity> {
  const owner_id = await ensureOwnerForCreate(
    (input as ActivityInput & { owner_id?: string | null }).owner_id
  )
  if (PREVIEW_MODE) {
    const row: Activity = {
      id: newId(),
      organization_id: "preview-org",
      type: input.type,
      subject: input.subject,
      body: input.body ?? null,
      contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null,
      deal_id: input.deal_id ?? null,
      owner_id,
      due_at: input.due_at ?? null,
      completed_at: input.completed_at ?? null,
      created_at: nowIso(),
    }
    const rows = loadMock<Activity>("activities", seedActivities)
    saveMock("activities", [row, ...rows])
    return row
  }
  const { data, error } = await supabase
    .from("activities")
    .insert({ ...input, owner_id, organization_id: requireOrg() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateActivity(
  id: string,
  input: Partial<ActivityInput>
): Promise<Activity> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Activity>("activities", seedActivities)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Activity not found")
    rows[idx] = { ...rows[idx], ...input }
    saveMock("activities", rows)
    return rows[idx]
  }
  const { data, error } = await supabase
    .from("activities")
    .update(input)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteActivity(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Activity>("activities", seedActivities)
    saveMock("activities", rows.filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("activities").delete().eq("id", id)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Profile (current user)
// ───────────────────────────────────────────────────────────────────────────

export type ProfileLite = {
  full_name: string | null
  email: string | null
  phone: string | null
  job_title: string | null
  avatar_url: string | null
}

export async function getMyProfile(): Promise<ProfileLite> {
  if (PREVIEW_MODE) {
    try {
      const raw = localStorage.getItem("avanew-crm.mock.profile")
      if (raw) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return { full_name: "Preview User", email: "preview@avanew.ai", phone: null, job_title: null, avatar_url: null }
  }
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { full_name: null, email: null, phone: null, job_title: null, avatar_url: null }
  const meta = user.user_metadata as { full_name?: string; phone?: string; job_title?: string } | undefined
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle()
  return {
    full_name: data?.full_name ?? meta?.full_name ?? null,
    email: user.email ?? null,
    phone: meta?.phone ?? null,
    job_title: meta?.job_title ?? null,
    avatar_url: (data?.avatar_url as string | null) ?? null,
  }
}

export async function updateMyProfile(input: {
  full_name: string
  phone?: string
  job_title?: string
  avatar_url?: string
}): Promise<void> {
  if (PREVIEW_MODE) {
    const cur = await getMyProfile()
    const next: ProfileLite = {
      ...cur,
      full_name: input.full_name,
      phone: input.phone ?? cur.phone,
      job_title: input.job_title ?? cur.job_title,
      avatar_url: input.avatar_url ?? cur.avatar_url,
    }
    try {
      localStorage.setItem("avanew-crm.mock.profile", JSON.stringify(next))
    } catch {
      /* ignore */
    }
    return
  }
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error("Not signed in")
  const profileUpdate: { full_name: string; avatar_url?: string } = { full_name: input.full_name }
  if (input.avatar_url !== undefined) profileUpdate.avatar_url = input.avatar_url
  const { error } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id)
  if (error) throw error
  await supabase.auth.updateUser({
    data: {
      full_name: input.full_name,
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.job_title !== undefined && { job_title: input.job_title }),
    },
  })
}

// ───────────────────────────────────────────────────────────────────────────
// Team members (users + roles)
//
// Production note:
//   - Reading is straightforward (profiles + invitations rows).
//   - Inviting / removing requires the Supabase admin API, which uses the
//     service-role key. That key MUST live server-side, so we route those
//     calls through a Supabase Edge Function — see
//     supabase/functions/invite-user/index.ts for a template.
// ───────────────────────────────────────────────────────────────────────────

export type InviteInput = {
  email: string
  full_name?: string | null
  role: TeamRole
}

function seedTeamMembers(): TeamMember[] {
  return [
    {
      id: "tm-self",
      email: "you@avanew.ai",
      full_name: "Preview User",
      role: "admin",
      status: "active",
      created_at: nowIso(),
    },
  ]
}

function roleSortKey(role: TeamRole) {
  return role === "super_user" ? 0 : role === "owner" ? 1 : role === "admin" ? 2 : role === "bd" ? 3 : 4
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<TeamMember>("team_members", seedTeamMembers)
    return [...rows].sort((a, b) => {
      const r = roleSortKey(a.role) - roleSortKey(b.role)
      if (r !== 0) return r
      return a.email.localeCompare(b.email)
    })
  }
  const orgId = requireOrg()
  const [{ data: members, error: mErr }, { data: invites, error: iErr }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("user_id, role, created_at, is_program_admin, profiles(id, full_name, email)")
        .eq("organization_id", orgId)
        // RAs are managed exclusively on the Referral Associates tab; never
        // surface them here as Admins via the ROLE_META fallback. Cast through
        // unknown because TeamRole locally excludes the RA role even though
        // the DB enum carries it.
        .neq("role", "referral_associate" as unknown as TeamRole)
        .order("created_at", { ascending: true }),
      supabase
        .from("invitations")
        .select("id, email, full_name, role, created_at")
        .eq("organization_id", orgId)
        .neq("role", "referral_associate" as unknown as TeamRole)
        .order("created_at", { ascending: true }),
    ])
  if (mErr) throw mErr
  if (iErr) throw iErr
  type OrgMemberRow = { user_id: string; role: string; created_at: string; is_program_admin: boolean | null; profiles: { id: string; full_name: string | null; email: string | null } | null }
  const active: TeamMember[] = ((members ?? []) as unknown as OrgMemberRow[]).map((m) => {
    const profile = m.profiles
    return {
      id: profile?.id ?? m.user_id,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
      role: m.role as TeamRole,
      status: "active" as const,
      created_at: m.created_at,
      is_program_admin: Boolean(m.is_program_admin),
    }
  })
  const pending: TeamMember[] = (invites ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    full_name: (i.full_name as string | null) ?? null,
    role: i.role as TeamRole,
    status: "invited" as const,
    created_at: i.created_at as string,
  }))
  return [...active, ...pending].sort((a, b) => {
    const r = roleSortKey(a.role) - roleSortKey(b.role)
    if (r !== 0) return r
    return a.email.localeCompare(b.email)
  })
}

export async function inviteTeamMember(
  input: InviteInput
): Promise<TeamMember> {
  const email = input.email.trim().toLowerCase()
  const full_name = input.full_name?.trim() || null

  if (PREVIEW_MODE) {
    const rows = loadMock<TeamMember>("team_members", seedTeamMembers)
    if (rows.some((r) => r.email.toLowerCase() === email)) {
      throw new Error("That email is already on the team")
    }
    const row: TeamMember = {
      id: newId(),
      email,
      full_name,
      role: input.role,
      status: "invited",
      created_at: nowIso(),
    }
    saveMock("team_members", [...rows, row])
    return row
  }
  // Production: invoke Edge Function. The function uses the service-role key
  // to call supabase.auth.admin.inviteUserByEmail() and write the role.
  const { data, error } = await supabase.functions.invoke<TeamMember>(
    "invite-user",
    { body: { email, full_name, role: input.role, organization_id: requireOrg(), redirect_to: `${window.location.origin}/setup-account` } }
  )
  if (error) throw error
  if (!data) throw new Error("Invite returned no data")
  return data
}

export async function updateTeamMemberRole(
  id: string,
  role: TeamRole,
  status: TeamMember["status"] = "active"
): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<TeamMember>("team_members", seedTeamMembers)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Member not found")
    if (rows[idx].role === "admin" && role !== "admin") {
      const adminCount = rows.filter(
        (r) => r.role === "admin" && r.status === "active"
      ).length
      if (adminCount <= 1) throw new Error("Need at least one admin")
    }
    rows[idx] = { ...rows[idx], role }
    saveMock("team_members", rows)
    return
  }
  if (status === "invited") {
    const { error } = await supabase
      .from("invitations")
      .update({ role })
      .eq("id", id)
    if (error) throw error
    return
  }
  // Active member: update their role in organization_members. The
  // enforce_program_admin_role trigger requires is_program_admin=true only on
  // role='admin'; clear the flag in the same update when moving away from admin
  // so we don't hit the trigger error.
  const patch: { role: TeamRole; is_program_admin?: boolean } =
    role === "admin" ? { role } : { role, is_program_admin: false }
  const { error } = await supabase
    .from("organization_members")
    .update(patch)
    .eq("organization_id", requireOrg())
    .eq("user_id", id)
  if (error) throw error
}

export async function removeTeamMember(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    const rows = loadMock<TeamMember>("team_members", seedTeamMembers)
    const target = rows.find((r) => r.id === id)
    if (!target) return
    if (target.role === "admin" && target.status === "active") {
      const adminCount = rows.filter(
        (r) => r.role === "admin" && r.status === "active"
      ).length
      if (adminCount <= 1) {
        throw new Error("Can't remove the only admin")
      }
    }
    saveMock(
      "team_members",
      rows.filter((r) => r.id !== id)
    )
    return
  }
  // Pending invites: delete from invitations (scoped to org so we don't
  // accidentally drop an invite that belongs to another org for the same email).
  const orgId = requireOrg()
  const { count } = await supabase
    .from("invitations")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("organization_id", orgId)
  if (count && count > 0) return
  // Active members: revoke org membership only (Edge Function reassigns this
  // user's records to the caller and deletes the organization_members row).
  // The auth user is intentionally preserved so they keep access to any
  // other orgs they belong to, and password reset still works.
  const { error } = await supabase.functions.invoke("remove-user", {
    body: { user_id: id, organization_id: orgId },
  })
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Referral Associates
// ───────────────────────────────────────────────────────────────────────────

export function generateRaSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    || "ra"
}

export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (PREVIEW_MODE) return true
  const { data } = await supabase
    .from("ra_associates")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()
  return !data
}

export async function listRaAssociates(): Promise<import("@/types/db").RaAssociate[]> {
  if (PREVIEW_MODE) return listPreviewRaAssociates()
  const { data, error } = await supabase
    .from("ra_associates")
    .select(`
      *,
      profiles!ra_associates_user_id_fkey (
        email,
        full_name
      )
    `)
    .eq("organization_id", requireOrg())
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as { email: string; full_name: string | null } | null
    const { profiles: _p, ...rest } = row
    return {
      ...rest,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
    } as import("@/types/db").RaAssociate
  })
}

// ── RA self-service data functions ──────────────────────────────────────────

/** Fetch the current user's own RA associate record (includes all fields). */
export async function getRaAssociate(): Promise<import("@/types/db").RaAssociate | null> {
  if (PREVIEW_MODE) return getPreviewRaAssociate()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("ra_associates")
    .select(`
      *,
      profiles!ra_associates_user_id_fkey (
        email,
        full_name
      )
    `)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const profile = (data as Record<string, unknown>).profiles as { email: string; full_name: string | null } | null
  const { profiles: _p, ...rest } = data as Record<string, unknown>
  return {
    ...rest,
    email: profile?.email ?? "",
    full_name: profile?.full_name ?? null,
  } as import("@/types/db").RaAssociate
}

/**
 * Determines whether the signed-in user belongs in the RA portal rather than
 * the staff CRM. Returns the path to send them to ("/ra/dashboard") or null if
 * they are a staff user (super_user / owner / admin / bd / partner).
 *
 * Keyed off profiles.role === "referral_associate" — the authoritative signal
 * set by the invite-ra edge function — NOT merely "has an ra_associates row".
 * This is critical: a staff member (e.g. the super_user) may ALSO hold an RA
 * profile for their own /refer/:slug page, and must keep full CRM access.
 */
// Hard staff allowlist — these accounts are ALWAYS treated as staff, regardless
// of profiles.role. Safety net so a stale/unapplied role migration can never
// trap a known platform operator in the RA portal (e.g. jae is super_user AND
// holds an RA profile for /refer/jae).
const STAFF_EMAIL_ALLOWLIST = new Set(["jae@divigner.com"])

export async function getRaPortalRedirect(): Promise<string | null> {
  if (PREVIEW_MODE) return null // preview demos the CRM as super_user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (user.email && STAFF_EMAIL_ALLOWLIST.has(user.email.trim().toLowerCase())) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  // profiles.role is typed as TeamRole locally (no referral_associate variant),
  // but the DB column carries that role for invited RAs — cast through string.
  const profileRole = (profile?.role as string | null) ?? ""
  if (profileRole !== "referral_associate") return null

  // The RA goes to the portal — but routing depends on where they are in the
  // lifecycle. Without this branch every login would land them at
  // /ra/dashboard, including a half-onboarded RA who hasn't finished their
  // checklist, who would then see an empty dashboard instead of resuming where
  // they left off. Mirrors the auto-advance logic in RaOnboardingSteps.tsx.
  const { data: ra } = await supabase
    .from("ra_associates")
    .select("status, photo_completed, contact_completed, banking_completed, agreement_completed, w9_completed")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!ra) return "/ra/dashboard" // no RA row — let the dashboard guard handle it
  const status = ra.status as string

  // active → portal. terminated / declined → portal (will gracefully show the
  // status). suspended → portal (read-only view there).
  if (status === "active" || status === "declined" || status === "terminated" || status === "suspended") {
    return "/ra/dashboard"
  }
  // verification: already submitted, /onboarding/steps renders the pending screen.
  // pending / needs_changes / anything else with incomplete checklist: resume.
  return "/onboarding/steps"
}

/** Best-effort RA lifecycle email. Never throws.
 *  - "submitted"        → notifies Program Admins of the RA's org
 *  - other kinds        → notifies the RA themselves
 */
async function notifyRaStatus(
  raId: string,
  kind: "approved" | "declined" | "changes_requested" | "submitted",
  notes?: string,
): Promise<void> {
  if (PREVIEW_MODE) return
  try {
    await supabase.functions.invoke("notify-ra-status", {
      body: { ra_associate_id: raId, kind, notes: notes ?? null },
    })
  } catch {
    // Notification is non-blocking — the status change already succeeded.
  }
}

/** Upload a photo file to ra-photos storage and update the RA record. */
export async function saveRaPhoto(raId: string, file: File): Promise<string> {
  if (PREVIEW_MODE) throw new Error("Not available in preview mode")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const path = `${user.id}/avatar.${ext}`

  // upsert: overwrite any previous avatar
  const { error: uploadErr } = await supabase.storage
    .from("ra-photos")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) throw uploadErr

  const { data: { publicUrl } } = supabase.storage
    .from("ra-photos")
    .getPublicUrl(path)

  // Bust cache by appending a timestamp query param
  const photoUrl = `${publicUrl}?t=${Date.now()}`

  const { error: updateErr } = await supabase
    .from("ra_associates")
    .update({ photo_url: photoUrl, photo_completed: true })
    .eq("id", raId)
  if (updateErr) throw updateErr

  return photoUrl
}

/** Save contact info and mark that section complete. */
export async function saveRaContact(raId: string, data: {
  contact_phone: string
  contact_email: string
  bio: string
}): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_associates")
    .update({ ...data, contact_completed: true })
    .eq("id", raId)
  if (error) throw error
}

/** Save ACH banking details and mark that section complete.
 *  These fields are RLS-protected — only admins can SELECT them. */
export async function saveRaBanking(raId: string, data: {
  ach_account_holder: string
  ach_bank_name: string
  ach_routing: string
  ach_account: string
}): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_associates")
    .update({ ...data, banking_completed: true })
    .eq("id", raId)
  if (error) throw error
}

/** Submit the completed application — moves status to 'verification' and
 *  fans out a "ready for review" email to every Program Admin in the org.
 *  Notification is best-effort; failure doesn't block submission. */
export async function submitRaApplication(raId: string): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_associates")
    .update({ status: "verification", submitted_at: new Date().toISOString() })
    .eq("id", raId)
  if (error) throw error
  await notifyRaStatus(raId, "submitted")
}

/** Approve a submitted RA application — moves status to 'active'. */
export async function approveRa(raId: string): Promise<void> {
  if (PREVIEW_MODE) return
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("ra_associates")
    .update({ status: "active", verified_at: now, activated_at: now })
    .eq("id", raId)
  if (error) throw error
  await notifyRaStatus(raId, "approved")
}

/** Request changes on a submitted application — moves status to 'needs_changes'. */
export async function requestRaChanges(raId: string, notes: string): Promise<void> {
  if (PREVIEW_MODE) return
  const trimmed = notes.trim()
  const { error } = await supabase
    .from("ra_associates")
    .update({ status: "needs_changes", verification_notes: trimmed })
    .eq("id", raId)
  if (error) throw error
  await notifyRaStatus(raId, "changes_requested", trimmed)
}

/** Decline a submitted RA application — moves status to 'declined'. */
export async function declineRa(raId: string): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_associates")
    .update({ status: "declined" })
    .eq("id", raId)
  if (error) throw error
  await notifyRaStatus(raId, "declined")
}

export async function revokeRa(raId: string): Promise<void> {
  if (PREVIEW_MODE) throw new Error("Not available in preview mode")
  const { error } = await supabase.functions.invoke("revoke-ra", {
    body: { ra_id: raId },
  })
  if (error) throw error
}

/** Permanently delete an RA. Snapshots all related rows (leads, deals,
 *  checkins, payouts, agreement audit, page views) into archive_* tables BEFORE
 *  destroying the auth user. The original CRM records (companies, contacts)
 *  stay in place; leads/deals.referred_by_ra_id will be SET NULL by FK once the
 *  underlying profile cascades.
 *
 *  Gate: super_user or program_admin in the RA's org (enforced by the edge
 *  function). The caller is encouraged to pass `confirmName` matching the RA's
 *  display_name to mirror the typed-confirmation UI.
 */
export async function deleteRa(
  raId: string,
  opts?: { confirmName?: string; reason?: string }
): Promise<{ archive_id: string; display_name: string }> {
  if (PREVIEW_MODE) throw new Error("Not available in preview mode")
  const { data, error } = await supabase.functions.invoke("delete-ra", {
    body: {
      ra_id: raId,
      confirm_name: opts?.confirmName ?? null,
      reason: opts?.reason ?? null,
    },
  })
  if (error) throw error
  return data as { archive_id: string; display_name: string }
}

// ── RA Archive readers ──────────────────────────────────────────────────────

/** List archived RAs for the current org. Read-only view. */
export async function listArchivedRas(): Promise<import("@/types/db").ArchivedRaAssociate[]> {
  if (PREVIEW_MODE) return []
  const { data, error } = await supabase
    .from("archived_ra_associates")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("archived_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as import("@/types/db").ArchivedRaAssociate[]
}

/** Get one archived RA with all preserved related rows. */
export async function getArchivedRa(
  archiveId: string
): Promise<import("@/types/db").ArchivedRaDetail | null> {
  if (PREVIEW_MODE) return null
  const { data: ra, error: raErr } = await supabase
    .from("archived_ra_associates")
    .select("*")
    .eq("id", archiveId)
    .maybeSingle()
  if (raErr) throw raErr
  if (!ra) return null

  const [leads, deals, checkins, payouts, agreements] = await Promise.all([
    supabase.from("archived_leads").select("*").eq("archived_ra_associate_id", archiveId).order("archived_at", { ascending: false }),
    supabase.from("archived_deals").select("*").eq("archived_ra_associate_id", archiveId).order("archived_at", { ascending: false }),
    supabase.from("archived_client_checkins").select("*").eq("archived_ra_associate_id", archiveId).order("archived_at", { ascending: false }),
    supabase.from("archived_commission_payouts").select("*").eq("archived_ra_associate_id", archiveId).order("archived_at", { ascending: false }),
    supabase.from("archived_agreement_acceptances").select("*").eq("archived_ra_associate_id", archiveId).order("archived_at", { ascending: false }),
  ])
  return {
    ra: ra as import("@/types/db").ArchivedRaAssociate,
    leads: (leads.data ?? []) as import("@/types/db").ArchivedRaRow[],
    deals: (deals.data ?? []) as import("@/types/db").ArchivedRaRow[],
    checkins: (checkins.data ?? []) as import("@/types/db").ArchivedRaRow[],
    payouts: (payouts.data ?? []) as import("@/types/db").ArchivedRaRow[],
    agreements: (agreements.data ?? []) as import("@/types/db").ArchivedRaRow[],
  }
}

/** Undo a permanent RA delete — re-creates the RA from its archive snapshot,
 *  re-links leads/deals, restores payouts/checkins/agreements, and removes the
 *  archive entry. Gated to super_user / program_admin by the edge function. */
export async function restoreRa(archiveId: string): Promise<{
  ra_id: string
  slug: string
  display_name: string
  leads_relinked: number
  deals_relinked: number
  payouts_restored: number
  checkins_restored: number
}> {
  if (PREVIEW_MODE) throw new Error("Not available in preview mode")
  const { data, error } = await supabase.functions.invoke("restore-ra", {
    body: { archive_id: archiveId },
  })
  if (error) throw error
  return data as {
    ra_id: string; slug: string; display_name: string
    leads_relinked: number; deals_relinked: number
    payouts_restored: number; checkins_restored: number
  }
}

// ── Program Admin designation ───────────────────────────────────────────────

/** Toggle the Program Admin designation on an org member. Super User only.
 *  The DB trigger enforces that only role='admin' members can hold this flag. */
export async function setProgramAdmin(
  userId: string,
  value: boolean
): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("organization_members")
    .update({ is_program_admin: value })
    .eq("organization_id", requireOrg())
    .eq("user_id", userId)
  if (error) throw error
}

/** Returns true when the current user can approve, decline, or delete RAs
 *  in the current org. super_user OR (admin AND is_program_admin=true). */
export async function canManageRaProgram(): Promise<boolean> {
  if (PREVIEW_MODE) return true
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (profile?.role === "super_user") return true

  const orgId = typeof localStorage !== "undefined"
    ? localStorage.getItem("avanew-crm.current-org-id")
    : null
  if (!orgId) return false
  const { data: member } = await supabase
    .from("organization_members")
    .select("role, is_program_admin")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle()
  return member?.role === "admin" && member?.is_program_admin === true
}

export async function inviteRa(input: {
  email: string
  first_name: string
  last_name: string
  slug: string
  ra_type?: import("@/types/db").RaType
}): Promise<import("@/types/db").RaAssociate> {
  if (PREVIEW_MODE) return invitePreviewRa(input)
  const { data, error } = await supabase.functions.invoke<import("@/types/db").RaAssociate>(
    "invite-ra",
    {
      body: {
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        slug: input.slug,
        ra_type: input.ra_type ?? "individual",
        organization_id: requireOrg(),
        redirect_to: `${window.location.origin}/onboarding`,
      },
    }
  )
  if (error) throw error
  if (!data) throw new Error("No data returned from invite-ra")
  return data
}

/** Change an RA's type (individual ⇄ company) after creation. */
export async function updateRaType(
  raId: string,
  raType: import("@/types/db").RaType
): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_associates")
    .update({ ra_type: raType })
    .eq("id", raId)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// RA landing page templates
// ───────────────────────────────────────────────────────────────────────────

/** List all templates for the current org, default first then by name. */
export async function listRaLandingTemplates(): Promise<import("@/types/db").RaLandingTemplate[]> {
  if (PREVIEW_MODE) return []
  const { data, error } = await supabase
    .from("ra_landing_templates")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Create a new template — first one created becomes the default automatically. */
export async function createRaLandingTemplate(
  name: string,
  html: string,
  opts?: { demo_html?: string; default_for_type?: import("@/types/db").RaType | null }
): Promise<import("@/types/db").RaLandingTemplate> {
  if (PREVIEW_MODE) throw new Error("Not available in preview mode")
  const orgId = requireOrg()

  // If no templates exist yet, the new one becomes the default.
  const { count } = await supabase
    .from("ra_landing_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)

  const { data, error } = await supabase
    .from("ra_landing_templates")
    .insert({
      organization_id: orgId,
      name,
      html,
      demo_html: opts?.demo_html ?? "",
      default_for_type: opts?.default_for_type ?? null,
      is_default: (count ?? 0) === 0,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

/** Update a template's name, refer HTML, and/or demo HTML. */
export async function updateRaLandingTemplate(
  id: string,
  patch: { name?: string; html?: string; demo_html?: string }
): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_landing_templates")
    .update(patch)
    .eq("id", id)
  if (error) throw error
}

/** Set a template as the org default for a given RA type (individual/company).
 *  Clears the previous type-default first so the unique partial index doesn't
 *  block the change. Pass null to clear the type-default on this template. */
export async function setRaLandingTemplateDefaultForType(
  id: string,
  raType: import("@/types/db").RaType
): Promise<void> {
  if (PREVIEW_MODE) return
  const orgId = requireOrg()
  // Clear any existing default for this type in the org.
  const { error: clearErr } = await supabase
    .from("ra_landing_templates")
    .update({ default_for_type: null })
    .eq("organization_id", orgId)
    .eq("default_for_type", raType)
  if (clearErr) throw clearErr
  const { error: setErr } = await supabase
    .from("ra_landing_templates")
    .update({ default_for_type: raType })
    .eq("id", id)
  if (setErr) throw setErr
}

/** Ensure the org has the two type-default templates ("RA Individual",
 *  "RA Company"). Seeds each template's demo HTML from the live /demo.html so
 *  the editor shows real content and the demo page renders from the template.
 *  Idempotent — only creates a type-default that doesn't already exist. */
export async function ensureDefaultRaTemplates(): Promise<void> {
  if (PREVIEW_MODE) return
  const orgId = requireOrg()
  const { data: existing, error } = await supabase
    .from("ra_landing_templates")
    .select("id, default_for_type")
    .eq("organization_id", orgId)
  if (error) throw error

  const haveIndividual = (existing ?? []).some((t) => t.default_for_type === "individual")
  const haveCompany = (existing ?? []).some((t) => t.default_for_type === "company")
  if (haveIndividual && haveCompany) return

  // Pull the live demo markup once so both seeds start from the real page.
  let demoHtml = ""
  try {
    const res = await fetch("/demo.html")
    if (res.ok) demoHtml = await res.text()
  } catch {
    // If the static file isn't reachable, seed empty — the demo page falls
    // back to the static file anyway until the user customizes it.
  }

  const seeds: { name: string; type: import("@/types/db").RaType }[] = []
  if (!haveIndividual) seeds.push({ name: "RA Individual", type: "individual" })
  if (!haveCompany) seeds.push({ name: "RA Company", type: "company" })

  for (const seed of seeds) {
    await createRaLandingTemplate(seed.name, "", {
      demo_html: demoHtml,
      default_for_type: seed.type,
    })
  }
}

/** Set a template as the org default. Clears the previous default in a single transaction. */
export async function setRaLandingTemplateDefault(id: string): Promise<void> {
  if (PREVIEW_MODE) return
  const orgId = requireOrg()
  // Two-step: clear existing default, then set new one. The unique partial
  // index would block a single UPDATE if multiple rows transiently had is_default=true.
  const { error: clearErr } = await supabase
    .from("ra_landing_templates")
    .update({ is_default: false })
    .eq("organization_id", orgId)
    .eq("is_default", true)
  if (clearErr) throw clearErr
  const { error: setErr } = await supabase
    .from("ra_landing_templates")
    .update({ is_default: true })
    .eq("id", id)
  if (setErr) throw setErr
}

/** Delete a template. RAs assigned to it fall back to the org default via ON DELETE SET NULL. */
export async function deleteRaLandingTemplate(id: string): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_landing_templates")
    .delete()
    .eq("id", id)
  if (error) throw error
}

/** Assign a specific template to an RA (or null to revert to org default). */
export async function setRaTemplate(raId: string, templateId: string | null): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("ra_associates")
    .update({ template_id: templateId })
    .eq("id", raId)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Public RA landing page (anon access via SECURITY DEFINER RPC)
// ───────────────────────────────────────────────────────────────────────────

export type RaLandingPageData = {
  slug:               string
  display_name:       string
  first_name:         string | null
  last_name:          string | null
  photo_url:          string | null
  contact_phone:      string | null
  contact_email:      string | null
  bio:                string | null
  is_active:          boolean
  ra_type:            import("@/types/db").RaType | null
  template_html:      string | null
  template_demo_html: string | null
  template_name:      string | null
  partner_company_name?: string | null
  partner_logo_url?:     string | null
  partner_website?:      string | null
  linkedin_url?:         string | null
  ra_title?:             string | null
}

/** Fetch a public RA landing page by slug. Returns null if no RA found. */
export async function getRaLandingPage(slug: string): Promise<RaLandingPageData | null> {
  const { data, error } = await supabase.rpc("get_ra_landing_page", { p_slug: slug })
  if (error) throw error
  const rows = (data as RaLandingPageData[] | null) ?? []
  return rows[0] ?? null
}

/** Submit a lead via the ra-lead-submit edge function (no auth). */
export async function submitRaLead(input: {
  slug: string
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  website?: string
  message?: string
}): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke<{ id: string; message: string }>(
    "ra-lead-submit",
    { body: input }
  )
  if (error) throw error
  if (!data) throw new Error("No data returned from ra-lead-submit")
  return { id: data.id }
}

// ───────────────────────────────────────────────────────────────────────────
// RA dashboard stats (called by logged-in RAs)
// ───────────────────────────────────────────────────────────────────────────

export type RaDashboardStats = {
  total_leads:  number
  active_leads: number
  deals_closed: number
}

export async function getRaDashboardStats(): Promise<RaDashboardStats> {
  if (PREVIEW_MODE) return { total_leads: 0, active_leads: 0, deals_closed: 0 }
  const { data, error } = await supabase.rpc("get_ra_dashboard_stats")
  if (error) throw error
  const row = (data as RaDashboardStats[] | null)?.[0]
  return row ?? { total_leads: 0, active_leads: 0, deals_closed: 0 }
}

/** List leads attributed to the current RA (their own pipeline view). */
export async function listRaLeads(): Promise<import("@/types/db").Lead[]> {
  if (PREVIEW_MODE) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("referred_by_ra_id", user.id)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

// ───────────────────────────────────────────────────────────────────────────
// Leads
// ───────────────────────────────────────────────────────────────────────────

export type LeadInput = {
  first_name: string
  last_name?: string | null
  company?: string | null
  title?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  fax?: string | null
  website?: string | null
  lead_source?: string | null
  lead_status?: string | null
  industry?: string | null
  annual_revenue?: number | null
  no_of_employees?: number | null
  rating?: string | null
  email_opt_out?: boolean
  street?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  country?: string | null
  description?: string | null
  owner_id?: string | null
  converted?: boolean
  converted_company_id?: string | null
  converted_contact_id?: string | null
  converted_deal_id?: string | null
}

function seedLeads(): Lead[] {
  const t = nowIso()
  return [
    {
      id: "l-1", organization_id: "preview-org", owner_id: null, first_name: "Alex", last_name: "Torres",
      company: "BlueWave Tech", title: "CTO", phone: "+1 650 555 0100",
      mobile: null, email: "alex@bluewave.io", fax: null,
      website: "bluewave.io", lead_source: "Web", lead_status: "New",
      industry: "Technology", annual_revenue: null, no_of_employees: 45,
      rating: "Hot", email_opt_out: false,
      street: null, city: null, state: null, zip_code: null, country: null,
      description: "Interested in enterprise plan.", converted: false,
      converted_company_id: null, converted_contact_id: null, converted_deal_id: null,
      referred_by_ra_id: null, attribution_expires_at: null, prospect_intent: null,
      created_at: t, updated_at: t,
    },
  ]
}

export async function listLeads(): Promise<Lead[]> {
  if (PREVIEW_MODE) {
    const rows = previewFilterByOwner(loadMock<Lead>("leads", seedLeads))
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  // Exclude RA-referral leads from the global admin Leads page — those are
  // shown in the per-RA drill-down inside Settings → Team → Referral Associates.
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", requireOrg())
    .is("referred_by_ra_id", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function listLeadsForRa(raUserId: string): Promise<Lead[]> {
  if (PREVIEW_MODE) return []
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", requireOrg())
    .eq("referred_by_ra_id", raUserId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createLead(input: LeadInput): Promise<Lead> {
  const owner_id = await ensureOwnerForCreate(input.owner_id)
  if (PREVIEW_MODE) {
    const row: Lead = {
      id: newId(), organization_id: "preview-org", owner_id,
      first_name: input.first_name, last_name: input.last_name ?? null,
      company: input.company ?? null, title: input.title ?? null,
      phone: input.phone ?? null, mobile: input.mobile ?? null,
      email: input.email ?? null, fax: input.fax ?? null,
      website: input.website ?? null, lead_source: input.lead_source ?? null,
      lead_status: input.lead_status ?? "New", industry: input.industry ?? null,
      annual_revenue: input.annual_revenue ?? null, no_of_employees: input.no_of_employees ?? null,
      rating: input.rating ?? null, email_opt_out: input.email_opt_out ?? false,
      street: input.street ?? null, city: input.city ?? null, state: input.state ?? null,
      zip_code: input.zip_code ?? null, country: input.country ?? null,
      description: input.description ?? null, converted: false,
      converted_company_id: null, converted_contact_id: null, converted_deal_id: null,
      referred_by_ra_id: null, attribution_expires_at: null, prospect_intent: null,
      created_at: nowIso(), updated_at: nowIso(),
    }
    saveMock("leads", [row, ...loadMock<Lead>("leads", seedLeads)])
    return row
  }
  const { data, error } = await supabase.from("leads").insert({ ...input, owner_id, organization_id: requireOrg() }).select().single()
  if (error) throw error
  return data
}

export async function updateLead(id: string, input: LeadInput): Promise<Lead> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Lead>("leads", seedLeads)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Lead not found")
    rows[idx] = { ...rows[idx], ...input, updated_at: nowIso() }
    saveMock("leads", rows)
    return rows[idx]
  }
  const { data, error } = await supabase.from("leads").update({ ...input, updated_at: nowIso() }).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteLead(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    saveMock("leads", loadMock<Lead>("leads", seedLeads).filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("leads").delete().eq("id", id)
  if (error) throw error
}

export type ConvertLeadOptions = {
  account_name: string
  create_deal: boolean
  deal_title?: string
  deal_amount?: number | null
  deal_stage_id?: string
  deal_close_date?: string | null
}

export type ConvertLeadResult = {
  company: Company
  contact: Contact
  deal: Deal | null
}

export async function convertLead(
  lead: Lead,
  opts: ConvertLeadOptions
): Promise<ConvertLeadResult> {
  const company = await createCompany({
    name: opts.account_name.trim(),
    industry: lead.industry,
    website: lead.website,
    phone: lead.phone,
    fax: lead.fax,
    annual_revenue: lead.annual_revenue,
    employees: lead.no_of_employees,
    rating: lead.rating,
    billing_street: lead.street,
    billing_city: lead.city,
    billing_state: lead.state,
    billing_zip: lead.zip_code,
    billing_country: lead.country,
    description: lead.description,
  })

  const contact = await createContact({
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    mobile: lead.mobile,
    title: lead.title,
    company_id: company.id,
    lead_source: lead.lead_source,
    description: lead.description,
    mailing_street: lead.street,
    mailing_city: lead.city,
    mailing_state: lead.state,
    mailing_zip: lead.zip_code,
    mailing_country: lead.country,
  })

  let deal: Deal | null = null
  if (opts.create_deal && opts.deal_stage_id && opts.deal_title) {
    deal = await createDeal({
      title: opts.deal_title.trim(),
      stage_id: opts.deal_stage_id,
      company_id: company.id,
      contact_id: contact.id,
      owner_id: lead.owner_id,
      amount: opts.deal_amount ?? null,
      expected_close_date: opts.deal_close_date ?? null,
      lead_source: lead.lead_source,
      probability: 10,
    })
  }

  await updateLead(lead.id, {
    owner_id: lead.owner_id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    title: lead.title,
    phone: lead.phone,
    mobile: lead.mobile,
    lead_source: lead.lead_source,
    industry: lead.industry,
    annual_revenue: lead.annual_revenue,
    email_opt_out: lead.email_opt_out,
    company: lead.company,
    email: lead.email,
    fax: lead.fax,
    website: lead.website,
    lead_status: "Converted",
    no_of_employees: lead.no_of_employees,
    rating: lead.rating,
    street: lead.street,
    city: lead.city,
    state: lead.state,
    zip_code: lead.zip_code,
    country: lead.country,
    description: lead.description,
    converted: true,
    converted_company_id: company.id,
    converted_contact_id: contact.id,
    converted_deal_id: deal ? deal.id : null,
  })

  return { company, contact, deal }
}

// ───────────────────────────────────────────────────────────────────────────
// Tasks
// ───────────────────────────────────────────────────────────────────────────

export type TaskInput = {
  subject: string
  status?: string
  priority?: string
  owner_id?: string | null
  contact_id?: string | null
  company_id?: string | null
  deal_id?: string | null
  lead_id?: string | null
  due_date?: string | null
  description?: string | null
  completed_at?: string | null
}

function seedTasks(): Task[] {
  const now = new Date()
  const t = now.toISOString()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return [
    {
      id: "tk-1", organization_id: "preview-org", subject: "Follow up with Acme re: pilot", status: "Not Started",
      priority: "High", owner_id: null, contact_id: "ct-maya", company_id: "c-acme",
      deal_id: "d-acme-pilot", lead_id: null, due_date: tomorrow,
      description: "Check on pilot timeline.", completed_at: null,
      created_at: t, updated_at: t,
    },
  ]
}

export async function listTasks(): Promise<Task[]> {
  if (PREVIEW_MODE) {
    const rows = previewFilterByOwner(loadMock<Task>("tasks", seedTasks))
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  const { data, error } = await supabase.from("tasks").select("*").eq("organization_id", requireOrg()).order("created_at", { ascending: false })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function createTask(input: TaskInput): Promise<Task> {
  const owner_id = await ensureOwnerForCreate(input.owner_id)
  if (PREVIEW_MODE) {
    const row: Task = {
      id: newId(), organization_id: "preview-org", subject: input.subject,
      status: input.status ?? "Not Started", priority: input.priority ?? "Normal",
      owner_id, contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null, deal_id: input.deal_id ?? null,
      lead_id: input.lead_id ?? null, due_date: input.due_date ?? null,
      description: input.description ?? null, completed_at: input.completed_at ?? null,
      created_at: nowIso(), updated_at: nowIso(),
    }
    saveMock("tasks", [row, ...loadMock<Task>("tasks", seedTasks)])
    return row
  }
  const { data, error } = await supabase.from("tasks").insert({ ...input, owner_id, organization_id: requireOrg() }).select().single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Task>("tasks", seedTasks)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Task not found")
    rows[idx] = { ...rows[idx], ...input, updated_at: nowIso() }
    saveMock("tasks", rows)
    return rows[idx]
  }
  const { data, error } = await supabase.from("tasks").update({ ...input, updated_at: nowIso() }).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    saveMock("tasks", loadMock<Task>("tasks", seedTasks).filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Role helper
// ───────────────────────────────────────────────────────────────────────────

export async function getMyRole(): Promise<TeamRole> {
  if (PREVIEW_MODE) return "owner"
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return "partner"
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle()
  return (data?.role as TeamRole | null) ?? "partner"
}

// ───────────────────────────────────────────────────────────────────────────
// Constants for cashflow, partners, vendors
// ───────────────────────────────────────────────────────────────────────────

export const INCOME_CATEGORIES = [
  "Sales", "Services", "Grants", "Investments", "Refunds", "Other Income",
] as const

export const EXPENSE_CATEGORIES = [
  "Payroll", "Software", "Marketing", "Infrastructure", "Legal",
  "Travel", "Equipment", "Consulting", "Rent", "Other",
] as const

export const RECURRENCE_PERIODS = [
  "daily", "weekly", "monthly", "quarterly", "yearly",
] as const

export const PARTNER_TYPES = [
  "Strategic", "Financial", "Reseller", "Technology", "Other",
] as const

export const PAYMENT_TERMS_OPTIONS = [
  "Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90", "Other",
] as const

// ───────────────────────────────────────────────────────────────────────────
// Cashflow Transactions
// ───────────────────────────────────────────────────────────────────────────

function seedTransactions(): CashflowTransaction[] {
  const now = new Date()
  const rows: CashflowTransaction[] = []

  for (let m = 11; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, "0")
    const mp = `${y}-${mo}`

    rows.push({ id: `txn-saas-${m}`, organization_id: "preview-org", type: "income", category: "Services", description: "SaaS subscription revenue", amount: 15000, date: `${mp}-01`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: null, reference: `INV-${y}${mo}-001`, created_at: `${mp}-01T00:00:00.000Z`, updated_at: `${mp}-01T00:00:00.000Z` })
    rows.push({ id: `txn-retainer-${m}`, organization_id: "preview-org", type: "income", category: "Services", description: "Retainer fee — Acme Robotics", amount: 8000, date: `${mp}-05`, is_recurring: true, recurrence_period: "monthly", partner_id: "partner-acme", vendor_id: null, reference: `RET-${y}${mo}`, created_at: `${mp}-05T00:00:00.000Z`, updated_at: `${mp}-05T00:00:00.000Z` })
    rows.push({ id: `txn-payroll-${m}`, organization_id: "preview-org", type: "expense", category: "Payroll", description: "Monthly payroll", amount: 18000, date: `${mp}-28`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: null, reference: `PAY-${y}${mo}`, created_at: `${mp}-28T00:00:00.000Z`, updated_at: `${mp}-28T00:00:00.000Z` })
    rows.push({ id: `txn-aws-${m}`, organization_id: "preview-org", type: "expense", category: "Infrastructure", description: "AWS cloud services", amount: 2500, date: `${mp}-01`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: "vendor-aws", reference: `AWS-${y}${mo}`, created_at: `${mp}-01T00:00:00.000Z`, updated_at: `${mp}-01T00:00:00.000Z` })
    rows.push({ id: `txn-sw-${m}`, organization_id: "preview-org", type: "expense", category: "Software", description: "SaaS tools (GitHub, Figma, Slack)", amount: 1200, date: `${mp}-01`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: "vendor-github", reference: null, created_at: `${mp}-01T00:00:00.000Z`, updated_at: `${mp}-01T00:00:00.000Z` })

    if (m % 3 === 0) {
      rows.push({ id: `txn-consulting-${m}`, organization_id: "preview-org", type: "income", category: "Services", description: "Consulting project delivery", amount: 12000, date: `${mp}-15`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: `PROJ-${y}${mo}`, created_at: `${mp}-15T00:00:00.000Z`, updated_at: `${mp}-15T00:00:00.000Z` })
    }
    if (m === 8) {
      rows.push({ id: "txn-seed", organization_id: "preview-org", type: "income", category: "Investments", description: "Seed funding round — Northwind Capital", amount: 50000, date: `${mp}-10`, is_recurring: false, recurrence_period: null, partner_id: "partner-northwind", vendor_id: null, reference: "SEED-2024", created_at: `${mp}-10T00:00:00.000Z`, updated_at: `${mp}-10T00:00:00.000Z` })
    }
    if (m === 6) {
      rows.push({ id: "txn-tradeshow", organization_id: "preview-org", type: "expense", category: "Marketing", description: "Tech Summit sponsorship", amount: 5000, date: `${mp}-10`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: "MKTG-2024-Q2", created_at: `${mp}-10T00:00:00.000Z`, updated_at: `${mp}-10T00:00:00.000Z` })
    }
    if (m === 4) {
      rows.push({ id: "txn-equipment", organization_id: "preview-org", type: "expense", category: "Equipment", description: "Development workstations (3×)", amount: 8400, date: `${mp}-05`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: "EQUIP-2024", created_at: `${mp}-05T00:00:00.000Z`, updated_at: `${mp}-05T00:00:00.000Z` })
    }
    if (m === 2) {
      rows.push({ id: "txn-legal", organization_id: "preview-org", type: "expense", category: "Legal", description: "Contract review & IP filing", amount: 3500, date: `${mp}-20`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: "LEGAL-2024", created_at: `${mp}-20T00:00:00.000Z`, updated_at: `${mp}-20T00:00:00.000Z` })
    }
  }

  return rows
}

export type TransactionInput = {
  type: "income" | "expense"
  category: string
  description?: string | null
  amount: number
  date: string
  is_recurring?: boolean
  recurrence_period?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | null
  partner_id?: string | null
  vendor_id?: string | null
  reference?: string | null
}

export async function listTransactions(): Promise<CashflowTransaction[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<CashflowTransaction>("cashflow_transactions", seedTransactions)
    return [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }
  const { data, error } = await supabase
    .from("cashflow_transactions")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("date", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createTransaction(input: TransactionInput): Promise<CashflowTransaction> {
  if (PREVIEW_MODE) {
    const row: CashflowTransaction = {
      id: newId(),
      organization_id: "preview-org",
      type: input.type,
      category: input.category,
      description: input.description ?? null,
      amount: input.amount,
      date: input.date,
      is_recurring: input.is_recurring ?? false,
      recurrence_period: input.recurrence_period ?? null,
      partner_id: input.partner_id ?? null,
      vendor_id: input.vendor_id ?? null,
      reference: input.reference ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    const rows = loadMock<CashflowTransaction>("cashflow_transactions", seedTransactions)
    saveMock("cashflow_transactions", [row, ...rows])
    return row
  }
  const { data, error } = await supabase
    .from("cashflow_transactions")
    .insert({ ...input, organization_id: requireOrg() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTransaction(
  id: string,
  input: TransactionInput
): Promise<CashflowTransaction> {
  if (PREVIEW_MODE) {
    const rows = loadMock<CashflowTransaction>("cashflow_transactions", seedTransactions)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Transaction not found")
    rows[idx] = { ...rows[idx], ...input, description: input.description ?? null, recurrence_period: input.recurrence_period ?? null, partner_id: input.partner_id ?? null, vendor_id: input.vendor_id ?? null, reference: input.reference ?? null, updated_at: nowIso() }
    saveMock("cashflow_transactions", rows)
    return rows[idx]
  }
  const { data, error } = await supabase
    .from("cashflow_transactions")
    .update({ ...input, updated_at: nowIso() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    saveMock("cashflow_transactions", loadMock<CashflowTransaction>("cashflow_transactions", seedTransactions).filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("cashflow_transactions").delete().eq("id", id)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Partners
// ───────────────────────────────────────────────────────────────────────────

function seedPartners(): Partner[] {
  const t = nowIso()
  return [
    { id: "partner-acme", organization_id: "preview-org", name: "Acme Partnerships LLC", type: "Strategic", email: "partners@acme-robotics.com", phone: "+1 415 555 0200", website: "acme-robotics.com", agreement_start_date: "2024-01-01", contract_terms: "Annual partnership agreement with co-marketing rights.", revenue_share: "15% revenue share on referred deals", key_contacts: "Maya Reyes (VP Operations)", notes: "Strong relationship, quarterly business reviews.", status: "Active", created_at: t, updated_at: t },
    { id: "partner-northwind", organization_id: "preview-org", name: "Northwind Capital", type: "Financial", email: "invest@northwindcap.com", phone: "+1 212 555 0300", website: "northwindcap.com", agreement_start_date: "2024-03-01", contract_terms: "Seed investment agreement, 18-month term.", revenue_share: "Equity stake per investment terms", key_contacts: "Jonas Becker (Director, Investments)", notes: "Seed round investor. Monthly check-ins.", status: "Active", created_at: t, updated_at: t },
    { id: "partner-bluewave", organization_id: "preview-org", name: "BlueWave Tech", type: "Reseller", email: "alex@bluewave.io", phone: "+1 650 555 0100", website: "bluewave.io", agreement_start_date: null, contract_terms: null, revenue_share: "20% reseller margin", key_contacts: "Alex Torres (CTO)", notes: "Exploring reseller agreement.", status: "Pending", created_at: t, updated_at: t },
  ]
}

export type PartnerInput = {
  name: string
  type?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  agreement_start_date?: string | null
  contract_terms?: string | null
  revenue_share?: string | null
  key_contacts?: string | null
  notes?: string | null
  status?: string
}

export async function listPartners(): Promise<Partner[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Partner>("partners", seedPartners)
    return [...rows].sort((a, b) => a.name.localeCompare(b.name))
  }
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createPartner(input: PartnerInput): Promise<Partner> {
  if (PREVIEW_MODE) {
    const row: Partner = {
      id: newId(),
      organization_id: "preview-org",
      name: input.name,
      type: input.type ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      agreement_start_date: input.agreement_start_date ?? null,
      contract_terms: input.contract_terms ?? null,
      revenue_share: input.revenue_share ?? null,
      key_contacts: input.key_contacts ?? null,
      notes: input.notes ?? null,
      status: input.status ?? "Active",
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    saveMock("partners", [row, ...loadMock<Partner>("partners", seedPartners)])
    return row
  }
  const { data, error } = await supabase.from("partners").insert({ ...input, organization_id: requireOrg() }).select().single()
  if (error) throw error
  return data
}

export async function updatePartner(id: string, input: PartnerInput): Promise<Partner> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Partner>("partners", seedPartners)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Partner not found")
    rows[idx] = { ...rows[idx], ...input, type: input.type ?? null, email: input.email ?? null, phone: input.phone ?? null, website: input.website ?? null, agreement_start_date: input.agreement_start_date ?? null, contract_terms: input.contract_terms ?? null, revenue_share: input.revenue_share ?? null, key_contacts: input.key_contacts ?? null, notes: input.notes ?? null, status: input.status ?? rows[idx].status, updated_at: nowIso() }
    saveMock("partners", rows)
    return rows[idx]
  }
  const { data, error } = await supabase.from("partners").update({ ...input, updated_at: nowIso() }).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deletePartner(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    saveMock("partners", loadMock<Partner>("partners", seedPartners).filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("partners").delete().eq("id", id)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Vendors
// ───────────────────────────────────────────────────────────────────────────

function seedVendors(): Vendor[] {
  const t = nowIso()
  return [
    { id: "vendor-aws", organization_id: "preview-org", name: "Amazon Web Services", service: "Cloud infrastructure & hosting", email: "aws-billing@amazon.com", phone: null, website: "aws.amazon.com", contract_terms: "Pay-as-you-go", payment_terms: "Net 30", cost_structure: "$2,500/month average spend on EC2, RDS, S3", cost_amount: 2500, cost_frequency: "monthly" as const, performance_notes: "99.9% uptime SLA, strong support.", status: "Active", created_at: t, updated_at: t },
    { id: "vendor-github", organization_id: "preview-org", name: "GitHub (Microsoft)", service: "Source control & CI/CD platform", email: null, phone: null, website: "github.com", contract_terms: "Annual subscription", payment_terms: "Net 30", cost_structure: "$500/month (Team plan, 25 seats)", cost_amount: 500, cost_frequency: "monthly" as const, performance_notes: "Core tooling, no issues.", status: "Active", created_at: t, updated_at: t },
    { id: "vendor-figma", organization_id: "preview-org", name: "Figma", service: "UI/UX design platform", email: null, phone: null, website: "figma.com", contract_terms: "Annual subscription", payment_terms: "Due on Receipt", cost_structure: "$300/month (Organization plan)", cost_amount: 300, cost_frequency: "monthly" as const, performance_notes: null, status: "Active", created_at: t, updated_at: t },
    { id: "vendor-slack", organization_id: "preview-org", name: "Slack (Salesforce)", service: "Team communications", email: null, phone: null, website: "slack.com", contract_terms: "Annual subscription", payment_terms: "Net 30", cost_structure: "$400/month (Pro plan, 30 seats)", cost_amount: 400, cost_frequency: "monthly" as const, performance_notes: null, status: "Active", created_at: t, updated_at: t },
  ]
}

export const COST_FREQUENCY_OPTIONS = ["monthly", "quarterly", "annually"] as const
export type CostFrequency = (typeof COST_FREQUENCY_OPTIONS)[number]

export type VendorInput = {
  name: string
  service?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  contract_terms?: string | null
  payment_terms?: string | null
  cost_structure?: string | null
  cost_amount?: number | null
  cost_frequency?: CostFrequency | null
  performance_notes?: string | null
  status?: string
}

export async function listVendors(): Promise<Vendor[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Vendor>("vendors", seedVendors)
    return [...rows].sort((a, b) => a.name.localeCompare(b.name))
  }
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("organization_id", requireOrg())
    .order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  if (PREVIEW_MODE) {
    const row: Vendor = {
      id: newId(),
      organization_id: "preview-org",
      name: input.name,
      service: input.service ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      contract_terms: input.contract_terms ?? null,
      payment_terms: input.payment_terms ?? null,
      cost_structure: input.cost_structure ?? null,
      cost_amount: input.cost_amount ?? null,
      cost_frequency: input.cost_frequency ?? null,
      performance_notes: input.performance_notes ?? null,
      status: input.status ?? "Active",
      created_at: nowIso(),
      updated_at: nowIso(),
    }
    saveMock("vendors", [row, ...loadMock<Vendor>("vendors", seedVendors)])
    return row
  }
  const { data, error } = await supabase.from("vendors").insert({ ...input, organization_id: requireOrg() }).select().single()
  if (error) throw error
  return data
}

export async function updateVendor(id: string, input: VendorInput): Promise<Vendor> {
  if (PREVIEW_MODE) {
    const rows = loadMock<Vendor>("vendors", seedVendors)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Vendor not found")
    rows[idx] = { ...rows[idx], ...input, service: input.service ?? null, email: input.email ?? null, phone: input.phone ?? null, website: input.website ?? null, contract_terms: input.contract_terms ?? null, payment_terms: input.payment_terms ?? null, cost_structure: input.cost_structure ?? null, cost_amount: input.cost_amount ?? null, cost_frequency: input.cost_frequency ?? null, performance_notes: input.performance_notes ?? null, status: input.status ?? rows[idx].status, updated_at: nowIso() }
    saveMock("vendors", rows)
    return rows[idx]
  }
  const { data, error } = await supabase.from("vendors").update({ ...input, updated_at: nowIso() }).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteVendor(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    saveMock("vendors", loadMock<Vendor>("vendors", seedVendors).filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from("vendors").delete().eq("id", id)
  if (error) throw error
}

// ───────────────────────────────────────────────────────────────────────────
// Bank Connections, Accounts, Transactions, Sync Logs
// ───────────────────────────────────────────────────────────────────────────

import type { BankConnection, BankAccount, BankTransaction, CashflowSyncLog, BankProvider, BankTransactionCategory } from "@/types/db"

// ─── Seed helpers ──────────────────────────────────────────────────────────

function daysAgo(n: number) {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
}

function seedBankConnections(): BankConnection[] {
  const t = nowIso()
  return [
    {
      id: "bc-mercury",
      organization_id: "preview-org",
      provider: "mercury" as BankProvider,
      institution_name: "Mercury",
      institution_id: "mercury",
      status: "active",
      last_sync_at: new Date(Date.now() - 2 * 864e5).toISOString(),
      error_message: null,
      created_at: t,
      updated_at: t,
    },
  ]
}

function seedBankAccounts(): BankAccount[] {
  const t = nowIso()
  return [
    {
      id: "ba-mercury-checking",
      organization_id: "preview-org",
      bank_connection_id: "bc-mercury",
      external_account_id: "mercury-checking-ext-001",
      name: "Mercury Checking",
      type: "checking",
      subtype: "checking",
      balance_current: 96700,
      balance_available: 95200,
      currency: "USD",
      institution_name: "Mercury",
      is_active: true,
      last_updated: new Date(Date.now() - 2 * 864e5).toISOString(),
      created_at: t,
      updated_at: t,
    },
    {
      id: "ba-mercury-savings",
      organization_id: "preview-org",
      bank_connection_id: "bc-mercury",
      external_account_id: "mercury-savings-ext-001",
      name: "Mercury Savings",
      type: "savings",
      subtype: "savings",
      balance_current: 50000,
      balance_available: 50000,
      currency: "USD",
      institution_name: "Mercury",
      is_active: true,
      last_updated: new Date(Date.now() - 2 * 864e5).toISOString(),
      created_at: t,
      updated_at: t,
    },
  ]
}

function seedBankTransactions(): BankTransaction[] {
  const t = nowIso()
  const mkTxn = (
    id: string,
    extId: string,
    date: string,
    desc: string,
    amount: number,
    cat: BankTransactionCategory,
    merchant: string | null = null,
    pending = false,
    vendorId: string | null = null,
    partnerId: string | null = null,
  ): BankTransaction => ({
    id,
    organization_id: "preview-org",
    bank_connection_id: "bc-mercury",
    bank_account_id: "ba-mercury-checking",
    provider: "mercury" as BankProvider,
    external_transaction_id: extId,
    date,
    description: desc,
    amount,
    currency: "USD",
    category: cat,
    pending,
    merchant_name: merchant,
    vendor_id: vendorId,
    partner_id: partnerId,
    notes: null,
    is_excluded: cat === "Transfer",
    override_category: null,
    raw_category: null,
    created_at: t,
    updated_at: t,
  })

  return [
    // Inflows — recent
    mkTxn("bt-001", "merc-ext-001", daysAgo(1),  "Client payment — Acme Robotics Q2", 15000, "Revenue", null, false, null, "partner-acme"),
    mkTxn("bt-002", "merc-ext-002", daysAgo(3),  "Stripe payout",                     8420,  "Revenue", "Stripe"),
    mkTxn("bt-003", "merc-ext-003", daysAgo(5),  "Northwind Capital retainer",         8000,  "Revenue", null, false, null, "partner-northwind"),
    mkTxn("bt-004", "merc-ext-004", daysAgo(8),  "Consulting delivery — Helix Bio",    12000, "Revenue"),
    mkTxn("bt-005", "merc-ext-005", daysAgo(12), "ACH transfer from savings",          25000, "Transfer", null, false),
    // Outflows — recent
    mkTxn("bt-006", "merc-ext-006", daysAgo(1),  "AWS — monthly invoice",             -2518, "Infrastructure", "Amazon Web Services", false, "vendor-aws"),
    mkTxn("bt-007", "merc-ext-007", daysAgo(2),  "Gusto payroll",                    -18000, "Payroll", "Gusto"),
    mkTxn("bt-008", "merc-ext-008", daysAgo(3),  "GitHub Team plan",                   -500, "Software", "GitHub", false, "vendor-github"),
    mkTxn("bt-009", "merc-ext-009", daysAgo(4),  "Figma Organization",                 -300, "Software", "Figma", false, "vendor-figma"),
    mkTxn("bt-010", "merc-ext-010", daysAgo(5),  "Slack Business+",                    -400, "Software", "Slack (Salesforce)", false, "vendor-slack"),
    mkTxn("bt-011", "merc-ext-011", daysAgo(7),  "Freelance designer — UI sprint",   -3500, "Contractor"),
    mkTxn("bt-012", "merc-ext-012", daysAgo(10), "IRS estimated tax Q1",             -8200, "Tax Payment", "IRS"),
    mkTxn("bt-013", "merc-ext-013", daysAgo(14), "Office supplies",                    -620, "Expense"),
    mkTxn("bt-014", "merc-ext-014", daysAgo(2),  "Stripe payout (pending)",            3200, "Revenue", "Stripe", true),
  ]
}

function seedSyncLogs(): CashflowSyncLog[] {
  const t = nowIso()
  const ago = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
  return [
    {
      id: "sl-001",
      organization_id: "preview-org",
      bank_connection_id: "bc-mercury",
      bank_account_id: "ba-mercury-checking",
      provider: "mercury",
      status: "success",
      transactions_imported: 14,
      transactions_skipped: 0,
      error_message: null,
      started_at: ago(2),
      completed_at: new Date(new Date(ago(2)).getTime() + 3400).toISOString(),
      created_at: t,
    },
    {
      id: "sl-002",
      organization_id: "preview-org",
      bank_connection_id: "bc-mercury",
      bank_account_id: "ba-mercury-savings",
      provider: "mercury",
      status: "success",
      transactions_imported: 2,
      transactions_skipped: 0,
      error_message: null,
      started_at: ago(2),
      completed_at: new Date(new Date(ago(2)).getTime() + 1200).toISOString(),
      created_at: t,
    },
    {
      id: "sl-003",
      organization_id: "preview-org",
      bank_connection_id: "bc-mercury",
      bank_account_id: null,
      provider: "mercury",
      status: "error",
      transactions_imported: 0,
      transactions_skipped: 0,
      error_message: "Rate limit exceeded — retried after 60s",
      started_at: ago(9),
      completed_at: ago(9),
      created_at: t,
    },
  ]
}

// ─── Bank Connections ───────────────────────────────────────────────────────

export async function listBankConnections(): Promise<BankConnection[]> {
  if (PREVIEW_MODE) return loadMock<BankConnection>("bank_connections", seedBankConnections)
  const { data, error } = await supabase.from("bank_connections").select("*").eq("organization_id", requireOrg()).order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createBankConnection(input: Omit<BankConnection, "id" | "created_at" | "updated_at" | "organization_id">): Promise<BankConnection> {
  if (PREVIEW_MODE) {
    const row: BankConnection = { id: newId(), organization_id: "preview-org", ...input, created_at: nowIso(), updated_at: nowIso() }
    saveMock("bank_connections", [row, ...loadMock<BankConnection>("bank_connections", seedBankConnections)])
    return row
  }
  const { data, error } = await supabase.from("bank_connections").insert({ ...input, organization_id: requireOrg() }).select().single()
  if (error) throw error
  return data
}

export async function updateBankConnection(id: string, input: Partial<Omit<BankConnection, "id" | "created_at">>): Promise<BankConnection> {
  if (PREVIEW_MODE) {
    const rows = loadMock<BankConnection>("bank_connections", seedBankConnections)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Connection not found")
    rows[idx] = { ...rows[idx], ...input, updated_at: nowIso() }
    saveMock("bank_connections", rows)
    return rows[idx]
  }
  const { data, error } = await supabase.from("bank_connections").update({ ...input, updated_at: nowIso() }).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteBankConnection(id: string): Promise<void> {
  if (PREVIEW_MODE) {
    saveMock("bank_connections", loadMock<BankConnection>("bank_connections", seedBankConnections).filter((r) => r.id !== id))
    saveMock("bank_accounts", loadMock<BankAccount>("bank_accounts", seedBankAccounts).filter((r) => r.bank_connection_id !== id))
    saveMock("bank_transactions", loadMock<BankTransaction>("bank_transactions", seedBankTransactions).filter((r) => r.bank_connection_id !== id))
    return
  }
  const { error } = await supabase.from("bank_connections").delete().eq("id", id)
  if (error) throw error
}

// ─── Bank Accounts ──────────────────────────────────────────────────────────

export async function listBankAccounts(connectionId?: string, { includeInactive = false } = {}): Promise<BankAccount[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<BankAccount>("bank_accounts", seedBankAccounts)
    return connectionId ? rows.filter((r) => r.bank_connection_id === connectionId) : rows
  }
  let q = supabase.from("bank_accounts").select("*").eq("organization_id", requireOrg()).order("name", { ascending: true })
  if (!includeInactive) q = q.eq("is_active", true)
  if (connectionId) q = q.eq("bank_connection_id", connectionId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function updateBankAccount(id: string, input: { is_active: boolean }): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase.from("bank_accounts").update(input).eq("id", id)
  if (error) throw error
}

// ─── Bank Transactions ──────────────────────────────────────────────────────

export type BankTransactionUpdateInput = {
  override_category?: BankTransactionCategory | null
  vendor_id?: string | null
  partner_id?: string | null
  notes?: string | null
  is_excluded?: boolean
}

export async function listBankTransactions(opts?: { accountId?: string; pending?: boolean }): Promise<BankTransaction[]> {
  if (PREVIEW_MODE) {
    let rows = loadMock<BankTransaction>("bank_transactions", seedBankTransactions)
    if (opts?.accountId) rows = rows.filter((r) => r.bank_account_id === opts.accountId)
    if (opts?.pending !== undefined) rows = rows.filter((r) => r.pending === opts.pending)
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  }
  // Scope to active accounts only so inactive/hidden accounts never appear
  const { data: activeAccounts } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("organization_id", requireOrg())
    .eq("is_active", true)
  const activeIds = (activeAccounts ?? []).map((a) => a.id)
  if (activeIds.length === 0) return []

  let q = supabase.from("bank_transactions").select("*").eq("organization_id", requireOrg()).in("bank_account_id", activeIds).order("date", { ascending: false })
  if (opts?.accountId) q = q.eq("bank_account_id", opts.accountId)
  if (opts?.pending !== undefined) q = q.eq("pending", opts.pending)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function updateBankTransaction(id: string, input: BankTransactionUpdateInput): Promise<BankTransaction> {
  if (PREVIEW_MODE) {
    const rows = loadMock<BankTransaction>("bank_transactions", seedBankTransactions)
    const idx = rows.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error("Bank transaction not found")
    rows[idx] = { ...rows[idx], ...input, updated_at: nowIso() }
    saveMock("bank_transactions", rows)
    return rows[idx]
  }
  const { data, error } = await supabase.from("bank_transactions").update({ ...input, updated_at: nowIso() }).eq("id", id).select().single()
  if (error) throw error
  return data
}

// ─── Sync Logs ──────────────────────────────────────────────────────────────

export async function listSyncLogs(connectionId?: string): Promise<CashflowSyncLog[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<CashflowSyncLog>("cashflow_sync_logs", seedSyncLogs)
    return connectionId ? rows.filter((r) => r.bank_connection_id === connectionId) : rows.sort((a, b) => b.started_at.localeCompare(a.started_at))
  }
  let q = supabase.from("cashflow_sync_logs").select("*").eq("organization_id", requireOrg()).order("started_at", { ascending: false }).limit(100)
  if (connectionId) q = q.eq("bank_connection_id", connectionId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createSyncLog(input: Omit<CashflowSyncLog, "id" | "created_at">): Promise<CashflowSyncLog> {
  if (PREVIEW_MODE) {
    const row: CashflowSyncLog = { id: newId(), ...input, created_at: nowIso() }
    saveMock("cashflow_sync_logs", [row, ...loadMock<CashflowSyncLog>("cashflow_sync_logs", seedSyncLogs)])
    return row
  }
  const { data, error } = await supabase.from("cashflow_sync_logs").insert(input).select().single()
  if (error) throw error
  return data
}

// ─── Trigger sync via Edge Function ─────────────────────────────────────────

export async function triggerMercurySync(connectionId: string): Promise<{ imported: number; skipped: number }> {
  if (PREVIEW_MODE) {
    // Simulate a sync in preview mode
    await new Promise((r) => setTimeout(r, 1200))
    const conn = loadMock<BankConnection>("bank_connections", seedBankConnections).find((c) => c.id === connectionId)
    if (!conn) throw new Error("Connection not found")
    const rows = loadMock<BankConnection>("bank_connections", seedBankConnections)
    const idx = rows.findIndex((r) => r.id === connectionId)
    rows[idx] = { ...rows[idx], last_sync_at: nowIso(), status: "active", error_message: null, updated_at: nowIso() }
    saveMock("bank_connections", rows)
    return { imported: 0, skipped: 14 }
  }
  const { data, error } = await supabase.functions.invoke("mercury-sync", { body: { connection_id: connectionId } })
  if (error) throw error
  return data as { imported: number; skipped: number }
}

export async function triggerPlaidSync(connectionId: string): Promise<{ imported: number; skipped: number }> {
  if (PREVIEW_MODE) {
    await new Promise((r) => setTimeout(r, 1500))
    return { imported: 0, skipped: 0 }
  }
  const { data, error } = await supabase.functions.invoke("plaid-sync", { body: { connection_id: connectionId } })
  if (error) throw error
  return data as { imported: number; skipped: number }
}

export async function getPlaidLinkToken(): Promise<string> {
  if (PREVIEW_MODE) return "link-sandbox-preview-token"
  const { data, error } = await supabase.functions.invoke("plaid-link-token")
  if (error) throw error
  return (data as { link_token: string }).link_token
}

// ── Storage / Documents ──────────────────────────────────────────────────────

/** Upload a profile avatar; returns the public URL with a cache-bust param. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

/** Fetch all documents attached to an entity, newest first. */
export async function listDocuments(
  entityType: EntityType,
  entityId: string,
): Promise<DocumentRecord[]> {
  if (PREVIEW_MODE) return []
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", requireOrg())
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  const rows = data ?? []

  // Resolve uploader names via a separate profiles lookup
  const uploaderIds = [...new Set(rows.map((d) => d.uploaded_by).filter((id): id is string => !!id))]
  const uploaderMap: Record<string, string | null> = {}
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds)
    for (const p of profiles ?? []) {
      uploaderMap[p.id] = p.full_name ?? null
    }
  }

  return rows.map((d) => ({
    id: d.id,
    entity_type: d.entity_type as EntityType,
    entity_id: d.entity_id,
    file_name: d.file_name,
    file_size: d.file_size,
    mime_type: d.mime_type,
    storage_path: d.storage_path,
    uploaded_by: d.uploaded_by,
    created_at: d.created_at,
    description: d.description ?? null,
    uploader_name: d.uploaded_by ? (uploaderMap[d.uploaded_by] ?? null) : null,
  }))
}

/** Upload a file to storage and insert a documents metadata row. */
export async function uploadDocument(
  entityType: EntityType,
  entityId: string,
  file: File,
  uploadedBy: string,
  description?: string | null,
): Promise<DocumentRecord> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-()[\] ]/g, "_")
  const path = `${entityType}/${entityId}/${Date.now()}_${safeName}`

  const { error: storageErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type || "application/octet-stream" })
  if (storageErr) throw new Error(storageErr.message)

  const { data, error: insertErr } = await supabase
    .from("documents")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      storage_path: path,
      uploaded_by: uploadedBy,
      organization_id: requireOrg(),
      description: description ?? null,
    })
    .select("*")
    .single()
  if (insertErr || !data) throw new Error(insertErr?.message ?? "Insert returned no data")

  // Resolve uploader name
  let uploaderName: string | null = null
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", uploadedBy)
    .single()
  if (profile) uploaderName = profile.full_name ?? null

  return {
    id: data.id,
    entity_type: data.entity_type as EntityType,
    entity_id: data.entity_id,
    file_name: data.file_name,
    file_size: data.file_size,
    mime_type: data.mime_type,
    storage_path: data.storage_path,
    uploaded_by: data.uploaded_by,
    created_at: data.created_at,
    description: data.description ?? null,
    uploader_name: uploaderName,
  }
}

/** Update mutable fields on a document metadata row. */
export async function updateDocument(id: string, updates: { description?: string | null }): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase.from("documents").update(updates).eq("id", id)
  if (error) throw new Error(error.message)
}

/** Delete a document from storage and remove its metadata row. */
export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  const { error: storageErr } = await supabase.storage
    .from("documents")
    .remove([storagePath])
  if (storageErr) throw new Error(storageErr.message)
  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

/** Create a 1-hour signed download URL for a private document. */
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60 * 60)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ── Organization management ───────────────────────────────────────────────────

/** List all organizations the current user belongs to, with their role in each. */
export async function listMyOrganizations(): Promise<OrgWithRole[]> {
  if (PREVIEW_MODE) {
    return [{ id: "preview-org", name: "Preview Org", slug: "preview", logo_url: null, created_at: new Date().toISOString(), role: "super_user" as const }]
  }
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return []

  // 1. Get the user's org memberships
  const { data: members, error: memErr } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userData.user.id)
  if (memErr) throw new Error(memErr.message)
  if (!members || members.length === 0) return []

  // 2. Fetch the org details separately (avoids relational-select issues)
  const orgIds = members.map((m) => m.organization_id)
  const { data: orgs, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, created_at")
    .in("id", orgIds)
  if (orgErr) throw new Error(orgErr.message)

  // 3. Merge
  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o]))
  return members.flatMap((m) => {
    const org = orgMap.get(m.organization_id)
    if (!org) return []
    return [{ ...org, role: m.role as import("@/types/db").TeamRole }]
  })
}

/** Add a user to an organization with a given role. */
export async function addOrgMember(orgId: string, userId: string, role: import("@/types/db").TeamRole): Promise<void> {
  if (PREVIEW_MODE) return
  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role })
  if (error) throw new Error(error.message)
}

/** Update a user's role within the current organization. */
export async function updateOrgMemberRole(userId: string, role: import("@/types/db").TeamRole): Promise<void> {
  if (PREVIEW_MODE) return
  const orgId = requireOrg()
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

/** Remove a user from the current organization (does not delete their account). */
export async function removeOrgMember(userId: string): Promise<void> {
  if (PREVIEW_MODE) return
  const orgId = requireOrg()
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

// ── RA Program / Commission Config ───────────────────────────────────────────
// Stored per-organization. In preview mode → localStorage. In real mode →
// `ra_program_settings` table (added in PR-3 migration). Until that ships,
// real mode also falls back to localStorage so the UI works end-to-end.

const COMMISSION_CONFIG_KEY = "avanew-crm.ra.commission-config"

export const DEFAULT_COMMISSION_CONFIG: import("@/types/db").CommissionConfig = {
  one_time_mode: "flat",
  one_time_value: 1000,
  implementation_fee: 6000,
  recurring_mode: "flat",
  recurring_value: 50,
  monthly_service_fee: 600,
  recurring_duration: { kind: "indefinite" },
  attribution_window_days: 30,
  annual_minimum_referrals: 4,
  checkin_interval_days: 90,
  checkin_warning_days: 90,
  checkin_suspension_days: 150,
  agreement_version: "v1.0",
  updated_at: new Date(0).toISOString(),
}

function readCommissionConfigLocal(): import("@/types/db").CommissionConfig {
  if (typeof localStorage === "undefined") return DEFAULT_COMMISSION_CONFIG
  try {
    const raw = localStorage.getItem(COMMISSION_CONFIG_KEY)
    if (!raw) return DEFAULT_COMMISSION_CONFIG
    const parsed = JSON.parse(raw) as Partial<import("@/types/db").CommissionConfig>
    return { ...DEFAULT_COMMISSION_CONFIG, ...parsed }
  } catch {
    return DEFAULT_COMMISSION_CONFIG
  }
}

function writeCommissionConfigLocal(cfg: import("@/types/db").CommissionConfig) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(COMMISSION_CONFIG_KEY, JSON.stringify(cfg))
  } catch {
    /* ignore quota errors */
  }
}

/** Load the active commission config for the current org. */
export async function getCommissionConfig(): Promise<import("@/types/db").CommissionConfig> {
  if (PREVIEW_MODE) return readCommissionConfigLocal()
  try {
    const { data, error } = await supabase
      .from("ra_program_settings" as never)
      .select("*")
      .eq("organization_id", requireOrg())
      .maybeSingle()
    if (error) throw error
    if (!data) return DEFAULT_COMMISSION_CONFIG
    return rowToCommissionConfig(data as Record<string, unknown>)
  } catch {
    return readCommissionConfigLocal()
  }
}

/** Persist the commission config. Bumps `updated_at`. */
export async function saveCommissionConfig(
  cfg: Omit<import("@/types/db").CommissionConfig, "updated_at">
): Promise<import("@/types/db").CommissionConfig> {
  const next: import("@/types/db").CommissionConfig = {
    ...cfg,
    updated_at: new Date().toISOString(),
  }
  writeCommissionConfigLocal(next)
  if (PREVIEW_MODE) return next
  const orgId = requireOrg()
  const row = {
    organization_id: orgId,
    one_time_mode: cfg.one_time_mode,
    one_time_value: cfg.one_time_value,
    implementation_fee: cfg.implementation_fee,
    recurring_mode: cfg.recurring_mode,
    recurring_value: cfg.recurring_value,
    monthly_service_fee: cfg.monthly_service_fee,
    recurring_duration_kind: cfg.recurring_duration.kind,
    recurring_duration_months:
      cfg.recurring_duration.kind === "months" ? cfg.recurring_duration.months : null,
    attribution_window_days: cfg.attribution_window_days,
    annual_minimum_referrals: cfg.annual_minimum_referrals,
    checkin_interval_days: cfg.checkin_interval_days,
    checkin_warning_days: cfg.checkin_warning_days,
    checkin_suspension_days: cfg.checkin_suspension_days,
    agreement_version: cfg.agreement_version,
  }
  const { data, error } = await supabase
    .from("ra_program_settings" as never)
    .upsert(row as never, { onConflict: "organization_id" })
    .select()
    .single()
  if (error) throw error
  return rowToCommissionConfig(data as Record<string, unknown>)
}

function rowToCommissionConfig(row: Record<string, unknown>): import("@/types/db").CommissionConfig {
  return {
    one_time_mode: row.one_time_mode as "flat" | "percent",
    one_time_value: Number(row.one_time_value),
    implementation_fee: Number(row.implementation_fee),
    recurring_mode: row.recurring_mode as "flat" | "percent",
    recurring_value: Number(row.recurring_value),
    monthly_service_fee: Number(row.monthly_service_fee),
    recurring_duration:
      row.recurring_duration_kind === "months"
        ? { kind: "months", months: Number(row.recurring_duration_months ?? 12) }
        : { kind: "indefinite" },
    attribution_window_days: Number(row.attribution_window_days),
    annual_minimum_referrals: Number(row.annual_minimum_referrals),
    checkin_interval_days: Number(row.checkin_interval_days),
    checkin_warning_days: Number(row.checkin_warning_days),
    checkin_suspension_days: Number(row.checkin_suspension_days),
    agreement_version: String(row.agreement_version),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}

// ── Agreement acceptance ─────────────────────────────────────────────────────
// localStorage-backed until PR-3 migration adds the columns + audit table.

const AGREEMENT_LS_PREFIX = "avanew-crm.ra.agreement."

type AgreementAcceptance = {
  agreement_completed: true
  agreement_version: string
  agreement_accepted_at: string
  agreement_ip_address: string | null
  agreement_user_agent: string | null
  agreement_signed_name: string
}

export function getLocalAgreementAcceptance(raId: string): AgreementAcceptance | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(AGREEMENT_LS_PREFIX + raId)
    return raw ? (JSON.parse(raw) as AgreementAcceptance) : null
  } catch {
    return null
  }
}

export async function saveRaAgreement(
  raId: string,
  data: { signed_name: string; agreement_version: string }
): Promise<AgreementAcceptance> {
  const acceptance: AgreementAcceptance = {
    agreement_completed: true,
    agreement_version: data.agreement_version,
    agreement_accepted_at: new Date().toISOString(),
    agreement_ip_address: null,
    agreement_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    agreement_signed_name: data.signed_name,
  }
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(AGREEMENT_LS_PREFIX + raId, JSON.stringify(acceptance))
    } catch {
      /* ignore quota */
    }
  }
  if (PREVIEW_MODE) return acceptance
  try {
    // Edge function captures IP from request headers and writes the audit row + ra_associates patch.
    const { data: result, error } = await supabase.functions.invoke<AgreementAcceptance>(
      "accept-agreement",
      {
        body: {
          ra_associate_id: raId,
          agreement_version: data.agreement_version,
          signed_legal_name: data.signed_name,
        },
      }
    )
    if (error) throw error
    return result ?? acceptance
  } catch (err) {
    // Surface but don't block — localStorage holds the optimistic state.
    console.warn("[saveRaAgreement] edge function failed; client copy retained.", err)
    return acceptance
  }
}

// ── Preview-mode RA record ───────────────────────────────────────────────────
// Lets the RA onboarding + dashboard flows render with mock data when
// VITE_PREVIEW_MODE=true. Persisted to localStorage so step completions stick
// across page reloads in preview.

const PREVIEW_RA_LS = "avanew-crm.preview.ra-associate"

function getPreviewRaAssociate(): import("@/types/db").RaAssociate {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(PREVIEW_RA_LS)
      if (raw) {
        const parsed = JSON.parse(raw) as import("@/types/db").RaAssociate
        // Merge any local agreement acceptance so completion sticks
        const localAgreement = getLocalAgreementAcceptance(parsed.id)
        return localAgreement ? { ...parsed, ...localAgreement } : parsed
      }
    } catch {
      /* fall through */
    }
  }
  const seed: import("@/types/db").RaAssociate = {
    id: "preview-ra-id",
    organization_id: "preview-org",
    user_id: "preview-user",
    slug: "preview",
    display_name: "Preview Associate",
    status: "pending",
    photo_url: null,
    contact_phone: null,
    contact_email: null,
    bio: null,
    ach_account_holder: null,
    ach_bank_name: null,
    ach_routing: null,
    ach_account: null,
    photo_completed: false,
    contact_completed: false,
    banking_completed: false,
    submitted_at: null,
    verification_notes: null,
    verified_at: null,
    activated_at: null,
    template_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: "preview@divigner.com",
    full_name: "Preview Associate",
  }
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(PREVIEW_RA_LS, JSON.stringify(seed)) } catch { /* ignore */ }
  }
  return seed
}

// ── W-9 upload (R4b) ─────────────────────────────────────────────────────────
// localStorage-backed metadata until PR-3 migration adds columns + ra-w9
// storage bucket. The actual PDF blob is held in-memory only in preview mode.

const W9_LS_PREFIX = "avanew-crm.ra.w9."

type W9Acceptance = {
  w9_completed: true
  w9_document_url: string
  w9_uploaded_at: string
}

export function getLocalW9(raId: string): W9Acceptance | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(W9_LS_PREFIX + raId)
    return raw ? (JSON.parse(raw) as W9Acceptance) : null
  } catch {
    return null
  }
}

export async function saveRaW9(
  raId: string,
  file: File
): Promise<W9Acceptance> {
  if (file.size > 10 * 1024 * 1024) throw new Error("W-9 must be under 10 MB")
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("W-9 must be a PDF file")
  }
  if (PREVIEW_MODE) {
    const stub: W9Acceptance = {
      w9_completed: true,
      w9_document_url: `preview://w9/${raId}/${encodeURIComponent(file.name)}`,
      w9_uploaded_at: new Date().toISOString(),
    }
    if (typeof localStorage !== "undefined") {
      try { localStorage.setItem(W9_LS_PREFIX + raId, JSON.stringify(stub)) } catch { /* ignore */ }
    }
    return stub
  }
  // Real mode: upload to private ra-w9 bucket, then mark RA row.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const path = `${user.id}/w9-${Date.now()}.pdf`
  const { error: uploadErr } = await supabase.storage
    .from("ra-w9")
    .upload(path, file, { upsert: false, contentType: "application/pdf" })
  if (uploadErr) throw uploadErr
  const acceptance: W9Acceptance = {
    w9_completed: true,
    w9_document_url: path,
    w9_uploaded_at: new Date().toISOString(),
  }
  const { error: updateErr } = await supabase
    .from("ra_associates")
    .update({
      w9_completed: true,
      w9_document_url: path,
      w9_uploaded_at: acceptance.w9_uploaded_at,
    } as never)
    .eq("id", raId)
  if (updateErr) throw updateErr
  return acceptance
}

// ── Preview-mode RA list + invite + status mutation ──────────────────────────
// Mirrors listRaAssociates / inviteRa / status mutation behavior using
// localStorage so admin views render without Supabase access.

const PREVIEW_RA_LIST_LS = "avanew-crm.preview.ra-list"

function seedPreviewRaList(): import("@/types/db").RaAssociate[] {
  const base = (overrides: Partial<import("@/types/db").RaAssociate>): import("@/types/db").RaAssociate => ({
    id: crypto.randomUUID(),
    organization_id: "preview-org",
    user_id: crypto.randomUUID(),
    slug: "ra",
    display_name: "Referral Associate",
    status: "pending",
    photo_url: null,
    contact_phone: null,
    contact_email: null,
    bio: null,
    ach_account_holder: null,
    ach_bank_name: null,
    ach_routing: null,
    ach_account: null,
    photo_completed: false,
    contact_completed: false,
    banking_completed: false,
    submitted_at: null,
    verification_notes: null,
    verified_at: null,
    activated_at: null,
    template_id: null,
    created_at: new Date(Date.now() - 86400_000 * 30).toISOString(),
    updated_at: new Date().toISOString(),
    email: "ra@example.com",
    full_name: "Referral Associate",
    ...overrides,
  })

  return [
    base({
      slug: "jae",
      display_name: "Jae McKinney",
      status: "active",
      photo_completed: true,
      contact_completed: true,
      banking_completed: true,
      w9_completed: true,
      agreement_completed: true,
      activated_at: new Date(Date.now() - 86400_000 * 12).toISOString(),
      email: "jae@divigner.com",
      full_name: "Jae McKinney",
      contact_phone: "+18045550101",
      contact_email: "jae@divigner.com",
    }),
    base({
      slug: "rachel-stevens",
      display_name: "Rachel Stevens",
      status: "verification",
      photo_completed: true,
      contact_completed: true,
      banking_completed: true,
      w9_completed: true,
      agreement_completed: true,
      submitted_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
      email: "rachel.stevens@example.com",
      full_name: "Rachel Stevens",
    }),
    base({
      slug: "marcus-okafor",
      display_name: "Marcus Okafor",
      status: "pending",
      photo_completed: true,
      contact_completed: false,
      banking_completed: false,
      created_at: new Date(Date.now() - 86400_000 * 5).toISOString(),
      email: "marcus.okafor@example.com",
      full_name: "Marcus Okafor",
    }),
    base({
      slug: "priya-narayan",
      display_name: "Priya Narayan",
      status: "needs_changes",
      photo_completed: true,
      contact_completed: true,
      banking_completed: false,
      verification_notes: "ACH routing number appears invalid. Please re-submit banking details.",
      email: "priya.narayan@example.com",
      full_name: "Priya Narayan",
    }),
    base({
      slug: "dan-fischer",
      display_name: "Dan Fischer",
      status: "declined",
      email: "dan.fischer@example.com",
      full_name: "Dan Fischer",
    }),
  ]
}

function listPreviewRaAssociates(): import("@/types/db").RaAssociate[] {
  if (typeof localStorage === "undefined") return seedPreviewRaList()
  try {
    const raw = localStorage.getItem(PREVIEW_RA_LIST_LS)
    if (raw) return JSON.parse(raw) as import("@/types/db").RaAssociate[]
  } catch {
    /* fall through */
  }
  const seed = seedPreviewRaList()
  try { localStorage.setItem(PREVIEW_RA_LIST_LS, JSON.stringify(seed)) } catch { /* ignore */ }
  return seed
}

function savePreviewRaList(list: import("@/types/db").RaAssociate[]) {
  if (typeof localStorage === "undefined") return
  try { localStorage.setItem(PREVIEW_RA_LIST_LS, JSON.stringify(list)) } catch { /* ignore */ }
}

async function invitePreviewRa(input: {
  email: string
  first_name: string
  last_name: string
  slug: string
}): Promise<import("@/types/db").RaAssociate> {
  const list = listPreviewRaAssociates()
  if (list.some((r) => r.slug === input.slug)) throw new Error(`Slug "${input.slug}" is already in use`)
  if (list.some((r) => r.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error(`${input.email} has already been invited`)
  }
  const display = `${input.first_name} ${input.last_name}`.trim()
  const created: import("@/types/db").RaAssociate = {
    id: crypto.randomUUID(),
    organization_id: "preview-org",
    user_id: crypto.randomUUID(),
    slug: input.slug,
    display_name: display,
    status: "pending",
    photo_url: null,
    contact_phone: null,
    contact_email: null,
    bio: null,
    ach_account_holder: null,
    ach_bank_name: null,
    ach_routing: null,
    ach_account: null,
    photo_completed: false,
    contact_completed: false,
    banking_completed: false,
    submitted_at: null,
    verification_notes: null,
    verified_at: null,
    activated_at: null,
    template_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email: input.email,
    full_name: display,
  }
  savePreviewRaList([created, ...list])
  return created
}

/** Update RA status (admin action). Mocks in preview, real Supabase otherwise. */
export async function updateRaStatus(
  raId: string,
  patch: Partial<Pick<import("@/types/db").RaAssociate, "status" | "verification_notes" | "verified_at" | "activated_at">>
): Promise<void> {
  if (PREVIEW_MODE) {
    const list = listPreviewRaAssociates()
    const idx = list.findIndex((r) => r.id === raId)
    if (idx === -1) throw new Error("RA not found")
    list[idx] = { ...list[idx], ...patch, updated_at: new Date().toISOString() }
    savePreviewRaList(list)
    return
  }
  const { error } = await supabase
    .from("ra_associates")
    .update(patch)
    .eq("id", raId)
  if (error) throw error

  // Fire the matching RA lifecycle notification (best-effort).
  if (patch.status === "active") await notifyRaStatus(raId, "approved")
  else if (patch.status === "declined") await notifyRaStatus(raId, "declined")
  else if (patch.status === "needs_changes") {
    await notifyRaStatus(raId, "changes_requested", patch.verification_notes ?? undefined)
  }
}

/** Fetch a single RA by slug. Preview-aware. */
export async function getRaBySlug(slug: string): Promise<import("@/types/db").RaAssociate | null> {
  if (PREVIEW_MODE) {
    return listPreviewRaAssociates().find((r) => r.slug === slug) ?? null
  }
  const { data, error } = await supabase
    .from("ra_associates")
    .select(`
      *,
      profiles!ra_associates_user_id_fkey ( email, full_name )
    `)
    .eq("slug", slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const profile = (data as Record<string, unknown>).profiles as { email: string; full_name: string | null } | null
  const { profiles: _p, ...rest } = data as Record<string, unknown>
  return { ...rest, email: profile?.email ?? "", full_name: profile?.full_name ?? null } as import("@/types/db").RaAssociate
}

// ── RA-attributed leads / deals / payouts (preview-aware) ────────────────────

type RaLead = {
  id: string
  ra_slug: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  stage: "new" | "qualified" | "proposal_sent" | "call_booked" | "closed_won" | "closed_lost"
  value: number | null
  intent: "learning" | "interested" | "sold" | null
  notes: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  closed_reason: string | null
}

type RaPayout = {
  id: string
  ra_slug: string
  deal_id: string | null
  client_name: string
  type: "one_time" | "recurring"
  period_start: string | null
  period_end: string | null
  amount: number
  status: "scheduled" | "paid" | "skipped" | "cancelled"
  paid_at: string | null
}

function seedRaLeads(): RaLead[] {
  const now = Date.now()
  const day = 86400_000
  const d = (offset: number) => new Date(now - offset * day).toISOString()
  return [
    // jae's pipeline
    { id: "rl-1",  ra_slug: "jae", name: "Sarah Chen",     company: "Riverbend Health",   email: "sarah@riverbend.health", phone: "+1 415 555 0102", stage: "new",           value: 6000,  intent: "interested", notes: "Met at NJ Health Tech Mixer.",      created_at: d(2),  updated_at: d(1),  closed_at: null,        closed_reason: null },
    { id: "rl-2",  ra_slug: "jae", name: "Marcus Rivera",  company: "Apex Capital",       email: "marcus@apexcap.io",      phone: "+1 212 555 0103", stage: "qualified",     value: 6000,  intent: "interested", notes: "Wants demo before EOM.",            created_at: d(5),  updated_at: d(3),  closed_at: null,        closed_reason: null },
    { id: "rl-3",  ra_slug: "jae", name: "Dr. Linda Park", company: "PineStreet Pediatrics", email: "lpark@pinestreet.med", phone: "+1 609 555 0104", stage: "proposal_sent", value: 6000,  intent: "interested", notes: "Sent SOW Apr 14. Awaiting board.",  created_at: d(10), updated_at: d(4),  closed_at: null,        closed_reason: null },
    { id: "rl-4",  ra_slug: "jae", name: "Tomás Aguilar",  company: "Aguilar Insurance", email: "tomas@aguilar-ins.com",  phone: "+1 305 555 0105", stage: "call_booked",   value: 6000,  intent: "interested", notes: "Discovery call Tuesday 2pm.",      created_at: d(8),  updated_at: d(2),  closed_at: null,        closed_reason: null },
    { id: "rl-5",  ra_slug: "jae", name: "Greta Olsen",    company: "Olsen Estate Law",   email: "greta@olsenlaw.com",     phone: "+1 201 555 0106", stage: "closed_won",    value: 6000,  intent: "sold",       notes: "Signed Mar 18. Implementation kicked off.", created_at: d(45), updated_at: d(10), closed_at: d(10),       closed_reason: null },
    { id: "rl-6",  ra_slug: "jae", name: "Avery Kahn",     company: "Kahn Realty Group",  email: "avery@kahnrealty.com",   phone: "+1 732 555 0107", stage: "closed_won",    value: 6000,  intent: "sold",       notes: "Live since Feb 22.",                created_at: d(80), updated_at: d(20), closed_at: d(20),       closed_reason: null },
    { id: "rl-7",  ra_slug: "jae", name: "Beth Quan",      company: "Quan Family Dental", email: "drquan@quandental.com",  phone: "+1 856 555 0108", stage: "closed_lost",   value: null,  intent: "learning",   notes: "Chose competitor (cheaper).",       created_at: d(40), updated_at: d(15), closed_at: d(15),       closed_reason: "budget" },
  ]
}

function seedRaPayouts(): RaPayout[] {
  const day = 86400_000
  const now = Date.now()
  const d = (offset: number) => new Date(now - offset * day).toISOString()
  const dateOnly = (offset: number) => new Date(now - offset * day).toISOString().slice(0,10)
  return [
    // Greta Olsen — one-time + recurring
    { id: "p-1",  ra_slug: "jae", deal_id: "rl-5", client_name: "Olsen Estate Law",  type: "one_time", period_start: null,             period_end: null,             amount: 1000, status: "paid",      paid_at: d(8) },
    { id: "p-2",  ra_slug: "jae", deal_id: "rl-5", client_name: "Olsen Estate Law",  type: "recurring", period_start: dateOnly(40),    period_end: dateOnly(10),     amount: 50,   status: "paid",      paid_at: d(8) },
    { id: "p-3",  ra_slug: "jae", deal_id: "rl-5", client_name: "Olsen Estate Law",  type: "recurring", period_start: dateOnly(10),    period_end: dateOnly(-20),    amount: 50,   status: "scheduled", paid_at: null },
    // Avery Kahn — one-time + accumulating recurring
    { id: "p-4",  ra_slug: "jae", deal_id: "rl-6", client_name: "Kahn Realty Group", type: "one_time", period_start: null,             period_end: null,             amount: 1000, status: "paid",      paid_at: d(18) },
    { id: "p-5",  ra_slug: "jae", deal_id: "rl-6", client_name: "Kahn Realty Group", type: "recurring", period_start: dateOnly(80),    period_end: dateOnly(50),     amount: 50,   status: "paid",      paid_at: d(45) },
    { id: "p-6",  ra_slug: "jae", deal_id: "rl-6", client_name: "Kahn Realty Group", type: "recurring", period_start: dateOnly(50),    period_end: dateOnly(20),     amount: 50,   status: "paid",      paid_at: d(15) },
    { id: "p-7",  ra_slug: "jae", deal_id: "rl-6", client_name: "Kahn Realty Group", type: "recurring", period_start: dateOnly(20),    period_end: dateOnly(-10),    amount: 50,   status: "scheduled", paid_at: null },
  ]
}

export async function listLeadsForRaSlug(slug: string): Promise<RaLead[]> {
  if (PREVIEW_MODE) {
    const overrides = readLeadOverrides()
    return seedRaLeads()
      .filter((l) => l.ra_slug === slug)
      .map((l) => ({ ...l, ...(overrides[l.id] ?? {}) } as RaLead))
  }
  // Real Supabase: join leads → ra_associates by slug. Requires PR-3 stage column.
  const { data, error } = await supabase
    .from("leads" as never)
    .select(`
      id, organization_id, first_name, last_name, company, email, phone,
      stage, attribution_expires_at, prospect_intent, description,
      created_at, updated_at, closed_at, closed_reason,
      referred_by_ra_id,
      ra_associates!leads_referred_by_ra_id_fkey ( slug )
    ` as never)
    .order("updated_at", { ascending: false } as never)
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  return rows
    .filter((r) => (r.ra_associates as { slug?: string } | null)?.slug === slug)
    .map((r) => ({
      id: String(r.id),
      ra_slug: slug,
      name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
      company: (r.company as string) ?? null,
      email: (r.email as string) ?? null,
      phone: (r.phone as string) ?? null,
      stage: (r.stage as RaLead["stage"]) ?? "new",
      value: 6000,
      intent: (r.prospect_intent as RaLead["intent"]) ?? null,
      notes: (r.description as string) ?? null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      closed_at: (r.closed_at as string) ?? null,
      closed_reason: (r.closed_reason as string) ?? null,
    }))
}

export async function listPayoutsForRaSlug(slug: string): Promise<RaPayout[]> {
  if (PREVIEW_MODE) {
    const seeded = seedRaPayouts().filter((p) => p.ra_slug === slug)
    const generated = readGeneratedPayouts().filter((p) => p.ra_slug === slug)
    return [...generated, ...seeded]
  }
  const ra = await getRaBySlug(slug)
  if (!ra) return []
  const { data, error } = await supabase
    .from("commission_payouts" as never)
    .select("*")
    .eq("ra_associate_id", ra.id)
    .order("created_at", { ascending: false } as never)
  if (error) throw error
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    ra_slug: slug,
    deal_id: (r.deal_id as string) ?? null,
    client_name: (r.notes as string) ?? "Client",
    type: r.type as RaPayout["type"],
    period_start: (r.period_start as string) ?? null,
    period_end: (r.period_end as string) ?? null,
    amount: Number(r.amount),
    status: r.status as RaPayout["status"],
    paid_at: (r.paid_at as string) ?? null,
  }))
}

// ── Client check-ins (PR-13) ─────────────────────────────────────────────────

export type ClientCheckin = {
  id: string
  ra_slug: string
  lead_id: string | null
  client_name: string
  checkin_at: string
  method: "phone" | "video" | "in_person" | "email"
  notes: string | null
  created_by: string | null
}

export type ActiveClient = {
  lead_id: string
  client_name: string
  closed_at: string
  last_checkin_at: string | null
  days_since: number          // days since closed_at if no check-in, else since last_checkin_at
  severity: "ok" | "warning" | "overdue"
}

const CHECKINS_LS = "avanew-crm.preview.client-checkins"

function readCheckins(): ClientCheckin[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(CHECKINS_LS)
    return raw ? (JSON.parse(raw) as ClientCheckin[]) : []
  } catch { return [] }
}
function writeCheckins(arr: ClientCheckin[]) {
  if (typeof localStorage === "undefined") return
  try { localStorage.setItem(CHECKINS_LS, JSON.stringify(arr)) } catch { /* ignore */ }
}

export async function listCheckinsForRaSlug(slug: string): Promise<ClientCheckin[]> {
  if (PREVIEW_MODE) {
    return readCheckins()
      .filter((c) => c.ra_slug === slug)
      .sort((a, b) => (a.checkin_at < b.checkin_at ? 1 : -1))
  }
  const ra = await getRaBySlug(slug)
  if (!ra) return []
  const { data, error } = await supabase
    .from("client_checkins" as never)
    .select("id, lead_id, client_name, checkin_at, method, notes, created_by")
    .eq("ra_associate_id", ra.id)
    .order("checkin_at", { ascending: false } as never)
  if (error) throw error
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    ra_slug: slug,
    lead_id: (r.lead_id as string) ?? null,
    client_name: (r.client_name as string) ?? "Client",
    checkin_at: String(r.checkin_at),
    method: r.method as ClientCheckin["method"],
    notes: (r.notes as string) ?? null,
    created_by: (r.created_by as string) ?? null,
  }))
}

export async function logClientCheckin(input: {
  ra_slug: string
  lead_id: string | null
  client_name: string
  method: ClientCheckin["method"]
  notes?: string | null
}): Promise<ClientCheckin> {
  const now = new Date().toISOString()
  if (PREVIEW_MODE) {
    const row: ClientCheckin = {
      id: crypto.randomUUID(),
      ra_slug: input.ra_slug,
      lead_id: input.lead_id,
      client_name: input.client_name,
      checkin_at: now,
      method: input.method,
      notes: input.notes ?? null,
      created_by: null,
    }
    writeCheckins([row, ...readCheckins()])
    return row
  }
  const ra = await getRaBySlug(input.ra_slug)
  if (!ra) throw new Error("RA not found")
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from("client_checkins" as never)
    .insert({
      organization_id: ra.organization_id,
      ra_associate_id: ra.id,
      lead_id: input.lead_id,
      client_name: input.client_name,
      method: input.method,
      notes: input.notes ?? null,
      created_by: user?.id ?? null,
    } as never)
    .select("id, lead_id, client_name, checkin_at, method, notes, created_by")
    .single()
  if (error) throw error
  const r = data as unknown as Record<string, unknown>
  return {
    id: String(r.id),
    ra_slug: input.ra_slug,
    lead_id: (r.lead_id as string) ?? null,
    client_name: String(r.client_name),
    checkin_at: String(r.checkin_at),
    method: r.method as ClientCheckin["method"],
    notes: (r.notes as string) ?? null,
    created_by: (r.created_by as string) ?? null,
  }
}

/** Active clients (closed_won, not lost) with derived check-in status. */
export async function listActiveClientsForRaSlug(slug: string): Promise<ActiveClient[]> {
  const [leads, checkins, cfg] = await Promise.all([
    listLeadsForRaSlug(slug),
    listCheckinsForRaSlug(slug),
    getCommissionConfig(),
  ])
  const active = leads.filter((l) => l.stage === "closed_won")
  const dayMs = 86400_000
  const now = Date.now()
  return active.map((l) => {
    const lc = checkins
      .filter((c) => c.lead_id === l.id)
      .sort((a, b) => (a.checkin_at < b.checkin_at ? 1 : -1))[0] ?? null
    const lastIso = lc?.checkin_at ?? l.closed_at ?? l.updated_at
    const days = Math.floor((now - new Date(lastIso).getTime()) / dayMs)
    const severity: ActiveClient["severity"] =
      days >= cfg.checkin_suspension_days ? "overdue"
        : days >= cfg.checkin_warning_days ? "warning"
        : "ok"
    return {
      lead_id: l.id,
      client_name: l.company ?? l.name,
      closed_at: l.closed_at ?? l.updated_at,
      last_checkin_at: lc?.checkin_at ?? null,
      days_since: days,
      severity,
    }
  })
}

// ── Annual minimum tracker (PR-14) ───────────────────────────────────────────

export type AnnualMinimumStatus = {
  year: number
  count: number
  target: number
  on_track: boolean
  days_remaining_in_year: number
  grace_period_active: boolean   // Jan 1–Apr 1 of FOLLOWING year
  grace_days_remaining: number   // days until suspension flag if shortfall
}

export async function getAnnualMinimumStatus(
  slug: string,
  year?: number,
): Promise<AnnualMinimumStatus> {
  const cfg = await getCommissionConfig()
  const target = cfg.annual_minimum_referrals
  const now = new Date()
  const evalYear = year ?? now.getFullYear()
  const leads = await listLeadsForRaSlug(slug)
  const count = leads.filter((l) => {
    if (l.stage !== "closed_won") return false
    const when = l.closed_at ?? l.updated_at
    if (!when) return false
    return new Date(when).getFullYear() === evalYear
  }).length
  const yearEnd = new Date(evalYear, 11, 31)
  const graceEnd = new Date(evalYear + 1, 3, 1) // Apr 1 of next year
  const dayMs = 86400_000
  const days_remaining_in_year = Math.max(
    0,
    Math.ceil((yearEnd.getTime() - now.getTime()) / dayMs),
  )
  const inGrace = now.getTime() > yearEnd.getTime() && now.getTime() < graceEnd.getTime()
  const grace_days_remaining = Math.max(
    0,
    Math.ceil((graceEnd.getTime() - now.getTime()) / dayMs),
  )
  return {
    year: evalYear,
    count,
    target,
    on_track: count >= target,
    days_remaining_in_year,
    grace_period_active: inGrace && count < target,
    grace_days_remaining: inGrace ? grace_days_remaining : 0,
  }
}

export type { RaLead, RaPayout }

// ── Lead detail / mutations (A8) ─────────────────────────────────────────────

const LEAD_NOTES_LS_PREFIX = "avanew-crm.lead.notes."
const PREVIEW_LEAD_OVERRIDES_LS = "avanew-crm.preview.lead-overrides"

type LeadNote = { id: string; text: string; at: string }

function readLeadOverrides(): Record<string, Partial<RaLead>> {
  if (typeof localStorage === "undefined") return {}
  try {
    const raw = localStorage.getItem(PREVIEW_LEAD_OVERRIDES_LS)
    return raw ? JSON.parse(raw) as Record<string, Partial<RaLead>> : {}
  } catch { return {} }
}
function writeLeadOverride(id: string, patch: Partial<RaLead>) {
  if (typeof localStorage === "undefined") return
  const map = readLeadOverrides()
  map[id] = { ...map[id], ...patch }
  try { localStorage.setItem(PREVIEW_LEAD_OVERRIDES_LS, JSON.stringify(map)) } catch { /* ignore */ }
}

function readLeadNotes(leadId: string): LeadNote[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(LEAD_NOTES_LS_PREFIX + leadId)
    return raw ? (JSON.parse(raw) as LeadNote[]) : []
  } catch { return [] }
}
function writeLeadNotes(leadId: string, notes: LeadNote[]) {
  if (typeof localStorage === "undefined") return
  try { localStorage.setItem(LEAD_NOTES_LS_PREFIX + leadId, JSON.stringify(notes)) } catch { /* ignore */ }
}

export async function getLeadDetail(leadId: string): Promise<{ lead: RaLead; notes: LeadNote[] }> {
  if (PREVIEW_MODE) {
    const base = seedRaLeads().find((l) => l.id === leadId)
    if (!base) throw new Error("Lead not found")
    const overrides = readLeadOverrides()[leadId] ?? {}
    const lead = { ...base, ...overrides } as RaLead
    return { lead, notes: readLeadNotes(leadId) }
  }
  // Real Supabase
  const { data, error } = await supabase
    .from("leads" as never)
    .select(`
      id, organization_id, first_name, last_name, company, email, phone,
      stage, prospect_intent, description, created_at, updated_at,
      closed_at, closed_reason,
      referred_by_ra_id,
      ra_associates!leads_referred_by_ra_id_fkey ( slug )
    ` as never)
    .eq("id", leadId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error("Lead not found")
  const row = data as unknown as Record<string, unknown>
  const lead: RaLead = {
    id: String(row.id),
    ra_slug: ((row.ra_associates as { slug?: string } | null)?.slug) ?? "",
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
    company: (row.company as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    stage: (row.stage as RaLead["stage"]) ?? "new",
    value: 6000,
    intent: (row.prospect_intent as RaLead["intent"]) ?? null,
    notes: (row.description as string) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    closed_at: (row.closed_at as string) ?? null,
    closed_reason: (row.closed_reason as string) ?? null,
  }
  return { lead, notes: readLeadNotes(leadId) }
}

export async function updateLeadStage(leadId: string, stage: RaLead["stage"]): Promise<RaLead> {
  const now = new Date().toISOString()
  const isClosed = stage === "closed_won" || stage === "closed_lost"
  if (PREVIEW_MODE) {
    writeLeadOverride(leadId, {
      stage,
      updated_at: now,
      ...(isClosed ? { closed_at: now } : { closed_at: null }),
    })
    const { lead } = await getLeadDetail(leadId)
    if (stage === "closed_won") {
      try { await generatePayoutsForDeal(leadId, lead.ra_slug) }
      catch { /* swallow — payout generation is best-effort */ }
    }
    return lead
  }
  const { error } = await supabase
    .from("leads" as never)
    .update({
      stage,
      updated_at: now,
      closed_at: isClosed ? now : null,
    } as never)
    .eq("id", leadId)
  if (error) throw error
  const { lead } = await getLeadDetail(leadId)
  if (stage === "closed_won") {
    try { await generatePayoutsForDeal(leadId, lead.ra_slug) }
    catch { /* swallow — payout generation is best-effort */ }
  }
  return lead
}

// ── Payout schedule generation (PR-12) ───────────────────────────────────────

const GENERATED_PAYOUTS_LS = "avanew-crm.preview.payouts-generated"
const INDEFINITE_HORIZON_MONTHS = 24

function readGeneratedPayouts(): RaPayout[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(GENERATED_PAYOUTS_LS)
    return raw ? (JSON.parse(raw) as RaPayout[]) : []
  } catch { return [] }
}
function writeGeneratedPayouts(payouts: RaPayout[]) {
  if (typeof localStorage === "undefined") return
  try { localStorage.setItem(GENERATED_PAYOUTS_LS, JSON.stringify(payouts)) } catch { /* ignore */ }
}

function monthBoundaries(anchor: Date, monthsAhead: number): { start: string; end: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth() + monthsAhead, 1)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + monthsAhead + 1, 0)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

/**
 * Generate the commission payout schedule for a closed-won deal.
 * Writes one one-time payout + N recurring payouts (N = months in duration,
 * or 24 months for indefinite). Idempotent: returns existing payouts if
 * already generated for this lead.
 */
export async function generatePayoutsForDeal(
  leadId: string,
  raSlug: string,
): Promise<RaPayout[]> {
  const [cfg, lead, ra] = await Promise.all([
    getCommissionConfig(),
    getLeadDetail(leadId).then((r) => r.lead),
    getRaBySlug(raSlug),
  ])
  if (!ra) throw new Error("RA not found for payout generation")

  const oneTimeAmount = calcOneTimeCommission(cfg)
  const recurringAmount = calcRecurringCommissionPerMonth(cfg)
  const monthsCount =
    cfg.recurring_duration.kind === "indefinite"
      ? INDEFINITE_HORIZON_MONTHS
      : cfg.recurring_duration.months

  // Anchor: the month implementation completes — treat closed_at as the
  // implementation-paid moment. First recurring period starts the next month.
  const anchorIso = lead.closed_at ?? new Date().toISOString()
  const anchor = new Date(anchorIso)
  const clientName = lead.company ?? lead.name

  if (PREVIEW_MODE) {
    const existing = readGeneratedPayouts()
    const already = existing.filter((p) => p.deal_id === leadId)
    if (already.length > 0) return already

    const oneTime: RaPayout = {
      id: `pg-${leadId}-ot`,
      ra_slug: raSlug,
      deal_id: leadId,
      client_name: clientName,
      type: "one_time",
      period_start: null,
      period_end: null,
      amount: oneTimeAmount,
      status: "scheduled",
      paid_at: null,
    }
    const recurring: RaPayout[] = Array.from({ length: monthsCount }, (_, i) => {
      const { start, end } = monthBoundaries(anchor, i + 1)
      return {
        id: `pg-${leadId}-r${i + 1}`,
        ra_slug: raSlug,
        deal_id: leadId,
        client_name: clientName,
        type: "recurring",
        period_start: start,
        period_end: end,
        amount: recurringAmount,
        status: "scheduled",
        paid_at: null,
      }
    })
    const fresh = [oneTime, ...recurring]
    writeGeneratedPayouts([...existing, ...fresh])
    return fresh
  }

  // Supabase path: skip if any payouts already exist for this lead.
  const { data: existing, error: existingErr } = await supabase
    .from("commission_payouts" as never)
    .select("id")
    .eq("lead_id", leadId)
    .limit(1)
  if (existingErr) throw existingErr
  if ((existing ?? []).length > 0) return []

  const rows: Array<Record<string, unknown>> = [
    {
      organization_id: ra.organization_id,
      ra_associate_id: ra.id,
      lead_id: leadId,
      type: "one_time",
      amount: oneTimeAmount,
      status: "scheduled",
      notes: clientName,
    },
    ...Array.from({ length: monthsCount }, (_, i) => {
      const { start, end } = monthBoundaries(anchor, i + 1)
      return {
        organization_id: ra.organization_id,
        ra_associate_id: ra.id,
        lead_id: leadId,
        type: "recurring",
        amount: recurringAmount,
        status: "scheduled",
        period_start: start,
        period_end: end,
        notes: clientName,
      }
    }),
  ]
  const { error } = await supabase.from("commission_payouts" as never).insert(rows as never)
  if (error) throw error
  return []
}

export async function addLeadNote(leadId: string, text: string): Promise<LeadNote> {
  const note: LeadNote = { id: crypto.randomUUID(), text, at: new Date().toISOString() }
  const all = [note, ...readLeadNotes(leadId)]
  writeLeadNotes(leadId, all)
  return note
}
