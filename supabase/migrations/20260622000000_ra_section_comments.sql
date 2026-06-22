-- ─────────────────────────────────────────────────────────────────────────────
-- ra_section_comments — per-section review comments on an RA application.
--
-- A reviewing admin (super_user, admin, or program_admin) can attach
-- comments to any onboarding section (agreement / photo / bio / contact /
-- banking / w9 / profile / other). The RA the comments belong to can READ
-- their own comments so they can address each one before re-submitting.
-- Comments can be marked resolved (audit-friendly) but are never hard-deleted
-- except by the original author or a super_user, to preserve review history.
--
-- RLS:
--   * Authors / admins of the same org write
--   * RA owner reads own
--   * Program admins of the org write + read
--   * super_user always (platform-wide)
--
-- Idempotent (CREATE IF NOT EXISTS, DO blocks for policies, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ra_section_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ra_id           UUID NOT NULL REFERENCES public.ra_associates(id) ON DELETE CASCADE,
  -- Free-text key (not an enum) so we can add sections without a migration.
  -- Current sections used by the UI: agreement, photo, bio, contact, banking,
  -- w9, profile, other.
  section         TEXT NOT NULL CHECK (length(section) BETWEEN 1 AND 32),
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ra_section_comments_ra_idx
  ON public.ra_section_comments (ra_id, section, created_at);

CREATE INDEX IF NOT EXISTS ra_section_comments_org_idx
  ON public.ra_section_comments (organization_id, created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.ra_section_comments_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ra_section_comments_touch ON public.ra_section_comments;
CREATE TRIGGER ra_section_comments_touch
  BEFORE UPDATE ON public.ra_section_comments
  FOR EACH ROW EXECUTE FUNCTION public.ra_section_comments_touch();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.ra_section_comments ENABLE ROW LEVEL SECURITY;

-- READ: admins/super_user/program_admin in the org, OR the RA themselves
DROP POLICY IF EXISTS ra_section_comments_select ON public.ra_section_comments;
CREATE POLICY ra_section_comments_select
  ON public.ra_section_comments
  FOR SELECT
  USING (
    -- Platform super user
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
    OR
    -- Admins of the same org (or program admin via helper)
    public.is_program_admin(organization_id)
    OR
    -- Admin role on the org (broader than program admin: any admin can read)
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_section_comments.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
    )
    OR
    -- The RA the comment belongs to can read their own
    EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = ra_section_comments.ra_id
        AND ra.user_id = auth.uid()
    )
  );

-- INSERT: admins/super_user/program_admin only (RAs cannot comment on themselves)
DROP POLICY IF EXISTS ra_section_comments_insert ON public.ra_section_comments;
CREATE POLICY ra_section_comments_insert
  ON public.ra_section_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_user'
      )
      OR public.is_program_admin(organization_id)
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = ra_section_comments.organization_id
          AND om.user_id = auth.uid()
          AND om.role = 'admin'
      )
    )
  );

-- UPDATE: only the original author (for edits) or any super_user / program admin
-- (used to mark resolved_at). RA owners cannot mutate.
DROP POLICY IF EXISTS ra_section_comments_update ON public.ra_section_comments;
CREATE POLICY ra_section_comments_update
  ON public.ra_section_comments
  FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
    OR public.is_program_admin(organization_id)
  )
  WITH CHECK (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
    OR public.is_program_admin(organization_id)
  );

-- DELETE: original author or super_user only
DROP POLICY IF EXISTS ra_section_comments_delete ON public.ra_section_comments;
CREATE POLICY ra_section_comments_delete
  ON public.ra_section_comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_user'
    )
  );
