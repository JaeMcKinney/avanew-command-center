-- Avanew CRM — initial schema
-- Run this in Supabase SQL Editor (or via the CLI) once per project.

-- Extensions
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Team roles
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_role') then
    create type public.team_role as enum ('admin', 'member', 'viewer');
  end if;
end$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles (one row per auth.users entry)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  role public.team_role not null default 'member',
  created_at timestamptz not null default now()
);

-- Backfill / additions for existing installs
alter table public.profiles
  add column if not exists email text,
  add column if not exists role public.team_role not null default 'member';

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- invitations (pending team invites — created by the invite-user Edge Function)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role public.team_role not null default 'member',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Auto-create profile when a new auth user is created. If the email is in
-- invitations, adopt the role/full_name from there and consume the invite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.invitations%rowtype;
begin
  select * into inv from public.invitations where email = new.email;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(inv.full_name, new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(inv.role, 'member')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = coalesce(inv.role, public.profiles.role);

  if inv.id is not null then
    delete from public.invitations where id = inv.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- companies
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  industry text,
  notes text,
  owner_id uuid references public.profiles(id) on delete set null,
  -- Account extended fields
  phone text,
  fax text,
  website text,
  ticker_symbol text,
  ownership text,
  employees int,
  sic_code text,
  rating text,
  account_type text,
  account_number text,
  account_site text,
  annual_revenue numeric(18,2),
  billing_street text,
  billing_city text,
  billing_state text,
  billing_zip text,
  billing_country text,
  shipping_street text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  shipping_country text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies
  add column if not exists phone text,
  add column if not exists fax text,
  add column if not exists website text,
  add column if not exists ticker_symbol text,
  add column if not exists ownership text,
  add column if not exists employees int,
  add column if not exists sic_code text,
  add column if not exists rating text,
  add column if not exists account_type text,
  add column if not exists account_number text,
  add column if not exists account_site text,
  add column if not exists annual_revenue numeric(18,2),
  add column if not exists billing_street text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_zip text,
  add column if not exists billing_country text,
  add column if not exists shipping_street text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_zip text,
  add column if not exists shipping_country text,
  add column if not exists description text;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- contacts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text,
  phone text,
  title text,
  company_id uuid references public.companies(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  -- Contact extended fields
  mobile text,
  fax text,
  website text,
  secondary_email text,
  twitter text,
  skype_id text,
  email_opt_out boolean not null default false,
  date_of_birth date,
  assistant text,
  asst_phone text,
  department text,
  lead_source text,
  description text,
  mailing_street text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  mailing_country text,
  other_street text,
  other_city text,
  other_state text,
  other_zip text,
  other_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contacts
  add column if not exists mobile text,
  add column if not exists fax text,
  add column if not exists website text,
  add column if not exists secondary_email text,
  add column if not exists twitter text,
  add column if not exists skype_id text,
  add column if not exists email_opt_out boolean not null default false,
  add column if not exists date_of_birth date,
  add column if not exists assistant text,
  add column if not exists asst_phone text,
  add column if not exists department text,
  add column if not exists lead_source text,
  add column if not exists description text,
  add column if not exists mailing_street text,
  add column if not exists mailing_city text,
  add column if not exists mailing_state text,
  add column if not exists mailing_zip text,
  add column if not exists mailing_country text,
  add column if not exists other_street text,
  add column if not exists other_city text,
  add column if not exists other_state text,
  add column if not exists other_zip text,
  add column if not exists other_country text,
  add column if not exists description text;

create index if not exists contacts_company_id_idx on public.contacts(company_id);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- pipeline_stages
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed default stages once
insert into public.pipeline_stages (name, position, is_won, is_lost) values
  ('New', 1, false, false),
  ('Qualified', 2, false, false),
  ('Proposal', 3, false, false),
  ('Negotiation', 4, false, false),
  ('Won', 5, true, false),
  ('Lost', 6, false, true)
on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- deals
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(12, 2),
  currency text not null default 'USD',
  stage_id uuid not null references public.pipeline_stages(id),
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  expected_close_date date,
  closed_at timestamptz,
  position int not null default 0,
  type text,
  next_step text,
  lead_source text,
  probability int check (probability is null or (probability >= 0 and probability <= 100)),
  campaign_source text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill / additions for existing installs
alter table public.deals
  add column if not exists type text,
  add column if not exists next_step text,
  add column if not exists lead_source text,
  add column if not exists probability int,
  add column if not exists campaign_source text,
  add column if not exists description text;

create index if not exists deals_stage_id_idx on public.deals(stage_id);
create index if not exists deals_company_id_idx on public.deals(company_id);
create index if not exists deals_contact_id_idx on public.deals(contact_id);

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- activities
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type public.activity_type as enum ('call', 'email', 'note', 'meeting', 'task');
  end if;
end$$;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  type public.activity_type not null,
  subject text not null,
  body text,
  contact_id uuid references public.contacts(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activities_contact_id_idx on public.activities(contact_id);
create index if not exists activities_deal_id_idx on public.activities(deal_id);
create index if not exists activities_company_id_idx on public.activities(company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- v1 policy: any authenticated user has full access (single shared workspace).
-- Tighten later by introducing org membership and per-row owner checks.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.invitations      enable row level security;
alter table public.companies        enable row level security;
alter table public.contacts         enable row level security;
alter table public.pipeline_stages  enable row level security;
alter table public.deals            enable row level security;
alter table public.activities       enable row level security;

-- Profiles: anyone signed-in can read.
drop policy if exists "profiles read for authenticated" on public.profiles;
create policy "profiles read for authenticated"
  on public.profiles for select to authenticated using (true);

-- Profiles: users can update their own row (name, avatar, etc.).
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Profiles: admins can update anyone (role changes).
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Invitations: admins read; admins delete (cancel invites).
drop policy if exists "invitations admin read" on public.invitations;
create policy "invitations admin read"
  on public.invitations for select to authenticated using (public.is_admin());

drop policy if exists "invitations admin delete" on public.invitations;
create policy "invitations admin delete"
  on public.invitations for delete to authenticated using (public.is_admin());

-- Note: invitations are CREATED by the invite-user Edge Function (service role),
-- not by clients, so no insert policy is needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- leads
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text,
  company text,
  title text,
  phone text,
  mobile text,
  email text,
  fax text,
  website text,
  lead_source text,
  lead_status text,
  industry text,
  annual_revenue numeric(18,2),
  no_of_employees int,
  rating text,
  email_opt_out boolean not null default false,
  street text,
  city text,
  state text,
  zip_code text,
  country text,
  description text,
  converted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  status text not null default 'Not Started',
  priority text not null default 'Normal',
  owner_id uuid references public.profiles(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  due_date date,
  description text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- Records: viewers can read, members+ can write, admins can delete.
do $$
declare
  t text;
begin
  foreach t in array array['leads','tasks']
  loop
    execute format('drop policy if exists "%s read all" on public.%I;', t, t);
    execute format('drop policy if exists "%s write member" on public.%I;', t, t);
    execute format('drop policy if exists "%s delete admin" on public.%I;', t, t);
    execute format('drop policy if exists "%s update member" on public.%I;', t, t);
    execute format(
      'create policy "%s read all" on public.%I for select to authenticated using (true);', t, t
    );
    execute format(
      'create policy "%s write member" on public.%I for insert to authenticated with check (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''admin'',''member''))
       );', t, t
    );
    execute format(
      'create policy "%s update member" on public.%I for update to authenticated using (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''admin'',''member''))
       ) with check (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''admin'',''member''))
       );', t, t
    );
    execute format(
      'create policy "%s delete admin" on public.%I for delete to authenticated using (public.is_admin());', t, t
    );
  end loop;
end$$;

-- Records: viewers can read, members+ can write, admins can delete.
do $$
declare
  t text;
begin
  foreach t in array array['companies','contacts','pipeline_stages','deals','activities']
  loop
    execute format('drop policy if exists "%s read all" on public.%I;', t, t);
    execute format('drop policy if exists "%s write member" on public.%I;', t, t);
    execute format('drop policy if exists "%s delete admin" on public.%I;', t, t);
    execute format('drop policy if exists "%s update member" on public.%I;', t, t);
    execute format('drop policy if exists "%s all for authenticated" on public.%I;', t, t);

    execute format(
      'create policy "%s read all" on public.%I for select to authenticated using (true);',
      t, t
    );
    execute format(
      'create policy "%s write member" on public.%I for insert to authenticated with check (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''admin'',''member''))
       );',
      t, t
    );
    execute format(
      'create policy "%s update member" on public.%I for update to authenticated using (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''admin'',''member''))
       ) with check (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in (''admin'',''member''))
       );',
      t, t
    );
    execute format(
      'create policy "%s delete admin" on public.%I for delete to authenticated using (public.is_admin());',
      t, t
    );
  end loop;
end$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Add owner role to the team_role enum
-- ─────────────────────────────────────────────────────────────────────────────
alter type public.team_role add value if not exists 'owner';

-- ─────────────────────────────────────────────────────────────────────────────
-- is_owner() helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- partners
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  email text,
  phone text,
  website text,
  agreement_start_date date,
  contract_terms text,
  revenue_share text,
  key_contacts text,
  notes text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

alter table public.partners enable row level security;

drop policy if exists "partners read all" on public.partners;
create policy "partners read all" on public.partners for select to authenticated using (true);
drop policy if exists "partners write member" on public.partners;
create policy "partners write member" on public.partners for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','member')));
drop policy if exists "partners update member" on public.partners;
create policy "partners update member" on public.partners for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','member')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','member')));
drop policy if exists "partners delete admin" on public.partners;
create policy "partners delete admin" on public.partners for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin')));

-- ─────────────────────────────────────────────────────────────────────────────
-- vendors
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service text,
  email text,
  phone text,
  website text,
  contract_terms text,
  payment_terms text,
  cost_structure text,
  performance_notes text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

alter table public.vendors enable row level security;

drop policy if exists "vendors read all" on public.vendors;
create policy "vendors read all" on public.vendors for select to authenticated using (true);
drop policy if exists "vendors write member" on public.vendors;
create policy "vendors write member" on public.vendors for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','member')));
drop policy if exists "vendors update member" on public.vendors;
create policy "vendors update member" on public.vendors for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','member')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin','member')));
drop policy if exists "vendors delete admin" on public.vendors;
create policy "vendors delete admin" on public.vendors for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','admin')));

-- ─────────────────────────────────────────────────────────────────────────────
-- cashflow_transactions  (owner-role restricted)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.cashflow_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income','expense')),
  category text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  is_recurring boolean not null default false,
  recurrence_period text check (recurrence_period in ('daily','weekly','monthly','quarterly','yearly')),
  partner_id uuid references public.partners(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cashflow_transactions_set_updated_at on public.cashflow_transactions;
create trigger cashflow_transactions_set_updated_at
  before update on public.cashflow_transactions
  for each row execute function public.set_updated_at();

alter table public.cashflow_transactions enable row level security;

-- Only owner role can access financial data
drop policy if exists "cashflow owner only" on public.cashflow_transactions;
create policy "cashflow owner only" on public.cashflow_transactions
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create index if not exists cashflow_transactions_date_idx on public.cashflow_transactions(date);
create index if not exists cashflow_transactions_type_idx on public.cashflow_transactions(type);
create index if not exists cashflow_transactions_partner_id_idx on public.cashflow_transactions(partner_id);
create index if not exists cashflow_transactions_vendor_id_idx on public.cashflow_transactions(vendor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Schema additions (migration)
-- ─────────────────────────────────────────────────────────────────────────────

-- Link deals to partners
alter table public.deals
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

create index if not exists deals_partner_id_idx on public.deals(partner_id);

-- Structured cost fields on vendors
alter table public.vendors
  add column if not exists cost_amount numeric(12,2),
  add column if not exists cost_frequency text check (cost_frequency in ('monthly','quarterly','annually'));

-- ─────────────────────────────────────────────────────────────────────────────
-- super_user role + bank integration tables
-- ─────────────────────────────────────────────────────────────────────────────

alter type public.team_role add value if not exists 'super_user';

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
