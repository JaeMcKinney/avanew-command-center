-- ── RA invite link expiry (72h) + onboarding deadline (21d) ──────────────────

-- ── 1. New terminal statuses ─────────────────────────────────────────────────
-- Same pattern as team_role at 20260531000000_referral_associates.sql:4.
-- Note: ALTER TYPE ... ADD VALUE cannot be referenced by a statement in the
-- same transaction on older Postgres — don't add a CHECK/default elsewhere in
-- this same file that references these two literals.
ALTER TYPE public.ra_status ADD VALUE IF NOT EXISTS 'invite_expired';
ALTER TYPE public.ra_status ADD VALUE IF NOT EXISTS 'onboarding_expired';

-- ── 2. Deadline tracking columns ─────────────────────────────────────────────
-- All nullable except the dedup flag — existing rows get NULL (no retroactive
-- enforcement on already-in-flight invites). invite_expires_at/
-- onboarding_deadline_at are set explicitly by invite-ra at insert time
-- (now() + 72h / now() + 21d), not DB defaults, matching how verified_at/
-- activated_at are already handled on this table.
ALTER TABLE public.ra_associates
  ADD COLUMN IF NOT EXISTS invite_expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS invite_clicked_at       timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_deadline_at  timestamptz,
  ADD COLUMN IF NOT EXISTS invite_reminder_sent    boolean NOT NULL DEFAULT false;

-- No RLS changes: all existing ra_associates policies are row-scoped, not
-- column-scoped, so these new columns inherit whatever policy already gates
-- the row. Note ra_update_own_or_admin already lets an RA patch their own row
-- with no column restriction (same trust boundary as photo_completed etc.) —
-- worst case a self-serving RA spoofs invite_clicked_at to dodge the invite-
-- expiry check, which is a low-severity edge case, not a privilege escalation,
-- since actual deadline enforcement happens server-side in the cron jobs.

-- No new index: the existing ra_associates_status_idx already covers the new
-- cron queries (WHERE status = 'pending' AND ...) well enough at current RA
-- volume. Revisit if the table grows into the thousands of rows.
