// Everything Tavus holds about one avatar, read live: its instructions
// (system prompt), greeting, face, voice, knowledge documents, guardrails,
// objectives, tools and skills. For Divigner staff only.
//
// Body: { pal_id }

import { requireAccess, requireUser, serviceClient } from "../_shared/clients.ts"
import { endpoint, HttpError, json, readJson } from "../_shared/http.ts"
import { TavusError, tavusGet } from "../_shared/tavus.ts"

type Json = Record<string, unknown>
const SECRET_KEY = /(api[_-]?key|secret|token|password|authorization)/i

/** Keys, tokens and header values are never sent to the browser. */
export function redact(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, key))
  if (value && typeof value === "object") {
    const out: Json = {}
    for (const [k, v] of Object.entries(value as Json)) {
      out[k] = key === "headers" && typeof v === "string" && v ? "(hidden)" : redact(v, k)
    }
    return out
  }
  return typeof value === "string" && value && SECRET_KEY.test(key) ? "(hidden)" : value
}

/** Runs a Tavus read and reports a failure as data, so one missing piece does not blank the page. */
async function part<T>(read: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await read() }
  } catch (err) {
    return { ok: false, error: err instanceof TavusError ? err.message : "Could not be read" }
  }
}
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [])
const enc = encodeURIComponent

export const handler = endpoint(async (req) => {
  const caller = await requireUser(req)
  await requireAccess(caller, "avatars.link")
  const { pal_id } = await readJson<{ pal_id?: string }>(req)
  if (!pal_id || !/^[A-Za-z0-9_-]{3,64}$/.test(pal_id)) throw new HttpError(400, "Choose an avatar")

  let pal: Json
  try {
    pal = await tavusGet<Json>(`/pals/${enc(pal_id)}`)
  } catch (err) {
    if (err instanceof TavusError && err.status === 404) throw new HttpError(404, "Tavus no longer has this avatar")
    throw new HttpError(502, err instanceof TavusError ? err.message : "Could not reach Tavus")
  }

  // Older PALs carry a single guardrails set; newer ones carry a list of guardrails.
  const guardrailIds = [...new Set([...list(pal.guardrail_ids), ...list([pal.guardrails_id])])]
  const [face, tools, skills, objectives, guardrails, documents] = await Promise.all([
    typeof pal.default_face_id === "string" && pal.default_face_id ? part(() => tavusGet<Json>(`/faces/${enc(pal.default_face_id as string)}?verbose=true`)) : null,
    part(() => tavusGet<{ data?: Json[] }>(`/pals/${enc(pal_id)}/tools`).then((r) => r.data ?? [])),
    part(() => tavusGet<{ data?: Json }>(`/pals/${enc(pal_id)}/skills`).then((r) => r.data ?? {})),
    typeof pal.objectives_id === "string" && pal.objectives_id ? part(() => tavusGet<Json>(`/objectives/${enc(pal.objectives_id as string)}`)) : null,
    Promise.all(guardrailIds.slice(0, 40).map((id) => part(() => tavusGet<Json>(`/guardrails/${enc(id)}`)).then((r) => ({ id, ...r })))),
    Promise.all(list(pal.document_ids).slice(0, 60).map((id) => part(() => tavusGet<Json>(`/documents/${enc(id)}`)).then((r) => ({ id, ...r })))),
  ])

  // Which client this avatar is linked to here, and its deployments, from our own copy.
  const admin = serviceClient()
  const [{ data: avatar }, { data: deployments }] = await Promise.all([
    admin.from("avatars").select("id, display_name, role_label, client_id, webhook_status, clients(name, slug)").eq("tavus_pal_id", pal_id).is("unlinked_at", null).maybeSingle(),
    admin.from("tavus_deployments").select("deployment_id, name, channel, status, allowed_origins, limits").eq("pal_id", pal_id).is("removed_at", null).order("name"),
  ])

  return json(200, {
    ok: true,
    fetched_at: new Date().toISOString(),
    pal: redact(pal),
    face: redact(face),
    tools: redact(tools),
    skills: redact(skills),
    objectives: redact(objectives),
    guardrails: redact(guardrails),
    guardrail_tags: list(pal.guardrail_tags),
    documents: redact(documents),
    document_tags: list(pal.document_tags),
    linked: avatar ?? null,
    deployments: deployments ?? [],
  })
})
