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

