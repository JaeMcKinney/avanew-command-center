-- ─────────────────────────────────────────────────────────────────────────────
-- Verification for 20260618130000_crm_rls_lockdown.sql  (NOT a migration — run manually)
-- ─────────────────────────────────────────────────────────────────────────────
-- Run in the Supabase SQL editor or psql AFTER applying the lockdown, ideally on
-- a branch/staging clone. It impersonates an RA and a staff user via JWT claims
-- and checks that RAs are blocked from CRM data while staff and RA-own-leads work.
--
-- Fill these in first (from: select u.email, u.id, ra.organization_id,
-- ra.user_id from auth.users u join ra_associates ra on ra.user_id=u.id):
--   :ra_uid    — an RA's auth user_id (role 'referral_associate')
--   :staff_uid — a staff user's auth user_id (owner/admin/bd/partner)
--   :org_id    — the organization both belong to

\set ra_uid    '00000000-0000-0000-0000-000000000000'
\set staff_uid '00000000-0000-0000-0000-000000000000'

-- 0. RLS is actually enabled on every target table -----------------------------
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('companies','contacts','deals','activities','tasks',
                  'partners','vendors','pipeline_stages','cashflow_transactions','leads')
ORDER BY relname;   -- expect rls_enabled = true for all

-- 1. As an RA — CRM tables must return ZERO rows -------------------------------
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'ra_uid', 'role', 'authenticated')::text, true);

SELECT 'RA contacts (expect 0)'  AS check, count(*) FROM public.contacts;
SELECT 'RA companies (expect 0)' AS check, count(*) FROM public.companies;
SELECT 'RA deals (expect 0)'     AS check, count(*) FROM public.deals;
SELECT 'RA partners (expect 0)'  AS check, count(*) FROM public.partners;
SELECT 'RA vendors (expect 0)'   AS check, count(*) FROM public.vendors;
SELECT 'RA tasks (expect 0)'     AS check, count(*) FROM public.tasks;
-- RA leads: should see ONLY their own attributed leads (not the whole org)
SELECT 'RA leads — all own?' AS check,
       count(*) AS visible,
       count(*) FILTER (WHERE referred_by_ra_id = :'ra_uid') AS own
FROM public.leads;   -- expect visible == own
ROLLBACK;

-- 2. As a staff user — CRM tables must return their org's rows -----------------
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'staff_uid', 'role', 'authenticated')::text, true);

SELECT 'staff contacts (expect >0 if org has any)' AS check, count(*) FROM public.contacts;
SELECT 'staff partners' AS check, count(*) FROM public.partners;
SELECT 'staff leads'    AS check, count(*) FROM public.leads;
ROLLBACK;

-- 3. Policy inventory — confirm only the intended policies exist ---------------
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('companies','contacts','deals','activities','tasks',
                    'partners','vendors','pipeline_stages','cashflow_transactions','leads')
ORDER BY tablename, policyname;
