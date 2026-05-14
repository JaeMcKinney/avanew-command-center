-- ── Multi-tenancy: organizations + organization_members ───────────────────────
-- Every data table gets an organization_id.
-- Existing Avanew data is tagged with the Avanew org UUID.
-- Divigner org is created empty, ready for data.

-- ── 1. Organizations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        NOT NULL UNIQUE,
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ── 2. Organization members ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            public.team_role NOT NULL DEFAULT 'bd',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ── 3. Add organization_id to all data tables ─────────────────────────────────
ALTER TABLE public.companies             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contacts              ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.leads                 ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.deals                 ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages       ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.activities            ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks                 ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invitations           ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.documents             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.partners              ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.vendors               ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cashflow_transactions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.bank_connections      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.bank_accounts         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.bank_transactions     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cashflow_sync_logs    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.role_permissions      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── 4. Seed: Avanew org — tag all existing data ───────────────────────────────
INSERT INTO public.organizations (id, name, slug)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Avanew', 'avanew')
ON CONFLICT (id) DO NOTHING;

UPDATE public.companies             SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.contacts              SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.leads                 SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.deals                 SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.pipeline_stages       SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.activities            SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.tasks                 SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.invitations           SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.documents             SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.partners              SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.vendors               SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.cashflow_transactions SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.bank_connections      SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.bank_accounts         SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.bank_transactions     SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.cashflow_sync_logs    SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;
UPDATE public.role_permissions      SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE organization_id IS NULL;

-- Add all existing profiles as Avanew members, preserving their current roles
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, COALESCE(role, 'bd')
FROM public.profiles
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ── 5. Seed: Divigner org ─────────────────────────────────────────────────────
INSERT INTO public.organizations (id, name, slug)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Divigner', 'divigner')
ON CONFLICT (id) DO NOTHING;

-- ── 6. RLS: organizations ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_see_their_orgs" ON public.organizations;
CREATE POLICY "users_see_their_orgs" ON public.organizations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id AND om.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

DROP POLICY IF EXISTS "super_user_manage_orgs" ON public.organizations;
CREATE POLICY "super_user_manage_orgs" ON public.organizations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user'));

-- ── 7. RLS: organization_members ─────────────────────────────────────────────
DROP POLICY IF EXISTS "members_see_their_org_members" ON public.organization_members;
CREATE POLICY "members_see_their_org_members" ON public.organization_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

DROP POLICY IF EXISTS "admins_manage_org_members" ON public.organization_members;
CREATE POLICY "admins_manage_org_members" ON public.organization_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
        AND om2.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
        AND om2.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );
