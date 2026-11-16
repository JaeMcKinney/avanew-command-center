-- ─────────────────────────────────────────────────────────────────────────────
-- Divigner Avatar Analytics — foundation
--
-- Two sides log in:
--   * divigner — Divigner staff. What they can do comes from their role's
--     permissions; which clients they can see comes from the role's
--     client_scope ('all', or 'assigned' = only clients assigned to them).
--   * client   — a user of exactly one client. They only ever see that client.
--
-- Every table has row-level security. Helper functions live in the `app`
-- schema, which the REST API does not expose, so they cannot be called as RPCs.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
grant usage on schema app to authenticated, service_role;

-- Nothing in this app is for signed-out visitors. Stop new tables and
-- functions from being opened to the anon role by default.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

-- ── Roles and permissions ────────────────────────────────────────────────────

create table public.permissions (
  key         text primary key,
  side        text not null check (side in ('divigner', 'client', 'both')),
  label       text not null,
  description text not null default '',
  sort        integer not null default 0
);

create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name         text not null,
  description  text not null default '',
  side         text not null check (side in ('divigner', 'client')),
  -- 'assigned' limits a Divigner role to the clients in staff_client_assignments.
  client_scope text not null default 'all' check (client_scope in ('all', 'assigned')),
  is_system    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.role_permissions (
  role_id    uuid not null references public.roles (id) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission)
);

-- ── Clients ──────────────────────────────────────────────────────────────────

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  status      text not null default 'onboarding'
                check (status in ('onboarding', 'active', 'paused', 'cancelled')),
  timezone    text not null default 'America/New_York',
  logo_url    text check (logo_url is null or logo_url ~ '^https://'),
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Users ────────────────────────────────────────────────────────────────────

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  side       text not null check (side in ('divigner', 'client')),
  role_id    uuid not null references public.roles (id),
  client_id  uuid references public.clients (id) on delete cascade,
  is_active  boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- A client user always belongs to a client; a Divigner user never does.
  constraint profiles_side_matches_client check ((side = 'client') = (client_id is not null))
);
create index profiles_client_id_idx on public.profiles (client_id);
create index profiles_role_id_idx on public.profiles (role_id);

create table public.staff_client_assignments (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  primary key (user_id, client_id)
);
create index staff_client_assignments_client_idx on public.staff_client_assignments (client_id);

-- ── Settings and audit log ───────────────────────────────────────────────────

create table public.settings (
  key         text primary key,
  value       jsonb not null,
  description text not null default '',
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  client_id   uuid references public.clients (id) on delete set null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_client_idx on public.audit_log (client_id, created_at desc);

-- ── Helper functions (schema app, not exposed over REST) ─────────────────────

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.side = 'divigner'
  )
$$;

create or replace function app.has_perm(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.id = (select auth.uid()) and p.is_active and rp.permission = p_permission
  )
$$;

create or replace function app.can_access_client(p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = (select auth.uid())
      and p.is_active
      and (
        (p.side = 'client' and p.client_id = p_client_id)
        or (p.side = 'divigner' and (
              r.client_scope = 'all'
              or exists (
                select 1 from public.staff_client_assignments a
                where a.user_id = p.id and a.client_id = p_client_id
              )
        ))
      )
  )
$$;

create or replace function app.my_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.client_id from public.profiles p
  where p.id = (select auth.uid()) and p.is_active
$$;

create or replace function app.audit(
  p_action text, p_target_type text, p_target_id text, p_client_id uuid, p_detail jsonb default '{}'
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, client_id, detail)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, p_client_id, coalesce(p_detail, '{}'))
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- ── Integrity triggers ───────────────────────────────────────────────────────

create or replace function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger clients_touch before update on public.clients
  for each row execute function app.touch_updated_at();

create or replace function app.clients_validate() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown time zone "%"', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;

create trigger clients_validate before insert or update of timezone on public.clients
  for each row execute function app.clients_validate();

-- A profile's role must belong to the same side as the profile.
create or replace function app.profiles_validate() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_side text;
begin
  select r.side into v_side from public.roles r where r.id = new.role_id;
  if v_side is distinct from new.side then
    raise exception 'Role does not belong to the % side', new.side using errcode = '22023';
  end if;
  new.email := lower(new.email);
  return new;
end $$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function app.profiles_validate();

-- The Owner role always keeps every Divigner permission, so nobody can lock
-- the whole team out by editing it.
create or replace function app.protect_owner_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.roles r where r.id = old.role_id and r.key = 'owner')
     and exists (select 1 from public.permissions p where p.key = old.permission) then
    raise exception 'The Owner role always has every permission' using errcode = '42501';
  end if;
  return old;
end $$;

create trigger role_permissions_protect_owner before delete on public.role_permissions
  for each row execute function app.protect_owner_role();

-- A client role can only hold permissions that make sense for clients, and
-- the other way round.
create or replace function app.role_permissions_validate() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_role_side text;
  v_perm_side text;
begin
  select r.side into v_role_side from public.roles r where r.id = new.role_id;
  select p.side into v_perm_side from public.permissions p where p.key = new.permission;
  if v_perm_side <> 'both' and v_perm_side <> v_role_side then
    raise exception 'Permission "%" cannot be given to a % role', new.permission, v_role_side
      using errcode = '22023';
  end if;
  return new;
end $$;

create trigger role_permissions_validate before insert or update on public.role_permissions
  for each row execute function app.role_permissions_validate();

create or replace function app.protect_system_roles() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'Built-in roles cannot be deleted' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.is_system and (new.key <> old.key or new.side <> old.side or not new.is_system) then
    raise exception 'Built-in roles cannot change key or side' using errcode = '42501';
  end if;
  if old.key = 'owner' and new.client_scope <> 'all' then
    raise exception 'The Owner role always sees every client' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger roles_protect_system before update or delete on public.roles
  for each row execute function app.protect_system_roles();

-- The first Owner. Whoever sets the project up names one email address in
-- settings ('bootstrap.owner_email'). When a user with exactly that address
-- is created and nobody has a profile yet, they become the Owner and the
-- setting is removed. Nobody else is ever promoted by signing up; everyone
-- after the Owner is invited.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner_email text;
begin
  select s.value #>> '{}' into v_owner_email from public.settings s where s.key = 'bootstrap.owner_email';
  if v_owner_email is not null
     and lower(new.email) = lower(trim(v_owner_email))
     and not exists (select 1 from public.profiles) then
    insert into public.profiles (id, email, full_name, side, role_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      'divigner',
      (select id from public.roles where key = 'owner')
    );
    delete from public.settings where key = 'bootstrap.owner_email';
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ── Row-level security ───────────────────────────────────────────────────────

alter table public.permissions              enable row level security;
alter table public.roles                    enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.clients                  enable row level security;
alter table public.profiles                 enable row level security;
alter table public.staff_client_assignments enable row level security;
alter table public.settings                 enable row level security;
alter table public.audit_log                enable row level security;

-- Roles and permissions: everyone signed in can read them; only people who
-- manage the team can change them.
create policy permissions_read on public.permissions
  for select to authenticated using (true);

create policy roles_read on public.roles
  for select to authenticated using (true);
create policy roles_insert on public.roles
  for insert to authenticated with check ((select app.has_perm('team.manage')) and not is_system);
create policy roles_update on public.roles
  for update to authenticated
  using ((select app.has_perm('team.manage')))
  with check ((select app.has_perm('team.manage')));
create policy roles_delete on public.roles
  for delete to authenticated using ((select app.has_perm('team.manage')));

create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);
create policy role_permissions_insert on public.role_permissions
  for insert to authenticated with check ((select app.has_perm('team.manage')));
create policy role_permissions_delete on public.role_permissions
  for delete to authenticated using ((select app.has_perm('team.manage')));

-- Clients: visible to anyone who can access them. Created through
-- create_client(); edited by staff who manage clients.
create policy clients_read on public.clients
  for select to authenticated using (app.can_access_client(id));
create policy clients_update on public.clients
  for update to authenticated
  using ((select app.is_staff()) and (select app.has_perm('clients.manage')) and app.can_access_client(id))
  with check ((select app.is_staff()) and (select app.has_perm('clients.manage')) and app.can_access_client(id));
create policy clients_delete on public.clients
  for delete to authenticated
  using ((select app.is_staff()) and (select app.has_perm('clients.manage')) and app.can_access_client(id));

-- Profiles: you see yourself; staff see the Divigner team and the users of
-- clients they can access; a client user who manages their team sees it.
-- All changes go through functions (invites, set_user_active, set_user_role).
create policy profiles_read on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or ((select app.is_staff()) and (side = 'divigner' or app.can_access_client(client_id)))
    or (client_id is not null
        and client_id = (select app.my_client_id())
        and (select app.has_perm('client_users.manage')))
  );

create policy staff_assignments_read on public.staff_client_assignments
  for select to authenticated using ((select app.is_staff()));

create policy settings_read on public.settings
  for select to authenticated using ((select app.is_staff()));
create policy settings_update on public.settings
  for update to authenticated
  using ((select app.has_perm('settings.manage')))
  with check ((select app.has_perm('settings.manage')));

create policy audit_log_read on public.audit_log
  for select to authenticated using ((select app.has_perm('audit.view')));

-- ── Functions the app calls ──────────────────────────────────────────────────

-- Everything the app needs to know about the signed-in user, in one call.
create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'side', p.side,
    'is_active', p.is_active,
    'role', jsonb_build_object('id', r.id, 'key', r.key, 'name', r.name, 'client_scope', r.client_scope),
    'permissions', coalesce(
      (select jsonb_agg(rp.permission order by rp.permission)
       from public.role_permissions rp where rp.role_id = r.id), '[]'::jsonb),
    'client', case when c.id is null then null else
      jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug,
                         'logo_url', c.logo_url, 'brand_color', c.brand_color,
                         'timezone', c.timezone, 'status', c.status) end
  )
  from public.profiles p
  join public.roles r on r.id = p.role_id
  left join public.clients c on c.id = p.client_id
  where p.id = (select auth.uid())
$$;

-- Used by server functions to check the caller before doing privileged work.
create or replace function public.check_access(p_permission text, p_client_id uuid default null)
returns boolean
language sql stable security invoker set search_path = '' as $$
  select app.has_perm(p_permission)
     and (p_client_id is null or app.can_access_client(p_client_id))
$$;

create or replace function public.create_client(
  p_name text,
  p_slug text,
  p_timezone text default 'America/New_York',
  p_brand_color text default null,
  p_logo_url text default null
) returns public.clients
language plpgsql security definer set search_path = '' as $$
declare
  v_client public.clients;
  v_scope text;
begin
  if not (app.is_staff() and app.has_perm('clients.manage')) then
    raise exception 'You do not have permission to create clients' using errcode = '42501';
  end if;

  insert into public.clients (name, slug, timezone, brand_color, logo_url, created_by)
  values (trim(p_name), lower(trim(p_slug)), p_timezone, nullif(p_brand_color, ''), nullif(p_logo_url, ''),
          (select auth.uid()))
  returning * into v_client;

  -- Someone who only sees assigned clients is assigned to the one they create.
  select r.client_scope into v_scope
  from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = (select auth.uid());
  if v_scope = 'assigned' then
    insert into public.staff_client_assignments (user_id, client_id)
    values ((select auth.uid()), v_client.id);
  end if;

  perform app.audit('client.created', 'client', v_client.id::text, v_client.id,
                    jsonb_build_object('name', v_client.name, 'slug', v_client.slug));
  return v_client;
end $$;

create or replace function public.update_my_profile(p_full_name text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set full_name = trim(p_full_name) where id = (select auth.uid())
$$;

-- Who may manage a given user: team managers for Divigner users; for client
-- users, anyone with client_users.manage who can access that client.
create or replace function app.can_manage_user(p_target public.profiles) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_target.side = 'divigner' then app.is_staff() and app.has_perm('team.manage')
    else app.has_perm('client_users.manage') and app.can_access_client(p_target.client_id)
  end
$$;

create or replace function app.assert_not_last_owner(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
       select 1 from public.profiles p join public.roles r on r.id = p.role_id
       where p.id = p_user_id and r.key = 'owner' and p.is_active)
     and not exists (
       select 1 from public.profiles p join public.roles r on r.id = p.role_id
       where p.id <> p_user_id and r.key = 'owner' and p.is_active) then
    raise exception 'There must always be at least one active Owner' using errcode = '42501';
  end if;
end $$;

create or replace function public.set_user_active(p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.profiles;
begin
  select * into v_target from public.profiles where id = p_user_id;
  if not found or not app.can_manage_user(v_target) then
    raise exception 'You do not have permission to change this user' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot deactivate your own account' using errcode = '42501';
  end if;
  if not p_active then
    perform app.assert_not_last_owner(p_user_id);
  end if;
  update public.profiles set is_active = p_active where id = p_user_id;
  perform app.audit(case when p_active then 'user.activated' else 'user.deactivated' end,
                    'user', p_user_id::text, v_target.client_id, jsonb_build_object('email', v_target.email));
end $$;

create or replace function public.set_user_role(p_user_id uuid, p_role_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_target public.profiles;
  v_role public.roles;
begin
  select * into v_target from public.profiles where id = p_user_id;
  select * into v_role from public.roles where id = p_role_id;
  if v_target.id is null or v_role.id is null or not app.can_manage_user(v_target) then
    raise exception 'You do not have permission to change this user' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if v_role.key <> 'owner' then
    perform app.assert_not_last_owner(p_user_id);
  end if;
  update public.profiles set role_id = p_role_id where id = p_user_id;
  perform app.audit('user.role_changed', 'user', p_user_id::text, v_target.client_id,
                    jsonb_build_object('email', v_target.email, 'role', v_role.key));
end $$;

create or replace function public.set_staff_assignments(p_user_id uuid, p_client_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app.is_staff() and app.has_perm('team.manage')) then
    raise exception 'You do not have permission to assign clients' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and side = 'divigner') then
    raise exception 'Only Divigner users can be assigned clients' using errcode = '22023';
  end if;
  delete from public.staff_client_assignments
  where user_id = p_user_id and client_id <> all (coalesce(p_client_ids, '{}'));
  insert into public.staff_client_assignments (user_id, client_id)
  select p_user_id, c from unnest(coalesce(p_client_ids, '{}')) as c
  on conflict do nothing;
  perform app.audit('user.assignments_changed', 'user', p_user_id::text, null,
                    jsonb_build_object('client_ids', coalesce(p_client_ids, '{}')));
end $$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

revoke execute on function
  public.my_access(), public.check_access(text, uuid),
  public.create_client(text, text, text, text, text), public.update_my_profile(text),
  public.set_user_active(uuid, boolean), public.set_user_role(uuid, uuid),
  public.set_staff_assignments(uuid, uuid[])
from public, anon;
grant execute on function
  public.my_access(), public.check_access(text, uuid),
  public.create_client(text, text, text, text, text), public.update_my_profile(text),
  public.set_user_active(uuid, boolean), public.set_user_role(uuid, uuid),
  public.set_staff_assignments(uuid, uuid[])
to authenticated, service_role;

-- Table privileges: RLS decides which rows; these decide which verbs.
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.clients, public.profiles, public.staff_client_assignments,
  public.audit_log, public.permissions, public.settings from authenticated;
grant update (name, status, timezone, logo_url, brand_color) on public.clients to authenticated;
grant delete on public.clients to authenticated;
grant update (value) on public.settings to authenticated;

-- ── Seed: permissions and built-in roles ─────────────────────────────────────

insert into public.permissions (key, side, label, description, sort) values
  ('analytics.view',      'both',     'View dashboards',        'See talk time, conversations and charts.', 10),
  ('transcripts.view',    'both',     'Read transcripts',       'Open and download conversation transcripts.', 20),
  ('embeds.view',         'both',     'Copy embed codes',       'See and copy the code that puts an avatar on a website.', 30),
  ('client_users.manage', 'both',     'Manage client users',    'Invite and remove the people who can sign in for a client.', 40),
  ('clients.manage',      'divigner', 'Manage clients',         'Create clients and edit their details and branding.', 50),
  ('avatars.link',        'divigner', 'Link avatars',           'Connect Tavus avatars to clients and refresh the Tavus list.', 60),
  ('team.manage',         'divigner', 'Manage the team',        'Create Divigner users, and edit roles and permissions.', 70),
  ('settings.manage',     'divigner', 'Change settings',        'Change app-wide settings.', 80),
  ('audit.view',          'divigner', 'View the activity log',  'See who changed what, and incoming Tavus events.', 90);

insert into public.roles (key, name, description, side, client_scope, is_system) values
  ('owner',         'Owner',         'Everything, including managing the team.',            'divigner', 'all',      true),
  ('admin',         'Admin',         'Manage clients, avatars and settings.',               'divigner', 'all',      true),
  ('manager',       'Manager',       'Manage only the clients assigned to them.',           'divigner', 'assigned', true),
  ('analyst',       'Analyst',       'Read-only access to dashboards.',                     'divigner', 'all',      true),
  ('client_admin',  'Client admin',  'Dashboards, transcripts, embed codes and their team.', 'client',   'all',      true),
  ('client_member', 'Client member', 'Dashboards and transcripts.',                         'client',   'all',      true);

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r cross join public.permissions p where r.key = 'owner'
union all
select r.id, p.key from public.roles r cross join public.permissions p
  where r.key = 'admin' and p.key <> 'team.manage'
union all
select r.id, p.key from public.roles r cross join public.permissions p
  where r.key = 'manager'
    and p.key in ('analytics.view', 'transcripts.view', 'embeds.view', 'client_users.manage', 'clients.manage', 'avatars.link')
union all
select r.id, 'analytics.view' from public.roles r where r.key = 'analyst'
union all
select r.id, p.key from public.roles r cross join public.permissions p
  where r.key = 'client_admin'
    and p.key in ('analytics.view', 'transcripts.view', 'embeds.view', 'client_users.manage')
union all
select r.id, p.key from public.roles r cross join public.permissions p
  where r.key = 'client_member' and p.key in ('analytics.view', 'transcripts.view');

-- New permissions added later are given to the Owner automatically.
create or replace function app.grant_new_permission_to_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.side in ('divigner', 'both') then
    insert into public.role_permissions (role_id, permission)
    select r.id, new.key from public.roles r where r.key = 'owner'
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger permissions_grant_owner after insert on public.permissions
  for each row execute function app.grant_new_permission_to_owner();

insert into public.settings (key, value, description) values
  ('usage.round_to_seconds', '6',
   'Talk time is rounded to the nearest this-many seconds, the way Tavus bills.'),
  ('usage.minimum_seconds', '30',
   'Minimum billable seconds for a conversation the avatar joined.');
