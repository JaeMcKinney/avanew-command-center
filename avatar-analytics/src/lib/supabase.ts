import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/db"

// A value starting with "/" means "on this same site", for when the app and
// the API are served through one address (see the dev proxy in vite.config.ts).
const configured = import.meta.env.VITE_SUPABASE_URL as string | undefined
const url = configured?.startsWith("/") ? window.location.origin + configured : configured
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error("Missing settings. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
}

export const supabase = createClient<Database>(url, anonKey)

const configuredFunctions = import.meta.env.VITE_FUNCTIONS_URL as string | undefined
const functionsUrl = (
  configuredFunctions?.startsWith("/") ? window.location.origin + configuredFunctions : (configuredFunctions ?? `${url}/functions/v1`)
).replace(/\/+$/, "")

/** Calls a server function as the signed-in user. Throws with a readable message on failure. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Your session has ended. Sign in again.")

  let res: Response
  try {
    res = await fetch(`${functionsUrl}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey!, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.")
  }
  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.error ?? `The server returned an error (${res.status}).`)
  return payload as T
}

/** Like callFunction, for functions that answer with a file instead of JSON. */
export async function callFunctionRaw(name: string, body: unknown): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Your session has ended. Sign in again.")
  let res: Response
  try {
    res = await fetch(`${functionsUrl}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey!, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.")
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new Error(payload?.error ?? `The server returned an error (${res.status}).`)
  }
  return res
}
