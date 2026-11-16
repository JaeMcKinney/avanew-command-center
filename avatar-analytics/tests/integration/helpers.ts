import { execFileSync } from "node:child_process"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
export const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!
export const FUNCTIONS_URL = process.env.VITE_FUNCTIONS_URL ?? "http://127.0.0.1:54399/functions/v1"
export const MOCK_TAVUS = "http://127.0.0.1:54398"
export const PASSWORD = "Correct-horse-9-battery"

/** Service-role client: bypasses row-level security. Test set-up only. */
export const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Empties every app table and removes every user, so each file starts clean. */
export function resetDatabase() {
  const sql = `
    truncate public.client_notes, public.client_contacts, public.usage_topups, public.notifications, public.invoices, public.stripe_events, public.client_billing, public.plans,
      public.avatar_knowledge, public.questions, public.question_groups, public.conversation_insights,
      public.usage_daily, public.transcripts, public.conversations, public.tavus_events,
      public.avatar_secrets, public.avatars, public.tavus_deployments, public.tavus_pals,
      public.tavus_sync_runs, public.staff_client_assignments, public.audit_log, public.clients
      restart identity cascade;
    delete from auth.users;
    delete from public.roles where not is_system;
  `
  execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_avatar-analytics", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
    { stdio: ["ignore", "ignore", "inherit"] },
  )
}

export async function resetMockTavus(overrides: Record<string, unknown> = {}) {
  await fetch(`${MOCK_TAVUS}/__control/reset`, { method: "POST", body: JSON.stringify(overrides) })
}

export async function mockTavusState(): Promise<{
  pals: Array<Record<string, unknown>>
  patches: Array<{ pal_id: string; ops: Array<{ op: string; path: string; value: unknown }> }>
  documents: Array<{ document_id: string; document_url: string; document_name: string; crawl?: unknown }>
  recrawls: string[]
  emails: Array<{ from: string; to: string[]; subject: string; text: string; html: string }>
  deploymentPatches: Array<{ deployment_id: string; ops: Array<{ op: string; path: string; value: unknown }> }>
  deployments: Array<{ deployment_id: string; status: string }>
  stripe: {
    customers: Array<{ id: string; name: string; email: string; metadata: { client_id: string } }>
    sessions: Array<{ id: string; url: string; form: Record<string, string> }>
    portals: Array<Record<string, string>>
    subscriptions: Record<string, unknown>
    calls: Array<{ method: string; path: string; form: Record<string, string> }>
  }
  anthropicCalls: number
}> {
  return (await fetch(`${MOCK_TAVUS}/__control/state`)).json()
}

export type TestUser = { id: string; email: string; client: SupabaseClient; token: string }

async function roleId(key: string): Promise<string> {
  const { data, error } = await admin.from("roles").select("id").eq("key", key).single()
  if (error) throw error
  return data.id
}

/** Creates a user with a role and signs them in. */
export async function createUser(opts: {
  email: string
  role: string
  clientId?: string
  assignedClientIds?: string[]
}): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: opts.email.split("@")[0] },
  })
  if (error) throw error
  const id = data.user.id

  const role = await roleId(opts.role)
  const side = opts.clientId ? "client" : "divigner"
  const { error: profileError } = await admin.from("profiles").upsert({
    id,
    email: opts.email,
    full_name: opts.email.split("@")[0],
    side,
    role_id: role,
    client_id: opts.clientId ?? null,
  })
  if (profileError) throw profileError

  if (opts.assignedClientIds?.length) {
    const { error: assignError } = await admin
      .from("staff_client_assignments")
      .insert(opts.assignedClientIds.map((client_id) => ({ user_id: id, client_id })))
    if (assignError) throw assignError
  }
  return signIn(opts.email, id)
}

export async function signIn(email: string, id = ""): Promise<TestUser> {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return { id: id || data.user.id, email, client, token: data.session.access_token }
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function callFunction(
  name: string,
  body: unknown,
  opts: { token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    // keep text
  }
  return { status: res.status, body: parsed }
}

export async function createClientRow(owner: TestUser, name: string, slug: string, timezone = "America/New_York") {
  const { data, error } = await owner.client.rpc("create_client", { p_name: name, p_slug: slug, p_timezone: timezone })
  if (error) throw error
  return data as { id: string; name: string; slug: string }
}

/** Puts a PAL in the catalog and links it to a client, without calling Tavus. */
export async function seedAvatar(clientId: string, palId: string, name: string) {
  await admin.from("tavus_pals").upsert({ pal_id: palId, name })
  const { data, error } = await admin
    .from("avatars")
    .insert({ client_id: clientId, tavus_pal_id: palId, display_name: name })
    .select("id")
    .single()
  if (error) throw error
  const token = Array.from(palId, (ch) => ch.charCodeAt(0).toString(16)).join("").padEnd(48, "0")
  const secret = { avatar_id: data.id, webhook_token: token, callback_secret: `secret-${palId}` }
  const { error: secretError } = await admin.from("avatar_secrets").insert(secret)
  if (secretError) throw secretError
  return { id: data.id as string, token: secret.webhook_token, secret: secret.callback_secret }
}

export function event(conversationId: string, type: string, timestamp: string, properties: Record<string, unknown> = {}) {
  return {
    conversation_id: conversationId,
    event_type: type,
    message_type: type.split(".")[0],
    timestamp,
    properties,
  }
}

export async function ingest(avatarId: string, payload: unknown, source = "webhook") {
  const { data, error } = await admin.rpc("ingest_tavus_event", { p_avatar_id: avatarId, p_payload: payload, p_source: source })
  if (error) throw error
  return data as { stored: boolean; counted: boolean; talk_seconds: number | null; billable_seconds: number | null; usage_date: string }
}
