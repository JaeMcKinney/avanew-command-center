-- Owners have full access to their workspace, including the Referral Program.

create or replace function public.is_program_admin(org_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'super_user'
  )
  or exists (
    select 1 from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and (role = 'owner' or (is_program_admin = true and role = 'admin'))
  );
$$;

drop policy if exists client_checkins_admin_write on public.client_checkins;
create policy client_checkins_admin_write on public.client_checkins for all using (
  exists (
    select 1 from organization_members om
    where om.organization_id = client_checkins.organization_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'owner', 'super_user')
  )
);

drop policy if exists client_checkins_read on public.client_checkins;
create policy client_checkins_read on public.client_checkins for select using (
  exists (
    select 1 from ra_associates ra
    where ra.id = client_checkins.ra_associate_id and ra.user_id = auth.uid()
  )
  or exists (
    select 1 from organization_members om
    where om.organization_id = client_checkins.organization_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'owner', 'super_user')
  )
);
