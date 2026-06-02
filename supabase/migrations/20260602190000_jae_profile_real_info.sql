-- ═══════════════════════════════════════════════════════════════════════════
-- Real RA profile for the 'jae' demo / template seed.
-- Sets the owner's actual name, contact info, photo, and bio. Idempotent —
-- safe to re-run; only updates the row with slug='jae'.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ra_associates: name, contact, photo, bio
UPDATE public.ra_associates
SET
  display_name  = 'Jae McKinney',
  photo_url     = 'https://ai-automation.divigner.com/ra-photo-jae.webp',
  contact_phone = '+1 732-328-2407',
  contact_email = 'jae@divigner.com',
  bio           = 'Founder and Chief AI Strategist at Divigner Group. I focus on conversational AI and conversational design for life sciences, healthcare, insurance, and small business — building AI agents that turn site conversations into real outcomes.'
WHERE slug = 'jae';

-- 2. profiles.full_name (drives first_name / last_name split in the RPC)
UPDATE public.profiles
SET full_name = 'Jae McKinney'
WHERE id = (SELECT user_id FROM public.ra_associates WHERE slug = 'jae');
