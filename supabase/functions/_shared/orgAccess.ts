// Company-scoped staff check for edge functions.
// profiles.role is global, so an Owner/Admin of one company must never be
// trusted to act on another company. Only a platform Super User crosses orgs.

// deno-lint-ignore no-explicit-any
type AdminClient = any

const ORG_STAFF_ROLES = ["super_user", "owner", "admin"]

export async function canManageOrg(
  admin: AdminClient,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  if (profile?.role === "super_user") return true
  const { data: member } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()
  return ORG_STAFF_ROLES.includes(member?.role ?? "")
}
