// Minimal Tavus REST client. Field names follow the public API reference
// (https://docs.tavus.io/openapi.yaml). The API key stays on the server.

import { HttpError } from "./http.ts"

export type TavusPal = {
  pal_id: string
  pal_name?: string | null
  default_face_id?: string | null
  callback_url?: string | null
  document_ids?: string[] | null
  pipeline_mode?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type TavusDeployment = {
  deployment_id: string
  pal_id: string
  channel: string
  status: string
  name?: string | null
  allowed_origins?: string[] | null
  limits?: Record<string, unknown> | null
  usage_total?: number | null
  usage_today?: number | null
  thumbnail_image_url?: string | null
  replica_thumbnail_image_url?: string | null
  url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** A face (the person an avatar looks like). Its thumbnail is the avatar's photo. */
export type TavusFace = {
  face_id: string
  face_name?: string | null
  thumbnail_image_url?: string | null
}

export type TavusConversation = {
  conversation_id: string
  status?: string | null
  pal_id?: string | null
  created_at?: string | null
  updated_at?: string | null
  events?: Array<{ event_type?: string; timestamp?: string; properties?: Record<string, unknown> }> | null
}

export type JsonPatchOp = { op: "add" | "remove" | "replace"; path: string; value?: unknown }

export class TavusError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

const PAGE_SIZE = 100
const MAX_PAGES = 200

function config() {
  const key = Deno.env.get("TAVUS_API_KEY")
  if (!key) throw new HttpError(500, "The Tavus API key is not set on the server")
  const base = (Deno.env.get("TAVUS_API_BASE") ?? "https://tavusapi.com/v2").replace(/\/+$/, "")
  return { key, base }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { key, base } = config()
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { "x-api-key": key, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    throw new TavusError(0, `Could not reach Tavus: ${(err as Error).message}`, null)
  }
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const b = body as { message?: string; error?: string } | null
    const reason = (b && typeof b === "object" && (b.message || b.error)) || `HTTP ${res.status}`
    throw new TavusError(res.status, `Tavus said: ${reason}`, body)
  }
  return body as T
}

/** Every PAL the account created (not Tavus's own stock PALs). */
export async function listPals(): Promise<TavusPal[]> {
  const all: TavusPal[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await request<{ data?: TavusPal[]; total_count?: number }>(
      `/pals?limit=${PAGE_SIZE}&page=${page}&pal_type=user`,
    )
    const rows = res.data ?? []
    all.push(...rows)
    if (rows.length === 0 || (res.total_count != null && all.length >= res.total_count)) break
  }
  return all
}

export async function listDeployments(): Promise<TavusDeployment[]> {
  const all: TavusDeployment[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await request<{ deployments?: TavusDeployment[]; total?: number }>(
      `/deployments?limit=${PAGE_SIZE}&page=${page}`,
    )
    const rows = res.deployments ?? []
    all.push(...rows)
    if (rows.length === 0 || (res.total != null && all.length >= res.total)) break
  }
  return all
}

/**
 * Every face the account can use: its own (`user`) or Tavus's stock ones
 * (`system`). Pages are read until one adds nothing new, so it does not matter
 * whether Tavus counts them from zero or from one.
 */
export async function listFaces(faceType: "user" | "system"): Promise<TavusFace[]> {
  const byId = new Map<string, TavusFace>()
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await request<{ data?: TavusFace[]; total_count?: number }>(`/faces?limit=${PAGE_SIZE}&page=${page}&face_type=${faceType}`)
    const before = byId.size
    for (const face of res.data ?? []) if (face.face_id) byId.set(face.face_id, face)
    if (byId.size === before && page > 0) break
    if (res.total_count != null && byId.size >= res.total_count) break
  }
  return [...byId.values()]
}

export function getPal(palId: string): Promise<TavusPal> {
  return request<TavusPal>(`/pals/${encodeURIComponent(palId)}`)
}

export function patchPal(palId: string, ops: JsonPatchOp[]): Promise<unknown> {
  return request(`/pals/${encodeURIComponent(palId)}`, { method: "PATCH", body: JSON.stringify(ops) })
}

/** One page of conversations. Pages start at 1. */
export async function listConversations(page: number, limit = PAGE_SIZE): Promise<TavusConversation[]> {
  const res = await request<{ data?: TavusConversation[] }>(`/conversations?limit=${limit}&page=${page}`)
  return res.data ?? []
}

/** A conversation with its events (joined, shutdown, transcript…). */
export function getConversationWithEvents(conversationId: string): Promise<TavusConversation> {
  return request<TavusConversation>(`/conversations/${encodeURIComponent(conversationId)}?verbose=true`)
}

export type TavusDocument = { document_id: string; status?: string | null }

/** Adds a web page to the knowledge base. Processing continues in Tavus after this returns. */
export function createDocument(body: {
  document_url: string
  document_name: string
  tags?: string[]
  crawl?: { depth: number; max_pages: number }
}): Promise<TavusDocument> {
  return request<TavusDocument>("/documents", { method: "POST", body: JSON.stringify(body) })
}

/** Asks Tavus to read a crawled document's page again. At most once an hour per document. */
export function recrawlDocument(documentId: string): Promise<unknown> {
  return request(`/documents/${encodeURIComponent(documentId)}/recrawl`, { method: "POST" })
}

/** Turns a deployment on or off. An inactive deployment's embed cannot start calls. */
export function setDeploymentStatus(deploymentId: string, status: "active" | "inactive"): Promise<unknown> {
  return request(`/deployments/${encodeURIComponent(deploymentId)}`, {
    method: "PATCH", body: JSON.stringify([{ op: "replace", path: "/status", value: status }]),
  })
}

/** Reads any Tavus resource by path, for views that show what Tavus holds as it is. */
export function tavusGet<T = unknown>(path: string): Promise<T> {
  return request<T>(path)
}
