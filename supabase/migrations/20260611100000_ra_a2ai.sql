-- ═══════════════════════════════════════════════════════════════════════════
-- A2 Applied Intelligence RA — Dr. Anson Kairys
--
-- Creates the Supabase user, profile, org membership, and ra_associates
-- record for the A2AI partnership demo page at /demo/a2ai.
-- Idempotent: safe to re-run.
--
-- Pattern: special-case bootstrap (see docs/ra-templates.md §7).
-- Going forward, companies will sign up via the invite flow.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  org_id        uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  default_uid   uuid := 'dddddddd-dddd-dddd-dddd-000000000011';
  a2ai_uid      uuid;
  demo_pw       text := extensions.crypt('Demo@2026!', extensions.gen_salt('bf', 10));
BEGIN

  -- ── 1. auth.users ─────────────────────────────────────────────────────────
  -- If a row already exists for this email (e.g. Anson previously signed up),
  -- reuse its id. Otherwise insert a new row with our default uid.
  SELECT id INTO a2ai_uid FROM auth.users WHERE email = 'anson@a2ai.us';

  IF a2ai_uid IS NULL THEN
    a2ai_uid := default_uid;
    INSERT INTO auth.users (
      instance_id, id, aud, role,
      email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', a2ai_uid,
      'authenticated', 'authenticated',
      'anson@a2ai.us', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Anson Kairys"}',
      now(), now(), '', '', '', ''
    );
  END IF;

  -- ── 2. profiles ───────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (a2ai_uid, 'anson@a2ai.us', 'Dr. Anson Kairys', 'partner')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role,
        email     = EXCLUDED.email;

  -- ── 3. org membership ─────────────────────────────────────────────────────
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, a2ai_uid, 'partner')
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- ── 4. ra_associates ──────────────────────────────────────────────────────
  -- contact_phone is intentionally NULL — hidden in UI per RA's request.
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
    a2ai_uid,
    'a2ai',
    'Dr. Anson Kairys',
    'active',
    'https://ai-automation.divigner.com/ra-photo-a2ai.png',
    NULL,
    NULL,
    'Dr. Anson Kairys is a Clinical Assistant Professor of Psychiatry at the University of Michigan Medical School and founder of A2 Applied Intelligence, a research and consulting group dedicated to bridging the gap between cutting-edge AI and real-world clinical applications.',
    'CEO at A2 Applied Intelligence',
    'A2 Applied Intelligence',
    'https://ai-automation.divigner.com/logos/a2ai-white.png',
    'astro-site-pi-tan.vercel.app',
    'https://www.linkedin.com/in/anson-kairys-ph-d-384a4992/',
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

  RAISE NOTICE 'A2AI RA created: /demo/a2ai';

END $$;
