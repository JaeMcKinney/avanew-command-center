-- BD and Partner members only see (and write) the CRM records they own,
-- unless a Super User turns on can_view_all for that person (Settings → Team).
-- Owner / Admin / Super User keep full access to the workspace.
-- Before this, the staff policies let every non-RA member see everything, and
-- owner scoping only existed as a client-side filter for View-As.

alter table public.organization_members
  add column if not exists can_view_all boolean not null default false;

create or replace function public.is_org_limited(org_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('bd', 'partner')
      and not can_view_all
  );
$$;

do $$
declare
  t text;
  rule text := '(is_super_user() OR (is_org_staff(organization_id) AND (NOT is_org_limited(organization_id) OR owner_id = auth.uid())))';
begin
  foreach t in array array['companies', 'contacts', 'leads', 'deals', 'activities', 'tasks'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('create policy %I on public.%I for all using %s with check %s', t || '_staff_all', t, rule, rule);
  end loop;
end $$;
