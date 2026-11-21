-- Glass Health. A clinical avatar can look up published evidence through the
-- client's own Glass Health account. This app sits between the avatar and
-- Glass so every question is counted against the conversation it came from.
--
-- How it fits together:
--   1. Divigner turns Glass on for a client (glass_enable).
--   2. The client, or Divigner on their behalf, enters the client's Glass key
--      (glass_set_key). The key is stored encrypted in Supabase Vault. Nobody
--      can read it back: the app only ever shows its last four characters.
--   3. During a call the avatar's tool posts the question to the glass-consult
--      function, which reads the key (glass_read_key), asks Glass, and records
--      what the answer cost (glass_record_call).
--
-- What is kept per question: which avatar and conversation asked, when, the
-- tokens Glass reported, how long Glass took, and whether it worked. The
-- question and the answer themselves are not stored here.
--
-- Who sees what:
--   The key        nobody. Server functions read it to call Glass.
--   The connection anyone who may see the client's dashboards.
--   The usage      anyone who may see the client's dashboards.

create extension if not exists supabase_vault with schema vault;

insert into public.permissions (key, side, label, description, sort) values
  ('glass.manage', 'both', 'Connect Glass Health',
   'Enter, replace or remove the Glass Health key that a client''s avatars use.', 46);

insert into public.role_permissions (role_id, permission)
select r.id, 'glass.manage' from public.roles r where r.key in ('admin', 'client_admin')
on conflict do nothing;

-- Prices are entered in the app, not here. Zero means "do not estimate a cost".
insert into public.settings (key, value, description) values
  ('glass.input_cents_per_million', '0',
   'What Glass Health charges per million input tokens, in cents. Used to estimate cost. 0 leaves the cost blank.'),
  ('glass.output_cents_per_million', '0',
   'What Glass Health charges per million output tokens, in cents. Used to estimate cost. 0 leaves the cost blank.')
on conflict (key) do nothing;

-- ── Tables ───────────────────────────────────────────────────────────────────

-- A row means Glass is turned on for the client. secret_id is empty until a key is entered.
create table public.client_glass (
  client_id     uuid primary key references public.clients (id) on delete cascade,
  secret_id     uuid,
  -- The last four characters of the key, so its owner can recognise it.
  key_hint      text,
  status        text not null default 'no_key'
                  check (status in ('no_key', 'unchecked', 'ok', 'invalid', 'past_due', 'error')),
  status_detail text,
  checked_at    timestamptz,
  last_used_at  timestamptz,
  enabled_by    uuid references auth.users (id) on delete set null,
  enabled_at    timestamptz not null default now(),
  key_set_by    uuid references auth.users (id) on delete set null,
  key_set_at    timestamptz,
  check ((secret_id is null) = (status = 'no_key'))
);

-- One row for each request sent to Glass, which is also what Glass bills.
create table public.glass_calls (
  id               bigint generated always as identity primary key,
  client_id        uuid not null references public.clients (id) on delete restrict,
  avatar_id        uuid not null references public.avatars (id) on delete restrict,
  -- Tavus's conversation id. Not a foreign key: the first question can arrive
  -- before Tavus has reported the conversation.
  conversation_id  text not null,
  tool_call_id     text,
  asked_at         timestamptz not null default now(),
  -- The day it counts toward, in the client's time zone.
  usage_date       date not null,
  status           text not null check (status in ('ok', 'error')),
  error_code       text,
  input_tokens     integer not null default 0 check (input_tokens >= 0),
  output_tokens    integer not null default 0 check (output_tokens >= 0),
  duration_ms      integer not null default 0 check (duration_ms >= 0),
  -- Estimated from the rates in settings at the time. Empty when no rates are set.
  cost_cents       numeric(12, 4),
  glass_version    text,
  glass_request_id text
);
create index glass_calls_client_date_idx on public.glass_calls (client_id, usage_date);
create index glass_calls_conversation_idx on public.glass_calls (conversation_id);

alter table public.client_glass enable row level security;
alter table public.glass_calls  enable row level security;

create policy client_glass_read on public.client_glass for select to authenticated
  using ((select app.has_perm('analytics.view')) and app.can_access_client(client_id));
create policy glass_calls_read on public.glass_calls for select to authenticated
  using ((select app.has_perm('analytics.view')) and app.can_access_client(client_id));

revoke all on public.client_glass, public.glass_calls from anon, authenticated;
-- Not secret_id: where the key lives is nobody's business.
grant select (client_id, key_hint, status, status_detail, checked_at, last_used_at, enabled_at, key_set_at)
  on public.client_glass to authenticated;
grant select on public.glass_calls to authenticated;

-- ── Helpers (not callable from the app) ──────────────────────────────────────

/** Removes the stored key when its row goes, so no orphan stays in the vault. */
create function app.glass_forget_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.secret_id is null then
    return null;
  end if;
  if tg_op = 'DELETE' then
    delete from vault.secrets where id = old.secret_id;
  elsif new.secret_id is distinct from old.secret_id then
    delete from vault.secrets where id = old.secret_id;
  end if;
  return null;
end $$;
create trigger client_glass_forget_secret after delete or update of secret_id on public.client_glass
  for each row execute function app.glass_forget_secret();

create function app.glass_require_manage(p_client_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not ((select app.has_perm('glass.manage')) and app.can_access_client(p_client_id)) then
    raise exception 'You do not have permission to do this' using errcode = '42501';
  end if;
end $$;

-- ── Functions the app calls ──────────────────────────────────────────────────

/** Divigner turns Glass on or off for a client. Turning it off forgets the key; past usage stays. */
create function public.glass_enable(p_client_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select app.is_staff()) then
    raise exception 'You do not have permission to do this' using errcode = '42501';
  end if;
  perform app.glass_require_manage(p_client_id);
  if p_enabled then
    insert into public.client_glass (client_id, enabled_by) values (p_client_id, (select auth.uid()))
    on conflict (client_id) do nothing;
    if found then
      perform app.audit('glass.enabled', 'client', p_client_id::text, p_client_id);
    end if;
  else
    delete from public.client_glass where client_id = p_client_id;
    if found then
      perform app.audit('glass.disabled', 'client', p_client_id::text, p_client_id);
    end if;
  end if;
end $$;

/** Stores the client's Glass key, replacing any earlier one. It cannot be read back. */
create function public.glass_set_key(p_client_id uuid, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_key    text := btrim(coalesce(p_key, ''), E' \t\r\n');
  v_secret uuid;
  v_name   text := 'glass:' || p_client_id::text;
begin
  perform app.glass_require_manage(p_client_id);
  if v_key !~ '^[A-Za-z0-9_.-]+$' or length(v_key) not between 20 and 300 then
    raise exception 'That does not look like a Glass Health key. Copy it again from your Glass account.' using errcode = '22023';
  end if;
  perform 1 from public.client_glass g where g.client_id = p_client_id for update;
  if not found then
    raise exception 'Glass Health is not turned on for this client. Ask Divigner to turn it on.' using errcode = '22023';
  end if;

  -- A new secret each time; the trigger on this table then deletes the old one,
  -- so a replaced key is gone rather than kept as a past version.
  v_secret := vault.create_secret(v_key, v_name || ':' || replace(gen_random_uuid()::text, '-', ''), 'Glass Health key for a client');
  update public.client_glass
  set secret_id = v_secret, key_hint = right(v_key, 4), status = 'unchecked', status_detail = null,
      checked_at = null, key_set_by = (select auth.uid()), key_set_at = now()
  where client_id = p_client_id;
  perform app.audit('glass.key_set', 'client', p_client_id::text, p_client_id);
end $$;

/** Forgets the client's Glass key. Glass stays turned on, waiting for a new key. */
create function public.glass_remove_key(p_client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.glass_require_manage(p_client_id);
  update public.client_glass
  set secret_id = null, key_hint = null, status = 'no_key', status_detail = null, checked_at = null,
      key_set_by = null, key_set_at = null
  where client_id = p_client_id and secret_id is not null;
  if found then
    perform app.audit('glass.key_removed', 'client', p_client_id::text, p_client_id);
  end if;
end $$;

-- ── Functions only server functions call ─────────────────────────────────────

/** The client's Glass key, for calling Glass. Server functions only. */
create function public.glass_read_key(p_client_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select d.decrypted_secret
  from public.client_glass g join vault.decrypted_secrets d on d.id = g.secret_id
  where g.client_id = p_client_id
$$;

/** Records what a key check found. */
create function public.glass_set_status(p_client_id uuid, p_status text, p_detail text default null) returns void
language sql security definer set search_path = '' as $$
  update public.client_glass
  set status = p_status, status_detail = left(p_detail, 300), checked_at = now()
  where client_id = p_client_id and secret_id is not null
$$;

/** Records one request to Glass and what it cost, and keeps the connection's status current. */
create function public.glass_record_call(
  p_avatar_id uuid, p_conversation_id text, p_tool_call_id text, p_status text, p_error_code text,
  p_input_tokens integer, p_output_tokens integer, p_duration_ms integer, p_version text, p_request_id text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_client uuid;
  v_zone   text;
  v_in     integer := greatest(coalesce(p_input_tokens, 0), 0);
  v_out    integer := greatest(coalesce(p_output_tokens, 0), 0);
  v_in_rate  integer := app.setting_int('glass.input_cents_per_million', 0);
  v_out_rate integer := app.setting_int('glass.output_cents_per_million', 0);
  v_id     bigint;
begin
  select a.client_id, c.timezone into v_client, v_zone
  from public.avatars a join public.clients c on c.id = a.client_id
  where a.id = p_avatar_id;
  if v_client is null then
    raise exception 'Unknown avatar';
  end if;

  insert into public.glass_calls (client_id, avatar_id, conversation_id, tool_call_id, usage_date, status, error_code,
                                  input_tokens, output_tokens, duration_ms, cost_cents, glass_version, glass_request_id)
  values (v_client, p_avatar_id, p_conversation_id, p_tool_call_id, (now() at time zone v_zone)::date, p_status, p_error_code,
          v_in, v_out, greatest(coalesce(p_duration_ms, 0), 0),
          case when p_status = 'ok' and (v_in_rate > 0 or v_out_rate > 0)
               then round((v_in::numeric * v_in_rate + v_out::numeric * v_out_rate) / 1000000, 4) end,
          p_version, p_request_id)
  returning id into v_id;

  update public.client_glass
  set status = case when p_status = 'ok' then 'ok'
                    when p_error_code = 'invalid_key' then 'invalid'
                    when p_error_code = 'past_due' then 'past_due'
                    else status end,
      status_detail = case when p_status = 'ok' or p_error_code in ('invalid_key', 'past_due') then null else status_detail end,
      checked_at = case when p_status = 'ok' or p_error_code in ('invalid_key', 'past_due') then now() else checked_at end,
      last_used_at = case when p_status = 'ok' then now() else last_used_at end
  where client_id = v_client and secret_id is not null;
  return v_id;
end $$;

-- ── Reports ──────────────────────────────────────────────────────────────────
-- These run as the caller, so row-level security limits them to the clients
-- the caller can see. "questions" counts the requests Glass answered.

create function public.glass_usage_by_day(p_client_id uuid, p_from date, p_to date)
returns table (usage_date date, questions bigint, failed bigint, input_tokens bigint, output_tokens bigint, duration_ms bigint, cost_cents numeric)
language sql stable security invoker set search_path = '' as $$
  select g.usage_date, count(*) filter (where g.status = 'ok'), count(*) filter (where g.status <> 'ok'),
         coalesce(sum(g.input_tokens), 0)::bigint, coalesce(sum(g.output_tokens), 0)::bigint,
         coalesce(sum(g.duration_ms), 0)::bigint, sum(g.cost_cents)
  from public.glass_calls g
  where g.client_id = p_client_id and g.usage_date between p_from and p_to
  group by g.usage_date
  order by g.usage_date
$$;

create function public.glass_usage_by_avatar(p_client_id uuid, p_from date, p_to date)
returns table (avatar_id uuid, questions bigint, failed bigint, input_tokens bigint, output_tokens bigint, duration_ms bigint, cost_cents numeric)
language sql stable security invoker set search_path = '' as $$
  select g.avatar_id, count(*) filter (where g.status = 'ok'), count(*) filter (where g.status <> 'ok'),
         coalesce(sum(g.input_tokens), 0)::bigint, coalesce(sum(g.output_tokens), 0)::bigint,
         coalesce(sum(g.duration_ms), 0)::bigint, sum(g.cost_cents)
  from public.glass_calls g
  where g.client_id = p_client_id and g.usage_date between p_from and p_to
  group by g.avatar_id
$$;

create function public.glass_usage_by_conversation(p_conversation_ids text[])
returns table (conversation_id text, questions bigint, failed bigint, input_tokens bigint, output_tokens bigint, duration_ms bigint, cost_cents numeric)
language sql stable security invoker set search_path = '' as $$
  select g.conversation_id, count(*) filter (where g.status = 'ok'), count(*) filter (where g.status <> 'ok'),
         coalesce(sum(g.input_tokens), 0)::bigint, coalesce(sum(g.output_tokens), 0)::bigint,
         coalesce(sum(g.duration_ms), 0)::bigint, sum(g.cost_cents)
  from public.glass_calls g
  where g.conversation_id = any (p_conversation_ids)
  group by g.conversation_id
$$;

-- ── Who may call what ────────────────────────────────────────────────────────

revoke execute on function
  public.glass_enable(uuid, boolean), public.glass_set_key(uuid, text), public.glass_remove_key(uuid),
  public.glass_read_key(uuid), public.glass_set_status(uuid, text, text),
  public.glass_record_call(uuid, text, text, text, text, integer, integer, integer, text, text),
  public.glass_usage_by_day(uuid, date, date), public.glass_usage_by_avatar(uuid, date, date),
  public.glass_usage_by_conversation(text[])
from public, anon, authenticated;
grant execute on function
  public.glass_enable(uuid, boolean), public.glass_set_key(uuid, text), public.glass_remove_key(uuid),
  public.glass_usage_by_day(uuid, date, date), public.glass_usage_by_avatar(uuid, date, date),
  public.glass_usage_by_conversation(text[])
to authenticated, service_role;
grant execute on function
  public.glass_read_key(uuid), public.glass_set_status(uuid, text, text),
  public.glass_record_call(uuid, text, text, text, text, integer, integer, integer, text, text)
to service_role;
revoke execute on function app.glass_forget_secret(), app.glass_require_manage(uuid) from public, anon, authenticated;
