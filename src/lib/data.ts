import { supabase } from "@/lib/supabase"
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
  shipping_zip: null, shipping_country: null, description: null,
}

function seedCompanies(): Company[] {
  const t = nowIso()
  return [
    { id: "c-acme", name: "Acme Robotics", domain: "acme-robotics.com", industry: "Manufacturing", notes: null, owner_id: null, ...COMPANY_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "c-northwind", name: "Northwind Capital", domain: "northwindcap.com", industry: "Finance", notes: null, owner_id: null, ...COMPANY_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "c-helix", name: "Helix Bio", domain: "helixbio.io", industry: "Biotech", notes: null, owner_id: null, ...COMPANY_EXTRA_NULLS, created_at: t, updated_at: t },
  ]
}

const CONTACT_EXTRA_NULLS = {
  mobile: null, fax: null, website: null, secondary_email: null, twitter: null,
  skype_id: null, email_opt_out: false as boolean, date_of_birth: null,
  assistant: null, asst_phone: null, department: null, lead_source: null,
  description: null,
  mailing_street: null, mailing_city: null, mailing_state: null, mailing_zip: null, mailing_country: null,
  other_street: null, other_city: null, other_state: null, other_zip: null, other_country: null,
}

function seedContacts(): Contact[] {
  const t = nowIso()
  return [
    { id: "ct-maya", first_name: "Maya", last_name: "Reyes", email: "maya.reyes@acme-robotics.com", phone: "+1 415 555 0142", title: "VP of Operations", company_id: "c-acme", owner_id: null, notes: "Met at the Robotics Summit. Interested in pilot program.", ...CONTACT_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "ct-jonas", first_name: "Jonas", last_name: "Becker", email: "jonas@northwindcap.com", phone: "+1 212 555 0188", title: "Director, Investments", company_id: "c-northwind", owner_id: null, notes: null, ...CONTACT_EXTRA_NULLS, created_at: t, updated_at: t },
    { id: "ct-priya", first_name: "Priya", last_name: "Shah", email: "priya.shah@helixbio.io", phone: null, title: "Head of BD", company_id: "c-helix", owner_id: null, notes: "Wants demo of avatar studio next quarter.", ...CONTACT_EXTRA_NULLS, created_at: t, updated_at: t },
  ]
}

function seedStages(): PipelineStage[] {
  const t = nowIso()
  return [
    { id: "s-new", name: "New", position: 1, is_won: false, is_lost: false, created_at: t },
    { id: "s-lead", name: "Lead", position: 2, is_won: false, is_lost: false, created_at: t },
    { id: "s-qualified", name: "Qualified", position: 3, is_won: false, is_lost: false, created_at: t },
    { id: "s-proposal", name: "Proposal", position: 4, is_won: false, is_lost: false, created_at: t },
    { id: "s-negotiation", name: "Negotiation", position: 5, is_won: false, is_lost: false, created_at: t },
    { id: "s-won", name: "Won", position: 6, is_won: true, is_lost: false, created_at: t },
    { id: "s-lost", name: "Lost", position: 7, is_won: false, is_lost: true, created_at: t },
  ]
}

function seedDeals(): Deal[] {
  const t = nowIso()
  return [
    {
      id: "d-acme-pilot",
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
    .insert({ ...input, owner_id })
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
  twitter?: string | null
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
      twitter: input.twitter ?? null,
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
    .insert({ ...input, owner_id })
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
    .insert({ ...input, position: nextPos })
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
    .insert({ ...input, owner_id })
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
    .insert({ ...input, owner_id })
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
  // Production: read profiles + invitations.
  // Profiles need a `role` column and an optional `email` mirror; invitations
  // is a separate table for pending invites. See supabase/schema.sql.
  const [{ data: profiles, error: pErr }, { data: invites, error: iErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, email, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("invitations")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: true }),
    ])
  if (pErr) throw pErr
  if (iErr) throw iErr
  const active: TeamMember[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: (p.email as string | null) ?? "",
    full_name: (p.full_name as string | null) ?? null,
    role: ((p.role as TeamRole | null) ?? "admin") as TeamRole,
    status: "active",
    created_at: p.created_at as string,
  }))
  const pending: TeamMember[] = (invites ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    full_name: (i.full_name as string | null) ?? null,
    role: i.role as TeamRole,
    status: "invited",
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
    { body: { email, full_name, role: input.role, redirect_to: `${window.location.origin}/setup-account` } }
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
  // Invited users live in invitations, not profiles — update the right table.
  if (status === "invited") {
    const { error } = await supabase
      .from("invitations")
      .update({ role })
      .eq("id", id)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id)
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
  // Pending invites: delete from invitations.
  // Active members: requires admin API → Edge Function.
  // Try invitations first (it's the safe case); if not found, route to function.
  const { count } = await supabase
    .from("invitations")
    .delete({ count: "exact" })
    .eq("id", id)
  if (count && count > 0) return
  const { error } = await supabase.functions.invoke("remove-user", {
    body: { user_id: id },
  })
  if (error) throw error
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
}

function seedLeads(): Lead[] {
  const t = nowIso()
  return [
    {
      id: "l-1", owner_id: null, first_name: "Alex", last_name: "Torres",
      company: "BlueWave Tech", title: "CTO", phone: "+1 650 555 0100",
      mobile: null, email: "alex@bluewave.io", fax: null,
      website: "bluewave.io", lead_source: "Web", lead_status: "New",
      industry: "Technology", annual_revenue: null, no_of_employees: 45,
      rating: "Hot", email_opt_out: false,
      street: null, city: null, state: null, zip_code: null, country: null,
      description: "Interested in enterprise plan.", converted: false,
      created_at: t, updated_at: t,
    },
  ]
}

export async function listLeads(): Promise<Lead[]> {
  if (PREVIEW_MODE) {
    const rows = previewFilterByOwner(loadMock<Lead>("leads", seedLeads))
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function createLead(input: LeadInput): Promise<Lead> {
  const owner_id = await ensureOwnerForCreate(input.owner_id)
  if (PREVIEW_MODE) {
    const row: Lead = {
      id: newId(), owner_id,
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
      created_at: nowIso(), updated_at: nowIso(),
    }
    saveMock("leads", [row, ...loadMock<Lead>("leads", seedLeads)])
    return row
  }
  const { data, error } = await supabase.from("leads").insert({ ...input, owner_id }).select().single()
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
      id: "tk-1", subject: "Follow up with Acme re: pilot", status: "Not Started",
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
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return await applyViewAsFilter(data ?? [])
}

export async function createTask(input: TaskInput): Promise<Task> {
  const owner_id = await ensureOwnerForCreate(input.owner_id)
  if (PREVIEW_MODE) {
    const row: Task = {
      id: newId(), subject: input.subject,
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
  const { data, error } = await supabase.from("tasks").insert({ ...input, owner_id }).select().single()
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

    rows.push({ id: `txn-saas-${m}`, type: "income", category: "Services", description: "SaaS subscription revenue", amount: 15000, date: `${mp}-01`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: null, reference: `INV-${y}${mo}-001`, created_at: `${mp}-01T00:00:00.000Z`, updated_at: `${mp}-01T00:00:00.000Z` })
    rows.push({ id: `txn-retainer-${m}`, type: "income", category: "Services", description: "Retainer fee — Acme Robotics", amount: 8000, date: `${mp}-05`, is_recurring: true, recurrence_period: "monthly", partner_id: "partner-acme", vendor_id: null, reference: `RET-${y}${mo}`, created_at: `${mp}-05T00:00:00.000Z`, updated_at: `${mp}-05T00:00:00.000Z` })
    rows.push({ id: `txn-payroll-${m}`, type: "expense", category: "Payroll", description: "Monthly payroll", amount: 18000, date: `${mp}-28`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: null, reference: `PAY-${y}${mo}`, created_at: `${mp}-28T00:00:00.000Z`, updated_at: `${mp}-28T00:00:00.000Z` })
    rows.push({ id: `txn-aws-${m}`, type: "expense", category: "Infrastructure", description: "AWS cloud services", amount: 2500, date: `${mp}-01`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: "vendor-aws", reference: `AWS-${y}${mo}`, created_at: `${mp}-01T00:00:00.000Z`, updated_at: `${mp}-01T00:00:00.000Z` })
    rows.push({ id: `txn-sw-${m}`, type: "expense", category: "Software", description: "SaaS tools (GitHub, Figma, Slack)", amount: 1200, date: `${mp}-01`, is_recurring: true, recurrence_period: "monthly", partner_id: null, vendor_id: "vendor-github", reference: null, created_at: `${mp}-01T00:00:00.000Z`, updated_at: `${mp}-01T00:00:00.000Z` })

    if (m % 3 === 0) {
      rows.push({ id: `txn-consulting-${m}`, type: "income", category: "Services", description: "Consulting project delivery", amount: 12000, date: `${mp}-15`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: `PROJ-${y}${mo}`, created_at: `${mp}-15T00:00:00.000Z`, updated_at: `${mp}-15T00:00:00.000Z` })
    }
    if (m === 8) {
      rows.push({ id: "txn-seed", type: "income", category: "Investments", description: "Seed funding round — Northwind Capital", amount: 50000, date: `${mp}-10`, is_recurring: false, recurrence_period: null, partner_id: "partner-northwind", vendor_id: null, reference: "SEED-2024", created_at: `${mp}-10T00:00:00.000Z`, updated_at: `${mp}-10T00:00:00.000Z` })
    }
    if (m === 6) {
      rows.push({ id: "txn-tradeshow", type: "expense", category: "Marketing", description: "Tech Summit sponsorship", amount: 5000, date: `${mp}-10`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: "MKTG-2024-Q2", created_at: `${mp}-10T00:00:00.000Z`, updated_at: `${mp}-10T00:00:00.000Z` })
    }
    if (m === 4) {
      rows.push({ id: "txn-equipment", type: "expense", category: "Equipment", description: "Development workstations (3×)", amount: 8400, date: `${mp}-05`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: "EQUIP-2024", created_at: `${mp}-05T00:00:00.000Z`, updated_at: `${mp}-05T00:00:00.000Z` })
    }
    if (m === 2) {
      rows.push({ id: "txn-legal", type: "expense", category: "Legal", description: "Contract review & IP filing", amount: 3500, date: `${mp}-20`, is_recurring: false, recurrence_period: null, partner_id: null, vendor_id: null, reference: "LEGAL-2024", created_at: `${mp}-20T00:00:00.000Z`, updated_at: `${mp}-20T00:00:00.000Z` })
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
    .order("date", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createTransaction(input: TransactionInput): Promise<CashflowTransaction> {
  if (PREVIEW_MODE) {
    const row: CashflowTransaction = {
      id: newId(),
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
    .insert(input)
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
    { id: "partner-acme", name: "Acme Partnerships LLC", type: "Strategic", email: "partners@acme-robotics.com", phone: "+1 415 555 0200", website: "acme-robotics.com", agreement_start_date: "2024-01-01", contract_terms: "Annual partnership agreement with co-marketing rights.", revenue_share: "15% revenue share on referred deals", key_contacts: "Maya Reyes (VP Operations)", notes: "Strong relationship, quarterly business reviews.", status: "Active", created_at: t, updated_at: t },
    { id: "partner-northwind", name: "Northwind Capital", type: "Financial", email: "invest@northwindcap.com", phone: "+1 212 555 0300", website: "northwindcap.com", agreement_start_date: "2024-03-01", contract_terms: "Seed investment agreement, 18-month term.", revenue_share: "Equity stake per investment terms", key_contacts: "Jonas Becker (Director, Investments)", notes: "Seed round investor. Monthly check-ins.", status: "Active", created_at: t, updated_at: t },
    { id: "partner-bluewave", name: "BlueWave Tech", type: "Reseller", email: "alex@bluewave.io", phone: "+1 650 555 0100", website: "bluewave.io", agreement_start_date: null, contract_terms: null, revenue_share: "20% reseller margin", key_contacts: "Alex Torres (CTO)", notes: "Exploring reseller agreement.", status: "Pending", created_at: t, updated_at: t },
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
    .order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createPartner(input: PartnerInput): Promise<Partner> {
  if (PREVIEW_MODE) {
    const row: Partner = {
      id: newId(),
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
  const { data, error } = await supabase.from("partners").insert(input).select().single()
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
    { id: "vendor-aws", name: "Amazon Web Services", service: "Cloud infrastructure & hosting", email: "aws-billing@amazon.com", phone: null, website: "aws.amazon.com", contract_terms: "Pay-as-you-go", payment_terms: "Net 30", cost_structure: "$2,500/month average spend on EC2, RDS, S3", cost_amount: 2500, cost_frequency: "monthly" as const, performance_notes: "99.9% uptime SLA, strong support.", status: "Active", created_at: t, updated_at: t },
    { id: "vendor-github", name: "GitHub (Microsoft)", service: "Source control & CI/CD platform", email: null, phone: null, website: "github.com", contract_terms: "Annual subscription", payment_terms: "Net 30", cost_structure: "$500/month (Team plan, 25 seats)", cost_amount: 500, cost_frequency: "monthly" as const, performance_notes: "Core tooling, no issues.", status: "Active", created_at: t, updated_at: t },
    { id: "vendor-figma", name: "Figma", service: "UI/UX design platform", email: null, phone: null, website: "figma.com", contract_terms: "Annual subscription", payment_terms: "Due on Receipt", cost_structure: "$300/month (Organization plan)", cost_amount: 300, cost_frequency: "monthly" as const, performance_notes: null, status: "Active", created_at: t, updated_at: t },
    { id: "vendor-slack", name: "Slack (Salesforce)", service: "Team communications", email: null, phone: null, website: "slack.com", contract_terms: "Annual subscription", payment_terms: "Net 30", cost_structure: "$400/month (Pro plan, 30 seats)", cost_amount: 400, cost_frequency: "monthly" as const, performance_notes: null, status: "Active", created_at: t, updated_at: t },
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
    .order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  if (PREVIEW_MODE) {
    const row: Vendor = {
      id: newId(),
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
  const { data, error } = await supabase.from("vendors").insert(input).select().single()
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
  const { data, error } = await supabase.from("bank_connections").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createBankConnection(input: Omit<BankConnection, "id" | "created_at" | "updated_at">): Promise<BankConnection> {
  if (PREVIEW_MODE) {
    const row: BankConnection = { id: newId(), ...input, created_at: nowIso(), updated_at: nowIso() }
    saveMock("bank_connections", [row, ...loadMock<BankConnection>("bank_connections", seedBankConnections)])
    return row
  }
  const { data, error } = await supabase.from("bank_connections").insert(input).select().single()
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

export async function listBankAccounts(connectionId?: string): Promise<BankAccount[]> {
  if (PREVIEW_MODE) {
    const rows = loadMock<BankAccount>("bank_accounts", seedBankAccounts)
    return connectionId ? rows.filter((r) => r.bank_connection_id === connectionId) : rows
  }
  const q = supabase.from("bank_accounts").select("*").order("created_at", { ascending: true })
  if (connectionId) q.eq("bank_connection_id", connectionId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
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
  let q = supabase.from("bank_transactions").select("*").order("date", { ascending: false })
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
  let q = supabase.from("cashflow_sync_logs").select("*").order("started_at", { ascending: false }).limit(100)
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
    .select("*, uploader:uploaded_by(full_name)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => ({
    id: d.id,
    entity_type: d.entity_type as EntityType,
    entity_id: d.entity_id,
    file_name: d.file_name,
    file_size: d.file_size,
    mime_type: d.mime_type,
    storage_path: d.storage_path,
    uploaded_by: d.uploaded_by,
    created_at: d.created_at,
    uploader_name:
      (d.uploader as unknown as { full_name: string | null } | null)
        ?.full_name ?? null,
  }))
}

/** Upload a file to storage and insert a documents metadata row. */
export async function uploadDocument(
  entityType: EntityType,
  entityId: string,
  file: File,
  uploadedBy: string,
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
    })
    .select("*, uploader:uploaded_by(full_name)")
    .single()
  if (insertErr) throw new Error(insertErr.message)
  return {
    ...data,
    entity_type: data.entity_type as EntityType,
    uploader_name:
      (data.uploader as unknown as { full_name: string | null } | null)
        ?.full_name ?? null,
  }
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
