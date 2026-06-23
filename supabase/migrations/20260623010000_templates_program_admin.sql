-- Broaden ra_landing_templates RLS so Program Admins
-- (organization_members.is_program_admin = true) can manage page templates
-- regardless of their profiles.role. Previously the policy required
-- profiles.role IN ('super_user','owner','admin'), which silently locked
-- out anyone whose profile.role drifted (e.g. a Program Admin whose
-- profile.role got stuck at 'referral_associate' from an earlier RA-row
-- interaction). User confirmed: every Program Admin must see every
-- template in their org.

DROP POLICY IF EXISTS "ra_landing_templates: org admins manage"
  ON public.ra_landing_templates;

CREATE POLICY "ra_landing_templates: org admins manage"
  ON public.ra_landing_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      LEFT JOIN public.profiles p ON p.id = m.user_id
      WHERE m.organization_id = ra_landing_templates.organization_id
        AND m.user_id = auth.uid()
        AND (
          m.role IN ('super_user', 'owner', 'admin')
          OR m.is_program_admin = true
          OR p.role IN ('super_user', 'owner', 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      LEFT JOIN public.profiles p ON p.id = m.user_id
      WHERE m.organization_id = ra_landing_templates.organization_id
        AND m.user_id = auth.uid()
        AND (
          m.role IN ('super_user', 'owner', 'admin')
          OR m.is_program_admin = true
          OR p.role IN ('super_user', 'owner', 'admin')
        )
    )
  );
