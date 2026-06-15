-- ═══════════════════════════════════════════════════════════════════════════
-- Zuirrae's name: "Zuirrae M." → "Zuirrae McKinney"
--
-- Updates the public hero name (ra_associates.display_name) and the profile
-- full_name (drives the first_name / last_name split in get_ra_landing_page,
-- used for email greetings). Idempotent; targets slug = 'zuirrae'.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.ra_associates
   SET display_name = 'Zuirrae McKinney'
 WHERE slug = 'zuirrae';

UPDATE public.profiles
   SET full_name = 'Zuirrae McKinney'
 WHERE id = (SELECT user_id FROM public.ra_associates WHERE slug = 'zuirrae');
