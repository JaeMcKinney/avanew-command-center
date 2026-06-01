-- ═══════════════════════════════════════════════════════════════════════════
-- Day 5 follow-up: capture marketing_consent in record_ra_lead()
--
-- The public landing page now defaults to opt-IN (checkbox checked). If the
-- prospect unchecks it, we set leads.email_opt_out = true so the CRM can
-- visibly flag the record as not-safe-to-contact for future marketing.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.record_ra_lead(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.record_ra_lead(
  p_slug              text,
  p_first_name        text,
  p_last_name         text    DEFAULT NULL,
  p_email             text    DEFAULT NULL,
  p_phone             text    DEFAULT NULL,
  p_company           text    DEFAULT NULL,
  p_website           text    DEFAULT NULL,
  p_message           text    DEFAULT NULL,
  p_marketing_consent boolean DEFAULT true
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
    company,
    website,
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
    NULLIF(btrim(coalesce(p_company, '')), ''),
    NULLIF(btrim(coalesce(p_website, '')), ''),
    NULLIF(btrim(coalesce(p_message, '')), ''),
    'ra_referral',
    'new',
    v_ra_user_id,
    NOT coalesce(p_marketing_consent, true),
    false
  )
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ra_lead(text, text, text, text, text, text, text, text, boolean)
  TO anon, authenticated;
