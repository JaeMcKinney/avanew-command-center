-- ─────────────────────────────────────────────────────────────────────────────
-- CRM Row-Level Security lockdown — keep Referral Associates out of staff data
-- ─────────────────────────────────────────────────────────────────────────────
-- Context: the core CRM tables were created outside version control and (per a
-- live audit) are NOT RLS-isolated, so any authenticated user — including an RA,
-- who is a real organization_members row with role 'referral_associate' — can
-- read org CRM data directly via the Supabase API. The client-side AppLayout gate
-- hides this in the UI; THIS migration enforces it at the database.
--
-- Model:
--   • "Staff" = an organization_members row whose role is anything EXCEPT
--     'referral_associate' (owner/admin/bd/partner) — plus platform super_user.
--   • Staff get full access to their org's CRM rows. RAs get NOTHING here, except
--     their OWN attributed leads (read + stage update), which the RA portal needs.
--   • Service-role edge functions and SECURITY DEFINER RPCs (record_ra_lead,
--     get_ra_landing_page, get_ra_dashboard_stats, record_ra_page_view) BYPASS RLS
--     and are unaffected — public landing/lead-capture flows keep working.
--
-- ⚠️  DO NOT APPLY BLIND. RLS policies are OR-combined; a leftover permissive
--     policy would defeat this. Each table is cleaned to a known slate first.
--     Validate on a Supabase branch with supabase/tests/crm_rls_lockdown.verify.sql
--     BEFORE production. Rollback: ALTER TABLE ... DISABLE ROW LEVEL SECURITY.

-- ── Helper: is the current user STAFF (non-RA member) of a given org? ─────────
CREATE OR REPLACE FUNCTION public.is_org_staff(org_id uuid)
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
      AND role <> 'referral_associate'
  );
$$;

-- ── Apply staff-only RLS to every org-scoped CRM table ───────────────────────
-- Clean slate (drop ALL existing policies on the table) → enable RLS →
-- staff-all policy. Done in a loop so a missing/extra pre-existing policy can't
-- silently keep RAs in.
DO $$
DECLARE
  t   text;
  pol record;
  crm_tables text[] := ARRAY[
    'companies', 'contacts', 'deals', 'activities', 'tasks',
    'partners', 'vendors', 'pipeline_stages', 'cashflow_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY crm_tables LOOP
    -- Skip gracefully if a table doesn't exist in this environment.
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skipping %, not present', t;
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (public.is_org_staff(organization_id) OR public.is_super_user())
        WITH CHECK (public.is_org_staff(organization_id) OR public.is_super_user())
    $f$, t || '_staff_all', t);
  END LOOP;
END $$;

-- ── leads: staff full access + RA reads/updates their OWN attributed leads ────
-- referred_by_ra_id stores the RA's auth user_id (set by record_ra_lead).
DO $$
DECLARE pol record;
BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RAISE NOTICE 'leads not present, skipping';
    RETURN;
  END IF;

  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'leads'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.leads', pol.policyname);
  END LOOP;

  ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "leads_staff_all" ON public.leads
    FOR ALL TO authenticated
    USING (public.is_org_staff(organization_id) OR public.is_super_user())
    WITH CHECK (public.is_org_staff(organization_id) OR public.is_super_user());

  CREATE POLICY "leads_ra_read_own" ON public.leads
    FOR SELECT TO authenticated
    USING (referred_by_ra_id = auth.uid());

  CREATE POLICY "leads_ra_update_own" ON public.leads
    FOR UPDATE TO authenticated
    USING (referred_by_ra_id = auth.uid())
    WITH CHECK (referred_by_ra_id = auth.uid());
END $$;
