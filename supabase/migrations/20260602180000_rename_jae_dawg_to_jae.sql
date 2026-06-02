-- ═══════════════════════════════════════════════════════════════════════════
-- Rename the demo RA slug from "jae-dawg" to "jae" so the public URLs read
-- /refer/jae and /demo/jae. Idempotent: if a row with slug='jae' already
-- exists this is a no-op; otherwise the existing 'jae-dawg' row is updated.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.ra_associates
SET slug = 'jae'
WHERE slug = 'jae-dawg'
  AND NOT EXISTS (SELECT 1 FROM public.ra_associates WHERE slug = 'jae');
