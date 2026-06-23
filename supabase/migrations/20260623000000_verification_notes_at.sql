-- Track when a Program Admin issued the "request changes" summary note
-- (a.k.a. ra_associates.verification_notes — the text body that ends up in the
-- RA's needs_changes email). The Full Review page surfaces this timestamp
-- next to the note so admins know when they last wrote one.

ALTER TABLE public.ra_associates
  ADD COLUMN IF NOT EXISTS verification_notes_at timestamptz;

COMMENT ON COLUMN public.ra_associates.verification_notes_at IS
  'When verification_notes was last set by request_changes. Null for legacy rows where the note predates this column.';
