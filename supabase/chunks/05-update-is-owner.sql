-- Update is_owner to include super_user for financial table parity
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner','super_user')
  );
$$;

-- ── CRM tables: assigned-data (have owner_id) ─────────────────────────────────
-- companies, contacts, deals, activities, leads, tasks
-- super_user/owner/admin/member/viewer → read all
-- bd → read/write only rows where owner_id = auth.uid()
-- partner → denied (no policy covers them)
do $$
declare
  t text;
begin
  foreach t in array array['companies','contacts','deals','activities','leads','tasks']
  loop
    execute format('drop policy if exists "%s read all" on public.%I;', t, t);
    execute format('drop policy if exists "%s read internal" on public.%I;', t, t);
    execute format('drop policy if exists "%s read bd assigned" on public.%I;', t, t);
    execute format('drop policy if exists "%s write member" on public.%I;', t, t);
    execute format('drop policy if exists "%s write editor" on public.%I;', t, t);
    execute format('drop policy if exists "%s write bd" on public.%I;', t, t);
    execute format('drop policy if exists "%s update member" on public.%I;', t, t);
    execute format('drop policy if exists "%s update editor" on public.%I;', t, t);
    execute format('drop policy if exists "%s update bd" on public.%I;', t, t);
    execute format('drop policy if exists "%s delete admin" on public.%I;', t, t);
    execute format('drop policy if exists "%s delete editor" on public.%I;', t, t);

    -- SELECT: internal roles read everything; BD reads only their assigned rows
    execute format(
      'create policy "%s read internal" on public.%I
         for select to authenticated using (public.is_crm_reader());', t, t);
    execute format(
      'create policy "%s read bd assigned" on public.%I
         for select to authenticated using (public.is_bd() and owner_id = auth.uid());', t, t);

    -- INSERT: editors create freely; BD inserts only self-assigned records
    execute format(
      'create policy "%s write editor" on public.%I
         for insert to authenticated with check (public.is_crm_editor());', t, t);
    execute format(
      'create policy "%s write bd" on public.%I
         for insert to authenticated with check (public.is_bd() and owner_id = auth.uid());', t, t);

    -- UPDATE: same scope as insert
    execute format(
      'create policy "%s update editor" on public.%I
         for update to authenticated
         using (public.is_crm_editor()) with check (public.is_crm_editor());', t, t);
    execute format(
      'create policy "%s update bd" on public.%I
         for update to authenticated
         using (public.is_bd() and owner_id = auth.uid())
         with check (public.is_bd() and owner_id = auth.uid());', t, t);

    -- DELETE: admin+ only
    execute format(
      'create policy "%s delete editor" on public.%I
         for delete to authenticated using (public.is_crm_admin());', t, t);
  end loop;
end$$;

-- ── CRM tables: workspace-wide (no owner_id) ─────────────────────────────────
-- pipeline_stages, partners, vendors
-- BD gets read access (needs context for their assigned deals)
-- partner denied
do $$
declare
  t text;
begin
  foreach t in array array['pipeline_stages','partners','vendors']
  loop
    execute format('drop policy if exists "%s read all" on public.%I;', t, t);
    execute format('drop policy if exists "%s read internal" on public.%I;', t, t);
    execute format('drop policy if exists "%s write member" on public.%I;', t, t);
    execute format('drop policy if exists "%s write editor" on public.%I;', t, t);
    execute format('drop policy if exists "%s update member" on public.%I;', t, t);
    execute format('drop policy if exists "%s update editor" on public.%I;', t, t);
    execute format('drop policy if exists "%s delete admin" on public.%I;', t, t);
    execute format('drop policy if exists "%s delete editor" on public.%I;', t, t);
    execute format('drop policy if exists "partners read all" on public.%I;', t);
    execute format('drop policy if exists "partners write member" on public.%I;', t);
    execute format('drop policy if exists "vendors read all" on public.%I;', t);
    execute format('drop policy if exists "vendors write member" on public.%I;', t);

    execute format(
      'create policy "%s read internal" on public.%I
         for select to authenticated
         using (public.is_crm_reader() or public.is_bd());', t, t);
    execute format(
      'create policy "%s write editor" on public.%I
         for insert to authenticated with check (public.is_crm_editor());', t, t);
    execute format(
      'create policy "%s update editor" on public.%I
         for update to authenticated
         using (public.is_crm_editor()) with check (public.is_crm_editor());', t, t);
    execute format(
      'create policy "%s delete editor" on public.%I
         for delete to authenticated using (public.is_crm_admin());', t, t);
  end loop;
end$$;

-- ── Financial tables: owner / super_user only ─────────────────────────────────
