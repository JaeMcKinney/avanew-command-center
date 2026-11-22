-- ─────────────────────────────────────────────────────────────────────────────
-- Transcripts are the client's own
--
-- What visitors said to a client's avatars is private to that client. Staff
-- (Divigner's, or an agency's) still see every number about a conversation:
-- when it happened, how long it ran, how many turns, which avatar, its ID. They
-- cannot read what was said, the summary of it, or the questions asked in it,
-- until the client allows it, for a limited time, typically for a support
-- issue. The client can end that early, and it ends on its own.
--
-- The grouped list of questions on the Questions page stays visible to staff
-- who answer them: it is how an avatar's knowledge is improved, and it does
-- not say who asked or in which conversation.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.transcript_access (
  client_id  uuid primary key references public.clients (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_by_name text not null default '',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason     text not null default '' check (length(reason) <= 300)
);

alter table public.transcript_access enable row level security;
-- Both sides can see whether access is on, and until when.
create policy transcript_access_read on public.transcript_access
  for select to authenticated using (app.can_access_client(client_id));
revoke all on public.transcript_access from anon, authenticated;
grant select on public.transcript_access to authenticated;

insert into public.permissions (key, side, label, description, sort) values
  ('transcripts.share', 'client', 'Share transcripts with support', 'Let the support team read this client''s transcripts for a limited time, and end that access.', 25);
insert into public.role_permissions (role_id, permission)
select r.id, 'transcripts.share' from public.roles r where r.key = 'client_admin'
on conflict do nothing;

/**
 * Whether the caller may read what was said in a client's conversations.
 * The client's own people may, with the permission. Staff also need the
 * client's standing permission, which runs out.
 */
create function app.can_read_transcripts(p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_perm('transcripts.view')
     and app.can_access_client(p_client_id)
     and (not app.is_staff()
          or exists (select 1 from public.transcript_access t where t.client_id = p_client_id and t.expires_at > now()))
$$;

drop policy transcripts_read on public.transcripts;
create policy transcripts_read on public.transcripts
  for select to authenticated using (app.can_read_transcripts(client_id));

drop policy conversation_insights_read on public.conversation_insights;
create policy conversation_insights_read on public.conversation_insights
  for select to authenticated using (app.can_read_transcripts(client_id));

drop policy questions_read on public.questions;
create policy questions_read on public.questions
  for select to authenticated using (app.can_read_transcripts(client_id));

/** For server functions and screens: may the caller read this client's transcripts right now? */
create function public.can_read_transcripts(p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_read_transcripts(p_client_id)
$$;

/** A client lets its support team read its transcripts for a number of hours. */
create function public.grant_transcript_access(p_client_id uuid, p_hours integer, p_reason text default '')
returns public.transcript_access
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.transcript_access;
  v_name text;
begin
  -- Only the client's own people can give this. Staff cannot give it to themselves.
  if app.is_staff() or app.my_client_id() is distinct from p_client_id or not app.has_perm('transcripts.share') then
    raise exception 'Only the client can allow access to its transcripts' using errcode = '42501';
  end if;
  if p_hours is null or p_hours not in (24, 72, 168, 720) then
    raise exception 'Choose one day, three days, seven days or thirty days' using errcode = '22023';
  end if;
  select coalesce(nullif(trim(p.full_name), ''), p.email) into v_name from public.profiles p where p.id = (select auth.uid());
  insert into public.transcript_access (client_id, granted_by, granted_by_name, granted_at, expires_at, reason)
  values (p_client_id, (select auth.uid()), v_name, now(), now() + make_interval(hours => p_hours), left(trim(coalesce(p_reason, '')), 300))
  on conflict (client_id) do update
    set granted_by = excluded.granted_by, granted_by_name = excluded.granted_by_name, granted_at = excluded.granted_at,
        expires_at = excluded.expires_at, reason = excluded.reason
  returning * into v_row;
  perform app.audit('transcripts.access_granted', 'client', p_client_id::text, p_client_id, jsonb_build_object('hours', p_hours, 'until', v_row.expires_at));
  return v_row;
end $$;

/** Ends that access now. The client can; so can staff, to hand it back. */
create function public.revoke_transcript_access(p_client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.can_access_client(p_client_id)
     or not (app.is_staff() or (app.my_client_id() = p_client_id and app.has_perm('transcripts.share'))) then
    raise exception 'You do not have permission to do this' using errcode = '42501';
  end if;
  delete from public.transcript_access where client_id = p_client_id;
  if found then
    perform app.audit('transcripts.access_ended', 'client', p_client_id::text, p_client_id, '{}');
  end if;
end $$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;
grant execute on function app.agency_brand(public.agencies) to anon;

revoke execute on function
  public.can_read_transcripts(uuid), public.grant_transcript_access(uuid, integer, text), public.revoke_transcript_access(uuid)
from public, anon;
grant execute on function
  public.can_read_transcripts(uuid), public.grant_transcript_access(uuid, integer, text), public.revoke_transcript_access(uuid)
to authenticated, service_role;
