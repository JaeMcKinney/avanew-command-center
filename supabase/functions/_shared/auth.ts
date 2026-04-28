/**
 * Shared auth middleware for Avanew CRM Edge Functions.
 *
 * Usage:
 *   const result = await requireAuth(req, ["owner", "super_user"])
 *   if (!result.ok) return result.response
 *   const { profile, supabase } = result
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "./cors.ts"

export type AuthedProfile = {
  id: string
  role: string
  email: string | null
}

type AuthSuccess = {
  ok: true
  profile: AuthedProfile
  supabase: SupabaseClient
}

type AuthFailure = {
  ok: false
  response: Response
}

export type AuthResult = AuthSuccess | AuthFailure

export async function requireAuth(
  req: Request,
  allowedRoles?: string[],
): Promise<AuthResult> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return { ok: false, response: jsonError("Unauthorized", 401) }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  )
  if (authError || !user) {
    return { ok: false, response: jsonError("Unauthorized", 401) }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, response: jsonError("Profile not found", 403) }
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return {
      ok: false,
      response: jsonError(
        `Forbidden: requires ${allowedRoles.join(" or ")}`,
        403,
      ),
    }
  }

  return { ok: true, profile, supabase }
}

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
