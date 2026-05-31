-- ═══════════════════════════════════════════════════════════════════════════
-- Day 5: RA landing page templates
--
--   • ra_landing_templates: org-scoped HTML templates for /refer/:slug pages
--   • ra_associates.template_id: per-RA override (null = use org default)
--   • get_ra_landing_page(): extended to return first/last name + template HTML
--   • record_ra_lead(): SECURITY DEFINER insert path for public lead capture
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ra_landing_templates table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ra_landing_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  html            text        NOT NULL DEFAULT '',
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ra_landing_templates_org_idx
  ON public.ra_landing_templates(organization_id);

-- At most one default per org.
CREATE UNIQUE INDEX IF NOT EXISTS ra_landing_templates_one_default_per_org
  ON public.ra_landing_templates(organization_id) WHERE is_default = true;

DROP TRIGGER IF EXISTS ra_landing_templates_set_updated_at ON public.ra_landing_templates;
CREATE TRIGGER ra_landing_templates_set_updated_at
  BEFORE UPDATE ON public.ra_landing_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ra_landing_templates ENABLE ROW LEVEL SECURITY;

-- ── 2. RLS: org admins manage templates ──────────────────────────────────────

DROP POLICY IF EXISTS "ra_landing_templates: org admins manage"
  ON public.ra_landing_templates;
CREATE POLICY "ra_landing_templates: org admins manage"
  ON public.ra_landing_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.profiles p ON p.id = m.user_id
      WHERE m.organization_id = ra_landing_templates.organization_id
        AND m.user_id = auth.uid()
        AND p.role IN ('super_user', 'owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      JOIN public.profiles p ON p.id = m.user_id
      WHERE m.organization_id = ra_landing_templates.organization_id
        AND m.user_id = auth.uid()
        AND p.role IN ('super_user', 'owner', 'admin')
    )
  );

-- ── 3. Per-RA template override column ───────────────────────────────────────

ALTER TABLE public.ra_associates
  ADD COLUMN IF NOT EXISTS template_id uuid
    REFERENCES public.ra_landing_templates(id) ON DELETE SET NULL;

-- ── 4. Extend get_ra_landing_page() to include name parts + template HTML ───
-- Must DROP first because the return type signature changes (adding columns).

DROP FUNCTION IF EXISTS public.get_ra_landing_page(text);

CREATE OR REPLACE FUNCTION public.get_ra_landing_page(p_slug text)
RETURNS TABLE (
  slug            text,
  display_name    text,
  first_name      text,
  last_name       text,
  photo_url       text,
  contact_phone   text,
  contact_email   text,
  bio             text,
  is_active       boolean,
  template_html   text,
  template_name   text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ra AS (
    SELECT
      r.slug,
      r.display_name,
      r.photo_url,
      r.contact_phone,
      r.contact_email,
      r.bio,
      r.status,
      r.organization_id,
      r.template_id,
      p.full_name
    FROM public.ra_associates r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.slug = p_slug
    LIMIT 1
  ),
  tpl AS (
    -- 1) explicit per-RA template, OR
    -- 2) org default, OR
    -- 3) nothing (frontend falls back to built-in)
    SELECT t.html, t.name FROM public.ra_landing_templates t, ra
      WHERE t.id = ra.template_id
    UNION ALL
    SELECT t.html, t.name FROM public.ra_landing_templates t, ra
      WHERE ra.template_id IS NULL
        AND t.organization_id = ra.organization_id
        AND t.is_default = true
    LIMIT 1
  )
  SELECT
    ra.slug,
    ra.display_name,
    split_part(COALESCE(ra.full_name, ra.display_name), ' ', 1)                                    AS first_name,
    NULLIF(regexp_replace(COALESCE(ra.full_name, ra.display_name), '^\S+\s*', ''), '')             AS last_name,
    ra.photo_url,
    ra.contact_phone,
    ra.contact_email,
    ra.bio,
    (ra.status = 'active')                                                                          AS is_active,
    tpl.html                                                                                        AS template_html,
    tpl.name                                                                                        AS template_name
  FROM ra
  LEFT JOIN tpl ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_ra_landing_page(text) TO anon, authenticated;

-- ── 5. record_ra_lead(): public lead capture path ────────────────────────────
-- Called by the ra-lead-submit edge function (and could also be called directly
-- by anon clients, though the edge function is preferred for validation/rate-limiting).
-- Inserts into public.leads with referred_by_ra_id wired to the RA's user_id,
-- lead_source='ra_referral'. Returns the new lead's id.

CREATE OR REPLACE FUNCTION public.record_ra_lead(
  p_slug       text,
  p_first_name text,
  p_last_name  text DEFAULT NULL,
  p_email      text DEFAULT NULL,
  p_phone      text DEFAULT NULL,
  p_message    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ra_user_id  uuid;
  v_ra_org_id   uuid;
  v_lead_id     uuid;
BEGIN
  SELECT user_id, organization_id
    INTO v_ra_user_id, v_ra_org_id
  FROM public.ra_associates
  WHERE slug = p_slug AND status = 'active'
  LIMIT 1;

  IF v_ra_user_id IS NULL THEN
    RAISE EXCEPTION 'Active RA not found for slug %', p_slug USING ERRCODE = 'no_data_found';
  END IF;

  IF p_first_name IS NULL OR length(btrim(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'first_name is required';
  END IF;

  INSERT INTO public.leads (
    organization_id,
    first_name,
    last_name,
    email,
    phone,
    description,
    lead_source,
    lead_status,
    referred_by_ra_id,
    email_opt_out,
    converted
  ) VALUES (
    v_ra_org_id,
    btrim(p_first_name),
    NULLIF(btrim(coalesce(p_last_name, '')), ''),
    NULLIF(btrim(coalesce(p_email, '')), ''),
    NULLIF(btrim(coalesce(p_phone, '')), ''),
    NULLIF(btrim(coalesce(p_message, '')), ''),
    'ra_referral',
    'new',
    v_ra_user_id,
    false,
    false
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ra_lead(text, text, text, text, text, text)
  TO anon, authenticated;

-- ── 6. RA-scoped lead read function ──────────────────────────────────────────
-- Returns lead counts/list for the *currently authenticated* RA.
-- Used by the RA dashboard stat tiles + pipeline.

CREATE OR REPLACE FUNCTION public.get_ra_dashboard_stats()
RETURNS TABLE (
  total_leads       bigint,
  active_leads      bigint,
  deals_closed      bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS user_id
  )
  SELECT
    (SELECT count(*) FROM public.leads l, me
       WHERE l.referred_by_ra_id = me.user_id)                                  AS total_leads,
    (SELECT count(*) FROM public.leads l, me
       WHERE l.referred_by_ra_id = me.user_id AND l.converted = false)          AS active_leads,
    (SELECT count(*) FROM public.deals d, me
       WHERE d.referred_by_ra_id = me.user_id)                                  AS deals_closed;
$$;

GRANT EXECUTE ON FUNCTION public.get_ra_dashboard_stats() TO authenticated;

-- ── 7. Lead RLS: allow RAs to read their own attributed leads ────────────────
-- Existing org-member policy lets admins see all leads. This adds a parallel
-- policy so active RAs (who are NOT regular org members in the typical sense)
-- can see leads they personally referred.

DROP POLICY IF EXISTS "leads: ras can read own attributed" ON public.leads;
CREATE POLICY "leads: ras can read own attributed"
  ON public.leads
  FOR SELECT
  USING (referred_by_ra_id = auth.uid());
