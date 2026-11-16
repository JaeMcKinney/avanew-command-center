// Links Tavus PALs to a client (making them "avatars"), and unlinks them.
//
// Linking points the PAL's default callback_url at this app's webhook, with a
// signing secret, so every call to that avatar reports back here. Nothing
// else about the PAL is touched: prompts, faces and tools stay in Tavus.
//
// Body:
//   { action: "link", client_id, pals: [{ pal_id, display_name? }], replace_existing_callback? }
//   { action: "retry", avatar_id }     set the webhook up again after an error
//   { action: "unlink", avatar_id }

import { requireAccess, requireUser, serviceClient, webhookUrlFor, functionsBaseUrl, writeAudit, type SupabaseClient } from "../_shared/clients.ts"
import { endpoint, HttpError, json, readJson } from "../_shared/http.ts"
import { randomHex } from "../_shared/signature.ts"
import { getPal, patchPal, TavusError } from "../_shared/tavus.ts"

type LinkBody = {
  action: "link"
  client_id: string
  pals: Array<{ pal_id: string; display_name?: string }>
  replace_existing_callback?: boolean
}
type AvatarBody = { action: "retry" | "unlink"; avatar_id: string }
type Body = LinkBody | AvatarBody

type LinkResult = {
  pal_id: string
  status: "linked" | "linked_webhook_error" | "already_linked" | "callback_in_use" | "not_found" | "error"
  avatar_id?: string
  message?: string
  existing_callback_host?: string
}

function describeTavusError(err: unknown): string {
  if (err instanceof TavusError) {
    const body = err.body as { conflict?: string } | null
    if (err.status === 409 && body?.conflict === "maker_changes") {
      return "This avatar has unpublished changes in PAL Maker. Publish or discard them in Tavus, then try again."
    }
    return err.message
  }
  return (err as Error).message
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return "another address"
  }
}

/** Points the PAL's webhook at this app. Records the outcome on the avatar. */
async function configureWebhook(admin: SupabaseClient, avatarId: string, palId: string): Promise<string | null> {
  const { data: secret, error } = await admin
    .from("avatar_secrets")
    .select("webhook_token, callback_secret")
    .eq("avatar_id", avatarId)
    .single()
  if (error || !secret) return "Webhook credentials are missing for this avatar"

  try {
    await patchPal(palId, [
      { op: "add", path: "/callback_url", value: webhookUrlFor(secret.webhook_token) },
      { op: "add", path: "/callback_secret", value: secret.callback_secret },
    ])
  } catch (err) {
    const message = describeTavusError(err)
    await admin.from("avatars").update({ webhook_status: "error", webhook_error: message }).eq("id", avatarId)
    return message
  }
  await admin
    .from("avatars")
    .update({ webhook_status: "pending", webhook_error: null, webhook_configured_at: new Date().toISOString() })
    .eq("id", avatarId)
  return null
}

async function linkOne(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  pal: { pal_id: string; display_name?: string },
  replaceExisting: boolean,
): Promise<LinkResult> {
  const palId = pal.pal_id
  const { data: known } = await admin
    .from("tavus_pals")
    .select("pal_id, name, thumbnail_image_url")
    .eq("pal_id", palId)
    .is("removed_at", null)
    .maybeSingle()
  if (!known) return { pal_id: palId, status: "not_found", message: "This avatar is not in the Tavus list. Refresh from Tavus and try again." }

  const { data: taken } = await admin
    .from("avatars")
    .select("id")
    .eq("tavus_pal_id", palId)
    .is("unlinked_at", null)
    .maybeSingle()
  if (taken) return { pal_id: palId, status: "already_linked", avatar_id: taken.id, message: "This avatar is already linked to a client." }

  // Does the PAL already send its events somewhere else?
  let existing: string | null
  try {
    existing = (await getPal(palId)).callback_url ?? null
  } catch (err) {
    return { pal_id: palId, status: "error", message: describeTavusError(err) }
  }
  const pointsElsewhere = Boolean(existing) && !existing!.startsWith(functionsBaseUrl())
  if (pointsElsewhere && !replaceExisting) {
    return {
      pal_id: palId,
      status: "callback_in_use",
      existing_callback_host: hostOf(existing!),
      message: `This avatar already sends its call events to ${hostOf(existing!)}. Linking it will send them here instead.`,
    }
  }

  const { data: avatar, error: insertError } = await admin
    .from("avatars")
    .insert({
      client_id: clientId,
      tavus_pal_id: palId,
      display_name: (pal.display_name ?? "").trim() || known.name || palId,
      photo_url: known.thumbnail_image_url,
      previous_callback_url: pointsElsewhere ? existing : null,
      linked_by: userId,
    })
    .select("id")
    .single()
  if (insertError || !avatar) {
    // 23505: someone linked it a moment ago.
    if (insertError?.code === "23505") return { pal_id: palId, status: "already_linked", message: "This avatar is already linked to a client." }
    return { pal_id: palId, status: "error", message: insertError?.message ?? "Could not save the avatar" }
  }

  const { error: secretError } = await admin
    .from("avatar_secrets")
    .insert({ avatar_id: avatar.id, webhook_token: randomHex(24), callback_secret: randomHex(32) })
  if (secretError) {
    await admin.from("avatars").delete().eq("id", avatar.id)
    return { pal_id: palId, status: "error", message: "Could not create webhook credentials" }
  }

  const webhookError = await configureWebhook(admin, avatar.id, palId)
  await writeAudit(admin, {
    actorId: userId,
    action: "avatar.linked",
    targetType: "avatar",
    targetId: avatar.id,
    clientId,
    detail: { pal_id: palId, webhook_ok: !webhookError, replaced_callback_host: pointsElsewhere ? hostOf(existing!) : null },
  })
  return webhookError
    ? { pal_id: palId, status: "linked_webhook_error", avatar_id: avatar.id, message: webhookError }
    : { pal_id: palId, status: "linked", avatar_id: avatar.id }
}

export const handler = endpoint(async (req) => {
  const caller = await requireUser(req)
  const body = await readJson<Body>(req)
  const admin = serviceClient()

  if (body.action === "link") {
    if (!body.client_id || !Array.isArray(body.pals) || body.pals.length === 0) {
      throw new HttpError(400, "Choose a client and at least one avatar")
    }
    if (body.pals.length > 25) throw new HttpError(400, "Link at most 25 avatars at a time")
    await requireAccess(caller, "avatars.link", body.client_id)

    const { data: client } = await admin.from("clients").select("id").eq("id", body.client_id).maybeSingle()
    if (!client) throw new HttpError(404, "Client not found")

    const results: LinkResult[] = []
    for (const pal of body.pals) {
      if (!pal?.pal_id || typeof pal.pal_id !== "string") continue
      results.push(await linkOne(admin, caller.userId, body.client_id, pal, body.replace_existing_callback === true))
    }
    return json(200, { ok: true, results })
  }

  if (body.action === "retry" || body.action === "unlink") {
    if (!body.avatar_id) throw new HttpError(400, "avatar_id is required")
    const { data: avatar } = await admin
      .from("avatars")
      .select("id, client_id, tavus_pal_id, previous_callback_url, unlinked_at")
      .eq("id", body.avatar_id)
      .maybeSingle()
    if (!avatar) throw new HttpError(404, "Avatar not found")
    await requireAccess(caller, "avatars.link", avatar.client_id)
    if (avatar.unlinked_at) throw new HttpError(409, "This avatar is no longer linked")

    if (body.action === "retry") {
      const webhookError = await configureWebhook(admin, avatar.id, avatar.tavus_pal_id)
      if (webhookError) throw new HttpError(502, webhookError)
      return json(200, { ok: true })
    }

    // Unlink: hand the PAL's webhook back, but only if it still points here.
    let warning: string | null = null
    try {
      const live = await getPal(avatar.tavus_pal_id)
      if (live.callback_url && live.callback_url.startsWith(functionsBaseUrl())) {
        await patchPal(avatar.tavus_pal_id, [
          { op: "replace", path: "/callback_url", value: avatar.previous_callback_url ?? null },
        ])
      }
    } catch (err) {
      warning = `Unlinked here, but Tavus could not be updated: ${describeTavusError(err)}`
    }
    await admin.from("avatars").update({ unlinked_at: new Date().toISOString() }).eq("id", avatar.id)
    await writeAudit(admin, {
      actorId: caller.userId,
      action: "avatar.unlinked",
      targetType: "avatar",
      targetId: avatar.id,
      clientId: avatar.client_id,
      detail: { pal_id: avatar.tavus_pal_id, warning },
    })
    return json(200, { ok: true, warning })
  }

  throw new HttpError(400, "Unknown action")
})
