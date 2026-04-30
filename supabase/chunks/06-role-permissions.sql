-- Recreate explicitly to pick up the updated is_owner() (now includes super_user)
drop policy if exists "cashflow owner only" on public.cashflow_transactions;
create policy "cashflow owner only" on public.cashflow_transactions
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "bank_connections owner only" on public.bank_connections;
create policy "bank_connections owner only" on public.bank_connections
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "bank_accounts owner only" on public.bank_accounts;
create policy "bank_accounts owner only" on public.bank_accounts
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "bank_transactions owner only" on public.bank_transactions;
create policy "bank_transactions owner only" on public.bank_transactions
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "sync_logs owner only" on public.cashflow_sync_logs;
create policy "sync_logs owner only" on public.cashflow_sync_logs
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ── profiles: restrict role escalation ───────────────────────────────────────
-- Only super_user can change another user's role to super_user/owner
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (public.is_crm_admin())
  with check (public.is_crm_admin());

-- ── Role permissions table (permissions matrix persistence) ───────────────────
create table if not exists public.role_permissions (
  permission_key text not null,
  role           text not null,
  enabled        boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (permission_key, role)
);

alter table public.role_permissions enable row level security;

drop policy if exists "role_permissions read owner" on public.role_permissions;
create policy "role_permissions read owner" on public.role_permissions
  for select to authenticated using (public.is_owner());

drop policy if exists "role_permissions write owner" on public.role_permissions;
create policy "role_permissions write owner" on public.role_permissions
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
