-- ─────────────────────────────────────────────────────────────────────────────
-- Tavus catalog and avatars
--
-- tavus_pals / tavus_deployments are a copy of what is in the Tavus account,
-- refreshed by the tavus-sync function. Staff search this copy to link a PAL
-- to a client. A linked PAL is an "avatar".
-- ─────────────────────────────────────────────────────────────────────────────

create table public.tavus_pals (
  pal_id              text primary key,
  name                text not null default '',
  pipeline_mode       text,
  default_face_id     text,
  -- Host of the PAL's webhook address, or 'this-app' when it points here.
  callback_host       text,
  thumbnail_image_url text,
  tavus_created_at    timestamptz,
  tavus_updated_at    timestamptz,
  first_seen_at       timestamptz not null default now(),
  synced_at           timestamptz not null default now(),
  -- Set when a sync no longer finds the PAL in Tavus. Kept so history survives.
  removed_at          timestamptz
);
create index tavus_pals_name_trgm on public.tavus_pals using gin (name extensions.gin_trgm_ops);

create table public.tavus_deployments (
  deployment_id       text primary key,
  pal_id              text not null,
  channel             text not null,
  status              text not null,
  name                text not null default '',
  allowed_origins     text[] not null default '{}',
  limits              jsonb not null default '{}',
  usage_total         integer,
  usage_today         integer,
  thumbnail_image_url text,
  page_url            text,
  tavus_created_at    timestamptz,
  tavus_updated_at    timestamptz,
  synced_at           timestamptz not null default now(),
  removed_at          timestamptz
);
create index tavus_deployments_pal_idx on public.tavus_deployments (pal_id);
create index tavus_deployments_name_trgm on public.tavus_deployments using gin (name extensions.gin_trgm_ops);

create table public.tavus_sync_runs (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running' check (status in ('running', 'ok', 'error')),
  trigger           text not null default 'manual' check (trigger in ('manual', 'schedule')),
  triggered_by      uuid references auth.users (id) on delete set null,
  pals_count        integer,
  deployments_count integer,
  error             text
);
create index tavus_sync_runs_started_idx on public.tavus_sync_runs (started_at desc);

create table public.avatars (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients (id) on delete restrict,
  tavus_pal_id          text not null references public.tavus_pals (pal_id),
  display_name          text not null check (length(trim(display_name)) between 1 and 120),
  role_label            text,
  -- photo_url follows Tavus; custom_photo_url, when set, wins.
  photo_url             text,
  custom_photo_url      text check (custom_photo_url is null or custom_photo_url ~ '^https://'),
  webhook_status        text not null default 'pending'
                          check (webhook_status in ('pending', 'active', 'error')),
  webhook_error         text,
  webhook_configured_at timestamptz,
  last_event_at         timestamptz,
  -- What the PAL's callback_url was before we replaced it, so it can be restored.
  previous_callback_url text,
  linked_by             uuid references auth.users (id) on delete set null,
  linked_at             timestamptz not null default now(),
  -- Unlinking keeps the row so past usage stays with the client.
  unlinked_at           timestamptz
);
-- A PAL belongs to at most one client at a time.
create unique index avatars_active_pal_uniq on public.avatars (tavus_pal_id) where unlinked_at is null;
create index avatars_client_idx on public.avatars (client_id);

-- Webhook credentials. No policies: only server functions (service role) read it.
create table public.avatar_secrets (
  avatar_id       uuid primary key references public.avatars (id) on delete cascade,
  webhook_token   text not null unique,
  callback_secret text not null
);

alter table public.tavus_pals        enable row level security;
alter table public.tavus_deployments enable row level security;
alter table public.tavus_sync_runs   enable row level security;
alter table public.avatars           enable row level security;
alter table public.avatar_secrets    enable row level security;

-- The full Tavus list covers every client, so only staff can read it.
create policy tavus_pals_read on public.tavus_pals
  for select to authenticated using ((select app.is_staff()));

create policy tavus_sync_runs_read on public.tavus_sync_runs
  for select to authenticated using ((select app.is_staff()));

create policy avatars_read on public.avatars
  for select to authenticated using (app.can_access_client(client_id));
create policy avatars_update on public.avatars
  for update to authenticated
  using ((select app.is_staff()) and (select app.has_perm('avatars.link')) and app.can_access_client(client_id))
  with check ((select app.is_staff()) and (select app.has_perm('avatars.link')) and app.can_access_client(client_id));

-- A deployment is visible to staff, and to a client once its PAL is linked to them.
create policy tavus_deployments_read on public.tavus_deployments
  for select to authenticated using (
    (select app.is_staff())
    or exists (
      select 1 from public.avatars a
      where a.tavus_pal_id = tavus_deployments.pal_id
        and a.unlinked_at is null
        and app.can_access_client(a.client_id)
    )
  );

revoke insert, update, delete on public.tavus_pals, public.tavus_deployments, public.tavus_sync_runs,
  public.avatars, public.avatar_secrets from authenticated;
revoke select on public.avatar_secrets from authenticated;
-- Staff may rename an avatar or override its photo. Linking and unlinking go
-- through the avatar-link function, which also talks to Tavus.
grant update (display_name, role_label, custom_photo_url) on public.avatars to authenticated;

-- ── Search ───────────────────────────────────────────────────────────────────
-- Finds PALs by name, by the name of one of their deployments, or by PAL id.
-- Tolerates typos. Shows whether each PAL is already linked.
create or replace function public.search_tavus_pals(p_query text default '', p_limit integer default 25)
returns table (
  pal_id              text,
  name                text,
  thumbnail_image_url text,
  tavus_updated_at    timestamptz,
  deployments         jsonb,
  linked_avatar_id    uuid,
  linked_client_id    uuid,
  linked_client_name  text,
  score               real
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  if not (app.is_staff() and app.has_perm('avatars.link')) then
    raise exception 'You do not have permission to search Tavus avatars' using errcode = '42501';
  end if;

  return query
  with dep as (
    select d.pal_id,
           jsonb_agg(jsonb_build_object(
             'deployment_id', d.deployment_id, 'name', d.name, 'channel', d.channel,
             'status', d.status, 'allowed_origins', d.allowed_origins
           ) order by d.tavus_updated_at desc nulls last) as deployments,
           max(d.thumbnail_image_url) as thumb,
           string_agg(lower(d.name || ' ' || array_to_string(d.allowed_origins, ' ')), ' ') as haystack
    from public.tavus_deployments d
    where d.removed_at is null
    group by d.pal_id
  ),
  scored as (
    select p.pal_id, p.name,
           coalesce(p.thumbnail_image_url, dep.thumb) as thumb,
           p.tavus_updated_at,
           coalesce(dep.deployments, '[]'::jsonb) as deployments,
           case
             when v_q = '' then 0.0
             when lower(p.pal_id) = v_q then 3.0
             when position(v_q in lower(p.name)) > 0 then 2.0
             when dep.haystack is not null and position(v_q in dep.haystack) > 0 then 1.5
             else greatest(extensions.word_similarity(v_q, lower(p.name)),
                           coalesce(extensions.word_similarity(v_q, dep.haystack), 0))
           end::real as score
    from public.tavus_pals p
    left join dep on dep.pal_id = p.pal_id
    where p.removed_at is null
  )
  select s.pal_id, s.name, s.thumb, s.tavus_updated_at, s.deployments,
         a.id,
         a.client_id,
         -- Someone limited to assigned clients is told a PAL is taken, not by whom.
         case when a.id is null then null
              when app.can_access_client(a.client_id) then c.name
              else 'another client' end,
         s.score
  from scored s
  left join public.avatars a on a.tavus_pal_id = s.pal_id and a.unlinked_at is null
  left join public.clients c on c.id = a.client_id
  where v_q = '' or s.score >= 0.35
  order by s.score desc, s.tavus_updated_at desc nulls last, s.name
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
end $$;

revoke execute on function public.search_tavus_pals(text, integer) from public, anon;
grant execute on function public.search_tavus_pals(text, integer) to authenticated, service_role;

-- After a sync, avatars pick up the photo Tavus has for their PAL.
create or replace function public.refresh_avatar_photos() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.avatars a
  set photo_url = p.thumbnail_image_url
  from public.tavus_pals p
  where p.pal_id = a.tavus_pal_id
    and a.unlinked_at is null
    and p.thumbnail_image_url is not null
    and p.thumbnail_image_url is distinct from a.photo_url;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.refresh_avatar_photos() from public, anon, authenticated;
grant execute on function public.refresh_avatar_photos() to service_role;
