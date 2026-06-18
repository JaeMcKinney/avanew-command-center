-- ─────────────────────────────────────────────────────────────────────────────
-- Promote jae@divigner.com to platform super_user
-- ─────────────────────────────────────────────────────────────────────────────
-- jae@divigner.com is the program super_user AND holds an RA profile (slug 'jae')
-- for the /refer/jae demo page. The RA-isolation guard (AppLayout / Login) keys
-- off profiles.role: only 'referral_associate' is bounced to the RA portal. This
-- migration guarantees jae resolves as staff so the super_user is never locked
-- out of the CRM. Idempotent.

UPDATE public.profiles p
SET role = 'super_user'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'jae@divigner.com'
  AND p.role IS DISTINCT FROM 'super_user';
