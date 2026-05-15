-- ============================================================
-- Purge Demo Users — Avanew org
--
-- Removes all three fictitious demo users and reassigns
-- their owned records to the first real org admin so nothing
-- is left orphaned.
--
-- Safe to run multiple times — all steps are idempotent.
-- ============================================================

DO $$
DECLARE
  org_id      uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  owner_uid   uuid := 'dddddddd-dddd-dddd-dddd-000000000001';
  bd_uid      uuid := 'dddddddd-dddd-dddd-dddd-000000000002';
  partner_uid uuid := 'dddddddd-dddd-dddd-dddd-000000000003';

  real_admin  uuid;  -- first non-demo admin/owner in the org
BEGIN

  -- ── 1. Find a real admin to re-own any records ─────────────────────────────
  SELECT om.user_id INTO real_admin
  FROM public.organization_members om
  JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = org_id
    AND om.user_id NOT IN (owner_uid, bd_uid, partner_uid)
    AND om.role IN ('super_user', 'owner', 'admin')
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF real_admin IS NULL THEN
    -- Fall back to any real member
    SELECT om.user_id INTO real_admin
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id NOT IN (owner_uid, bd_uid, partner_uid)
    ORDER BY om.created_at ASC
    LIMIT 1;
  END IF;

  RAISE NOTICE 'Reassigning demo-owned records to %', real_admin;

  -- ── 2. Reassign owned records to real_admin ────────────────────────────────
  UPDATE public.companies SET owner_id = real_admin
    WHERE owner_id IN (owner_uid, bd_uid, partner_uid)
      AND organization_id = org_id;

  UPDATE public.contacts SET owner_id = real_admin
    WHERE owner_id IN (owner_uid, bd_uid, partner_uid)
      AND organization_id = org_id;

  UPDATE public.leads SET owner_id = real_admin
    WHERE owner_id IN (owner_uid, bd_uid, partner_uid)
      AND organization_id = org_id;

  UPDATE public.deals SET owner_id = real_admin
    WHERE owner_id IN (owner_uid, bd_uid, partner_uid)
      AND organization_id = org_id;

  UPDATE public.activities SET owner_id = real_admin
    WHERE owner_id IN (owner_uid, bd_uid, partner_uid)
      AND organization_id = org_id;

  UPDATE public.tasks SET owner_id = real_admin
    WHERE owner_id IN (owner_uid, bd_uid, partner_uid)
      AND organization_id = org_id;

  -- ── 3. Remove from org ─────────────────────────────────────────────────────
  DELETE FROM public.organization_members
  WHERE organization_id = org_id
    AND user_id IN (owner_uid, bd_uid, partner_uid);

  -- ── 4. Delete profiles ─────────────────────────────────────────────────────
  DELETE FROM public.profiles
  WHERE id IN (owner_uid, bd_uid, partner_uid);

  -- ── 5. Delete auth users ───────────────────────────────────────────────────
  DELETE FROM auth.users
  WHERE id IN (owner_uid, bd_uid, partner_uid);

  RAISE NOTICE 'Demo users purged:
  ✓ sarah.mitchell@demo.avanew
  ✓ jordan.hayes@demo.avanew
  ✓ alex.rivera@demo.avanew
  Owned records reassigned to: %', real_admin;

END $$;
