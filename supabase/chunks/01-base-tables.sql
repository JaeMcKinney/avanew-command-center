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
