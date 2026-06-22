-- ─────────────────────────────────────────────────────────────────────────────
-- ra_change_requests — when an RA edits sensitive fields (banking / W-9) from
-- their self-service settings page, we DON'T mutate ra_associates directly.
-- Instead we capture the proposed change here as a pending request that a
-- Program Admin reviews and approves/declines. Non-sensitive profile fields
-- (photo, bio, alias display_name, contact info) are written directly by the RA
-- and do NOT go through this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ra_change_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ra_associate_id  UUID NOT NULL REFERENCES public.ra_associates(id) ON DELETE CASCADE,
  request_type     TEXT NOT NULL CHECK (request_type IN ('banking', 'w9', 'other')),
  -- Proposed values. For banking: { ach_account_holder, ach_bank_name,
  -- ach_routing, ach_account }. For w9: { w9_document_url }. Stored as JSONB so
  -- the shape can evolve without a migration.
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  requested_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  review_note      TEXT
);

CREATE INDEX IF NOT EXISTS ra_change_requests_ra_idx
  ON public.ra_change_requests (ra_associate_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS ra_change_requests_pending_idx
  ON public.ra_change_requests (organization_id, status)
  WHERE status = 'pending';

ALTER TABLE public.ra_change_requests ENABLE ROW LEVEL SECURITY;

-- READ: the RA who owns the request, or admins/program-admins/super_user.
DROP POLICY IF EXISTS ra_change_requests_select ON public.ra_change_requests;
CREATE POLICY ra_change_requests_select
  ON public.ra_change_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = ra_change_requests.ra_associate_id
        AND ra.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
    OR public.is_program_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_change_requests.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
    )
  );

-- INSERT: only the RA themselves, for their own ra_associate row.
DROP POLICY IF EXISTS ra_change_requests_insert ON public.ra_change_requests;
CREATE POLICY ra_change_requests_insert
  ON public.ra_change_requests
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = ra_change_requests.ra_associate_id
        AND ra.user_id = auth.uid()
        AND ra.organization_id = ra_change_requests.organization_id
    )
  );

-- UPDATE: only admins/program-admins/super_user (to set status + review_note).
DROP POLICY IF EXISTS ra_change_requests_update ON public.ra_change_requests;
CREATE POLICY ra_change_requests_update
  ON public.ra_change_requests
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_user')
    OR public.is_program_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_change_requests.organization_id
        AND om.user_id = auth.uid() AND om.role = 'admin'
    )
  );
