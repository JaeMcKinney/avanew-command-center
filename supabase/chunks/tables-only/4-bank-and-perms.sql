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

create table if not exists public.role_permissions (
  permission_key text not null,
  role           text not null,
  enabled        boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (permission_key, role)
);

