-- ─────────────────────────────────────────────────────────────────────────────
-- Distinguish Demo vs Refer page views on ra_page_views, so the RA portal can
-- report how many times each public page was viewed (lightweight, no GA4).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ra_page_views
  ADD COLUMN IF NOT EXISTS page_type TEXT NOT NULL DEFAULT 'refer'
  CHECK (page_type IN ('demo', 'refer'));

CREATE INDEX IF NOT EXISTS ra_page_views_type_idx
  ON public.ra_page_views (ra_id, page_type, viewed_at);

-- Extend the anon-callable recorder with an optional page_type. Keeping the old
-- 3-arg signature working would require an overload; instead we replace with a
-- 4-arg version (default 'refer') — PostgREST resolves by provided args.
CREATE OR REPLACE FUNCTION public.record_ra_page_view(
  p_slug       text,
  p_ip_hash    text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_page_type  text DEFAULT 'refer'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ra_id uuid;
  v_type  text;
BEGIN
  v_type := CASE WHEN p_page_type = 'demo' THEN 'demo' ELSE 'refer' END;
  SELECT id INTO v_ra_id FROM public.ra_associates WHERE slug = p_slug AND status = 'active';
  IF v_ra_id IS NOT NULL THEN
    INSERT INTO public.ra_page_views (ra_id, ip_hash, user_agent, page_type)
    VALUES (v_ra_id, p_ip_hash, p_user_agent, v_type);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ra_page_view(text, text, text, text) TO anon, authenticated;
