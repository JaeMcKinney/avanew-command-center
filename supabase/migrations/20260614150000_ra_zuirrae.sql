-- ═══════════════════════════════════════════════════════════════════════════
-- Zuirrae M. — Individual RA demo page at /demo/zuirrae
--
-- Creates the Supabase user, profile, org membership, and ra_associates
-- record for Zuirrae's individual demo page.
-- Idempotent: safe to re-run.
--
-- Pattern: special-case bootstrap (see docs/ra-templates.md §7), Individual
-- flavor — mirrors /demo/jae, NOT the Company template. No partner_* fields,
-- so the public renderer treats it as an Individual page (no logo/avatar grid).
-- RA records live in the Divigner org (dddddddd-…), NOT Avanew.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  org_id        uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  default_uid   uuid := 'dddddddd-dddd-dddd-dddd-000000000013';
  ra_uid        uuid;
  demo_pw       text := extensions.crypt('Demo@2026!', extensions.gen_salt('bf', 10));
BEGIN

  -- ── 1. auth.users ─────────────────────────────────────────────────────────
  -- If a row already exists for this email (Zuirrae is internal — she may
  -- already have a login), reuse its id and never touch the existing password.
  -- Otherwise insert a new row with our default uid.
  SELECT id INTO ra_uid FROM auth.users WHERE email = 'zuirrae@divigner.com';

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
      'zuirrae@divigner.com', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Zuirrae M."}',
      now(), now(), '', '', '', ''
    );
  END IF;

  -- ── 2. profiles ───────────────────────────────────────────────────────────
  -- Create as 'partner' for a brand-new account. If a profile already exists
  -- (she's a Divigner team member), PRESERVE any elevated role — never demote
  -- an admin/owner to partner. full_name is left untouched on conflict.
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (ra_uid, 'zuirrae@divigner.com', 'Zuirrae M.', 'partner')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role  = CASE
                  WHEN public.profiles.role::text IN ('super_user','owner','admin','member')
                    THEN public.profiles.role
                  ELSE 'partner'
                END;

  -- ── 3. org membership ─────────────────────────────────────────────────────
  -- Add to Divigner if absent; leave any existing membership/role untouched.
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, ra_uid, 'partner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- ── 4. ra_associates (Individual — no partner_* branding fields) ──────────
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
    photo_completed,
    contact_completed,
    banking_completed,
    submitted_at,
    verified_at,
    activated_at
  ) VALUES (
    org_id,
    ra_uid,
    'zuirrae',
    'Zuirrae M.',
    'active',
    'https://ai-automation.divigner.com/ra-photo-zuirrae.png',
    '+1 862-596-1187',
    'zuirrae@divigner.com',
    'Zuirrae serves as the Interactive Avatar Experience Manager at Divigner, guiding clients through the implementation of AI-powered avatars. She works closely with businesses to ensure a smooth onboarding experience, align avatar solutions with their goals, and support successful deployment. Her focus is creating engaging, effective AI experiences that enhance customer communication and engagement.',
    'Interactive Avatar Experience Manager',
    true,
    true,
    false,
    now(),
    now(),
    now()
  )
  ON CONFLICT (slug) DO UPDATE
    SET display_name  = EXCLUDED.display_name,
        photo_url     = EXCLUDED.photo_url,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        bio           = EXCLUDED.bio,
        ra_title      = EXCLUDED.ra_title,
        status        = 'active';

  RAISE NOTICE 'Zuirrae M. Individual RA created: /demo/zuirrae';

END $$;
