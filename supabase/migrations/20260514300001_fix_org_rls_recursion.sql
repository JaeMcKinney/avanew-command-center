-- Fix: infinite recursion in organization_members RLS policies.
-- The original policies queried organization_members from within their own
-- USING clause, causing PostgreSQL to re-evaluate the same policy endlessly.
-- Solution: SECURITY DEFINER helper functions that bypass RLS for the check.

-- ── Helper: is the current user a member of a given org? ─────────────────────
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$;

-- ── Helper: is the current user an admin+ of a given org? ────────────────────
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('super_user', 'owner', 'admin')
  );
$$;

-- ── Helper: is the current user a platform super_user? ───────────────────────
CREATE OR REPLACE FUNCTION public.is_super_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_user'
  );
$$;

-- ── Fix organization_members SELECT policy ───────────────────────────────────
DROP POLICY IF EXISTS "members_see_their_org_members" ON public.organization_members;
CREATE POLICY "members_see_their_org_members" ON public.organization_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_super_user()
  );

-- ── Fix organization_members ALL (admin manage) policy ───────────────────────
DROP POLICY IF EXISTS "admins_manage_org_members" ON public.organization_members;
CREATE POLICY "admins_manage_org_members" ON public.organization_members
  FOR ALL TO authenticated
  USING (
    public.is_org_admin(organization_id)
    OR public.is_super_user()
  )
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR public.is_super_user()
  );

-- ── Fix organizations SELECT policy (it also queried organization_members) ───
DROP POLICY IF EXISTS "users_see_their_orgs" ON public.organizations;
CREATE POLICY "users_see_their_orgs" ON public.organizations
  FOR SELECT TO authenticated USING (
    public.is_org_member(id)
    OR public.is_super_user()
  );
