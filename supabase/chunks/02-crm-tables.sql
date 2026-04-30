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

