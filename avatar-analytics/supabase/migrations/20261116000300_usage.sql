-- ─────────────────────────────────────────────────────────────────────────────
-- Usage: Tavus events → conversations → daily totals
--
-- Every Tavus event (from a webhook or from the backup check) goes through
-- ingest_tavus_event(). It stores the raw event once, updates the conversation
-- it belongs to, and recomputes that avatar's total for the day. Running it
-- twice with the same event, or with events out of order, gives the same result.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.tavus_events (
  id              bigint generated always as identity primary key,
  event_key       text not null unique,
  conversation_id text not null,
  avatar_id       uuid references public.avatars (id) on delete set null,
  event_type      text not null,
  occurred_at     timestamptz,
  payload         jsonb not null,
  source          text not null check (source in ('webhook', 'backfill')),
  received_at     timestamptz not null default now()
);
create index tavus_events_conversation_idx on public.tavus_events (conversation_id);
create index tavus_events_received_idx on public.tavus_events (received_at desc);

create table public.conversations (
  conversation_id       text primary key,
  avatar_id             uuid not null references public.avatars (id) on delete restrict,
  client_id             uuid not null references public.clients (id) on delete restrict,
  started_at            timestamptz,   -- the avatar joined
  ended_at              timestamptz,   -- the room shut down
  shutdown_reason       text,
  talk_seconds          integer,       -- null until the conversation has ended
  billable_seconds      integer,
  usage_date            date,          -- the day it counts toward, in the client's time zone
  turns                 integer,
  visitor_speech_seconds numeric(10, 2),
  avatar_speech_seconds  numeric(10, 2),
  has_transcript        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index conversations_client_date_idx on public.conversations (client_id, usage_date desc);
create index conversations_avatar_date_idx on public.conversations (avatar_id, usage_date desc);

-- Kept apart from conversations because fewer people may read transcripts.
create table public.transcripts (
  conversation_id text primary key references public.conversations (conversation_id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete restrict,
  turns           jsonb not null,
  created_at      timestamptz not null default now()
);

create table public.usage_daily (
  avatar_id        uuid not null references public.avatars (id) on delete restrict,
  usage_date       date not null,
  client_id        uuid not null references public.clients (id) on delete restrict,
  conversations    integer not null,
  talk_seconds     integer not null,
  billable_seconds integer not null,
  primary key (avatar_id, usage_date)
);
create index usage_daily_client_date_idx on public.usage_daily (client_id, usage_date);

alter table public.tavus_events  enable row level security;
alter table public.conversations enable row level security;
alter table public.transcripts   enable row level security;
alter table public.usage_daily   enable row level security;

create policy tavus_events_read on public.tavus_events
  for select to authenticated using ((select app.has_perm('audit.view')));

create policy conversations_read on public.conversations
  for select to authenticated
  using ((select app.has_perm('analytics.view')) and app.can_access_client(client_id));

create policy transcripts_read on public.transcripts
  for select to authenticated
  using ((select app.has_perm('transcripts.view')) and app.can_access_client(client_id));

create policy usage_daily_read on public.usage_daily
  for select to authenticated
  using ((select app.has_perm('analytics.view')) and app.can_access_client(client_id));

revoke insert, update, delete on public.tavus_events, public.conversations, public.transcripts,
  public.usage_daily from authenticated;

-- ── Ingest ───────────────────────────────────────────────────────────────────

create or replace function app.setting_int(p_key text, p_default integer) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::numeric::integer end
     from public.settings s where s.key = p_key),
    p_default)
$$;

create or replace function app.recompute_usage_day(p_avatar_id uuid, p_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_avatar_id is null or p_date is null then
    return;
  end if;
  -- One recompute at a time per avatar and day.
  perform pg_advisory_xact_lock(hashtextextended(p_avatar_id::text || ':' || p_date::text, 0));

  delete from public.usage_daily where avatar_id = p_avatar_id and usage_date = p_date;

  insert into public.usage_daily (avatar_id, usage_date, client_id, conversations, talk_seconds, billable_seconds)
  select c.avatar_id, c.usage_date, c.client_id, count(*), sum(c.talk_seconds), sum(c.billable_seconds)
  from public.conversations c
  where c.avatar_id = p_avatar_id and c.usage_date = p_date and c.talk_seconds is not null
  group by c.avatar_id, c.usage_date, c.client_id;
end $$;

create or replace function public.ingest_tavus_event(
  p_avatar_id uuid,
  p_payload   jsonb,
  p_source    text default 'webhook'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_conversation_id text := p_payload ->> 'conversation_id';
  v_type            text := p_payload ->> 'event_type';
  v_props           jsonb := coalesce(p_payload -> 'properties', '{}'::jsonb);
  v_at              timestamptz;
  v_key             text;
  v_new_event       boolean;
  v_avatar          public.avatars;
  v_conv            public.conversations;
  v_old_date        date;
  v_timezone        text;
  v_round           integer;
  v_minimum         integer;
  v_talk            integer;
  v_billable        integer;
  v_date            date;
  v_turns           jsonb;
begin
  if v_conversation_id is null or v_type is null then
    raise exception 'Event has no conversation_id or event_type' using errcode = '22023';
  end if;

  begin
    v_at := (p_payload ->> 'timestamp')::timestamptz;
  exception when others then
    v_at := null;
  end;

  -- These happen once per conversation, so the webhook copy and the backup
  -- copy share a key. Anything else can repeat and is keyed by its time too.
  -- system.replica_joined is Tavus's legacy duplicate of system.pal_joined.
  if v_type in ('system.pal_joined', 'system.replica_joined', 'system.shutdown',
                'application.transcription_ready', 'application.perception_analysis') then
    v_key := v_conversation_id || '|' || v_type;
  else
    v_key := v_conversation_id || '|' || v_type || '|' ||
             coalesce(extract(epoch from v_at)::text, p_payload ->> 'timestamp', '') || '|' ||
             coalesce(v_props ->> 'tool_id', '');
  end if;

  select * into v_avatar from public.avatars where id = p_avatar_id;

  insert into public.tavus_events (event_key, conversation_id, avatar_id, event_type, occurred_at, payload, source)
  values (md5(v_key), v_conversation_id, v_avatar.id, v_type, v_at, p_payload, p_source)
  on conflict (event_key) do nothing;
  v_new_event := found;

  -- Events that cannot be matched to a linked avatar are stored but not counted.
  if v_avatar.id is null then
    return jsonb_build_object('stored', v_new_event, 'counted', false, 'conversation_id', v_conversation_id);
  end if;

  if v_new_event then
    update public.avatars
    set last_event_at = greatest(coalesce(last_event_at, '-infinity'), now()),
        webhook_status = case when p_source = 'webhook' then 'active' else webhook_status end,
        webhook_error = case when p_source = 'webhook' then null else webhook_error end
    where id = v_avatar.id;
  end if;

  insert into public.conversations (conversation_id, avatar_id, client_id)
  values (v_conversation_id, v_avatar.id, v_avatar.client_id)
  on conflict (conversation_id) do nothing;

  select * into v_conv from public.conversations where conversation_id = v_conversation_id for update;
  v_old_date := v_conv.usage_date;

  if v_type in ('system.pal_joined', 'system.replica_joined') and v_at is not null then
    v_conv.started_at := least(coalesce(v_conv.started_at, v_at), v_at);
  elsif v_type = 'system.shutdown' then
    v_conv.ended_at := coalesce(v_at, v_conv.ended_at, now());
    v_conv.shutdown_reason := coalesce(v_props ->> 'shutdown_reason', v_conv.shutdown_reason);
  elsif v_type = 'application.transcription_ready' then
    v_turns := v_props -> 'transcript';
    if jsonb_typeof(v_turns) = 'array' then
      select count(*) filter (where t ->> 'role' in ('user', 'assistant')),
             sum(case when t ->> 'role' = 'user' and jsonb_typeof(t -> 'duration') = 'number'
                      then (t ->> 'duration')::numeric end),
             sum(case when t ->> 'role' = 'assistant' and jsonb_typeof(t -> 'duration') = 'number'
                      then (t ->> 'duration')::numeric end)
      into v_conv.turns, v_conv.visitor_speech_seconds, v_conv.avatar_speech_seconds
      from jsonb_array_elements(v_turns) as t;
      v_conv.has_transcript := true;

      insert into public.transcripts (conversation_id, client_id, turns)
      values (v_conversation_id, v_conv.client_id, v_turns)
      on conflict (conversation_id) do update set turns = excluded.turns;
    end if;
  end if;

  -- Talk time is known once the room has shut down. If the avatar never
  -- joined (for example a start-up error), the conversation counts as zero.
  if v_conv.ended_at is null then
    v_talk := null;
  elsif v_conv.started_at is null then
    v_talk := 0;
  else
    v_talk := greatest(0, round(extract(epoch from (v_conv.ended_at - v_conv.started_at)))::integer);
  end if;

  if v_talk is null then
    v_billable := null;
  elsif v_conv.started_at is null then
    v_billable := 0;
  else
    v_round := greatest(app.setting_int('usage.round_to_seconds', 6), 1);
    v_minimum := greatest(app.setting_int('usage.minimum_seconds', 30), 0);
    v_billable := greatest(v_minimum, (round(v_talk::numeric / v_round) * v_round)::integer);
  end if;

  select c.timezone into v_timezone from public.clients c where c.id = v_conv.client_id;
  v_date := (coalesce(v_conv.started_at, v_conv.ended_at) at time zone coalesce(v_timezone, 'UTC'))::date;

  update public.conversations set
    started_at = v_conv.started_at,
    ended_at = v_conv.ended_at,
    shutdown_reason = v_conv.shutdown_reason,
    talk_seconds = v_talk,
    billable_seconds = v_billable,
    usage_date = v_date,
    turns = v_conv.turns,
    visitor_speech_seconds = v_conv.visitor_speech_seconds,
    avatar_speech_seconds = v_conv.avatar_speech_seconds,
    has_transcript = v_conv.has_transcript,
    updated_at = now()
  where conversation_id = v_conversation_id;

  if v_old_date is distinct from v_date then
    perform app.recompute_usage_day(v_conv.avatar_id, v_old_date);
  end if;
  perform app.recompute_usage_day(v_conv.avatar_id, v_date);

  return jsonb_build_object(
    'stored', v_new_event, 'counted', true, 'conversation_id', v_conversation_id,
    'talk_seconds', v_talk, 'billable_seconds', v_billable, 'usage_date', v_date);
end $$;

-- Only server functions ingest events.
revoke execute on function public.ingest_tavus_event(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_tavus_event(uuid, jsonb, text) to service_role;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- ── Reports ──────────────────────────────────────────────────────────────────
-- These run as the caller, so row-level security limits them to the clients
-- the caller can see.

create or replace function public.usage_by_client(p_from date, p_to date)
returns table (client_id uuid, conversations bigint, talk_seconds bigint, billable_seconds bigint)
language sql stable security invoker set search_path = '' as $$
  select u.client_id, sum(u.conversations)::bigint, sum(u.talk_seconds)::bigint, sum(u.billable_seconds)::bigint
  from public.usage_daily u
  where u.usage_date between p_from and p_to
  group by u.client_id
$$;

create or replace function public.usage_by_avatar(p_client_id uuid, p_from date, p_to date)
returns table (avatar_id uuid, conversations bigint, talk_seconds bigint, billable_seconds bigint)
language sql stable security invoker set search_path = '' as $$
  select u.avatar_id, sum(u.conversations)::bigint, sum(u.talk_seconds)::bigint, sum(u.billable_seconds)::bigint
  from public.usage_daily u
  where u.client_id = p_client_id and u.usage_date between p_from and p_to
  group by u.avatar_id
$$;

-- p_client_id null = every client the caller can see.
create or replace function public.usage_by_day(p_client_id uuid, p_from date, p_to date)
returns table (usage_date date, conversations bigint, talk_seconds bigint, billable_seconds bigint)
language sql stable security invoker set search_path = '' as $$
  select u.usage_date, sum(u.conversations)::bigint, sum(u.talk_seconds)::bigint, sum(u.billable_seconds)::bigint
  from public.usage_daily u
  where (p_client_id is null or u.client_id = p_client_id) and u.usage_date between p_from and p_to
  group by u.usage_date
  order by u.usage_date
$$;

revoke execute on function public.usage_by_client(date, date),
  public.usage_by_avatar(uuid, date, date), public.usage_by_day(uuid, date, date) from public, anon;
grant execute on function public.usage_by_client(date, date),
  public.usage_by_avatar(uuid, date, date), public.usage_by_day(uuid, date, date)
  to authenticated, service_role;
