// Every read and write the screens make. Row-level security in the database
// decides what each signed-in person gets back; nothing here filters for
// security.

import type { PostgrestError } from "@supabase/supabase-js"
import type { DateRange } from "@/lib/dates"
import { callFunction, supabase } from "@/lib/supabase"
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
