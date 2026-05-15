-- Fix: invitations table and handle_new_user trigger were not org-aware.
--
-- Problems:
--   1. invitations had UNIQUE(email) — one invite per email globally,
--      but a person can belong to multiple orgs.
--   2. handle_new_user didn't write to organization_members on signup,
--      so accepted invites never made the user visible in the org.
--
-- This migration fixes both.

-- ── 1. Replace UNIQUE(email) with UNIQUE(email, organization_id) ─────────────
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_email_key;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_email_org_key
  UNIQUE (email, organization_id);

-- ── 2. Rebuild handle_new_user to also write organization_members ─────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv public.invitations%rowtype;
BEGIN
  -- Pick the most-recently-created invitation for this email (handles multi-org).
  SELECT * INTO inv
  FROM public.invitations
  WHERE email = new.email
  ORDER BY created_at DESC
  LIMIT 1;

  -- Always upsert a profile row.
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(inv.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(inv.role, 'member')
  )
  ON CONFLICT (id) DO UPDATE
    SET email      = EXCLUDED.email,
        full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        role       = COALESCE(inv.role, public.profiles.role);

  -- If the invitation carried an organization_id, add the user to that org.
  IF inv.id IS NOT NULL AND inv.organization_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (inv.organization_id, new.id, COALESCE(inv.role, 'member'))
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = EXCLUDED.role;

    DELETE FROM public.invitations WHERE id = inv.id;
  ELSIF inv.id IS NOT NULL THEN
    -- Legacy invite without org — just clean up.
    DELETE FROM public.invitations WHERE id = inv.id;
  END IF;

  RETURN new;
END;
$$;
