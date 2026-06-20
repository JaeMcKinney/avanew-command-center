-- ═══════════════════════════════════════════════════════════════════════════
-- restore_ra() — one-click undo of a permanent RA delete
--
-- Re-creates an RA from its archive snapshot and re-attaches everything that
-- delete-ra detached/destroyed, in a single transaction:
--   • ra_associates  — re-inserted from the snapshot (new id, caller-resolved
--                      user_id; ra_type/status coalesced for old snapshots)
--   • leads / deals   — live rows still exist; their referred_by_ra_id (NULLed
--                      when the RA's profile cascaded) is re-pointed at the
--                      restored owner
--   • commission_payouts / client_checkins / agreement_acceptances — these were
--                      cascade-deleted with the RA, so re-inserted from their
--                      archive snapshots (new ids, new ra_associate_id)
--   • the archive parent row is deleted (children cascade) so the archive no
--                      longer shows a false "deleted" entry
--
-- ra_page_views (analytics) are intentionally NOT restored — high volume, no
-- operational value.
--
-- The edge function (restore-ra) resolves/creates the auth user + profile +
-- org membership first, then calls this with p_user_id. SECURITY DEFINER;
-- service_role-only execution.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.restore_ra(
  p_archive_id UUID,
  p_user_id    UUID
)
RETURNS TABLE (ra_id UUID, leads_relinked INT, deals_relinked INT, payouts_restored INT, checkins_restored INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arc        public.archived_ra_associates;
  v_new_ra_id  UUID := gen_random_uuid();
  v_snap       JSONB;
  v_leads      INT := 0;
  v_deals      INT := 0;
  v_payouts    INT := 0;
  v_checkins   INT := 0;
BEGIN
  SELECT * INTO v_arc FROM public.archived_ra_associates WHERE id = p_archive_id FOR UPDATE;
  IF v_arc.id IS NULL THEN
    RAISE EXCEPTION 'Archive entry % not found', p_archive_id;
  END IF;

  -- Slug must be free (a new RA may have taken it since the delete).
  IF EXISTS (SELECT 1 FROM public.ra_associates WHERE slug = v_arc.slug) THEN
    RAISE EXCEPTION 'Slug "%" is already in use — rename or remove the conflicting RA before restoring', v_arc.slug
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Overlay the snapshot with the new identity + safe defaults for columns that
  -- may not exist in older snapshots.
  v_snap := v_arc.snapshot
    || jsonb_build_object(
         'id',         v_new_ra_id,
         'user_id',    p_user_id,
         'ra_type',    COALESCE(v_arc.snapshot->>'ra_type', 'individual'),
         'status',     COALESCE(v_arc.snapshot->>'status', v_arc.status_at_archive::text),
         'updated_at', now()
       );

  -- Re-insert the RA row via record population (ignores unknown keys, so schema
  -- drift between snapshot and table is safe).
  INSERT INTO public.ra_associates
  SELECT (jsonb_populate_record(NULL::public.ra_associates, v_snap)).*;

  -- Re-point live leads/deals back at the restored owner (only ones still
  -- unattributed, so we never steal a lead that was re-assigned meanwhile).
  UPDATE public.leads l
     SET referred_by_ra_id = p_user_id
   WHERE l.id IN (SELECT original_lead_id FROM public.archived_leads WHERE archived_ra_associate_id = p_archive_id)
     AND l.referred_by_ra_id IS NULL;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  UPDATE public.deals d
     SET referred_by_ra_id = p_user_id
   WHERE d.id IN (SELECT original_deal_id FROM public.archived_deals WHERE archived_ra_associate_id = p_archive_id)
     AND d.referred_by_ra_id IS NULL;
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  -- Re-insert cascade-deleted child rows from their snapshots, re-homed on the
  -- new ra id with fresh primary keys.
  IF to_regclass('public.commission_payouts') IS NOT NULL THEN
    INSERT INTO public.commission_payouts
    SELECT (jsonb_populate_record(
              NULL::public.commission_payouts,
              snapshot || jsonb_build_object('id', gen_random_uuid(), 'ra_associate_id', v_new_ra_id)
            )).*
    FROM public.archived_commission_payouts
    WHERE archived_ra_associate_id = p_archive_id;
    GET DIAGNOSTICS v_payouts = ROW_COUNT;
  END IF;

  IF to_regclass('public.client_checkins') IS NOT NULL THEN
    INSERT INTO public.client_checkins
    SELECT (jsonb_populate_record(
              NULL::public.client_checkins,
              snapshot || jsonb_build_object('id', gen_random_uuid(), 'ra_associate_id', v_new_ra_id)
            )).*
    FROM public.archived_client_checkins
    WHERE archived_ra_associate_id = p_archive_id;
    GET DIAGNOSTICS v_checkins = ROW_COUNT;
  END IF;

  IF to_regclass('public.agreement_acceptances') IS NOT NULL THEN
    INSERT INTO public.agreement_acceptances
    SELECT (jsonb_populate_record(
              NULL::public.agreement_acceptances,
              snapshot || jsonb_build_object('id', gen_random_uuid(), 'ra_associate_id', v_new_ra_id)
            )).*
    FROM public.archived_agreement_acceptances
    WHERE archived_ra_associate_id = p_archive_id;
  END IF;

  -- Remove the archive parent (children cascade).
  DELETE FROM public.archived_ra_associates WHERE id = p_archive_id;

  ra_id := v_new_ra_id;
  leads_relinked := v_leads;
  deals_relinked := v_deals;
  payouts_restored := v_payouts;
  checkins_restored := v_checkins;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_ra(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_ra(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.restore_ra(UUID, UUID) IS
  'Undo a permanent RA delete: re-create the RA from its archive snapshot, re-link leads/deals, restore payouts/checkins/agreements, drop the archive entry. Called by the restore-ra edge function after it resolves the auth user. service_role-only.';
