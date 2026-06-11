-- ═══════════════════════════════════════════════════════════════════════════
-- 3SF Media RA — Ray Silcox II
--
-- Creates the Supabase user, profile, org membership, and ra_associates
-- record for the 3SF Media partnership demo page at /demo/3sfmedia.
-- Idempotent: safe to re-run.
--
-- Pattern: special-case bootstrap (see docs/ra-templates.md §7).
-- Company RAs belong in the Divigner org (dddddddd-…), NOT Avanew.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  org_id        uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  default_uid   uuid := 'dddddddd-dddd-dddd-dddd-000000000012';
  ra_uid        uuid;
  demo_pw       text := extensions.crypt('Demo@2026!', extensions.gen_salt('bf', 10));
BEGIN

  -- ── 1. auth.users ─────────────────────────────────────────────────────────
  -- If a row already exists for this email (e.g. Ray previously signed up),
  -- reuse its id. Otherwise insert a new row with our default uid.
  SELECT id INTO ra_uid FROM auth.users WHERE email = 'sales@3sfmedia.com';

  IF ra_uid IS NULL THEN
    ra_uid := default_uid;
    INSERT INTO auth.users (
      instance_id, id, aud, role,
      email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', ra_uid,
      'authenticated', 'authenticated',
      'sales@3sfmedia.com', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Ray Silcox II"}',
      now(), now(), '', '', '', ''
    );
  END IF;

  -- ── 2. profiles ───────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (ra_uid, 'sales@3sfmedia.com', 'Ray Silcox II', 'partner')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role,
        email     = EXCLUDED.email;

  -- ── 3. org membership ─────────────────────────────────────────────────────
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, ra_uid, 'partner')
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- ── 4. ra_associates ──────────────────────────────────────────────────────
  INSERT INTO public.ra_associates (
    organization_id,
    user_id,
    slug,
    display_name,
    status,
    photo_url,
    contact_phone,
    contact_email,
    bio,
    ra_title,
    partner_company_name,
    partner_logo_url,
    partner_website,
    linkedin_url,
    photo_completed,
    contact_completed,
    banking_completed,
    submitted_at,
    verified_at,
    activated_at
  ) VALUES (
    org_id,
    ra_uid,
    '3sfmedia',
    'Ray Silcox II',
    'active',
    'https://ai-automation.divigner.com/ra-photo-3sfmedia.png',
    '+1 570-516-1822',
    'sales@3sfmedia.com',
    'Ray Silcox II is the owner of 3SF Media, a Pottsville, Pennsylvania computer and web services company serving Schuylkill County and clients around the world since 2006. From computer repair and sales to website design, hosting, and domain registration, 3SF Media backs every part and service with a 30-day guarantee and a commitment to total customer satisfaction.',
    'Owner at 3SF Media',
    '3SF Media',
    'https://ai-automation.divigner.com/logos/3sfmedia-white.png',
    '3sfmedia.com',
    'https://www.linkedin.com/in/ray-silcox-ii-2a56ab61',
    true,
    true,
    false,
    now(),
    now(),
    now()
  )
  ON CONFLICT (slug) DO UPDATE
    SET display_name         = EXCLUDED.display_name,
        photo_url            = EXCLUDED.photo_url,
        contact_phone        = EXCLUDED.contact_phone,
        contact_email        = EXCLUDED.contact_email,
        bio                  = EXCLUDED.bio,
        ra_title             = EXCLUDED.ra_title,
        partner_company_name = EXCLUDED.partner_company_name,
        partner_logo_url     = EXCLUDED.partner_logo_url,
        partner_website      = EXCLUDED.partner_website,
        linkedin_url         = EXCLUDED.linkedin_url,
        status               = 'active';

  RAISE NOTICE '3SF Media RA created: /demo/3sfmedia';

END $$;
