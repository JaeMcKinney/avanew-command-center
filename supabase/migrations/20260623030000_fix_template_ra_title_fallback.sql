-- ═══════════════════════════════════════════════════════════════════════════
-- Fix ra-title fallback in all DB-stored landing templates.
--
-- Every template had JS that only overwrites the title element when
-- ra.ra_title is truthy, leaving the hardcoded "Founder & Chief AI
-- Strategist · Divigner Group" visible for every other RA. This patches
-- the JS in both `html` and `demo_html` columns to hide the element
-- when there is no ra_title.
-- ═══════════════════════════════════════════════════════════════════════════

-- Patch the render script in html column
UPDATE public.ra_landing_templates
SET html = REPLACE(
  html,
  'if(titleEl && ra.ra_title) titleEl.innerHTML = ra.ra_title;',
  'if(titleEl){ if(ra.ra_title) titleEl.innerHTML = ra.ra_title; else titleEl.style.display = ''none''; }'
)
WHERE html LIKE '%if(titleEl && ra.ra_title) titleEl.innerHTML = ra.ra_title;%';

-- Patch the render script in demo_html column
UPDATE public.ra_landing_templates
SET demo_html = REPLACE(
  demo_html,
  'if(titleEl && ra.ra_title) titleEl.innerHTML = ra.ra_title;',
  'if(titleEl){ if(ra.ra_title) titleEl.innerHTML = ra.ra_title; else titleEl.style.display = ''none''; }'
)
WHERE demo_html LIKE '%if(titleEl && ra.ra_title) titleEl.innerHTML = ra.ra_title;%';
