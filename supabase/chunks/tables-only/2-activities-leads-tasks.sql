-- Prerequisite: activity_type enum (needed by activities table)
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

