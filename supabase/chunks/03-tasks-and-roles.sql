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
