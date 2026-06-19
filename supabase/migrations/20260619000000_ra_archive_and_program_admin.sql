-- ─────────────────────────────────────────────────────────────────────────────
-- RA Archive infrastructure + Program Admin designation
-- ─────────────────────────────────────────────────────────────────────────────
-- Two unrelated additions bundled in one migration because they ship together:
--
--   1. ARCHIVE TABLES — When an RA is permanently deleted, we snapshot the RA
--      and every related row (leads, deals, check-ins, payouts, agreement audit,
--      page views) into `archived_*` mirrors so prospect/client history is
--      preserved forever. Each archive row carries (organization_id,
--      original_*_id, snapshot JSONB, archived_at/by/reason). The delete-ra
--      edge function is the only writer (service role).
--
--   2. PROGRAM ADMIN DESIGNATION — An organization_members.is_program_admin
--      boolean flag identifies which admin(s) receive RA application
--      notifications and may approve/decline RA submissions. Super User assigns
--      via Team Members UI. Only admins can be designated. Multiple admins per
--      org can hold the designation.
--
-- Idempotent (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, etc.).

-- ── Part 1: Program Admin designation ────────────────────────────────────────

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS is_program_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS organization_members_program_admin_idx
  ON public.organization_members (organization_id)
  WHERE is_program_admin = true;

-- Helper: is the current user a Program Admin in the given org?
-- Returns true for super_user (platform-level), so all super_user code paths
-- continue to work without explicit checks.
CREATE OR REPLACE FUNCTION public.is_program_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_user'
  )
  OR EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND is_program_admin = true
      AND role = 'admin'
  );
$$;

-- Constraint: only admin org_members may hold is_program_admin=true.
-- Enforced at write time via a trigger because we don't want a CHECK constraint
-- to block legitimate role transitions (admin → bd while clearing the flag).
CREATE OR REPLACE FUNCTION public.enforce_program_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_program_admin = true AND NEW.role <> 'admin' THEN
    RAISE EXCEPTION 'is_program_admin can only be set on members with role = admin (got %)', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_members_program_admin_check ON public.organization_members;
CREATE TRIGGER organization_members_program_admin_check
  BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_program_admin_role();

-- ── Part 2: Archive tables ───────────────────────────────────────────────────
-- Shape: a parent `archived_ra_associates` snapshot + 6 child archive tables,
-- each FK'd to the parent with ON DELETE CASCADE. Per-row payload stored as
-- JSONB so future column additions on the source tables don't require schema
-- migrations on the archive side. Key fields are mirrored as columns for
-- listing/searching without unpacking JSONB.

-- Parent: archived RA snapshot
CREATE TABLE IF NOT EXISTS public.archived_ra_associates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Original identity (the ra_associates row that was deleted)
  original_ra_id UUID NOT NULL,
  original_user_id UUID,        -- nullable: may be set NULL if auth user was deleted
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  status_at_archive public.ra_status NOT NULL,
  -- Archive metadata
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_by UUID,             -- auth.users(id) of the admin who deleted — no FK to allow admin self-deletion later
  archive_reason TEXT,
  -- Full row dump of ra_associates as it was at delete time
  snapshot JSONB NOT NULL,
  -- Counts for fast list rendering without unpacking child tables
  archived_leads_count INTEGER NOT NULL DEFAULT 0,
  archived_deals_count INTEGER NOT NULL DEFAULT 0,
  archived_checkins_count INTEGER NOT NULL DEFAULT 0,
  archived_payouts_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS archived_ra_associates_org_idx
  ON public.archived_ra_associates (organization_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS archived_ra_associates_slug_idx
  ON public.archived_ra_associates (organization_id, slug);

-- Children: one archive table per source table tied to RA
CREATE TABLE IF NOT EXISTS public.archived_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_ra_associate_id UUID NOT NULL REFERENCES public.archived_ra_associates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  original_lead_id UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_leads_parent_idx
  ON public.archived_leads (archived_ra_associate_id);

CREATE TABLE IF NOT EXISTS public.archived_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_ra_associate_id UUID NOT NULL REFERENCES public.archived_ra_associates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  original_deal_id UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_deals_parent_idx
  ON public.archived_deals (archived_ra_associate_id);

CREATE TABLE IF NOT EXISTS public.archived_client_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_ra_associate_id UUID NOT NULL REFERENCES public.archived_ra_associates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  original_checkin_id UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_client_checkins_parent_idx
  ON public.archived_client_checkins (archived_ra_associate_id);

CREATE TABLE IF NOT EXISTS public.archived_commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_ra_associate_id UUID NOT NULL REFERENCES public.archived_ra_associates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  original_payout_id UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_commission_payouts_parent_idx
  ON public.archived_commission_payouts (archived_ra_associate_id);

CREATE TABLE IF NOT EXISTS public.archived_agreement_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_ra_associate_id UUID NOT NULL REFERENCES public.archived_ra_associates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  original_acceptance_id UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_agreement_acceptances_parent_idx
  ON public.archived_agreement_acceptances (archived_ra_associate_id);

CREATE TABLE IF NOT EXISTS public.archived_ra_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archived_ra_associate_id UUID NOT NULL REFERENCES public.archived_ra_associates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_ra_page_views_parent_idx
  ON public.archived_ra_page_views (archived_ra_associate_id);

-- ── RLS on archive tables ────────────────────────────────────────────────────
-- Archive contains banking + W-9 + commission + audit data. Read access is
-- tighter than ordinary RA management: super_user OR org owner OR program
-- admin. NOT every admin, since they can already manage RAs without needing
-- access to the historical PII of deleted ones. Writes are service-role only
-- (delete-ra edge function); no client-side INSERT/UPDATE/DELETE policy.

CREATE OR REPLACE FUNCTION public.can_view_ra_archive(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.is_super_user()
      OR public.is_program_admin(org_id)
      OR EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND role = 'owner'
      );
$$;

DO $$
DECLARE
  t text;
  archive_tables text[] := ARRAY[
    'archived_ra_associates',
    'archived_leads',
    'archived_deals',
    'archived_client_checkins',
    'archived_commission_payouts',
    'archived_agreement_acceptances',
    'archived_ra_page_views'
  ];
BEGIN
  FOREACH t IN ARRAY archive_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($f$
      DROP POLICY IF EXISTS %I ON public.%I
    $f$, t || '_read', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (public.can_view_ra_archive(organization_id))
    $f$, t || '_read', t);
  END LOOP;
END $$;

COMMENT ON TABLE public.archived_ra_associates IS
  'Permanent archive of deleted RAs and their related rows. Written only by the delete-ra edge function (service role). Readable by super_user, owners, and program admins.';

COMMENT ON FUNCTION public.is_program_admin(uuid) IS
  'Returns true when the current user is super_user, OR an admin in the given org with is_program_admin=true. Used by RLS, notification routing, and approve/decline gates.';

-- ── Part 3: Atomic archive RPC ───────────────────────────────────────────────
-- archive_ra(ra_id, archived_by, reason) snapshots the RA + every related row
-- into the archive tables in a single transaction. Returns the new
-- archived_ra_associates.id. The caller (delete-ra edge function) is then
-- responsible for deleting the auth.user, which cascades through profiles →
-- ra_associates → ra_page_views / client_checkins / commission_payouts /
-- agreement_acceptances. leads/deals.referred_by_ra_id cascades to NULL because
-- the FK is to profiles(id), not ra_associates(id) — we snapshot before that
-- happens so attribution is never lost.
--
-- Runs as SECURITY DEFINER so it bypasses RLS on the source tables. Permission
-- to call is granted to authenticated only as a final fallback; the edge
-- function gates on super_user OR is_program_admin before invoking.

CREATE OR REPLACE FUNCTION public.archive_ra(
  p_ra_id UUID,
  p_archived_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ra public.ra_associates;
  v_profile_email TEXT;
  v_archive_id UUID;
  v_leads_count INTEGER := 0;
  v_deals_count INTEGER := 0;
  v_checkins_count INTEGER := 0;
  v_payouts_count INTEGER := 0;
BEGIN
  -- Fetch the RA row (locks for the duration of the transaction)
  SELECT * INTO v_ra FROM public.ra_associates WHERE id = p_ra_id FOR UPDATE;
  IF v_ra.id IS NULL THEN
    RAISE EXCEPTION 'RA % not found', p_ra_id;
  END IF;

  -- Resolve the email from profiles (RA snapshot also captures it directly)
  SELECT email INTO v_profile_email FROM public.profiles WHERE id = v_ra.user_id;

  -- Parent archive row — snapshot the full ra_associates row as JSONB
  INSERT INTO public.archived_ra_associates (
    organization_id,
    original_ra_id,
    original_user_id,
    slug,
    display_name,
    email,
    status_at_archive,
    archived_at,
    archived_by,
    archive_reason,
    snapshot
  )
  VALUES (
    v_ra.organization_id,
    v_ra.id,
    v_ra.user_id,
    v_ra.slug,
    v_ra.display_name,
    v_profile_email,
    v_ra.status,
    now(),
    p_archived_by,
    p_reason,
    to_jsonb(v_ra)
  )
  RETURNING id INTO v_archive_id;

  -- Snapshot every lead this RA referred (referred_by_ra_id points at
  -- profiles(id) — i.e. the RA's user_id). Leads themselves stay in place;
  -- their referred_by_ra_id will SET NULL when the profile cascades, but the
  -- archive preserves the attribution snapshot.
  IF v_ra.user_id IS NOT NULL THEN
    INSERT INTO public.archived_leads (
      archived_ra_associate_id, organization_id, original_lead_id, snapshot
    )
    SELECT v_archive_id, v_ra.organization_id, l.id, to_jsonb(l)
    FROM public.leads l
    WHERE l.referred_by_ra_id = v_ra.user_id;
    GET DIAGNOSTICS v_leads_count = ROW_COUNT;

    INSERT INTO public.archived_deals (
      archived_ra_associate_id, organization_id, original_deal_id, snapshot
    )
    SELECT v_archive_id, v_ra.organization_id, d.id, to_jsonb(d)
    FROM public.deals d
    WHERE d.referred_by_ra_id = v_ra.user_id;
    GET DIAGNOSTICS v_deals_count = ROW_COUNT;
  END IF;

  -- Snapshot RA-keyed child tables. These would CASCADE to dust when the RA
  -- is deleted, so snapshot first.
  IF to_regclass('public.client_checkins') IS NOT NULL THEN
    INSERT INTO public.archived_client_checkins (
      archived_ra_associate_id, organization_id, original_checkin_id, snapshot
    )
    SELECT v_archive_id, v_ra.organization_id, c.id, to_jsonb(c)
    FROM public.client_checkins c
    WHERE c.ra_associate_id = v_ra.id;
    GET DIAGNOSTICS v_checkins_count = ROW_COUNT;
  END IF;

  IF to_regclass('public.commission_payouts') IS NOT NULL THEN
    INSERT INTO public.archived_commission_payouts (
      archived_ra_associate_id, organization_id, original_payout_id, snapshot
    )
    SELECT v_archive_id, v_ra.organization_id, p.id, to_jsonb(p)
    FROM public.commission_payouts p
    WHERE p.ra_associate_id = v_ra.id;
    GET DIAGNOSTICS v_payouts_count = ROW_COUNT;
  END IF;

  IF to_regclass('public.agreement_acceptances') IS NOT NULL THEN
    INSERT INTO public.archived_agreement_acceptances (
      archived_ra_associate_id, organization_id, original_acceptance_id, snapshot
    )
    SELECT v_archive_id, v_ra.organization_id, a.id, to_jsonb(a)
    FROM public.agreement_acceptances a
    WHERE a.ra_associate_id = v_ra.id;
  END IF;

  IF to_regclass('public.ra_page_views') IS NOT NULL THEN
    INSERT INTO public.archived_ra_page_views (
      archived_ra_associate_id, organization_id, snapshot
    )
    SELECT v_archive_id, v_ra.organization_id, to_jsonb(v)
    FROM public.ra_page_views v
    WHERE v.ra_id = v_ra.id;
  END IF;

  -- Backfill the parent counts so the archive list view doesn't need
  -- per-row aggregation.
  UPDATE public.archived_ra_associates
  SET archived_leads_count = v_leads_count,
      archived_deals_count = v_deals_count,
      archived_checkins_count = v_checkins_count,
      archived_payouts_count = v_payouts_count
  WHERE id = v_archive_id;

  RETURN v_archive_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_ra(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_ra(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.archive_ra(UUID, UUID, TEXT) IS
  'Snapshots an RA and all related rows (leads, deals, checkins, payouts, agreements, page views) into archive tables. Called by the delete-ra edge function before deleting the underlying auth user. SECURITY DEFINER; service_role-only execution.';
