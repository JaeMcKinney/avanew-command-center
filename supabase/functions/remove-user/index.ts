// Supabase Edge Function — remove-user
//
// Revokes a user's membership in a SINGLE organization. The auth user is
// never touched, so the same person can keep working in their other orgs
// (and "forgot password" continues to work for them).
//
// Steps:
//   1. Verify the caller is an admin/owner/super_user in the target org
//      (org-scoped role from organization_members, NOT global profiles.role).
//   2. Refuse to remove the last admin of the org (unless caller is owner/super).
//   3. Reassign every record this user owns in this org to the caller,
//      so no CRM data orphans (companies, contacts, leads, deals, tasks,
//      activities, documents).
//   4. Delete the organization_members row (org_id + user_id). Auth user
//      stays alive in auth.users — they just lose access to this one org.
//
// Deploy:
//   supabase functions deploy remove-user --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2"

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
    },
  })

const PRIVILEGED = ["super_user", "owner", "admin"] as const
type OrgRole = "super_user" | "owner" | "admin" | "bd" | "partner"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          "authorization, content-type, apikey, x-client-info",
        "access-control-allow-methods": "POST, OPTIONS",
      },
    })
  }
  if (req.method !== "POST") return json(405, { error: "POST only" })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" })
  }

  const callerJwt = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  )
  if (!callerJwt) return json(401, { error: "Missing bearer token" })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. Authenticate caller ────────────────────────────────────────────────
  const { data: callerData, error: callerErr } = await admin.auth.getUser(
    callerJwt
  )
  if (callerErr || !callerData.user) {
    return json(401, { error: "Invalid session" })
  }
  const callerId = callerData.user.id

  // ── 2. Validate body ──────────────────────────────────────────────────────
  let body: { user_id?: string; organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "Invalid JSON" })
  }
  const userId = body.user_id
  const orgId = body.organization_id
  if (!userId) return json(400, { error: "user_id required" })
  if (!orgId) return json(400, { error: "organization_id required" })
  if (userId === callerId) {
    return json(400, { error: "Can't remove yourself" })
  }

  // ── 3. Authorize caller in THIS org ───────────────────────────────────────
  const { data: callerMember, error: callerMemberErr } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", callerId)
    .maybeSingle()
  if (callerMemberErr) return json(500, { error: callerMemberErr.message })
  const callerRole = (callerMember?.role ?? "") as OrgRole
  if (!PRIVILEGED.includes(callerRole as (typeof PRIVILEGED)[number])) {
    return json(403, { error: "Admin or above required in this organization" })
  }

  // ── 4. Find target's membership in THIS org ───────────────────────────────
  const { data: targetMember, error: targetMemberErr } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()
  if (targetMemberErr) return json(500, { error: targetMemberErr.message })
  if (!targetMember) {
    return json(404, { error: "User is not a member of this organization" })
  }

  // ── 5. Last-admin guard ───────────────────────────────────────────────────
  // Only owner/super_user may remove an admin if they're the last admin.
  const callerIsSuperPrivilege = ["super_user", "owner"].includes(callerRole)
  if (targetMember.role === "admin" && !callerIsSuperPrivilege) {
    const { count } = await admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "admin")
    if ((count ?? 0) <= 1) {
      return json(400, { error: "Need at least one admin in this organization" })
    }
  }

  // ── 6. Reassign records owned by the user (within this org only) ──────────
  // Reassign to the caller so nothing becomes orphaned and RLS still shows
  // these records to admins.
  const OWNER_TABLES = [
    "companies",
    "contacts",
    "leads",
    "deals",
    "tasks",
    "activities",
  ] as const

  for (const table of OWNER_TABLES) {
    const { error: reErr } = await admin
      .from(table)
      .update({ owner_id: callerId })
      .eq("organization_id", orgId)
      .eq("owner_id", userId)
    if (reErr) return json(500, { error: `Reassign ${table}: ${reErr.message}` })
  }

  // documents uses uploaded_by, not owner_id
  const { error: docErr } = await admin
    .from("documents")
    .update({ uploaded_by: callerId })
    .eq("organization_id", orgId)
    .eq("uploaded_by", userId)
  if (docErr) return json(500, { error: `Reassign documents: ${docErr.message}` })

  // ── 7. Delete only the organization_members row ───────────────────────────
  const { error: delErr } = await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId)
  if (delErr) return json(500, { error: delErr.message })

  // ── 8. Done. auth.users is intentionally NOT touched — the user keeps
  //        access to any other orgs they belong to, and password reset still
  //        works for their account.
  return json(200, { ok: true })
})
