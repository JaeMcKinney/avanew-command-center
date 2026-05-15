-- ============================================================
-- Create Demo Users — Avanew org
--
-- Creates three fictitious users (Owner, BD, Partner) with
-- fixed UUIDs so the demo seed data can reference them reliably.
--
-- Demo credentials (all same password):
--   sarah.mitchell@demo.avanew  /  Demo@2026!   (Owner)
--   jordan.hayes@demo.avanew    /  Demo@2026!   (BD)
--   alex.rivera@demo.avanew     /  Demo@2026!   (Partner)
--
-- Run BEFORE avanew_demo_data.sql
-- Run purge_demo_users.sql when you're done with demo data.
-- ============================================================

DO $$
DECLARE
  org_id     uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  owner_uid  uuid := 'dddddddd-dddd-dddd-dddd-000000000001';
  bd_uid     uuid := 'dddddddd-dddd-dddd-dddd-000000000002';
  partner_uid uuid := 'dddddddd-dddd-dddd-dddd-000000000003';

  demo_pw    text := crypt('Demo@2026!', gen_salt('bf', 10));
BEGIN

  -- ── 1. Insert into auth.users (bypasses the invite flow) ──────────────────
  -- The handle_new_user trigger fires and creates the profile automatically.

  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES
    (
      '00000000-0000-0000-0000-000000000000', owner_uid,
      'authenticated', 'authenticated',
      'sarah.mitchell@demo.avanew', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Sarah Mitchell"}',
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', bd_uid,
      'authenticated', 'authenticated',
      'jordan.hayes@demo.avanew', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Jordan Hayes"}',
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', partner_uid,
      'authenticated', 'authenticated',
      'alex.rivera@demo.avanew', demo_pw,
      now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Alex Rivera"}',
      now(), now(), '', '', '', ''
    )
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Ensure profiles exist with correct roles ────────────────────────────
  -- handle_new_user creates them with role 'member'; override here.

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES
    (owner_uid,   'sarah.mitchell@demo.avanew', 'Sarah Mitchell', 'owner'),
    (bd_uid,      'jordan.hayes@demo.avanew',   'Jordan Hayes',   'bd'),
    (partner_uid, 'alex.rivera@demo.avanew',    'Alex Rivera',    'partner')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role,
        email     = EXCLUDED.email;

  -- ── 3. Add to Avanew org with correct roles ────────────────────────────────

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES
    (org_id, owner_uid,   'owner'),
    (org_id, bd_uid,      'bd'),
    (org_id, partner_uid, 'partner')
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  RAISE NOTICE 'Demo users created:
  → sarah.mitchell@demo.avanew  (Owner)
  → jordan.hayes@demo.avanew    (BD)
  → alex.rivera@demo.avanew     (Partner)
  Password for all: Demo@2026!';

END $$;
