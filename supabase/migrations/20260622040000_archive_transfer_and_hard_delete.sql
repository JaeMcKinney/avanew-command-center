-- Permanent-delete + lead-transfer for archived RAs
--
-- Two RPCs that round out the archive lifecycle:
--   • transfer_archived_ra_leads(p_archive_id, p_target_user_id)
--       Re-points every live lead/deal that was originally referred by the
--       archived RA to a different active RA's user_id. The archive entry
--       (snapshot of the original attribution) stays intact for audit.
--       Returns the per-table counts of rows actually moved.
--
--   • hard_delete_archived_ra(p_archive_id)
--       Permanently drops the archive entry; ON DELETE CASCADE cleans up
--       archived_leads / archived_deals / archived_client_checkins /
--       archived_commission_payouts / archived_agreement_acceptances /
--       archived_ra_page_views. Once gone, the only path to recover this
--       RA's prospect/client history is from external backups.
--
-- Both RPCs run as SECURITY DEFINER so they can mutate ra-attribution columns
-- on tables RLS-locked to staff. Caller permission is enforced by the calling
-- edge functions (transfer-archived-leads / hard-delete-archive), which gate
-- on super_user OR program_admin in the archive's org.

-- ── transfer_archived_ra_leads ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_archived_ra_leads(
  p_archive_id uuid,
  p_target_user_id uuid
)
RETURNS TABLE (leads_transferred integer, deals_transferred integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_target_org uuid;
  v_leads int := 0;
  v_deals int := 0;
BEGIN
  -- Resolve the archive entry's org so we can scope the safety check.
  SELECT organization_id INTO v_org
  FROM public.archived_ra_associates
  WHERE id = p_archive_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Archive entry % not found', p_archive_id;
  END IF;

  -- Target RA must exist as an active RA in the same org. Prevents accidentally
  -- transferring leads to an RA from a different org / a non-RA profile.
  SELECT organization_id INTO v_target_org
  FROM public.ra_associates
  WHERE user_id = p_target_user_id
    AND organization_id = v_org;
  IF v_target_org IS NULL THEN
    RAISE EXCEPTION 'Target RA user_id % is not an active RA in this organization', p_target_user_id;
  END IF;

  -- Re-point live leads that originated from this RA.
  -- The archived_leads snapshot preserves the original_lead_id pointing at the
  -- still-existing live row. After delete-ra, leads.referred_by_ra_id was
  -- SET NULL by FK cascade; the IS NULL guard keeps us from clobbering rows a
  -- restore (or a previous transfer) may have already reassigned.
  WITH targets AS (
    SELECT original_lead_id AS lead_id
    FROM public.archived_leads
    WHERE archived_ra_associate_id = p_archive_id
  )
  UPDATE public.leads l
  SET referred_by_ra_id = p_target_user_id
  FROM targets t
  WHERE l.id = t.lead_id
    AND l.referred_by_ra_id IS NULL;
  GET DIAGNOSTICS v_leads = ROW_COUNT;

  WITH targets AS (
    SELECT original_deal_id AS deal_id
    FROM public.archived_deals
    WHERE archived_ra_associate_id = p_archive_id
  )
  UPDATE public.deals d
  SET referred_by_ra_id = p_target_user_id
  FROM targets t
  WHERE d.id = t.deal_id
    AND d.referred_by_ra_id IS NULL;
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  RETURN QUERY SELECT v_leads, v_deals;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_archived_ra_leads(uuid, uuid) FROM public;

-- ── hard_delete_archived_ra ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hard_delete_archived_ra(p_archive_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.archived_ra_associates WHERE id = p_archive_id
  ) THEN
    RAISE EXCEPTION 'Archive entry % not found', p_archive_id;
  END IF;

  -- Children of archived_ra_associates are ON DELETE CASCADE — one row goes,
  -- the rest follow.
  DELETE FROM public.archived_ra_associates WHERE id = p_archive_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_archived_ra(uuid) FROM public;
