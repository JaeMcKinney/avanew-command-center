// Copies the list of PALs and deployments from Tavus into the database.
// Run by a schedule, and by staff pressing "Refresh from Tavus".

import { isScheduledCall, requireAccess, requireUser, serviceClient, functionsBaseUrl, writeAudit, requireDivignerAccount } from "../_shared/clients.ts"
import { endpoint, HttpError, json } from "../_shared/http.ts"
import { listDeployments, listPals, type TavusDeployment, type TavusPal, listFaces } from "../_shared/tavus.ts"
import { toIso } from "../_shared/time.ts"

function callbackHost(url: string | null | undefined, ownBase: string): string | null {
  if (!url) return null
  if (url.startsWith(ownBase)) return "this-app"
  try {
    return new URL(url).host
  } catch {
    return "unknown"
  }
}

function chunks<T>(rows: T[], size = 200): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

export const handler = endpoint(async (req) => {
  const scheduled = isScheduledCall(req)
  let userId: string | null = null
  if (!scheduled) {
    const caller = await requireUser(req)
    await requireAccess(caller, "avatars.link")
    await requireDivignerAccount(caller, "Tavus")
    userId = caller.userId
  }

  const admin = serviceClient()
  const { data: run, error: runError } = await admin
    .from("tavus_sync_runs")
    .insert({ trigger: scheduled ? "schedule" : "manual", triggered_by: userId })
    .select("id")
    .single()
  if (runError || !run) throw new HttpError(500, "Could not start the sync")

  const fail = async (message: string): Promise<never> => {
    await admin
      .from("tavus_sync_runs")
      .update({ status: "error", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id)
    throw new HttpError(502, message)
  }

  let pals: TavusPal[]
  let deployments: TavusDeployment[]
  try {
    ;[pals, deployments] = await Promise.all([listPals(), listDeployments()])
  } catch (err) {
    return await fail((err as Error).message)
  }

  // An empty answer from Tavus is far more likely an outage than a deleted
  // account. Do not mark every avatar as removed because of it.
  if (pals.length === 0) {
    const { count } = await admin
      .from("tavus_pals")
      .select("pal_id", { count: "exact", head: true })
      .is("removed_at", null)
    if ((count ?? 0) > 0) return await fail("Tavus returned no avatars, so nothing was changed")
  }

  const now = new Date().toISOString()
  const ownBase = functionsBaseUrl()

  // An avatar's photo: the one on any of its deployments, or else its face's.
  const thumbByPal = new Map<string, string>()
  for (const d of deployments) {
    const thumb = d.thumbnail_image_url ?? d.replica_thumbnail_image_url
    if (thumb && !thumbByPal.has(d.pal_id)) thumbByPal.set(d.pal_id, thumb)
  }
  const faceless = pals.filter((p) => p.default_face_id && !thumbByPal.has(p.pal_id))
  if (faceless.length > 0) {
    // Photos are a nicety. If Tavus cannot list faces, the sync still stands and the photos fill in next time.
    try {
      const wanted = new Set(faceless.map((p) => p.default_face_id))
      const thumbByFace = new Map<string, string>()
      for (const type of ["user", "system"] as const) {
        if ([...wanted].every((id) => thumbByFace.has(id as string))) break
        for (const face of await listFaces(type)) if (face.thumbnail_image_url) thumbByFace.set(face.face_id, face.thumbnail_image_url)
      }
      for (const p of faceless) {
        const thumb = thumbByFace.get(p.default_face_id as string)
        if (thumb) thumbByPal.set(p.pal_id, thumb)
      }
    } catch {
      // Left without photos for now.
    }
  }
  // A photo already on file is kept when Tavus did not send one this time.
  const { data: known } = await admin.from("tavus_pals").select("pal_id, thumbnail_image_url").not("thumbnail_image_url", "is", null)
  for (const row of known ?? []) if (!thumbByPal.has(row.pal_id)) thumbByPal.set(row.pal_id, row.thumbnail_image_url as string)

  const palRows = pals.map((p) => ({
    pal_id: p.pal_id,
    name: (p.pal_name ?? "").trim(),
    pipeline_mode: p.pipeline_mode ?? null,
    default_face_id: p.default_face_id ?? null,
    callback_host: callbackHost(p.callback_url, ownBase),
    thumbnail_image_url: thumbByPal.get(p.pal_id) ?? null,
    tavus_created_at: toIso(p.created_at),
    tavus_updated_at: toIso(p.updated_at),
    synced_at: now,
    removed_at: null,
  }))
  const deploymentRows = deployments.map((d) => ({
    deployment_id: d.deployment_id,
    pal_id: d.pal_id,
    channel: d.channel,
    status: d.status,
    name: (d.name ?? "").trim(),
    allowed_origins: d.allowed_origins ?? [],
    limits: d.limits ?? {},
    usage_total: d.usage_total ?? null,
    usage_today: d.usage_today ?? null,
    thumbnail_image_url: d.thumbnail_image_url ?? d.replica_thumbnail_image_url ?? null,
    page_url: d.url ?? null,
    tavus_created_at: toIso(d.created_at),
    tavus_updated_at: toIso(d.updated_at),
    synced_at: now,
    removed_at: null,
  }))

  for (const batch of chunks(palRows)) {
    const { error } = await admin.from("tavus_pals").upsert(batch, { onConflict: "pal_id" })
    if (error) return await fail(`Could not save avatars: ${error.message}`)
  }
  for (const batch of chunks(deploymentRows)) {
    const { error } = await admin.from("tavus_deployments").upsert(batch, { onConflict: "deployment_id" })
    if (error) return await fail(`Could not save deployments: ${error.message}`)
  }

  // Anything this run did not see is gone from Tavus. Flag it; keep the row.
  const stalePals = await admin.from("tavus_pals").update({ removed_at: now }).lt("synced_at", now).is("removed_at", null)
  const staleDeps = await admin.from("tavus_deployments").update({ removed_at: now }).lt("synced_at", now).is("removed_at", null)
  if (stalePals.error || staleDeps.error) return await fail("Could not flag avatars removed from Tavus")

  await admin.rpc("refresh_avatar_photos")

  await admin
    .from("tavus_sync_runs")
    .update({
      status: "ok",
      finished_at: new Date().toISOString(),
      pals_count: palRows.length,
      deployments_count: deploymentRows.length,
    })
    .eq("id", run.id)

  if (userId) {
    await writeAudit(admin, {
      actorId: userId,
      action: "tavus.synced",
      detail: { pals: palRows.length, deployments: deploymentRows.length },
    })
  }

  return json(200, { ok: true, pals: palRows.length, deployments: deploymentRows.length, synced_at: now })
})
