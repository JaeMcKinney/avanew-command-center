-- ============================================================================
-- Helper functions for role checks
-- ============================================================================

create or replace function public.is_admin_or_above() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role in ('owner','super_user','admin'));
$$;

create or replace function public.is_member_or_above() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role in ('owner','super_user','admin','member'));
$$;

create or replace function public.is_viewer_or_above() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role in ('owner','super_user','admin','member','viewer'));
$$;

create or replace function public.is_bd() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role = 'bd');
$$;

-- ============================================================================
-- Owner-only tables (financial + settings)
-- ============================================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'bank_connections','bank_accounts','bank_transactions',
    'cashflow_transactions','cashflow_sync_logs','role_permissions'
  ])
  loop
    execute format('drop policy if exists "%I authenticated all" on public.%I;', t, t);
    execute format('drop policy if exists "%I owner only" on public.%I;', t, t);
    execute format(
      'create policy "%I owner only" on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner());',
      t, t);
  end loop;
end$$;

-- ============================================================================
-- CRM tables with owner_id (BD-scoped, viewer read-only)
-- ============================================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'companies','contacts','deals','leads','tasks','activities'
  ])
  loop
    execute format('drop policy if exists "%I authenticated all" on public.%I;', t, t);
    execute format('drop policy if exists "%I select" on public.%I;', t, t);
    execute format('drop policy if exists "%I insert" on public.%I;', t, t);
    execute format('drop policy if exists "%I update" on public.%I;', t, t);
    execute format('drop policy if exists "%I delete" on public.%I;', t, t);

    execute format(
      'create policy "%I select" on public.%I for select to authenticated using (public.is_viewer_or_above() or (public.is_bd() and owner_id = auth.uid()));',
      t, t);
    execute format(
      'create policy "%I insert" on public.%I for insert to authenticated with check (public.is_member_or_above() or (public.is_bd() and owner_id = auth.uid()));',
      t, t);
    execute format(
      'create policy "%I update" on public.%I for update to authenticated using (public.is_member_or_above() or (public.is_bd() and owner_id = auth.uid())) with check (public.is_member_or_above() or (public.is_bd() and owner_id = auth.uid()));',
      t, t);
    execute format(
      'create policy "%I delete" on public.%I for delete to authenticated using (public.is_admin_or_above() or (public.is_bd() and owner_id = auth.uid()));',
      t, t);
  end loop;
end$$;

-- ============================================================================
-- Pipeline stages (config: viewer+ reads, admin+ writes)
-- ============================================================================
drop policy if exists "pipeline_stages authenticated all" on public.pipeline_stages;
drop policy if exists "pipeline_stages select" on public.pipeline_stages;
drop policy if exists "pipeline_stages write" on public.pipeline_stages;

create policy "pipeline_stages select" on public.pipeline_stages
  for select to authenticated using (public.is_viewer_or_above());
create policy "pipeline_stages write" on public.pipeline_stages
  for all to authenticated using (public.is_admin_or_above()) with check (public.is_admin_or_above());

-- ============================================================================
-- Partners & vendors (viewer+ reads, member+ writes, admin+ deletes)
-- ============================================================================
do $$
declare t text;
begin
  for t in select unnest(array['partners','vendors']) loop
    execute format('drop policy if exists "%I authenticated all" on public.%I;', t, t);
    execute format('drop policy if exists "%I select" on public.%I;', t, t);
    execute format('drop policy if exists "%I insert" on public.%I;', t, t);
    execute format('drop policy if exists "%I update" on public.%I;', t, t);
    execute format('drop policy if exists "%I delete" on public.%I;', t, t);

    execute format(
      'create policy "%I select" on public.%I for select to authenticated using (public.is_viewer_or_above());',
      t, t);
    execute format(
      'create policy "%I insert" on public.%I for insert to authenticated with check (public.is_member_or_above());',
      t, t);
    execute format(
      'create policy "%I update" on public.%I for update to authenticated using (public.is_member_or_above()) with check (public.is_member_or_above());',
      t, t);
    execute format(
      'create policy "%I delete" on public.%I for delete to authenticated using (public.is_admin_or_above());',
      t, t);
  end loop;
end$$;
