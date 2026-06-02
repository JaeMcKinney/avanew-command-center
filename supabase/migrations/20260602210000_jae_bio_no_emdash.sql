-- ═══════════════════════════════════════════════════════════════════════════
-- Rewrite Jae's bio to drop the em dash (LLM tell). Three short sentences.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.ra_associates
SET bio = 'Founder and Chief AI Strategist at Divigner Group. I focus on conversational AI and conversational design for life sciences, healthcare, insurance, and small business. I build AI agents that turn site conversations into real outcomes.'
WHERE slug = 'jae';
