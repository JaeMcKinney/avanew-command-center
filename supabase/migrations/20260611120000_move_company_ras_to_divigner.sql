-- ═══════════════════════════════════════════════════════════════════════════
-- Move Skilldora + A2AI Company RAs from Avanew to the Divigner org.
--
-- Background: The skilldora and a2ai bootstrap migrations both used the
-- Avanew org UUID (aaaaaaaa-…) instead of the Divigner UUID (dddddddd-…).
-- That put both Company RAs in the wrong org and routed every test
-- submission through their /refer/ slugs into the Avanew leads pipeline.
--
-- This migration:
--   1. Re-parents the ra_associates rows for skilldora + a2ai → Divigner
--   2. Re-parents the corresponding organization_members rows → Divigner
--   3. Adds a Divigner membership for Anson while preserving his existing
--      Avanew membership (he has real activity there)
--   4. Deletes every Avanew lead that was created by the public /refer/ flow
--      for these two RAs (lead_source = 'ra_referral'), which is the pile
--      of test submissions from email pipeline debugging.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  avanew_org   uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  divigner_org uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  skilldora_uid uuid;
  a2ai_uid      uuid;
  deleted_leads int;
BEGIN

  SELECT user_id INTO skilldora_uid FROM public.ra_associates WHERE slug = 'skilldora';
  SELECT user_id INTO a2ai_uid      FROM public.ra_associates WHERE slug = 'a2ai';

  -- ── 1. Re-parent ra_associates ───────────────────────────────────────────
  UPDATE public.ra_associates
     SET organization_id = divigner_org
   WHERE slug IN ('skilldora', 'a2ai')
     AND organization_id = avanew_org;

  -- ── 2. Re-parent organization_members for skilldora ──────────────────────
  -- Skilldora was only ever in Avanew via my bootstrap; flip the row.
  IF skilldora_uid IS NOT NULL THEN
    -- Remove any pre-existing Divigner membership to avoid a unique conflict,
    -- then move the Avanew row over.
    DELETE FROM public.organization_members
     WHERE user_id = skilldora_uid AND organization_id = divigner_org;
    UPDATE public.organization_members
       SET organization_id = divigner_org
     WHERE user_id = skilldora_uid AND organization_id = avanew_org;
  END IF;

  -- ── 3. Anson keeps Avanew membership (he has activity), gains Divigner ───
  IF a2ai_uid IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (divigner_org, a2ai_uid, 'partner')
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = EXCLUDED.role;
  END IF;

  -- ── 4. Delete pipeline-debug test leads from Avanew ──────────────────────
  -- Only target leads that came in via the public /refer/ flow for the two
  -- mis-orged RAs. Real Avanew leads (other lead_sources, other RAs) are
  -- untouched.
  DELETE FROM public.leads
   WHERE organization_id = avanew_org
     AND lead_source     = 'ra_referral'
     AND referred_by_ra_id IN (skilldora_uid, a2ai_uid);
  GET DIAGNOSTICS deleted_leads = ROW_COUNT;
  RAISE NOTICE 'Deleted % Avanew test leads tied to skilldora/a2ai', deleted_leads;

END $$;
