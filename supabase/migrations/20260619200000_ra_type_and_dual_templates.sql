-- ═══════════════════════════════════════════════════════════════════════════
-- RA type (Individual vs Company) + dual landing templates (demo + refer)
--
--   1. ra_associates.ra_type — explicit 'individual' | 'company' (was inferred
--      from partner_company_name). Set at invite, editable after.
--   2. ra_landing_templates.demo_html — second HTML body so a template now
--      drives BOTH the /demo/:slug page (demo_html) and /refer/:slug page (html).
--   3. ra_landing_templates.default_for_type — marks a template as the default
--      for individuals OR companies. New RAs auto-resolve to the matching
--      type-default. At most one default per (org, type).
--   4. get_ra_landing_page() v4 — returns ra_type + template_demo_html and
--      resolves the template by: per-RA override → type default → legacy
--      org default → none (frontend builtin fallback).
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ra_type on ra_associates ─────────────────────────────────────────────

ALTER TABLE public.ra_associates
  ADD COLUMN IF NOT EXISTS ra_type text NOT NULL DEFAULT 'individual'
    CHECK (ra_type IN ('individual', 'company'));

-- Backfill: anything with partner branding is a Company.
UPDATE public.ra_associates
   SET ra_type = 'company'
 WHERE partner_company_name IS NOT NULL
   AND ra_type IS DISTINCT FROM 'company';

-- ── 2. Dual template bodies + type-scoped default ───────────────────────────

ALTER TABLE public.ra_landing_templates
  ADD COLUMN IF NOT EXISTS demo_html text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_for_type text
    CHECK (default_for_type IN ('individual', 'company'));

-- At most one default template per (org, type).
CREATE UNIQUE INDEX IF NOT EXISTS ra_landing_templates_one_default_per_type
  ON public.ra_landing_templates(organization_id, default_for_type)
  WHERE default_for_type IS NOT NULL;

-- ── 3. get_ra_landing_page() v4 ─────────────────────────────────────────────
-- Adds ra_type + template_demo_html. Resolves the template in priority order:
--   1) explicit per-RA template_id
--   2) org template whose default_for_type matches the RA's ra_type
--   3) legacy org default (is_default = true)
--   4) none → frontend builtin fallback

DROP FUNCTION IF EXISTS public.get_ra_landing_page(text);

CREATE OR REPLACE FUNCTION public.get_ra_landing_page(p_slug text)
RETURNS TABLE (
  slug                 text,
  display_name         text,
  first_name           text,
  last_name            text,
  photo_url            text,
  contact_phone        text,
  contact_email        text,
  bio                  text,
  is_active            boolean,
  ra_type              text,
  template_html        text,
  template_demo_html   text,
  template_name        text,
  partner_company_name text,
  partner_logo_url     text,
  partner_website      text,
  linkedin_url         text,
  ra_title             text
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
      r.ra_type,
      r.organization_id,
      r.template_id,
      r.partner_company_name,
      r.partner_logo_url,
      r.partner_website,
      r.linkedin_url,
      r.ra_title,
      p.full_name
    FROM public.ra_associates r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.slug = p_slug
    LIMIT 1
  ),
  tpl AS (
    -- 1) explicit per-RA template
    SELECT t.html, t.demo_html, t.name, 1 AS pri
      FROM public.ra_landing_templates t, ra
      WHERE t.id = ra.template_id
    UNION ALL
    -- 2) type-scoped org default
    SELECT t.html, t.demo_html, t.name, 2 AS pri
      FROM public.ra_landing_templates t, ra
      WHERE ra.template_id IS NULL
        AND t.organization_id = ra.organization_id
        AND t.default_for_type = ra.ra_type
    UNION ALL
    -- 3) legacy org-wide default
    SELECT t.html, t.demo_html, t.name, 3 AS pri
      FROM public.ra_landing_templates t, ra
      WHERE ra.template_id IS NULL
        AND t.organization_id = ra.organization_id
        AND t.is_default = true
    ORDER BY pri
    LIMIT 1
  )
  SELECT
    ra.slug,
    ra.display_name,
    split_part(COALESCE(ra.full_name, ra.display_name), ' ', 1)                          AS first_name,
    NULLIF(regexp_replace(COALESCE(ra.full_name, ra.display_name), '^\S+\s*', ''), '')   AS last_name,
    ra.photo_url,
    ra.contact_phone,
    ra.contact_email,
    ra.bio,
    (ra.status = 'active')                                                               AS is_active,
    ra.ra_type,
    tpl.html                                                                             AS template_html,
    NULLIF(tpl.demo_html, '')                                                            AS template_demo_html,
    tpl.name                                                                             AS template_name,
    ra.partner_company_name,
    ra.partner_logo_url,
    ra.partner_website,
    ra.linkedin_url,
    ra.ra_title
  FROM ra
  LEFT JOIN tpl ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_ra_landing_page(text) TO anon, authenticated;

COMMENT ON COLUMN public.ra_associates.ra_type IS
  'individual | company. Set at invite, editable after. Drives which type-default landing template the public pages resolve to.';
COMMENT ON COLUMN public.ra_landing_templates.demo_html IS
  'HTML body for the public /demo/:slug page. The existing html column drives /refer/:slug.';
COMMENT ON COLUMN public.ra_landing_templates.default_for_type IS
  'individual | company | NULL. When set, this template is the org default for that RA type. At most one per (org, type).';
