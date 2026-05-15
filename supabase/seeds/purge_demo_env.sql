-- ============================================================
-- Purge Demo Environment — "Demo Co"
--
-- Removes everything created by create_demo_env.sql:
--   • All Demo Co data (CRM, cashflow, banking, partners, vendors, stages)
--   • The three demo users (Morgan Quinn, Riley Carter, Casey Walsh)
--   • The Demo Co organization itself
--
-- This script only touches rows scoped to the Demo Co org_id
-- (cccccccc-cccc-cccc-cccc-cccccccccccc), so your real Avanew and
-- Divigner data is untouched.
--
-- Safe to run multiple times — every step is idempotent.
-- ============================================================

DO $$
DECLARE
  demo_org  uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  u_owner   uuid := 'cccccccc-cccc-cccc-cccc-000000000001';
  u_bd      uuid := 'cccccccc-cccc-cccc-cccc-000000000002';
  u_partner uuid := 'cccccccc-cccc-cccc-cccc-000000000003';

  n_banktx       int;
  n_bankacct     int;
  n_bankconn     int;
  n_cashflow     int;
  n_tasks        int;
  n_activities   int;
  n_deals        int;
  n_leads        int;
  n_contacts     int;
  n_companies    int;
  n_partners     int;
  n_vendors      int;
  n_stages       int;
  n_documents    int;
  n_invitations  int;
  n_members      int;
BEGIN

  -- ── 1. Bank data (deepest cascade first) ────────────────────────────────────
  DELETE FROM public.bank_transactions WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_banktx = ROW_COUNT;

  DELETE FROM public.bank_accounts     WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_bankacct = ROW_COUNT;

  DELETE FROM public.bank_connections  WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_bankconn = ROW_COUNT;

  -- ── 2. Cashflow ─────────────────────────────────────────────────────────────
  DELETE FROM public.cashflow_transactions WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_cashflow = ROW_COUNT;

  -- ── 3. Operations & CRM children ────────────────────────────────────────────
  DELETE FROM public.tasks      WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_tasks = ROW_COUNT;

  DELETE FROM public.activities WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_activities = ROW_COUNT;

  DELETE FROM public.deals      WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_deals = ROW_COUNT;

  DELETE FROM public.leads      WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_leads = ROW_COUNT;

  DELETE FROM public.contacts   WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_contacts = ROW_COUNT;

  DELETE FROM public.companies  WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_companies = ROW_COUNT;

  -- ── 4. Partner / vendor / pipeline stages ──────────────────────────────────
  DELETE FROM public.partners        WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_partners = ROW_COUNT;

  DELETE FROM public.vendors         WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_vendors = ROW_COUNT;

  DELETE FROM public.pipeline_stages WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_stages = ROW_COUNT;

  -- ── 5. Documents & invitations scoped to this org ──────────────────────────
  DELETE FROM public.documents   WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_documents = ROW_COUNT;

  DELETE FROM public.invitations WHERE organization_id = demo_org;
  GET DIAGNOSTICS n_invitations = ROW_COUNT;

  -- ── 6. Membership ──────────────────────────────────────────────────────────
  DELETE FROM public.organization_members
   WHERE organization_id = demo_org
      OR user_id IN (u_owner, u_bd, u_partner);
  GET DIAGNOSTICS n_members = ROW_COUNT;

  -- ── 7. Demo users — profiles + auth.users ──────────────────────────────────
  DELETE FROM public.profiles WHERE id IN (u_owner, u_bd, u_partner);
  DELETE FROM auth.users      WHERE id IN (u_owner, u_bd, u_partner);

  -- ── 8. The organization itself ─────────────────────────────────────────────
  DELETE FROM public.organizations WHERE id = demo_org;

  RAISE NOTICE 'Demo environment purged:
  ✓ Bank transactions:   %
  ✓ Bank accounts:       %
  ✓ Bank connections:    %
  ✓ Cashflow entries:    %
  ✓ Tasks:               %
  ✓ Activities:          %
  ✓ Deals:               %
  ✓ Leads:               %
  ✓ Contacts:            %
  ✓ Companies:           %
  ✓ Partners:            %
  ✓ Vendors:             %
  ✓ Pipeline stages:     %
  ✓ Documents:           %
  ✓ Invitations:         %
  ✓ Org members:         %
  ✓ Demo users + org:    removed',
    n_banktx, n_bankacct, n_bankconn, n_cashflow,
    n_tasks, n_activities, n_deals, n_leads,
    n_contacts, n_companies, n_partners, n_vendors,
    n_stages, n_documents, n_invitations, n_members;

END $$;
