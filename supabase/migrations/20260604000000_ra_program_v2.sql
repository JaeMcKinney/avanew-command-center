-- ─────────────────────────────────────────────────────────────────────────────
-- RA Program v2 — agreement, W-9, lead stages, commission payouts
-- ─────────────────────────────────────────────────────────────────────────────
-- Combines onboarding column additions (PR-3) and leads/payouts schema (PR-7).
-- Drives:
--   • R0 Agreement step audit trail
--   • R4b W-9 upload with admin review
--   • RA-attribution lead stage tracking (kanban-ready)
--   • Recurring commission payout schedule

-- ── 1. Lead pipeline stage enum (for kanban + closed-won/lost flows) ──────────

DO $$ BEGIN
  CREATE TYPE public.lead_pipeline_stage AS ENUM (
    'new', 'qualified', 'proposal_sent', 'call_booked', 'closed_won', 'closed_lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 2. Onboarding columns on ra_associates ────────────────────────────────────

ALTER TABLE public.ra_associates
  ADD COLUMN IF NOT EXISTS display_name_override   text,
  ADD COLUMN IF NOT EXISTS linkedin_url            text,
  ADD COLUMN IF NOT EXISTS w9_completed            boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS w9_document_url         text,
  ADD COLUMN IF NOT EXISTS w9_uploaded_at          timestamptz,
  ADD COLUMN IF NOT EXISTS w9_reviewed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS w9_reviewed_by          uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS agreement_completed     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_version       text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_ip_address    text,
  ADD COLUMN IF NOT EXISTS agreement_user_agent    text,
  ADD COLUMN IF NOT EXISTS agreement_signed_name   text;

COMMENT ON COLUMN public.ra_associates.display_name_override IS
  'RA-chosen public-facing name. Nullable; falls back to display_name (first + last).';
COMMENT ON COLUMN public.ra_associates.w9_document_url IS
  'Supabase Storage path in the private ra-w9 bucket (admin-readable only).';
COMMENT ON COLUMN public.ra_associates.agreement_ip_address IS
  'Captured by the accept-agreement edge function from request headers.';

-- ── 3. agreement_acceptances audit log ────────────────────────────────────────
-- One row per acceptance event (including re-acceptance on version bumps).

CREATE TABLE IF NOT EXISTS public.agreement_acceptances (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_associate_id    uuid        NOT NULL REFERENCES public.ra_associates(id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agreement_version  text        NOT NULL,
  accepted_at        timestamptz NOT NULL DEFAULT now(),
  ip_address         text,
  user_agent         text,
  signed_legal_name  text        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agreement_acceptances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS agreement_acceptances_ra_idx     ON public.agreement_acceptances(ra_associate_id);
CREATE INDEX IF NOT EXISTS agreement_acceptances_user_idx   ON public.agreement_acceptances(user_id);
CREATE INDEX IF NOT EXISTS agreement_acceptances_at_idx     ON public.agreement_acceptances(accepted_at DESC);

DROP POLICY IF EXISTS "agreement_acceptances_read" ON public.agreement_acceptances;
DROP POLICY IF EXISTS "agreement_acceptances_insert" ON public.agreement_acceptances;

-- Only the RA themselves and same-org admins may read.
CREATE POLICY "agreement_acceptances_read" ON public.agreement_acceptances
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.ra_associates ra
        JOIN public.organization_members om ON om.organization_id = ra.organization_id
      WHERE ra.id = agreement_acceptances.ra_associate_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

-- Inserts come exclusively from the accept-agreement edge function (service-role).
-- Authenticated insert is still allowed by the RA themselves for resilience.
CREATE POLICY "agreement_acceptances_insert" ON public.agreement_acceptances
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = agreement_acceptances.ra_associate_id
        AND ra.user_id = auth.uid()
    )
  );

-- ── 4. Leads / Deals — pipeline stage + closure metadata ──────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage          public.lead_pipeline_stage NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS closed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason  text;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS closed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason  text,
  ADD COLUMN IF NOT EXISTS implementation_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS implementation_fee_paid     numeric(12,2);

CREATE INDEX IF NOT EXISTS leads_stage_idx ON public.leads(stage);

-- ── 5. commission_payouts (recurring + one-time schedule + status) ────────────

DO $$ BEGIN
  CREATE TYPE public.commission_payout_type AS ENUM ('one_time', 'recurring');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$ BEGIN
  CREATE TYPE public.commission_payout_status AS ENUM (
    'scheduled', 'paid', 'skipped', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

CREATE TABLE IF NOT EXISTS public.commission_payouts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ra_associate_id    uuid        NOT NULL REFERENCES public.ra_associates(id) ON DELETE CASCADE,
  deal_id            uuid        REFERENCES public.deals(id) ON DELETE SET NULL,
  lead_id            uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  type               public.commission_payout_type   NOT NULL,
  period_start       date,
  period_end         date,
  amount             numeric(12,2) NOT NULL CHECK (amount >= 0),
  status             public.commission_payout_status NOT NULL DEFAULT 'scheduled',
  paid_at            timestamptz,
  ach_transaction_id text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS commission_payouts_org_idx  ON public.commission_payouts(organization_id);
CREATE INDEX IF NOT EXISTS commission_payouts_ra_idx   ON public.commission_payouts(ra_associate_id);
CREATE INDEX IF NOT EXISTS commission_payouts_deal_idx ON public.commission_payouts(deal_id);
CREATE INDEX IF NOT EXISTS commission_payouts_status_idx ON public.commission_payouts(status);
CREATE INDEX IF NOT EXISTS commission_payouts_period_idx
  ON public.commission_payouts(period_start, period_end);

DROP TRIGGER IF EXISTS commission_payouts_set_updated_at ON public.commission_payouts;
CREATE TRIGGER commission_payouts_set_updated_at
  BEFORE UPDATE ON public.commission_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "commission_payouts_read" ON public.commission_payouts;
DROP POLICY IF EXISTS "commission_payouts_admin_write" ON public.commission_payouts;

-- The RA can see their own; same-org admins manage all.
CREATE POLICY "commission_payouts_read" ON public.commission_payouts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = commission_payouts.ra_associate_id
        AND ra.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = commission_payouts.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "commission_payouts_admin_write" ON public.commission_payouts
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = commission_payouts.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = commission_payouts.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

-- ── 6. ra_program_settings — per-org commission configuration ─────────────────
-- Backs the SettingsFinancial "Referral Commission Structure" card.

CREATE TABLE IF NOT EXISTS public.ra_program_settings (
  organization_id           uuid        PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  one_time_mode             text        NOT NULL DEFAULT 'flat' CHECK (one_time_mode IN ('flat','percent')),
  one_time_value            numeric(12,2) NOT NULL DEFAULT 1000,
  implementation_fee        numeric(12,2) NOT NULL DEFAULT 6000,
  recurring_mode            text        NOT NULL DEFAULT 'flat' CHECK (recurring_mode IN ('flat','percent')),
  recurring_value           numeric(12,2) NOT NULL DEFAULT 50,
  monthly_service_fee       numeric(12,2) NOT NULL DEFAULT 600,
  recurring_duration_kind   text        NOT NULL DEFAULT 'indefinite' CHECK (recurring_duration_kind IN ('indefinite','months')),
  recurring_duration_months integer,
  attribution_window_days   integer     NOT NULL DEFAULT 30 CHECK (attribution_window_days > 0),
  annual_minimum_referrals  integer     NOT NULL DEFAULT 4 CHECK (annual_minimum_referrals >= 0),
  checkin_interval_days     integer     NOT NULL DEFAULT 90,
  checkin_warning_days      integer     NOT NULL DEFAULT 90,
  checkin_suspension_days   integer     NOT NULL DEFAULT 150,
  agreement_version         text        NOT NULL DEFAULT 'v1.0',
  updated_at                timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ra_program_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS ra_program_settings_set_updated_at ON public.ra_program_settings;
CREATE TRIGGER ra_program_settings_set_updated_at
  BEFORE UPDATE ON public.ra_program_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "ra_program_settings_read" ON public.ra_program_settings;
DROP POLICY IF EXISTS "ra_program_settings_admin_write" ON public.ra_program_settings;

-- Any member of the org can read (powers public RA pages + dashboards).
CREATE POLICY "ra_program_settings_read" ON public.ra_program_settings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_program_settings.organization_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "ra_program_settings_admin_write" ON public.ra_program_settings
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_program_settings.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_program_settings.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

-- Seed defaults for existing orgs.
INSERT INTO public.ra_program_settings (organization_id)
  SELECT id FROM public.organizations
  ON CONFLICT (organization_id) DO NOTHING;

-- ── 7. ra-w9 private storage bucket ───────────────────────────────────────────
-- Admin-only access via the standard storage.objects policies pattern.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('ra-w9', 'ra-w9', false)
  ON CONFLICT (id) DO NOTHING;

-- RA can upload to their own folder; admins can read all.
DROP POLICY IF EXISTS "ra_w9_owner_upload" ON storage.objects;
DROP POLICY IF EXISTS "ra_w9_admin_read"   ON storage.objects;

CREATE POLICY "ra_w9_owner_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'ra-w9'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ra_w9_admin_read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'ra-w9'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid()
          AND role IN ('super_user', 'owner', 'admin')
      )
    )
  );
