// Invites a person to the app and gives them a role.
//
// Body: { email, full_name, role_id, client_id?, assigned_client_ids? }
//
// The role decides which side they are on. A Divigner role needs the caller
// to hold team.manage. A client role needs client_users.manage and access to
// that client, so a client admin can only invite people to their own client.

import { requireAccess, requireUser, serviceClient, writeAudit } from "../_shared/clients.ts"
import { endpoint, HttpError, json, readJson } from "../_shared/http.ts"

type Body = {
  email?: string
  full_name?: string
  role_id?: string
  client_id?: string | null
  assigned_client_ids?: string[]
}

export const handler = endpoint(async (req) => {
  const caller = await requireUser(req)
  const body = await readJson<Body>(req)

  const email = (body.email ?? "").trim().toLowerCase()
  const fullName = (body.full_name ?? "").trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address")
  if (!fullName) throw new HttpError(400, "Enter the person's name")
  if (!body.role_id) throw new HttpError(400, "Choose a role")

  const admin = serviceClient()
  const { data: role } = await admin.from("roles").select("id, key, side, client_scope").eq("id", body.role_id).maybeSingle()
  if (!role) throw new HttpError(400, "That role does not exist")

  let clientId: string | null = null
  if (role.side === "divigner") {
    await requireAccess(caller, "team.manage")
  } else {
    if (!body.client_id) throw new HttpError(400, "Choose which client this person belongs to")
    await requireAccess(caller, "client_users.manage", body.client_id)
    clientId = body.client_id
  }

  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  if (existing) throw new HttpError(409, "Someone with that email already has an account")

  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "")
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: appUrl ? `${appUrl}/accept-invite` : undefined,
  })
  if (inviteError || !invited?.user) {
    const taken = /already.*registered|already exists/i.test(inviteError?.message ?? "")
    throw new HttpError(taken ? 409 : 502, taken ? "Someone with that email already has an account" : `Could not send the invite: ${inviteError?.message}`)
  }
  const userId = invited.user.id

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    email,
    full_name: fullName,
    side: role.side,
    role_id: role.id,
    client_id: clientId,
    invited_by: caller.userId,
  })
  if (profileError) {
    // Do not leave a login behind that has no profile.
    await admin.auth.admin.deleteUser(userId)
    throw new HttpError(500, `Could not create the user: ${profileError.message}`)
  }

  if (role.side === "divigner" && role.client_scope === "assigned" && body.assigned_client_ids?.length) {
    await admin
      .from("staff_client_assignments")
      .insert(body.assigned_client_ids.map((id) => ({ user_id: userId, client_id: id })))
  }

  await writeAudit(admin, {
    actorId: caller.userId,
    action: "user.invited",
    targetType: "user",
    targetId: userId,
    clientId,
    detail: { email, role: role.key },
  })
  return json(200, { ok: true, user_id: userId })
})
