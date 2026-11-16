// Supabase clients and caller checks for server functions.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import { HttpError } from "./http.ts"
import { timingSafeEqual } from "./signature.ts"

export type { SupabaseClient }

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new HttpError(500, `Server setting ${name} is missing`)
  return value
}

/** Full-access client. Only use after the caller has been checked. */
export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type Caller = { userId: string; asUser: SupabaseClient }

/** The signed-in user who called the function, or a 401. */
export async function requireUser(req: Request): Promise<Caller> {
  const header = req.headers.get("Authorization") ?? ""
  const token = header.replace(/^Bearer\s+/i, "")
  if (!token) throw new HttpError(401, "Sign in to continue")

  const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await asUser.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, "Sign in to continue")
  return { userId: data.user.id, asUser }
}

/** Throws 403 unless the caller holds the permission (and can see the client, if given). */
export async function requireAccess(caller: Caller, permission: string, clientId?: string | null): Promise<void> {
  const { data, error } = await caller.asUser.rpc("check_access", {
    p_permission: permission,
    p_client_id: clientId ?? null,
  })
  if (error) throw new HttpError(500, "Could not check your permissions")
  if (data !== true) throw new HttpError(403, "You do not have permission to do this")
}

/** True when the request carries the schedule's shared secret. */
export function isScheduledCall(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET")
  const given = req.headers.get("x-cron-secret")
  return Boolean(expected && given && timingSafeEqual(expected, given))
}

/** Public base URL of the functions, e.g. https://<ref>.supabase.co/functions/v1 */
export function functionsBaseUrl(): string {
  const override = Deno.env.get("PUBLIC_FUNCTIONS_URL")
  return (override ?? `${env("SUPABASE_URL")}/functions/v1`).replace(/\/+$/, "")
}

export function webhookUrlFor(token: string): string {
  return `${functionsBaseUrl()}/tavus-webhook/${token}`
}

export async function writeAudit(
  admin: SupabaseClient,
  entry: {
    actorId: string | null
    action: string
    targetType?: string
    targetId?: string
    clientId?: string | null
    detail?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    client_id: entry.clientId ?? null,
    detail: entry.detail ?? {},
  })
  if (error) console.error("audit_log insert failed", error.message)
}
