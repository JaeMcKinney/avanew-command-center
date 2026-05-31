-- ═══════════════════════════════════════════════════════════════════════════
-- DEMO SEED — fast-track the "jae-dawg" RA to active status so the
-- public /refer/jae-dawg landing page renders end-to-end without walking
-- through the full onboarding flow. Idempotent: re-running is a no-op if the
-- RA is already active.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.ra_associates
SET
  status              = 'active',
  photo_url           = COALESCE(photo_url,     'https://i.pravatar.cc/240?img=12'),
  bio                 = COALESCE(NULLIF(bio,'') , 'I help growth-stage companies find the right AI automation partners. Let''s talk about what you''re building.'),
  contact_phone       = COALESCE(NULLIF(contact_phone,''), '+1 555 010 1212'),
  contact_email       = COALESCE(NULLIF(contact_email,''), 'jaemckinne.y@gmail.com'),
  ach_account_holder  = COALESCE(NULLIF(ach_account_holder,''), 'Jae Dawg'),
  ach_bank_name       = COALESCE(NULLIF(ach_bank_name,''),      'Demo Bank'),
  ach_routing         = COALESCE(NULLIF(ach_routing,''),        '110000000'),
  ach_account         = COALESCE(NULLIF(ach_account,''),        '000123456789'),
  photo_completed     = true,
  contact_completed   = true,
  banking_completed   = true,
  submitted_at        = COALESCE(submitted_at, now()),
  verified_at         = COALESCE(verified_at,  now()),
  activated_at        = COALESCE(activated_at, now())
WHERE slug = 'jae-dawg';
