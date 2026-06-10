-- ═══════════════════════════════════════════════════════════════════════════
-- Skilldora RA — Dr. DeMario M. McIlwain
--
-- Creates the Supabase user, profile, org membership, and ra_associates
-- record for the Skilldora partnership demo page at /demo/skilldora.
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  org_id          uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  skilldora_uid   uuid := 'dddddddd-dddd-dddd-dddd-000000000010';
  demo_pw         text := crypt('Demo@2026!', gen_salt('bf', 10));
BEGIN

  -- ── 1. auth.users ─────────────────────────────────────────────────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', skilldora_uid,
    'authenticated', 'authenticated',
    'demario@myskilldora.com', demo_pw,
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"DeMario M. McIlwain"}',
    now(), now(), '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. profiles ───────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (skilldora_uid, 'demario@myskilldora.com', 'DeMario M. McIlwain', 'partner')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role,
        email     = EXCLUDED.email;

  -- ── 3. org membership ─────────────────────────────────────────────────────
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, skilldora_uid, 'partner')
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
    skilldora_uid,
    'skilldora',
    'Dr. DeMario M. McIlwain',
    'active',
    'https://ai-automation.divigner.com/ra-photo-skilldora.png',
    '+1 803-220-7006',
    NULL,
    'Dr. DeMario M. McIlwain is an AI thought leader, educator, and technology strategist — and the CEO & Founder of Skilldora® Inc. Under his leadership, Skilldora® became the first U.S.-based AI-avatar-led eLearning platform to receive global CPD accreditation from the Global CPD Standards Office (London). A U.S. Army Veteran, he spends his time equipping CEOs, ministry leaders, and working professionals to cut through the noise and put AI to work — simply, strategically, and on purpose.',
    'CEO & Co-Founder at Skilldora®',
    'Skilldora',
    'https://ai-automation.divigner.com/logos/skilldora-white.png',
    'myskilldora.com',
    NULL,
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

  RAISE NOTICE 'Skilldora RA created: /demo/skilldora';

END $$;
