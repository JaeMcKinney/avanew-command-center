
-- Migration: rename super_admin → super_user (run once on existing databases)
-- update public.profiles set role = 'super_user' where role = 'super_admin';

-- Helper: is current user a super_user?
create or replace function public.is_super_user() returns boolean
  language sql stable security definer
  as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_user'); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- bank_connections  (one row per connected institution)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mercury','plaid','finicity','manual')),
  institution_name text not null,
  institution_id text,
  -- access_token / api_key stored server-side ONLY in Edge Function env vars
  -- never returned to the frontend
  status text not null default 'pending' check (status in ('active','error','disconnected','pending')),
  last_sync_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists bank_connections_set_updated_at on public.bank_connections;
create trigger bank_connections_set_updated_at
  before update on public.bank_connections
  for each row execute function public.set_updated_at();

alter table public.bank_connections enable row level security;
drop policy if exists "bank_connections owner only" on public.bank_connections;
create policy "bank_connections owner only" on public.bank_connections
  for all to authenticated using (public.is_owner() or public.is_super_user()) with check (public.is_owner() or public.is_super_user());

-- ─────────────────────────────────────────────────────────────────────────────
-- bank_accounts  (one row per account within a connection)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_connection_id uuid not null references public.bank_connections(id) on delete cascade,
  external_account_id text not null,
  name text not null,
  type text not null check (type in ('checking','savings','credit','investment','other')),
  subtype text,
  balance_current numeric(14,2),
  balance_available numeric(14,2),
  currency text not null default 'USD',
  institution_name text not null,
  is_active boolean not null default true,
  last_updated timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_connection_id, external_account_id)
);

drop trigger if exists bank_accounts_set_updated_at on public.bank_accounts;
create trigger bank_accounts_set_updated_at
  before update on public.bank_accounts
  for each row execute function public.set_updated_at();

alter table public.bank_accounts enable row level security;
drop policy if exists "bank_accounts owner only" on public.bank_accounts;
create policy "bank_accounts owner only" on public.bank_accounts
  for all to authenticated using (public.is_owner() or public.is_super_user()) with check (public.is_owner() or public.is_super_user());

create index if not exists bank_accounts_connection_idx on public.bank_accounts(bank_connection_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- bank_transactions  (normalised transactions from all providers)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_connection_id uuid not null references public.bank_connections(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  provider text not null check (provider in ('mercury','plaid','finicity','manual')),
  external_transaction_id text not null,
  date date not null,
  description text not null,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  category text not null check (category in (
    'Revenue','Expense','Transfer','Refund','Owner Contribution',
    'Loan / Financing','Tax Payment','Payroll','Software','Infrastructure',
    'Contractor','Vendor Payment','Partner Payment','Other'
  )),
  pending boolean not null default false,
  merchant_name text,
  vendor_id uuid references public.vendors(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  notes text,
  is_excluded boolean not null default false,
  override_category text check (override_category in (
    'Revenue','Expense','Transfer','Refund','Owner Contribution',
    'Loan / Financing','Tax Payment','Payroll','Software','Infrastructure',
    'Contractor','Vendor Payment','Partner Payment','Other'
  )),
  raw_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_connection_id, external_transaction_id)
);

drop trigger if exists bank_transactions_set_updated_at on public.bank_transactions;
create trigger bank_transactions_set_updated_at
  before update on public.bank_transactions
  for each row execute function public.set_updated_at();

alter table public.bank_transactions enable row level security;
drop policy if exists "bank_transactions owner only" on public.bank_transactions;
create policy "bank_transactions owner only" on public.bank_transactions
  for all to authenticated using (public.is_owner() or public.is_super_user()) with check (public.is_owner() or public.is_super_user());

create index if not exists bank_transactions_account_idx on public.bank_transactions(bank_account_id);
create index if not exists bank_transactions_date_idx on public.bank_transactions(date);
create index if not exists bank_transactions_category_idx on public.bank_transactions(category);
create index if not exists bank_transactions_vendor_idx on public.bank_transactions(vendor_id);
create index if not exists bank_transactions_partner_idx on public.bank_transactions(partner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- cashflow_sync_logs  (audit trail for every sync event)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cashflow_sync_logs (
  id uuid primary key default gen_random_uuid(),
  bank_connection_id uuid not null references public.bank_connections(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  provider text not null,
  status text not null check (status in ('success','error','partial')),
  transactions_imported integer not null default 0,
  transactions_skipped integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.cashflow_sync_logs enable row level security;
drop policy if exists "sync_logs owner only" on public.cashflow_sync_logs;
create policy "sync_logs owner only" on public.cashflow_sync_logs
  for all to authenticated using (public.is_owner() or public.is_super_user()) with check (public.is_owner() or public.is_super_user());

create index if not exists sync_logs_connection_idx on public.cashflow_sync_logs(bank_connection_id);
create index if not exists sync_logs_started_at_idx on public.cashflow_sync_logs(started_at desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- ENFORCEMENT — All 4 layers (UI · Route · API · Data)
-- Phase 9: Global permission enforcement for all roles
-- ═════════════════════════════════════════════════════════════════════════════

-- ── New enum values ───────────────────────────────────────────────────────────
alter type public.team_role add value if not exists 'super_user';
alter type public.team_role add value if not exists 'bd';
alter type public.team_role add value if not exists 'partner';

-- ── Role helper functions ─────────────────────────────────────────────────────

-- Returns true for roles that can read all internal CRM records
create or replace function public.is_crm_reader() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('super_user','owner','admin','member','viewer')
  );
$$;

-- Returns true for roles that can create/edit CRM records
create or replace function public.is_crm_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('super_user','owner','admin','member')
  );
$$;

-- Returns true for roles that can delete CRM records
create or replace function public.is_crm_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('super_user','owner','admin')
  );
$$;

-- Returns true for BD users (scoped read/write to assigned records only)
create or replace function public.is_bd() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'bd'
  );
$$;

