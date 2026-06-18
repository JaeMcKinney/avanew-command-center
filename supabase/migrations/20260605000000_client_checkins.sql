-- ─────────────────────────────────────────────────────────────────────────────
-- Client check-ins (PR-13) — quarterly touchpoint tracking per signed agreement §7
-- ─────────────────────────────────────────────────────────────────────────────
-- Each row is one logged touchpoint between an RA and one of their active
-- clients (a closed-won lead). Days-since-last-checkin drives the dashboard
-- badge color and (eventually) recurring-payout suspension.

DO $$ BEGIN
  CREATE TYPE public.client_checkin_method AS ENUM (
    'phone', 'video', 'in_person', 'email'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

CREATE TABLE IF NOT EXISTS public.client_checkins (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ra_associate_id   uuid        NOT NULL REFERENCES public.ra_associates(id) ON DELETE CASCADE,
  lead_id           uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id           uuid        REFERENCES public.deals(id) ON DELETE SET NULL,
  client_name       text        NOT NULL,
  checkin_at        timestamptz NOT NULL DEFAULT now(),
  method            public.client_checkin_method NOT NULL,
  notes             text,
  created_by        uuid        REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_checkins ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS client_checkins_org_idx   ON public.client_checkins(organization_id);
CREATE INDEX IF NOT EXISTS client_checkins_ra_idx    ON public.client_checkins(ra_associate_id);
CREATE INDEX IF NOT EXISTS client_checkins_lead_idx  ON public.client_checkins(lead_id);
CREATE INDEX IF NOT EXISTS client_checkins_when_idx  ON public.client_checkins(checkin_at);

DROP POLICY IF EXISTS "client_checkins_read"        ON public.client_checkins;
DROP POLICY IF EXISTS "client_checkins_ra_insert"   ON public.client_checkins;
DROP POLICY IF EXISTS "client_checkins_admin_write" ON public.client_checkins;

-- The RA can see their own; same-org admins manage all.
CREATE POLICY "client_checkins_read" ON public.client_checkins
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = client_checkins.ra_associate_id
        AND ra.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = client_checkins.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin','super_user')
    )
  );

-- The RA records their own check-ins.
CREATE POLICY "client_checkins_ra_insert" ON public.client_checkins
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ra_associates ra
      WHERE ra.id = client_checkins.ra_associate_id
        AND ra.user_id = auth.uid()
    )
  );

-- Admins can also write/update (for backfill / corrections).
CREATE POLICY "client_checkins_admin_write" ON public.client_checkins
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = client_checkins.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin','super_user')
    )
  );
