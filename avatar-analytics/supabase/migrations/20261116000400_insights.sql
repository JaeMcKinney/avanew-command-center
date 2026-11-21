-- ─────────────────────────────────────────────────────────────────────────────
-- Conversation insights: a summary of each call, the questions the visitor
-- asked, and an inbox of questions the avatar could not answer well.
--
-- A client answers a question once; the answer is published to the knowledge
-- of every avatar that was asked it (see the knowledge-publish function).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.permissions (key, side, label, description, sort) values
  ('questions.answer', 'both', 'Answer visitor questions',
   'Write answers to questions an avatar could not answer. Answers are added to the avatar''s knowledge.', 25);

insert into public.role_permissions (role_id, permission)
select r.id, 'questions.answer' from public.roles r where r.key in ('admin', 'manager', 'client_admin')
on conflict do nothing;

create table public.conversation_insights (
  conversation_id text primary key references public.conversations (conversation_id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete restrict,
  status          text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  summary         text,
  model           text,
  attempts        integer not null default 0,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index conversation_insights_pending_idx on public.conversation_insights (created_at) where status = 'pending';

-- One row per topic a client's visitors keep asking about without a good answer.
create table public.question_groups (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete restrict,
  question         text not null check (length(trim(question)) between 1 and 500),
  status           text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  answer           text,
  answered_by      uuid references auth.users (id) on delete set null,
  answered_at      timestamptz,
  times_asked      integer not null default 0,
  last_asked_at    timestamptz,
  avatar_ids       uuid[] not null default '{}',
  -- Whether the answer has reached the avatars' knowledge in Tavus.
  knowledge_status text not null default 'none' check (knowledge_status in ('none', 'pending', 'published', 'error')),
  knowledge_error  text,
  created_at       timestamptz not null default now()
);
create index question_groups_client_idx on public.question_groups (client_id, status, last_asked_at desc);

-- Every question a visitor asked, and how well the avatar handled it.
create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.conversations (conversation_id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete restrict,
  avatar_id       uuid not null references public.avatars (id) on delete restrict,
  position        integer not null default 0,
  question        text not null,
  outcome         text not null check (outcome in ('answered', 'weak', 'unanswered')),
  group_id        uuid references public.question_groups (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index questions_conversation_idx on public.questions (conversation_id, position);
create index questions_group_idx on public.questions (group_id);

-- The page of questions and answers Tavus reads for each avatar. Server only.
create table public.avatar_knowledge (
  avatar_id         uuid primary key references public.avatars (id) on delete cascade,
  page_token        text not null unique,
  tavus_document_id text,
  needs_refresh     boolean not null default false,
  published_at      timestamptz,
  last_error        text
);

alter table public.conversation_insights enable row level security;
alter table public.question_groups       enable row level security;
alter table public.questions             enable row level security;
alter table public.avatar_knowledge      enable row level security;

create policy conversation_insights_read on public.conversation_insights
  for select to authenticated
  using ((select app.has_perm('transcripts.view')) and app.can_access_client(client_id));

create policy questions_read on public.questions
  for select to authenticated
  using ((select app.has_perm('transcripts.view')) and app.can_access_client(client_id));

create policy question_groups_read on public.question_groups
  for select to authenticated
  using (((select app.has_perm('transcripts.view')) or (select app.has_perm('questions.answer')))
         and app.can_access_client(client_id));

revoke insert, update, delete on public.conversation_insights, public.question_groups, public.questions from authenticated;
revoke all on public.avatar_knowledge from authenticated;

-- A new transcript queues the conversation for a summary.
create or replace function app.queue_insights() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversation_insights (conversation_id, client_id)
  values (new.conversation_id, new.client_id)
  on conflict (conversation_id) do nothing;
  return new;
end $$;

create trigger transcripts_queue_insights after insert on public.transcripts
  for each row execute function app.queue_insights();

-- Stores what the model found for one conversation. Safe to run again: the
-- conversation's questions are replaced and group counts are recomputed.
--
-- p_questions: [{ "question": "...", "outcome": "answered|weak|unanswered",
--                 "group_id": "<existing group>" | null, "topic": "short canonical wording" }]
create or replace function public.save_conversation_insights(
  p_conversation_id text,
  p_summary text,
  p_questions jsonb,
  p_model text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_conv     public.conversations;
  v_item     jsonb;
  v_outcome  text;
  v_group    uuid;
  v_touched  uuid[];
  v_position integer := 0;
begin
  select * into v_conv from public.conversations where conversation_id = p_conversation_id;
  if not found then
    raise exception 'Unknown conversation' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct q.group_id), '{}') into v_touched
  from public.questions q where q.conversation_id = p_conversation_id and q.group_id is not null;
  delete from public.questions where conversation_id = p_conversation_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    continue when coalesce(trim(v_item ->> 'question'), '') = '';
    v_outcome := case when v_item ->> 'outcome' in ('answered', 'weak', 'unanswered')
                      then v_item ->> 'outcome' else 'answered' end;
    v_group := null;

    if v_outcome <> 'answered' then
      -- Use the suggested group only if it really belongs to this client.
      begin
        select g.id into v_group from public.question_groups g
        where g.id = (v_item ->> 'group_id')::uuid and g.client_id = v_conv.client_id;
      exception when others then
        v_group := null;
      end;
      if v_group is null then
        insert into public.question_groups (client_id, question)
        values (v_conv.client_id, left(coalesce(nullif(trim(v_item ->> 'topic'), ''), trim(v_item ->> 'question')), 500))
        returning id into v_group;
      end if;
      v_touched := v_touched || v_group;
    end if;

    insert into public.questions (conversation_id, client_id, avatar_id, position, question, outcome, group_id)
    values (p_conversation_id, v_conv.client_id, v_conv.avatar_id, v_position,
            left(trim(v_item ->> 'question'), 1000), v_outcome, v_group);
    v_position := v_position + 1;
  end loop;

  update public.question_groups g set
    times_asked = s.n,
    last_asked_at = s.last_at,
    avatar_ids = s.avatars
  from (
    select q.group_id, count(*)::integer as n,
           max(coalesce(c.started_at, c.ended_at, q.created_at)) as last_at,
           array_agg(distinct q.avatar_id) as avatars
    from public.questions q join public.conversations c on c.conversation_id = q.conversation_id
    where q.group_id = any (v_touched)
    group by q.group_id
  ) s
  where g.id = s.group_id;

  -- A group nobody has answered, with no questions left in it, has no reason to exist.
  delete from public.question_groups g
  where g.id = any (v_touched) and g.status = 'open'
    and not exists (select 1 from public.questions q where q.group_id = g.id);

  insert into public.conversation_insights (conversation_id, client_id, status, summary, model, error, updated_at)
  values (p_conversation_id, v_conv.client_id, 'ready', nullif(trim(p_summary), ''), p_model, null, now())
  on conflict (conversation_id) do update
    set status = 'ready', summary = excluded.summary, model = excluded.model, error = null, updated_at = now();
end $$;

create or replace function public.answer_question(p_group_id uuid, p_answer text)
returns public.question_groups
language plpgsql security definer set search_path = '' as $$
declare
  v_group public.question_groups;
begin
  select * into v_group from public.question_groups where id = p_group_id;
  if not found or not (app.has_perm('questions.answer') and app.can_access_client(v_group.client_id)) then
    raise exception 'You do not have permission to answer this question' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_answer, ''))) = 0 then
    raise exception 'Write an answer first' using errcode = '22023';
  end if;
  if length(p_answer) > 4000 then
    raise exception 'Keep the answer under 4,000 characters' using errcode = '22023';
  end if;

  update public.question_groups set
    status = 'answered', answer = trim(p_answer), answered_by = (select auth.uid()), answered_at = now(),
    knowledge_status = 'pending', knowledge_error = null
  where id = p_group_id
  returning * into v_group;

  perform app.audit('question.answered', 'question_group', p_group_id::text, v_group.client_id,
                    jsonb_build_object('question', v_group.question));
  return v_group;
end $$;

-- 'dismissed' hides a question that needs no answer; 'open' puts it back.
create or replace function public.set_question_status(p_group_id uuid, p_status text)
returns public.question_groups
language plpgsql security definer set search_path = '' as $$
declare
  v_group public.question_groups;
begin
  select * into v_group from public.question_groups where id = p_group_id;
  if not found or not (app.has_perm('questions.answer') and app.can_access_client(v_group.client_id)) then
    raise exception 'You do not have permission to change this question' using errcode = '42501';
  end if;
  if p_status not in ('open', 'dismissed') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;

  update public.question_groups set
    status = p_status,
    -- Reopening or dismissing an answered question takes its answer out of the avatars' knowledge.
    knowledge_status = case when v_group.status = 'answered' then 'pending' else knowledge_status end
  where id = p_group_id
  returning * into v_group;
  return v_group;
end $$;

revoke execute on function public.save_conversation_insights(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_conversation_insights(text, text, jsonb, text) to service_role;
revoke execute on function public.answer_question(uuid, text), public.set_question_status(uuid, text) from public, anon;
grant execute on function public.answer_question(uuid, text), public.set_question_status(uuid, text) to authenticated, service_role;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;
