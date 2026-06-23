-- ═══════════════════════════════════════════════════════════════════════════
-- Set Jae's ra_title on the 'jae' RA row.
--
-- Previously, /demo.html left a hardcoded fallback title ("Founder & Chief AI
-- Strategist · Divigner Group") in place when ra_associates.ra_title was null,
-- so every newly-invited RA inherited Jae's title on their public landing.
--
-- The render script in demo.html now hides the title element when ra_title is
-- null. This migration backfills Jae's row so his page still renders the title.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.ra_associates
SET    ra_title = 'Founder & Chief AI Strategist · Divigner Group'
WHERE  slug = 'jae';
