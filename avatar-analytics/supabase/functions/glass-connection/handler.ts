// Manages a client's Glass Health connection for a signed-in person.
//
// Body:
//   { action: "save", client_id, key }   store the key, then check it with Glass
//   { action: "check", client_id }       check the stored key again
//   { action: "remove", client_id }      forget the key
//
// Saving and removing go through the database as the caller, so the database
// decides who may do it. The key is never sent back.

import { requireAccess, requireUser, serviceClient, type SupabaseClient } from "../_shared/clients.ts"
import { checkGlassKey } from "../_shared/glass.ts"
import { endpoint, HttpError, json, readJson } from "../_shared/http.ts"

type Body = { action: "save"; client_id: string; key: string } | { action: "check" | "remove"; client_id: string }

const COLUMNS = "client_id, key_hint, status, status_detail, checked_at, last_used_at, enabled_at, key_set_at"

async function checkStoredKey(admin: SupabaseClient, clientId: string): Promise<void> {
  const { data: key, error } = await admin.rpc("glass_read_key", { p_client_id: clientId })
  if (error) throw new HttpError(500, "Could not read the Glass Health connection")
  if (!key) throw new HttpError(409, "There is no Glass Health key to check")
  const result = await checkGlassKey(key as string, { base: Deno.env.get("GLASS_API_BASE") || undefined })
  const { error: statusError } = await admin.rpc("glass_set_status", { p_client_id: clientId, p_status: result.status, p_detail: result.detail })
  if (statusError) throw new HttpError(500, "Could not record the result of the check")
}

export const handler = endpoint(async (req) => {
  const caller = await requireUser(req)
  const body = await readJson<Body>(req)
  if (!body || typeof body.client_id !== "string" || !["save", "check", "remove"].includes(body.action)) {
    throw new HttpError(400, "Unknown request")
  }
  await requireAccess(caller, "glass.manage", body.client_id)
  const admin = serviceClient()

  if (body.action === "save") {
    if (typeof body.key !== "string") throw new HttpError(400, "A key is required")
    const { error } = await caller.asUser.rpc("glass_set_key", { p_client_id: body.client_id, p_key: body.key })
    if (error) throw new HttpError(error.code === "42501" ? 403 : 400, error.message)
    await checkStoredKey(admin, body.client_id)
  } else if (body.action === "check") {
    await checkStoredKey(admin, body.client_id)
  } else {
    const { error } = await caller.asUser.rpc("glass_remove_key", { p_client_id: body.client_id })
    if (error) throw new HttpError(error.code === "42501" ? 403 : 400, error.message)
  }

  const { data: connection, error } = await caller.asUser.from("client_glass").select(COLUMNS).eq("client_id", body.client_id).maybeSingle()
  if (error) throw new HttpError(500, "Could not read the Glass Health connection")
  return json(200, { connection })
})
