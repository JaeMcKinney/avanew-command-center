-- ═══════════════════════════════════════════════════════════════════════════
-- RA Partner Branding Columns
--
-- Adds optional partner/company branding fields to ra_associates so the
-- public demo page can show co-branded "In partnership with" sections.
-- These fields are nullable — individual RAs leave them blank; company
-- RAs (like Skilldora) populate them to show their logo and branding.
--
-- Also adds linkedin_url and company_website for richer RA profiles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. New columns on ra_associates ─────────────────────────────────────────

ALTER TABLE public.ra_associates
  ADD COLUMN IF NOT EXISTS partner_company_name text,
  ADD COLUMN IF NOT EXISTS partner_logo_url     text,
  ADD COLUMN IF NOT EXISTS partner_website      text,
  ADD COLUMN IF NOT EXISTS linkedin_url         text,
  ADD COLUMN IF NOT EXISTS ra_title             text;

-- ── 2. Extend get_ra_landing_page() to return the new fields ────────────────

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
  template_html        text,
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
    split_part(COALESCE(ra.full_name, ra.display_name), ' ', 1)                  AS first_name,
    NULLIF(regexp_replace(COALESCE(ra.full_name, ra.display_name), '^\S+\s*', ''), '') AS last_name,
    ra.photo_url,
    ra.contact_phone,
    ra.contact_email,
    ra.bio,
    (ra.status = 'active')                                                        AS is_active,
    tpl.html                                                                      AS template_html,
    tpl.name                                                                      AS template_name,
    ra.partner_company_name,
    ra.partner_logo_url,
    ra.partner_website,
    ra.linkedin_url,
    ra.ra_title
  FROM ra
  LEFT JOIN tpl ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_ra_landing_page(text) TO anon, authenticated;
