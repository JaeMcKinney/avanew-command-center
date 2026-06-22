-- ─────────────────────────────────────────────────────────────────────────────
-- Demo seed leads for a freshly-activated RA: 3 sample referred leads so the RA
-- can see what their pipeline/deals views look like once prospects fill out
-- their demo page. Flagged is_demo_seed so they're excluded from real metrics
-- and the RA can clear them whenever they like.
--
-- Because the leads table is RLS-locked to staff, seeding + clearing happen via
-- SECURITY DEFINER RPCs the RA may call for their OWN ra_associates row only.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_demo_seed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS leads_demo_seed_idx
  ON public.leads (referred_by_ra_id) WHERE is_demo_seed = true;

-- Seed exactly 3 demo leads for the calling RA, but only once and only if they
-- have no leads yet. Idempotent: a second call is a no-op.
CREATE OR REPLACE FUNCTION public.ensure_ra_demo_leads(p_slug text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ra        public.ra_associates%ROWTYPE;
  v_existing  integer;
  v_inserted  integer := 0;
BEGIN
  SELECT * INTO v_ra FROM public.ra_associates WHERE slug = p_slug;
  IF NOT FOUND THEN RETURN 0; END IF;
  -- Only the owning RA may seed their own demo data.
  IF v_ra.user_id <> auth.uid() THEN RETURN 0; END IF;

  SELECT count(*) INTO v_existing FROM public.leads WHERE referred_by_ra_id = v_ra.id;
  IF v_existing > 0 THEN RETURN 0; END IF;

  INSERT INTO public.leads (organization_id, first_name, last_name, company, email, phone, stage, prospect_intent, description, referred_by_ra_id, lead_source, is_demo_seed)
  VALUES
    (v_ra.organization_id, 'Jordan', 'Sample', 'Sample Dental Co', 'jordan@example.com', '(555) 010-0001', 'new',           'interested', 'Demo lead — submitted through your demo page. Safe to delete.', v_ra.id, 'ra_referral', true),
    (v_ra.organization_id, 'Riley',  'Demo',   'Demo Realty Group', 'riley@example.com', '(555) 010-0002', 'qualified',     'interested', 'Demo lead — booked a call to learn more. Safe to delete.',     v_ra.id, 'ra_referral', true),
    (v_ra.organization_id, 'Casey',  'Preview','Preview Law LLC',   'casey@example.com', '(555) 010-0003', 'proposal_sent', 'sold',       'Demo lead — proposal sent, near closing. Safe to delete.',     v_ra.id, 'ra_referral', true);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- Let the owning RA clear their demo seed leads (and only those).
CREATE OR REPLACE FUNCTION public.clear_ra_demo_leads(p_slug text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ra       public.ra_associates%ROWTYPE;
  v_deleted  integer := 0;
BEGIN
  SELECT * INTO v_ra FROM public.ra_associates WHERE slug = p_slug;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_ra.user_id <> auth.uid() THEN RETURN 0; END IF;

  DELETE FROM public.leads WHERE referred_by_ra_id = v_ra.id AND is_demo_seed = true;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_ra_demo_leads(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_ra_demo_leads(text) TO authenticated;
