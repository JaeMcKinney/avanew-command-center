-- ── Referral Associates Program ───────────────────────────────────────────────

-- ── 1. Extend team_role enum ──────────────────────────────────────────────────
ALTER TYPE public.team_role ADD VALUE IF NOT EXISTS 'referral_associate';

-- ── 2. RA status enum ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.ra_status AS ENUM (
    'pending', 'verification', 'needs_changes',
    'active', 'suspended', 'declined', 'terminated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ── 3. ra_associates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ra_associates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug                text        NOT NULL UNIQUE,
  display_name        text        NOT NULL,
  status              public.ra_status NOT NULL DEFAULT 'pending',
  -- RA-editable profile (also surfaced on landing page)
  photo_url           text,
  contact_phone       text,
  contact_email       text,
  bio                 text,
  -- Banking (plain text, RLS-gated to admins; encrypted at rest by Supabase)
  ach_bank_name       text,
  ach_routing         text,
  ach_account         text,
  ach_account_holder  text,
  -- Section completion flags (drive onboarding progress UI)
  photo_completed     boolean     NOT NULL DEFAULT false,
  contact_completed   boolean     NOT NULL DEFAULT false,
  banking_completed   boolean     NOT NULL DEFAULT false,
  -- Verification workflow
  submitted_at        timestamptz,
  verification_notes  text,
  verified_at         timestamptz,
  verified_by         uuid        REFERENCES public.profiles(id),
  activated_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_associates_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(slug) BETWEEN 2 AND 60)
);
ALTER TABLE public.ra_associates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ra_associates_org_idx    ON public.ra_associates(organization_id);
CREATE INDEX IF NOT EXISTS ra_associates_slug_idx   ON public.ra_associates(slug);
CREATE INDEX IF NOT EXISTS ra_associates_status_idx ON public.ra_associates(status);

DROP TRIGGER IF EXISTS ra_associates_set_updated_at ON public.ra_associates;
CREATE TRIGGER ra_associates_set_updated_at
  BEFORE UPDATE ON public.ra_associates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Attribution + intent columns ──────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referred_by_ra_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS prospect_intent        text        CHECK (prospect_intent IN ('learning', 'interested', 'sold') OR prospect_intent IS NULL);

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS referred_by_ra_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution_expires_at timestamptz;

-- ── 5. RA page-view analytics ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ra_page_views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ra_id       uuid        NOT NULL REFERENCES public.ra_associates(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  ip_hash     text,
  user_agent  text
);
ALTER TABLE public.ra_page_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ra_page_views_ra_id_idx   ON public.ra_page_views(ra_id);
CREATE INDEX IF NOT EXISTS ra_page_views_viewed_at_idx ON public.ra_page_views(viewed_at);

-- ── 6. Deal / lead notification subscribers ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_notification_subscribers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid        REFERENCES public.deals(id) ON DELETE CASCADE,
  lead_id       uuid        REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  email         text,
  display_name  text,
  added_by      uuid        NOT NULL REFERENCES public.profiles(id),
  added_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dns_has_parent  CHECK ((deal_id IS NOT NULL) OR (lead_id IS NOT NULL)),
  CONSTRAINT dns_has_contact CHECK ((user_id IS NOT NULL) OR (email IS NOT NULL))
);
ALTER TABLE public.deal_notification_subscribers ENABLE ROW LEVEL SECURITY;

-- Partial unique indexes prevent duplicate subscribers per record
CREATE UNIQUE INDEX IF NOT EXISTS dns_unique_user_deal
  ON public.deal_notification_subscribers(deal_id, user_id)
  WHERE deal_id IS NOT NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dns_unique_email_deal
  ON public.deal_notification_subscribers(deal_id, email)
  WHERE deal_id IS NOT NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dns_unique_user_lead
  ON public.deal_notification_subscribers(lead_id, user_id)
  WHERE lead_id IS NOT NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dns_unique_email_lead
  ON public.deal_notification_subscribers(lead_id, email)
  WHERE lead_id IS NOT NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS dns_deal_id_idx ON public.deal_notification_subscribers(deal_id);
CREATE INDEX IF NOT EXISTS dns_lead_id_idx ON public.deal_notification_subscribers(lead_id);

-- ── RLS: ra_associates ────────────────────────────────────────────────────────
-- RA can see/edit their own row. Same-org admins can manage all. Admins-only for INSERT/DELETE.

DROP POLICY IF EXISTS "ra_read_own_or_admin"    ON public.ra_associates;
DROP POLICY IF EXISTS "ra_insert_admin"          ON public.ra_associates;
DROP POLICY IF EXISTS "ra_update_own_or_admin"   ON public.ra_associates;
DROP POLICY IF EXISTS "ra_delete_admin"          ON public.ra_associates;

CREATE POLICY "ra_read_own_or_admin" ON public.ra_associates
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_associates.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "ra_insert_admin" ON public.ra_associates
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_associates.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "ra_update_own_or_admin" ON public.ra_associates
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_associates.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_associates.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

CREATE POLICY "ra_delete_admin" ON public.ra_associates
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = ra_associates.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('super_user', 'owner', 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

-- ── RLS: ra_page_views ────────────────────────────────────────────────────────
-- Recorded via the record_ra_page_view() SECURITY DEFINER function (anon-callable).
-- Direct reads restricted to the RA themselves and same-org admins.

DROP POLICY IF EXISTS "ra_page_views_read" ON public.ra_page_views;

CREATE POLICY "ra_page_views_read" ON public.ra_page_views
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = ra_page_views.ra_id
        AND (
          ra.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = ra.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('super_user', 'owner', 'admin')
          )
        )
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_user')
  );

-- ── RLS: deal_notification_subscribers ───────────────────────────────────────
-- Any authenticated user can read. Members+ can add. Admins can delete.

DROP POLICY IF EXISTS "dns_read_authenticated"   ON public.deal_notification_subscribers;
DROP POLICY IF EXISTS "dns_insert_authenticated" ON public.deal_notification_subscribers;
DROP POLICY IF EXISTS "dns_delete_admin"         ON public.deal_notification_subscribers;

CREATE POLICY "dns_read_authenticated" ON public.deal_notification_subscribers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dns_insert_authenticated" ON public.deal_notification_subscribers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "dns_delete_admin" ON public.deal_notification_subscribers
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_user', 'owner', 'admin', 'member')
    )
  );

-- ── Public landing page: SECURITY DEFINER read ───────────────────────────────
-- Called by the React app (anon Supabase client) to render /refer/:slug.
-- Returns only safe public fields — never exposes banking, status internals, or UUIDs.

CREATE OR REPLACE FUNCTION public.get_ra_landing_page(p_slug text)
RETURNS TABLE (
  slug          text,
  display_name  text,
  photo_url     text,
  contact_phone text,
  contact_email text,
  bio           text,
  is_active     boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ra.slug,
    ra.display_name,
    ra.photo_url,
    ra.contact_phone,
    ra.contact_email,
    ra.bio,
    (ra.status = 'active') AS is_active
  FROM public.ra_associates ra
  WHERE ra.slug = p_slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_ra_landing_page(text) TO anon, authenticated;

-- ── Page view recorder: SECURITY DEFINER insert ───────────────────────────────
-- Called by the public landing page (anon) to record a visit.
-- Looks up the ra_id from slug internally so no UUID is exposed to the client.

CREATE OR REPLACE FUNCTION public.record_ra_page_view(
  p_slug      text,
  p_ip_hash   text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ra_id uuid;
BEGIN
  SELECT id INTO v_ra_id FROM public.ra_associates WHERE slug = p_slug AND status = 'active';
  IF v_ra_id IS NOT NULL THEN
    INSERT INTO public.ra_page_views (ra_id, ip_hash, user_agent)
    VALUES (v_ra_id, p_ip_hash, p_user_agent);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ra_page_view(text, text, text) TO anon, authenticated;

-- ── Trigger: copy subscribers from lead → deal on conversion ──────────────────
-- Fires when leads.converted_deal_id is set (non-null → non-null change handled too).

CREATE OR REPLACE FUNCTION public.copy_subscribers_lead_to_deal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.converted_deal_id IS NOT NULL
     AND (OLD.converted_deal_id IS DISTINCT FROM NEW.converted_deal_id)
  THEN
    INSERT INTO public.deal_notification_subscribers
      (deal_id, user_id, email, display_name, added_by)
    SELECT
      NEW.converted_deal_id,
      dns.user_id,
      dns.email,
      dns.display_name,
      dns.added_by
    FROM public.deal_notification_subscribers dns
    WHERE dns.lead_id = NEW.id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_copy_subscribers_on_convert ON public.leads;
CREATE TRIGGER leads_copy_subscribers_on_convert
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.copy_subscribers_lead_to_deal();
