-- ═══════════════════════════════════════════════════════════════════════════
-- A2AI — reset Anson's password to the standard demo password.
--
-- Anson signed up weeks ago before we were ready and didn't keep the password.
-- One-time reset so Jae can test the login.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE auth.users
   SET encrypted_password = extensions.crypt('Demo@2026!', extensions.gen_salt('bf', 10)),
       updated_at         = now()
 WHERE email = 'anson@a2ai.us';
