// Every read and write the screens make. Row-level security in the database
// decides what each signed-in person gets back; nothing here filters for
// security.

import type { PostgrestError } from "@supabase/supabase-js"
import type { AgencyBrand, Theme } from "@/lib/brand"
import type { DateRange } from "@/lib/dates"
import { sumGlass, type GlassTotals } from "@/lib/glass"
import { callFunction, callFunctionRaw, supabase } from "@/lib/supabase"
import type { Database } from "@/types/db"

type Tables = Database["public"]["Tables"]
export type Client = Tables["clients"]["Row"]
export type Avatar = Tables["avatars"]["Row"]
export type Deployment = Tables["tavus_deployments"]["Row"]
export type Profile = Tables["profiles"]["Row"]
export type Role = Tables["roles"]["Row"]
export type Permission = Tables["permissions"]["Row"]
export type Conversation = Tables["conversations"]["Row"]
export type SyncRun = Tables["tavus_sync_runs"]["Row"]
export type AuditEntry = Tables["audit_log"]["Row"]

export type Access = {
  user_id: string
  email: string
  full_name: string
  side: "divigner" | "client"
  is_active: boolean
  role: { id: string; key: string; name: string; client_scope: "all" | "assigned" }
  permissions: string[]
  client: Pick<Client, "id" | "name" | "slug" | "logo_url" | "brand_color" | "timezone" | "status"> | null
  /** The agency this person works for, or whose client they belong to. Null for Divigner's own. */
  agency: AgencyBrand | null
}

export type UsageTotals = { conversations: number; talk_seconds: number; billable_seconds: number }
export type PalSearchHit = {
  pal_id: string
  name: string
  thumbnail_image_url: string | null
  tavus_updated_at: string | null
  deployments: Array<{ deployment_id: string; name: string; channel: string; status: string; allowed_origins: string[] }>
  linked_avatar_id: string | null
  linked_client_id: string | null
  linked_client_name: string | null
}
export type LinkResult = {
  pal_id: string
  status: "linked" | "linked_webhook_error" | "already_linked" | "callback_in_use" | "not_found" | "error"
  avatar_id?: string
  message?: string
  existing_callback_host?: string
}

/** Turns a database error into a sentence a person can act on. */
function fail(error: PostgrestError): never {
  if (error.code === "23505") {
    throw new Error(error.message.includes("slug") ? "That web address is already used by another client." : "That already exists.")
  }
  if (error.code === "42501" || /permission/i.test(error.message)) {
    throw new Error(/^You /.test(error.message) ? error.message : "You do not have permission to do this.")
  }
  throw new Error(error.message)
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) fail(result.error)
  return result.data as T
}

// ── Signed-in user ───────────────────────────────────────────────────────────

export async function fetchAccess(): Promise<Access | null> {
  return unwrap(await supabase.rpc("my_access")) as Access | null
}

// ── Clients ──────────────────────────────────────────────────────────────────

export async function listClients(): Promise<Client[]> {
  return unwrap(await supabase.from("clients").select("*").order("name"))
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  return unwrap(await supabase.from("clients").select("*").eq("slug", slug).maybeSingle())
}

export async function createClient(input: {
  name: string
  slug: string
  timezone: string
  brand_color?: string
  logo_url?: string
}): Promise<Client> {
  return unwrap(
    await supabase.rpc("create_client", {
      p_name: input.name,
      p_slug: input.slug,
      p_timezone: input.timezone,
      p_brand_color: input.brand_color || undefined,
      p_logo_url: input.logo_url || undefined,
    }),
  )
}

export async function updateClient(
  id: string,
  patch: Partial<Pick<Client, "name" | "status" | "timezone" | "logo_url" | "brand_color">>,
): Promise<Client> {
  const rows = unwrap(await supabase.from("clients").update(patch).eq("id", id).select())
  if (!rows.length) throw new Error("You do not have permission to edit this client.")
  return rows[0]
}

// ── Avatars and Tavus ────────────────────────────────────────────────────────

/** Linked avatars, oldest link first so each keeps its chart colour. */
export async function listAvatars(clientId?: string): Promise<Avatar[]> {
  let query = supabase.from("avatars").select("*").is("unlinked_at", null).order("linked_at").order("id")
  if (clientId) query = query.eq("client_id", clientId)
  return unwrap(await query)
}

export async function listDeployments(palIds: string[]): Promise<Deployment[]> {
  if (!palIds.length) return []
  return unwrap(
    await supabase.from("tavus_deployments").select("*").in("pal_id", palIds).is("removed_at", null).order("name"),
  )
}

export async function searchPals(query: string): Promise<PalSearchHit[]> {
  return unwrap(await supabase.rpc("search_tavus_pals", { p_query: query, p_limit: 50 })) as unknown as PalSearchHit[]
}

export async function linkAvatars(clientId: string, palIds: string[], replaceExistingCallback = false): Promise<LinkResult[]> {
  const res = await callFunction<{ results: LinkResult[] }>("avatar-link", {
    action: "link",
    client_id: clientId,
    pals: palIds.map((pal_id) => ({ pal_id })),
    replace_existing_callback: replaceExistingCallback,
  })
  return res.results
}

export function retryWebhook(avatarId: string) {
  return callFunction<{ ok: true }>("avatar-link", { action: "retry", avatar_id: avatarId })
}

export function unlinkAvatar(avatarId: string) {
  return callFunction<{ ok: true; warning: string | null }>("avatar-link", { action: "unlink", avatar_id: avatarId })
}

export async function renameAvatar(id: string, patch: { display_name: string; role_label: string | null }) {
  const rows = unwrap(await supabase.from("avatars").update(patch).eq("id", id).select())
  if (!rows.length) throw new Error("You do not have permission to edit this avatar.")
}

export function syncTavus() {
  return callFunction<{ pals: number; deployments: number; synced_at: string }>("tavus-sync", {})
}

export async function lastSyncRun(): Promise<SyncRun | null> {
  return unwrap(await supabase.from("tavus_sync_runs").select("*").order("id", { ascending: false }).limit(1).maybeSingle())
}

// ── Usage ────────────────────────────────────────────────────────────────────

export async function usageByClient(range: DateRange): Promise<Map<string, UsageTotals>> {
  const rows = unwrap(await supabase.rpc("usage_by_client", { p_from: range.from, p_to: range.to }))
  return new Map(rows.map((r) => [r.client_id, r]))
}

export async function usageByAvatar(clientId: string, range: DateRange): Promise<Map<string, UsageTotals>> {
  const rows = unwrap(await supabase.rpc("usage_by_avatar", { p_client_id: clientId, p_from: range.from, p_to: range.to }))
  return new Map(rows.map((r) => [r.avatar_id, r]))
}

export async function usageByDay(clientId: string | null, range: DateRange): Promise<Array<UsageTotals & { usage_date: string }>> {
  return unwrap(
    // The generated types mark the argument as required; the function accepts null for "all clients".
    await supabase.rpc("usage_by_day", { p_client_id: clientId as string, p_from: range.from, p_to: range.to }),
  )
}

export function sumUsage(rows: Iterable<UsageTotals>): UsageTotals {
  const total = { conversations: 0, talk_seconds: 0, billable_seconds: 0 }
  for (const r of rows) {
    total.conversations += Number(r.conversations)
    total.talk_seconds += Number(r.talk_seconds)
    total.billable_seconds += Number(r.billable_seconds)
  }
  return total
}

/** Every avatar the client has had, including ones since unlinked, so old conversations keep their name. */
export async function listAvatarsEver(clientId: string): Promise<Avatar[]> {
  return unwrap(await supabase.from("avatars").select("*").eq("client_id", clientId).order("linked_at").order("id"))
}

export const CONVERSATIONS_PAGE_SIZE = 25

/** One page of finished calls, newest first, optionally for a single avatar. `page` starts at 1. */
export async function listConversations(
  clientId: string,
  range: DateRange,
  options: { avatarId?: string | null; page?: number } = {},
): Promise<{ rows: Conversation[]; total: number }> {
  const page = Math.max(1, options.page ?? 1)
  let query = supabase
    .from("conversations")
    .select("*", { count: "exact" })
    .eq("client_id", clientId)
    .gte("usage_date", range.from)
    .lte("usage_date", range.to)
    .not("talk_seconds", "is", null)
  if (options.avatarId) query = query.eq("avatar_id", options.avatarId)
  const { data, error, count } = await query
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("conversation_id")
    .range((page - 1) * CONVERSATIONS_PAGE_SIZE, page * CONVERSATIONS_PAGE_SIZE - 1)
  // Asking for a page past the end is not an error; it is an empty page.
  if (error && error.code !== "PGRST103") fail(error)
  return { rows: data ?? [], total: count ?? 0 }
}

export type TranscriptTurn = { role: string; content: string; seconds_from_start?: number; duration?: number }

export async function getTranscript(conversationId: string): Promise<TranscriptTurn[] | null> {
  const { data, error } = await supabase.from("transcripts").select("turns").eq("conversation_id", conversationId).maybeSingle()
  if (error) fail(error)
  return data ? (data.turns as unknown as TranscriptTurn[]) : null
}

// ── Summaries and questions ──────────────────────────────────────────────────

export type Insight = Tables["conversation_insights"]["Row"]
/** A question from one call. `group` is the client-wide entry it belongs to, when the avatar did not answer it well. */
export type Question = Tables["questions"]["Row"] & { group?: { status: string; answer: string | null } | null }
const QUESTION_COLUMNS = "*, group:question_groups(status, answer)"

/** Splits a call's questions into the ones the avatar answered, partly answered, and did not answer. */
export function splitQuestions(questions: Question[]): { answered: Question[]; partly: Question[]; unanswered: Question[] } {
  return {
    answered: questions.filter((q) => q.outcome === "answered"),
    partly: questions.filter((q) => q.outcome === "weak"),
    unanswered: questions.filter((q) => q.outcome !== "answered" && q.outcome !== "weak"),
  }
}
export type QuestionGroup = Tables["question_groups"]["Row"]

export async function getInsight(conversationId: string): Promise<{ insight: Insight | null; questions: Question[] }> {
  const [insight, questions] = await Promise.all([
    supabase.from("conversation_insights").select("*").eq("conversation_id", conversationId).maybeSingle(),
    supabase.from("questions").select(QUESTION_COLUMNS).eq("conversation_id", conversationId).order("position"),
  ])
  if (insight.error) fail(insight.error)
  return { insight: insight.data, questions: unwrap(questions) }
}

export async function listQuestionGroups(clientId: string): Promise<QuestionGroup[]> {
  return unwrap(await supabase.from("question_groups").select("*").eq("client_id", clientId)
    .order("times_asked", { ascending: false }).order("last_asked_at", { ascending: false }))
}

export type PublishResult = { knowledge_status: string; knowledge_error: string | null; waiting: boolean }

/** Sends the avatar's updated answers to Tavus. If this fails the server retries on its schedule. */
export function publishKnowledge(groupId: string) {
  return callFunction<PublishResult>("knowledge-publish", { group_id: groupId })
}

export async function answerQuestion(groupId: string, answer: string): Promise<void> {
  const { error } = await supabase.rpc("answer_question", { p_group_id: groupId, p_answer: answer })
  if (error) fail(error)
}

export async function setQuestionStatus(groupId: string, status: "open" | "dismissed"): Promise<void> {
  const { error } = await supabase.rpc("set_question_status", { p_group_id: groupId, p_status: status })
  if (error) fail(error)
}

export const EXPORT_LIMIT = 200
export type ExportItem = { conversation: Conversation; turns: TranscriptTurn[]; summary: string | null; questions: Question[] }

/** The newest EXPORT_LIMIT calls in a period that have a transcript, for "select all". */
export async function listTranscriptConversations(clientId: string, range: DateRange, avatarId: string | null): Promise<{ rows: Conversation[]; total: number }> {
  let query = supabase.from("conversations").select("*", { count: "exact" }).eq("client_id", clientId).eq("has_transcript", true)
    .gte("usage_date", range.from).lte("usage_date", range.to)
  if (avatarId) query = query.eq("avatar_id", avatarId)
  const { data, error, count } = await query.order("started_at", { ascending: false, nullsFirst: false }).order("conversation_id").limit(EXPORT_LIMIT)
  if (error) fail(error)
  return { rows: data ?? [], total: count ?? 0 }
}

/** The transcript, summary and questions for each of the given calls, in the same order. */
export async function loadExportItems(conversations: Conversation[]): Promise<ExportItem[]> {
  const ids = conversations.map((c) => c.conversation_id)
  if (ids.length === 0) return []
  const [transcripts, insights, questions] = await Promise.all([
    supabase.from("transcripts").select("conversation_id, turns").in("conversation_id", ids),
    supabase.from("conversation_insights").select("conversation_id, summary").in("conversation_id", ids).eq("status", "ready"),
    supabase.from("questions").select(QUESTION_COLUMNS).in("conversation_id", ids).order("position"),
  ])
  const turns = new Map(unwrap(transcripts).map((t) => [t.conversation_id, t.turns as unknown as TranscriptTurn[]]))
  const summaries = new Map(unwrap(insights).map((i) => [i.conversation_id, i.summary]))
  const asked = unwrap(questions) as Question[]
  return conversations.filter((c) => turns.has(c.conversation_id)).map((conversation) => ({
    conversation,
    turns: turns.get(conversation.conversation_id) ?? [],
    summary: summaries.get(conversation.conversation_id) ?? null,
    questions: asked.filter((q) => q.conversation_id === conversation.conversation_id),
  }))
}

// ── Billing ──────────────────────────────────────────────────────────────────

export type Plan = Tables["plans"]["Row"]
export type Invoice = Tables["invoices"]["Row"]
export type PlanInput = Pick<Plan, "name" | "description" | "monthly_price_cents" | "included_minutes" | "max_concurrent" | "stripe_price_id" | "is_active" | "sort">
export type BillingSummary = {
  client_id: string
  status: "none" | "incomplete" | "trialing" | "active" | "past_due" | "unpaid" | "cancelled"
  plan: Pick<Plan, "id" | "name" | "description" | "monthly_price_cents" | "currency" | "included_minutes" | "max_concurrent"> | null
  period_start: string
  period_end: string
  renews_at: string | null
  cancel_at_period_end: boolean
  has_payment_account: boolean
  has_subscription: boolean
  paused_for_usage: boolean
  used_seconds: number
  /** Minutes bought on top of the package for this period. */
  extra_minutes: number
  included_seconds: number | null
  used_percent: number | null
  /** What each fixed amount buys right now. Empty when there is no package. */
  topup_options: Array<{ amount_cents: number; minutes: number }>
}

export async function listPlans(): Promise<Plan[]> {
  return unwrap(await supabase.from("plans").select("*").order("sort").order("monthly_price_cents"))
}

export async function savePlan(id: string | null, input: PlanInput): Promise<void> {
  const result = id ? await supabase.from("plans").update(input).eq("id", id).select("id") : await supabase.from("plans").insert(input).select("id")
  if (result.error) {
    if (result.error.code === "23505") throw new Error("Another package already uses that Stripe price.")
    fail(result.error)
  }
  if (!result.data?.length) throw new Error("You do not have permission to do this.")
}

export async function getBillingSummary(clientId: string): Promise<BillingSummary> {
  const { data, error } = await supabase.rpc("billing_summary", { p_client_id: clientId })
  if (error) fail(error)
  return data as unknown as BillingSummary
}

export async function listInvoices(clientId: string, range?: DateRange): Promise<Invoice[]> {
  let query = supabase.from("invoices").select("*").eq("client_id", clientId).order("issued_at", { ascending: false }).limit(120)
  if (range) query = query.gte("issued_at", `${range.from}T00:00:00Z`).lte("issued_at", `${range.to}T23:59:59Z`)
  return unwrap(await query)
}

type BillingAction =
  | { action: "checkout" | "change_plan"; plan_id: string }
  | { action: "portal" | "resume" }
  | { action: "cancel"; reason: string }
  | { action: "topup"; amount_cents: number }

export function billingAction(clientId: string, body: BillingAction) {
  return callFunction<{ ok: true; url?: string; resumed?: boolean; ends_at?: string }>("billing", { ...body, client_id: clientId })
}

export type UsageRules = { alertPercent: number; pauseEnabled: boolean; pausePercent: number; topupAmountsCents: number[]; topupRatePercent: number; customMinCents: number; customMaxCents: number }

export async function getUsageRules(): Promise<UsageRules> {
  const rows = unwrap(await supabase.from("settings").select("key, value").in("key", ["usage.alert_percent", "usage.pause_enabled", "usage.pause_percent", "billing.topup_amounts_cents", "billing.topup_rate_percent", "billing.topup_custom_min_cents", "billing.topup_custom_max_cents"]))
  const value = (key: string) => rows.find((r) => r.key === key)?.value
  const amounts = value("billing.topup_amounts_cents")
  return {
    alertPercent: Number(value("usage.alert_percent") ?? 90), pauseEnabled: value("usage.pause_enabled") !== false, pausePercent: Number(value("usage.pause_percent") ?? 100),
    topupAmountsCents: Array.isArray(amounts) ? amounts.map(Number) : [], topupRatePercent: Number(value("billing.topup_rate_percent") ?? 100),
    customMinCents: Number(value("billing.topup_custom_min_cents") ?? 0), customMaxCents: Number(value("billing.topup_custom_max_cents") ?? 0),
  }
}

export async function saveUsageRules(rules: UsageRules): Promise<void> {
  const changes: Array<[string, number | boolean | number[]]> = [
    ["usage.alert_percent", rules.alertPercent], ["usage.pause_enabled", rules.pauseEnabled], ["usage.pause_percent", rules.pausePercent],
    ["billing.topup_amounts_cents", rules.topupAmountsCents], ["billing.topup_rate_percent", rules.topupRatePercent],
    ["billing.topup_custom_min_cents", rules.customMinCents], ["billing.topup_custom_max_cents", rules.customMaxCents],
  ]
  for (const [key, value] of changes) {
    const { data, error } = await supabase.from("settings").update({ value }).eq("key", key).select("key")
    if (error) fail(error)
    if (!data?.length) throw new Error("You do not have permission to change settings.")
  }
}

// ── Staff: avatar detail from Tavus, the client file, money, logos ───────────

type Json = Record<string, unknown>
export type TavusPart<T> = { ok: true; data: T } | { ok: false; error: string }
export type PalDetail = {
  fetched_at: string
  pal: Json & { pal_id: string; pal_name?: string; system_prompt?: string; greeting?: string; default_face_id?: string; layers?: Record<string, Json> }
  face: TavusPart<Json> | null
  tools: TavusPart<Json[]>
  skills: TavusPart<Record<string, Json>>
  objectives: TavusPart<Json> | null
  guardrails: Array<{ id: string } & TavusPart<Json>>
  guardrail_tags: string[]
  documents: Array<{ id: string } & TavusPart<Json>>
  document_tags: string[]
  linked: { id: string; display_name: string; role_label: string | null; webhook_status: string; clients: { name: string; slug: string } | null } | null
  deployments: Array<{ deployment_id: string; name: string; channel: string; status: string; allowed_origins: string[]; limits: Json }>
}

export function getPalDetail(palId: string) {
  return callFunction<PalDetail>("tavus-pal", { pal_id: palId })
}

/** The face each PAL uses, from the last Tavus refresh. Staff only. */
export async function listPalFaces(): Promise<Map<string, string | null>> {
  const rows = unwrap(await supabase.from("tavus_pals").select("pal_id, default_face_id"))
  return new Map(rows.map((r) => [r.pal_id, r.default_face_id]))
}

export type CrmClient = {
  id: string; name: string; slug: string; status: string; logo_url: string | null; brand_color: string | null
  website: string | null; industry: string | null; phone: string | null; created_at: string; account_manager: string | null
  plan: string | null; monthly_price_cents: number; billing_status: string; cancel_at_period_end: boolean; renews_at: string | null
  avatars: number; users: number; contacts: number; notes: number; last_note_at: string | null
  primary_contact: { full_name: string; email: string | null; phone: string | null } | null
  minutes_30d: number; last_call_at: string | null; paid_cents: number
}
export type ClientContact = Tables["client_contacts"]["Row"]
export type ClientNote = Tables["client_notes"]["Row"]
export type ContactInput = Pick<ClientContact, "full_name" | "title" | "email" | "phone" | "is_primary" | "notes">
export type AccountInput = Pick<Client, "website" | "industry" | "phone" | "address" | "account_manager_id">

export async function listCrmClients(): Promise<CrmClient[]> {
  const { data, error } = await supabase.rpc("crm_clients")
  if (error) fail(error)
  return (data ?? []) as unknown as CrmClient[]
}

export async function listContacts(clientId?: string): Promise<Array<ClientContact & { clients?: { name: string; slug: string } | null }>> {
  let query = supabase.from("client_contacts").select("*, clients(name, slug)").order("is_primary", { ascending: false }).order("full_name")
  if (clientId) query = query.eq("client_id", clientId)
  return unwrap(await query)
}

export async function saveContact(clientId: string, id: string | null, input: ContactInput, userId: string): Promise<void> {
  const result = id
    ? await supabase.from("client_contacts").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id).select("id")
    : await supabase.from("client_contacts").insert({ ...input, client_id: clientId, created_by: userId }).select("id")
  if (result.error) fail(result.error)
  if (!result.data?.length) throw new Error("You do not have permission to do this.")
}

export async function deleteContact(id: string): Promise<void> {
  const { data, error } = await supabase.from("client_contacts").delete().eq("id", id).select("id")
  if (error) fail(error)
  if (!data?.length) throw new Error("You do not have permission to do this.")
}

export async function listNotes(clientId: string): Promise<ClientNote[]> {
  return unwrap(await supabase.from("client_notes").select("*").eq("client_id", clientId).order("pinned", { ascending: false }).order("created_at", { ascending: false }))
}

export async function addNote(clientId: string, userId: string, body: string, kind: string): Promise<void> {
  const { error } = await supabase.from("client_notes").insert({ client_id: clientId, author_id: userId, body, kind })
  if (error) fail(error)
}

export async function updateNote(id: string, patch: { body?: string; pinned?: boolean }): Promise<void> {
  const { data, error } = await supabase.from("client_notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("id")
  if (error) fail(error)
  if (!data?.length) throw new Error("Only the person who wrote a note can change it.")
}

export async function deleteNote(id: string): Promise<void> {
  const { data, error } = await supabase.from("client_notes").delete().eq("id", id).select("id")
  if (error) fail(error)
  if (!data?.length) throw new Error("Only the person who wrote a note can remove it.")
}

export async function updateClientAccount(id: string, input: AccountInput): Promise<void> {
  const { data, error } = await supabase.from("clients").update(input).eq("id", id).select("id")
  if (error) fail(error)
  if (!data?.length) throw new Error("You do not have permission to do this.")
}

/** Stores an edited logo (PNG) and makes it the client's logo. Returns its address. */
export async function uploadClientLogo(clientId: string, png: Blob): Promise<string> {
  const path = `${clientId}/${crypto.randomUUID()}.png`
  const { error } = await supabase.storage.from("logos").upload(path, png, { contentType: "image/png", cacheControl: "31536000" })
  if (error) throw new Error("The logo could not be saved. Check that it is under 1 MB and try again.")
  const url = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl
  const saved = await supabase.from("clients").update({ logo_url: url }).eq("id", clientId).select("id")
  if (saved.error) fail(saved.error)
  if (!saved.data?.length) throw new Error("You do not have permission to do this.")
  return url
}

export type FinanceMonth = { month: string; subscription_cents: number; extra_cents: number; addon_cents: number; minutes: number; usage_cost_cents: number; fixed_cost_cents: number }
export type FinanceClient = { id: string; name: string; slug: string; subscription_cents: number; extra_cents: number; minutes: number; usage_cost_cents: number }
export type Finance = {
  cost_per_minute_cents: number; fixed_monthly_cost_cents: number; months: FinanceMonth[]; clients: FinanceClient[]
  mrr_cents: number; ending_mrr_cents: number; subscribers: number; past_due: number
}

export async function getFinance(range: DateRange): Promise<Finance> {
  const { data, error } = await supabase.rpc("finance_summary", { p_from: range.from, p_to: range.to })
  if (error) fail(error)
  return data as unknown as Finance
}

export async function saveFinanceCosts(costPerMinuteCents: number, fixedMonthlyCents: number): Promise<void> {
  for (const [key, value] of [["finance.cost_per_minute_cents", costPerMinuteCents], ["finance.fixed_monthly_cost_cents", fixedMonthlyCents]] as const) {
    const { data, error } = await supabase.from("settings").update({ value }).eq("key", key).select("key")
    if (error) fail(error)
    if (!data?.length) throw new Error("You do not have permission to change settings.")
  }
}

export type TopupCustomRule = { min_cents: number; max_cents: number; minutes_per_dollar: number; currency: string }

export async function getTopupCustomRule(clientId: string): Promise<TopupCustomRule | null> {
  const { data, error } = await supabase.rpc("topup_custom_rule", { p_client_id: clientId })
  if (error) fail(error)
  return (data ?? null) as unknown as TopupCustomRule | null
}

/** A ZIP of every invoice PDF in the period, with a summary spreadsheet. */
export async function downloadInvoices(clientId: string, range: DateRange): Promise<{ blob: Blob; filename: string; count: number; missing: number }> {
  const res = await callFunctionRaw("invoice-export", { client_id: clientId, from: range.from, to: range.to })
  const filename = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "invoices.zip"
  return { blob: await res.blob(), filename, count: Number(res.headers.get("X-Invoices") ?? 0), missing: Number(res.headers.get("X-Invoices-Missing") ?? 0) }
}

// ── People, roles and permissions ────────────────────────────────────────────

export async function listProfiles(filter: { side: "divigner" } | { clientId: string }): Promise<Profile[]> {
  const query = supabase.from("profiles").select("*").order("full_name")
  return unwrap(await ("side" in filter ? query.eq("side", "divigner") : query.eq("client_id", filter.clientId)))
}

const ROLE_ORDER = ["owner", "admin", "manager", "analyst", "client_admin", "client_member"]

/** Built-in roles from most to least access, then custom roles, Divigner before client. */
export async function listRoles(): Promise<Role[]> {
  const roles = unwrap(await supabase.from("roles").select("*").order("created_at").order("name"))
  const rank = (r: Role) => {
    const builtIn = ROLE_ORDER.indexOf(r.key)
    return builtIn >= 0 ? builtIn : r.side === "divigner" ? 3.5 : ROLE_ORDER.length
  }
  return roles.sort((a, b) => rank(a) - rank(b))
}

export async function listPermissions(): Promise<Permission[]> {
  return unwrap(await supabase.from("permissions").select("*").order("sort"))
}

export async function listRolePermissions(): Promise<Array<{ role_id: string; permission: string }>> {
  return unwrap(await supabase.from("role_permissions").select("role_id, permission"))
}

export async function setRolePermission(roleId: string, permission: string, granted: boolean) {
  const row = { role_id: roleId, permission }
  const result = granted
    ? await supabase.from("role_permissions").insert(row)
    : await supabase.from("role_permissions").delete().match(row)
  if (result.error) fail(result.error)
}

export function inviteUser(body: {
  email: string
  full_name: string
  role_id: string
  client_id?: string
  assigned_client_ids?: string[]
  /** Divigner inviting someone into an agency's team. Left out, staff join the inviter's own team. */
  agency_id?: string
}) {
  return callFunction<{ user_id: string }>("user-invite", body)
}

export async function setUserActive(userId: string, active: boolean) {
  unwrap(await supabase.rpc("set_user_active", { p_user_id: userId, p_active: active }))
}

export async function setUserRole(userId: string, roleId: string) {
  unwrap(await supabase.rpc("set_user_role", { p_user_id: userId, p_role_id: roleId }))
}

export async function listAssignments(): Promise<Array<{ user_id: string; client_id: string }>> {
  return unwrap(await supabase.from("staff_client_assignments").select("user_id, client_id"))
}

export async function setAssignments(userId: string, clientIds: string[]) {
  unwrap(await supabase.rpc("set_staff_assignments", { p_user_id: userId, p_client_ids: clientIds }))
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  return unwrap(await supabase.from("audit_log").select("*").order("id", { ascending: false }).limit(limit))
}

// ── Support desk ─────────────────────────────────────────────────────────────

export type Ticket = Tables["support_tickets"]["Row"]
export type TicketMessage = Omit<Tables["support_messages"]["Row"], "attachments"> & { attachments: TicketFile[] }
export type TicketFile = { path: string; name: string; size: number }
export type TicketWithClient = Ticket & { clients?: { name: string; slug: string } | null }
export type SupportStaff = { id: string; full_name: string; email: string }

export const TICKET_CATEGORIES = [
  { value: "avatar_down", label: "My Avatar Is Not Working" },
  { value: "question", label: "A Question" },
  { value: "change_request", label: "A Change to My Avatar" },
  { value: "billing", label: "Billing" },
  { value: "other", label: "Something Else" },
] as const
export const TICKET_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const
export const MAX_TICKET_FILES = 5
export const MAX_TICKET_FILE_BYTES = 10 * 1024 * 1024

/** A client's tickets, or (for staff, with no client) every ticket they may see. Newest activity first. */
export async function listTickets(clientId?: string): Promise<TicketWithClient[]> {
  let query = supabase.from("support_tickets").select("*, clients(name, slug)").order("last_message_at", { ascending: false }).limit(500)
  if (clientId) query = query.eq("client_id", clientId)
  return unwrap(await query) as TicketWithClient[]
}

export async function getTicket(number: number): Promise<TicketWithClient | null> {
  return unwrap(await supabase.from("support_tickets").select("*, clients(name, slug)").eq("number", number).maybeSingle()) as TicketWithClient | null
}

export async function listTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  return unwrap(await supabase.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at")) as unknown as TicketMessage[]
}

/** Emails the other side about a new reply. The schedule does the same, so a failure here is not a problem. */
function notifySupport() {
  void callFunction("support-notify", {}).catch(() => null)
}

/** Stores the files someone attached to a message and returns what the message should record. */
export async function uploadTicketFiles(clientId: string, userId: string, files: File[]): Promise<TicketFile[]> {
  const stored: TicketFile[] = []
  for (const file of files) {
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "file"
    const path = `${clientId}/${userId}/${crypto.randomUUID()}/${safe}`
    const { error } = await supabase.storage.from("support").upload(path, file, { contentType: file.type || "application/octet-stream" })
    if (error) throw new Error(`"${file.name}" could not be attached. Files can be images, PDFs, text, Word or Excel, up to 10 MB each.`)
    stored.push({ path, name: file.name, size: file.size })
  }
  return stored
}

/** A link to an attached file that works for one minute. */
export async function ticketFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("support").createSignedUrl(path, 60)
  if (error || !data) throw new Error("The file could not be opened.")
  return data.signedUrl
}

export async function openTicket(input: {
  clientId: string; subject: string; body: string; category: string; conversationId?: string | null; files?: TicketFile[]
}): Promise<Ticket> {
  const ticket = unwrap(await supabase.rpc("support_open_ticket", {
    p_client_id: input.clientId, p_subject: input.subject, p_body: input.body, p_category: input.category,
    p_conversation_id: input.conversationId ?? undefined, p_attachments: input.files ?? [],
  })) as Ticket
  notifySupport()
  return ticket
}

export async function replyToTicket(ticketId: string, body: string, internal: boolean, files: TicketFile[] = []): Promise<void> {
  unwrap(await supabase.rpc("support_reply", { p_ticket_id: ticketId, p_body: body, p_internal: internal, p_attachments: files }))
  if (!internal) notifySupport()
}

export async function setTicketStatus(ticketId: string, status: "open" | "waiting" | "resolved"): Promise<void> {
  unwrap(await supabase.rpc("support_set_status", { p_ticket_id: ticketId, p_status: status }))
}

export async function assignTicket(ticketId: string, assigneeId: string | null): Promise<void> {
  // The database function takes null for "nobody"; the generated types do not say so.
  unwrap(await supabase.rpc("support_assign", { p_ticket_id: ticketId, p_assignee_id: assigneeId as string }))
}

export async function updateTicket(ticketId: string, patch: { priority?: string; category?: string }): Promise<void> {
  unwrap(await supabase.rpc("support_update_ticket", { p_ticket_id: ticketId, p_priority: patch.priority, p_category: patch.category }))
}

export async function listSupportStaff(clientId: string): Promise<SupportStaff[]> {
  return unwrap(await supabase.rpc("support_staff", { p_client_id: clientId })) as SupportStaff[]
}

// ── Glass Health ──

export { sumGlass, type GlassTotals }

export type GlassStatus = "no_key" | "unchecked" | "ok" | "invalid" | "past_due" | "error"
/** A client's Glass Health connection. The key itself is never sent to the browser. */
export type GlassConnection = {
  client_id: string
  key_hint: string | null
  status: GlassStatus
  status_detail: string | null
  checked_at: string | null
  last_used_at: string | null
  enabled_at: string
  key_set_at: string | null
}

const GLASS_COLUMNS = "client_id, key_hint, status, status_detail, checked_at, last_used_at, enabled_at, key_set_at"

/** Null when Glass Health is not turned on for the client. */
export async function getGlassConnection(clientId: string): Promise<GlassConnection | null> {
  return unwrap(await supabase.from("client_glass").select(GLASS_COLUMNS).eq("client_id", clientId).maybeSingle()) as GlassConnection | null
}

export async function setGlassEnabled(clientId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc("glass_enable", { p_client_id: clientId, p_enabled: enabled })
  if (error) fail(error)
}

function glassConnection(body: { action: "save"; client_id: string; key: string } | { action: "check" | "remove"; client_id: string }) {
  return callFunction<{ connection: GlassConnection | null }>("glass-connection", body).then((r) => r.connection)
}
export const saveGlassKey = (clientId: string, key: string) => glassConnection({ action: "save", client_id: clientId, key })
export const checkGlassKey = (clientId: string) => glassConnection({ action: "check", client_id: clientId })
export const removeGlassKey = (clientId: string) => glassConnection({ action: "remove", client_id: clientId })

type GlassRow = { questions: number; failed: number; input_tokens: number; output_tokens: number; duration_ms: number; cost_cents: number | null }
const glassTotals = (r: GlassRow): GlassTotals => ({
  questions: Number(r.questions), failed: Number(r.failed), input_tokens: Number(r.input_tokens), output_tokens: Number(r.output_tokens),
  duration_ms: Number(r.duration_ms), cost_cents: r.cost_cents == null ? null : Number(r.cost_cents),
})

export async function glassUsageByDay(clientId: string, range: DateRange): Promise<Array<GlassTotals & { usage_date: string }>> {
  const rows = unwrap(await supabase.rpc("glass_usage_by_day", { p_client_id: clientId, p_from: range.from, p_to: range.to }))
  return rows.map((r) => ({ usage_date: r.usage_date, ...glassTotals(r) }))
}

export async function glassUsageByAvatar(clientId: string, range: DateRange): Promise<Map<string, GlassTotals>> {
  const rows = unwrap(await supabase.rpc("glass_usage_by_avatar", { p_client_id: clientId, p_from: range.from, p_to: range.to }))
  return new Map(rows.map((r) => [r.avatar_id, glassTotals(r)]))
}

export async function glassUsageByConversation(conversationIds: string[]): Promise<Map<string, GlassTotals>> {
  if (conversationIds.length === 0) return new Map()
  const rows = unwrap(await supabase.rpc("glass_usage_by_conversation", { p_conversation_ids: conversationIds }))
  return new Map(rows.map((r) => [r.conversation_id, glassTotals(r)]))
}

// ── Agencies ─────────────────────────────────────────────────────────────────

export type Agency = Tables["agencies"]["Row"]
/** What Divigner sees of an agency: its account and totals. No client or avatar names. */
export type AgencyUsage = {
  id: string
  name: string
  slug: string
  status: "active" | "paused"
  domain: string | null
  payment_model: "one_time" | "subscription" | null
  fee_cents: number | null
  created_at: string
  has_brand: boolean
  staff: number
  clients: number
  active_clients: number
  avatars: number
  minutes: number
  conversations: number
  glass_questions: number
  last_call_at: string | null
}

function failAgency(error: PostgrestError): never {
  if (error.code === "23505") {
    throw new Error(error.message.includes("domain") ? "Another agency already uses that address." : "Another agency already uses that short name.")
  }
  if (error.code === "23514") throw new Error("Check the short name and the address: lowercase letters, numbers and hyphens only.")
  fail(error)
}

export async function listAgencyUsage(range: DateRange): Promise<AgencyUsage[]> {
  return (unwrap(await supabase.rpc("agency_usage", { p_from: range.from, p_to: range.to })) ?? []) as AgencyUsage[]
}

export async function getAgency(slug: string): Promise<Agency | null> {
  return unwrap(await supabase.from("agencies").select("*").eq("slug", slug).maybeSingle())
}

/** The signed-in person's own agency, for its staff. */
export async function getAgencyById(id: string): Promise<Agency | null> {
  return unwrap(await supabase.from("agencies").select("*").eq("id", id).maybeSingle())
}

export type AgencyDetails = { name: string; domain: string; status: "active" | "paused"; payment_model: "" | "one_time" | "subscription"; fee_cents: number | null }

export async function createAgency(input: { name: string; slug: string; domain: string; theme: Theme | null; payment_model: string; fee_cents: number | null }): Promise<Agency> {
  const result = await supabase.rpc("create_agency", {
    p_name: input.name, p_slug: input.slug, p_domain: input.domain || undefined, p_theme: input.theme ?? undefined,
    p_payment_model: input.payment_model || undefined, p_fee_cents: input.fee_cents ?? undefined,
  })
  if (result.error) failAgency(result.error)
  return result.data as Agency
}

export async function updateAgency(id: string, input: AgencyDetails): Promise<Agency> {
  const result = await supabase.rpc("update_agency", {
    p_agency_id: id, p_name: input.name, p_domain: input.domain, p_status: input.status,
    p_payment_model: input.payment_model, p_fee_cents: input.fee_cents as number,
  })
  if (result.error) failAgency(result.error)
  return result.data as Agency
}

export async function saveAgencyBrand(id: string, input: { theme: Theme | null; logo_light_url: string | null; logo_dark_url: string | null; icon_url: string | null }): Promise<Agency> {
  return unwrap(await supabase.rpc("agency_set_brand", {
    p_agency_id: id, p_theme: input.theme as never,
    p_logo_light_url: input.logo_light_url ?? undefined, p_logo_dark_url: input.logo_dark_url ?? undefined, p_icon_url: input.icon_url ?? undefined,
  })) as Agency
}

/** Saves a logo or icon for an agency and returns its address. The image is stored as a PNG. */
export async function uploadAgencyImage(agencyId: string, png: Blob): Promise<string> {
  const path = `${agencyId}/${crypto.randomUUID()}.png`
  const { error } = await supabase.storage.from("logos").upload(path, png, { contentType: "image/png", cacheControl: "31536000" })
  if (error) throw new Error("The image could not be saved. Check that it is under 1 MB and try again.")
  return supabase.storage.from("logos").getPublicUrl(path).data.publicUrl
}

export async function agencyUsageByDay(agencyId: string, range: DateRange): Promise<Array<{ usage_date: string; minutes: number; conversations: number }>> {
  return unwrap(await supabase.rpc("agency_usage_by_day", { p_agency_id: agencyId, p_from: range.from, p_to: range.to })) ?? []
}

export type AgencyStaff = { id: string; full_name: string; email: string; role_name: string; is_active: boolean; created_at: string }

/** An agency's own staff, for Divigner. Not its clients' users. */
export async function listAgencyStaff(agencyId: string): Promise<AgencyStaff[]> {
  return unwrap(await supabase.rpc("agency_staff", { p_agency_id: agencyId })) ?? []
}

/** The brand for a sign-in page: by the address it was opened at, or by an agency's short name. */
export async function brandForHost(host: string, slug: string | null): Promise<AgencyBrand | null> {
  const { data } = await supabase.rpc("brand_for_host", { p_host: host, p_slug: slug ?? undefined })
  return (data as AgencyBrand | null) ?? null
}
