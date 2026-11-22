-- ─────────────────────────────────────────────────────────────────────────────
-- Agencies
--
-- A third kind of account between Divigner and the end client. Divigner
-- creates an agency; the agency's own staff then run Avalytics for the
-- agency's clients with the same roles and permissions Divigner's staff have,
-- limited to that agency. The app wears the agency's logo and colours for the
-- agency's staff and for the agency's clients.
--
--   * A staff profile (side 'divigner') with agency_id set is agency staff.
--     With agency_id null it is Divigner's own staff.
--   * A client with agency_id set belongs to that agency. Divigner's staff
--     cannot open it or see its name: they see each agency's totals only.
--   * Everything already scoped by app.can_access_client() follows, because
--     that function now also requires the client and the person to share an
--     owner. Tables that were open to all staff are narrowed here.
-- ─────────────────────────────────────────────────────────────────────────────

-- A look is fourteen colours and one switch, nothing else, so a stored look can
-- never carry anything but colours into a page.
create function app.valid_theme(p_theme jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v_mode text;
  v_key text;
  v_value jsonb;
  v_count integer;
begin
  if p_theme is null or jsonb_typeof(p_theme) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(p_theme) k where k not in ('light', 'dark', 'motion')) then return false; end if;
  if jsonb_typeof(p_theme -> 'motion') is distinct from 'boolean' then return false; end if;
  foreach v_mode in array array['light', 'dark'] loop
    if jsonb_typeof(p_theme -> v_mode) is distinct from 'object' then return false; end if;
    v_count := 0;
    for v_key, v_value in select * from jsonb_each(p_theme -> v_mode) loop
      if v_key not in ('background', 'card', 'text', 'action', 'action_text', 'highlight', 'sidebar') then return false; end if;
      if jsonb_typeof(v_value) <> 'string' or (v_value #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
      v_count := v_count + 1;
    end loop;
    if v_count <> 7 then return false; end if;
  end loop;
  return true;
end $$;

create table public.agencies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) between 1 and 120),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  status         text not null default 'active' check (status in ('active', 'paused')),
  -- The address the agency's people sign in at, so the sign-in page can wear its look.
  domain         text unique check (domain is null or (domain = lower(domain) and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and length(domain) <= 253)),
  logo_light_url text check (logo_light_url is null or logo_light_url ~ '^https?://'),
  logo_dark_url  text check (logo_dark_url is null or logo_dark_url ~ '^https?://'),
  icon_url       text check (icon_url is null or icon_url ~ '^https?://'),
  theme          jsonb check (theme is null or app.valid_theme(theme)),
  -- How the agency pays Divigner for Avalytics. The amount is entered in the app.
  payment_model  text check (payment_model is null or payment_model in ('one_time', 'subscription')),
  fee_cents      integer check (fee_cents is null or fee_cents >= 0),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger agencies_touch before update on public.agencies
  for each row execute function app.touch_updated_at();

alter table public.clients  add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.profiles add column agency_id uuid references public.agencies (id) on delete restrict;
create index clients_agency_idx on public.clients (agency_id);
create index profiles_agency_idx on public.profiles (agency_id);
-- A client's user gets the agency from the client; only staff carry one of their own.
alter table public.profiles add constraint profiles_agency_is_staff check (side = 'divigner' or agency_id is null);

-- ── Whose world the caller is in ─────────────────────────────────────────────

/** The agency the caller works for, or whose client they belong to. Null means Divigner's own. */
create function app.my_agency_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(p.agency_id, c.agency_id)
  from public.profiles p left join public.clients c on c.id = p.client_id
  where p.id = (select auth.uid()) and p.is_active
$$;

/** Divigner's own staff: staff who do not belong to an agency. */
create function app.is_divigner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.side = 'divigner' and p.agency_id is null)
$$;

/** Whether a staff member and a client have the same owner: the same agency, or Divigner for both. */
create function app.same_owner(p_user_id uuid, p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.clients c on c.id = p_client_id
    where p.id = p_user_id and p.side = 'divigner' and p.agency_id is not distinct from c.agency_id)
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
        or (p.side = 'divigner'
            and exists (select 1 from public.clients c where c.id = p_client_id and c.agency_id is not distinct from p.agency_id)
            and (
              r.client_scope = 'all'
              or exists (
                select 1 from public.staff_client_assignments a
                where a.user_id = p.id and a.client_id = p_client_id
              )
        ))
      )
  )
$$;

-- ── Permissions ──────────────────────────────────────────────────────────────

insert into public.permissions (key, side, label, description, sort) values
  ('agencies.manage', 'divigner', 'Manage agencies', 'Create agencies, set their look and see what each one uses. Divigner''s own staff only.', 125),
  ('brand.manage',    'divigner', 'Manage the brand', 'Change an agency''s logo and colours.', 126);
insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r cross join (values ('agencies.manage'), ('brand.manage')) p(key)
where r.key = 'admin'
on conflict do nothing;

-- ── Narrowing what used to be open to all staff ──────────────────────────────

-- The team list: your own side of the house only.
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or ((select app.is_staff()) and (
          (side = 'divigner' and agency_id is not distinct from (select app.my_agency_id()))
          or app.can_access_client(client_id)))
    or (client_id is not null
        and client_id = (select app.my_client_id())
        and (select app.has_perm('client_users.manage')))
  );

drop policy staff_assignments_read on public.staff_client_assignments;
create policy staff_assignments_read on public.staff_client_assignments
  for select to authenticated using ((select app.is_staff()) and app.can_access_client(client_id));

-- Roles are shared by everyone, so only Divigner changes them.
drop policy roles_insert on public.roles;
drop policy roles_update on public.roles;
drop policy roles_delete on public.roles;
create policy roles_insert on public.roles
  for insert to authenticated with check ((select app.is_divigner()) and (select app.has_perm('team.manage')) and not is_system);
create policy roles_update on public.roles
  for update to authenticated
  using ((select app.is_divigner()) and (select app.has_perm('team.manage')))
  with check ((select app.is_divigner()) and (select app.has_perm('team.manage')));
create policy roles_delete on public.roles
  for delete to authenticated using ((select app.is_divigner()) and (select app.has_perm('team.manage')));
drop policy role_permissions_insert on public.role_permissions;
drop policy role_permissions_delete on public.role_permissions;
create policy role_permissions_insert on public.role_permissions
  for insert to authenticated with check ((select app.is_divigner()) and (select app.has_perm('team.manage')));
create policy role_permissions_delete on public.role_permissions
  for delete to authenticated using ((select app.is_divigner()) and (select app.has_perm('team.manage')));

-- Settings hold Divigner's own rates and costs.
drop policy settings_read on public.settings;
drop policy settings_update on public.settings;
create policy settings_read on public.settings
  for select to authenticated using ((select app.is_divigner()));
create policy settings_update on public.settings
  for update to authenticated
  using ((select app.is_divigner()) and (select app.has_perm('settings.manage')))
  with check ((select app.is_divigner()) and (select app.has_perm('settings.manage')));

-- The activity log: each owner sees its own.
alter table public.audit_log add column agency_id uuid references public.agencies (id) on delete set null;
create index audit_log_agency_idx on public.audit_log (agency_id, created_at desc);
create function app.audit_set_agency() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.agency_id is null then
    if new.client_id is not null then
      select c.agency_id into new.agency_id from public.clients c where c.id = new.client_id;
    elsif new.actor_id is not null then
      select p.agency_id into new.agency_id from public.profiles p where p.id = new.actor_id;
    end if;
  end if;
  return new;
end $$;
create trigger audit_log_set_agency before insert on public.audit_log
  for each row execute function app.audit_set_agency();
drop policy audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
  for select to authenticated
  using ((select app.is_staff()) and (select app.has_perm('audit.view')) and agency_id is not distinct from (select app.my_agency_id()));

-- The Tavus catalogue: each owner has its own Tavus account, so its own list.
alter table public.tavus_pals        add column agency_id uuid references public.agencies (id) on delete cascade;
alter table public.tavus_deployments add column agency_id uuid references public.agencies (id) on delete cascade;
alter table public.tavus_sync_runs   add column agency_id uuid references public.agencies (id) on delete cascade;
drop policy tavus_pals_read on public.tavus_pals;
create policy tavus_pals_read on public.tavus_pals
  for select to authenticated using ((select app.is_staff()) and agency_id is not distinct from (select app.my_agency_id()));
drop policy tavus_sync_runs_read on public.tavus_sync_runs;
create policy tavus_sync_runs_read on public.tavus_sync_runs
  for select to authenticated using ((select app.is_staff()) and agency_id is not distinct from (select app.my_agency_id()));
drop policy tavus_deployments_read on public.tavus_deployments;
create policy tavus_deployments_read on public.tavus_deployments
  for select to authenticated using (
    ((select app.is_staff()) and agency_id is not distinct from (select app.my_agency_id()))
    or exists (
      select 1 from public.avatars a
      where a.tavus_pal_id = tavus_deployments.pal_id and a.unlinked_at is null and app.can_access_client(a.client_id)
    )
  );
drop policy tavus_events_read on public.tavus_events;
create policy tavus_events_read on public.tavus_events
  for select to authenticated using ((select app.is_divigner()) and (select app.has_perm('audit.view')));

-- Packages: each owner sells its own.
alter table public.plans add column agency_id uuid default app.my_agency_id() references public.agencies (id) on delete cascade;
create index plans_agency_idx on public.plans (agency_id);
drop policy plans_read on public.plans;
drop policy plans_insert on public.plans;
drop policy plans_update on public.plans;
create policy plans_read on public.plans
  for select to authenticated
  using ((is_active or (select app.is_staff())) and agency_id is not distinct from (select app.my_agency_id()));
create policy plans_insert on public.plans
  for insert to authenticated
  with check ((select app.is_staff()) and (select app.has_perm('plans.manage')) and agency_id is not distinct from (select app.my_agency_id()));
create policy plans_update on public.plans
  for update to authenticated
  using ((select app.is_staff()) and (select app.has_perm('plans.manage')) and agency_id is not distinct from (select app.my_agency_id()))
  with check ((select app.is_staff()) and (select app.has_perm('plans.manage')) and agency_id is not distinct from (select app.my_agency_id()));

-- ── Functions that decided staff access on their own ─────────────────────────

create or replace function app.support_side(p_user_id uuid, p_client_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p.side = 'client' and p.client_id = p_client_id and exists (
      select 1 from public.role_permissions rp where rp.role_id = p.role_id and rp.permission = 'support.use') then 'client'
    when p.side = 'divigner' and app.same_owner(p.id, p_client_id) and exists (
      select 1 from public.role_permissions rp where rp.role_id = p.role_id and rp.permission = 'support.manage')
      and (r.client_scope = 'all' or exists (
        select 1 from public.staff_client_assignments a where a.user_id = p.id and a.client_id = p_client_id)) then 'divigner'
  end
  from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = p_user_id and p.is_active
$$;

create or replace function public.support_claim_notifications(p_limit integer default 50)
returns table (message_id uuid, ticket_number bigint, subject text, priority text, body text, author_name text, author_side text,
               client_name text, client_slug text, reply_token text, attachment_count integer, recipients text[])
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with claimed as (
    update public.support_messages m
    set notify_claimed_at = now(), notify_attempts = m.notify_attempts + 1
    where m.id in (
      select x.id from public.support_messages x
      where x.notified_at is null and x.notify_attempts < 3
        and (x.notify_claimed_at is null or x.notify_claimed_at < now() - interval '2 minutes')
      order by x.created_at limit greatest(p_limit, 1) for update skip locked)
    returning m.*
  )
  select c.id, t.number, t.subject, t.priority, c.body, c.author_name, c.author_side, cl.name, cl.slug, s.reply_token,
         jsonb_array_length(c.attachments),
         coalesce((
           select array_agg(distinct lower(p.email))
           from public.profiles p join public.roles r on r.id = p.role_id
           where p.is_active and p.id is distinct from c.author_id and (
             (c.author_side = 'client' and (
                (t.assignee_id is not null and p.id = t.assignee_id and app.support_side(p.id, t.client_id) = 'divigner')
                or ((t.assignee_id is null or app.support_side(t.assignee_id, t.client_id) is null) and app.support_side(p.id, t.client_id) = 'divigner')
                or (t.priority = 'urgent' and p.side = 'divigner' and r.key = 'owner' and app.same_owner(p.id, t.client_id))))
             or (c.author_side = 'divigner' and app.support_side(p.id, t.client_id) = 'client' and (
                p.id = t.opened_by
                or exists (select 1 from public.support_messages o where o.ticket_id = t.id and o.author_id = p.id and o.kind = 'message')
                or not exists (
                  select 1 from public.support_messages o join public.profiles op on op.id = o.author_id
                  where o.ticket_id = t.id and o.author_side = 'client' and o.kind = 'message' and op.is_active)))
           )), '{}')
  from claimed c
  join public.support_tickets t on t.id = c.ticket_id
  join public.clients cl on cl.id = t.client_id
  join public.support_ticket_secrets s on s.ticket_id = t.id
  order by c.created_at;
end $$;

create or replace function public.billing_contacts(p_client_id uuid)
returns table (email text, phone text, full_name text, side text)
language sql stable security definer set search_path = '' as $$
  select distinct u.email::text, pr.phone, pr.full_name, pr.side
  from public.profiles pr
  join auth.users u on u.id = pr.id
  join public.roles r on r.id = pr.role_id
  where pr.is_active and u.email is not null and (
    (pr.client_id = p_client_id and exists (
       select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission in ('billing.view', 'billing.manage')))
    or (pr.side = 'divigner' and r.key = 'owner' and app.same_owner(pr.id, p_client_id)))
$$;

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
    where d.removed_at is null and d.agency_id is not distinct from app.my_agency_id()
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
    where p.removed_at is null and p.agency_id is not distinct from app.my_agency_id()
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

create or replace function public.finance_summary(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cost_per_minute numeric;
  v_fixed numeric;
  v_result jsonb;
begin
  if not (app.is_staff() and app.has_perm('finance.view')) then
    raise exception 'You do not have permission to see finances' using errcode = '42501';
  end if;
  select coalesce((value #>> '{}')::numeric, 0) into v_cost_per_minute from public.settings where key = 'finance.cost_per_minute_cents' and app.my_agency_id() is null;
  select coalesce((value #>> '{}')::numeric, 0) into v_fixed from public.settings where key = 'finance.fixed_monthly_cost_cents' and app.my_agency_id() is null;
  -- An agency's costs are its own; Divigner's are not shown to it.
  v_cost_per_minute := coalesce(v_cost_per_minute, 0);
  v_fixed := coalesce(v_fixed, 0);

  with months as (
    select generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month')::date as month
  ),
  subscription as (
    select date_trunc('month', i.issued_at)::date as month, i.client_id, sum(i.amount_paid_cents) as cents
    from public.invoices i where i.status = 'paid' and i.issued_at::date between p_from and p_to and app.can_access_client(i.client_id) group by 1, 2
  ),
  extra as (
    select date_trunc('month', t.paid_at)::date as month, t.client_id, sum(t.amount_cents) as cents, sum(t.minutes) as minutes
    from public.usage_topups t where t.status = 'paid' and t.paid_at::date between p_from and p_to and app.can_access_client(t.client_id) group by 1, 2
  ),
  usage as (
    select date_trunc('month', d.usage_date)::date as month, d.client_id, sum(d.billable_seconds) / 60.0 as minutes
    from public.usage_daily d where d.usage_date between p_from and p_to and app.can_access_client(d.client_id) group by 1, 2
  ),
  by_month as (
    select m.month,
      coalesce((select sum(cents) from subscription s where s.month = m.month), 0) as subscription_cents,
      coalesce((select sum(cents) from extra e where e.month = m.month), 0) as extra_cents,
      0::numeric as addon_cents,
      coalesce((select sum(minutes) from usage u where u.month = m.month), 0) as minutes
    from months m
  ),
  by_client as (
    select c.id, c.name, c.slug,
      coalesce((select sum(cents) from subscription s where s.client_id = c.id), 0) as subscription_cents,
      coalesce((select sum(cents) from extra e where e.client_id = c.id), 0) as extra_cents,
      coalesce((select sum(minutes) from usage u where u.client_id = c.id), 0) as minutes
    from public.clients c where app.can_access_client(c.id)
  )
  select jsonb_build_object(
    'cost_per_minute_cents', v_cost_per_minute,
    'fixed_monthly_cost_cents', v_fixed,
    'months', coalesce((select jsonb_agg(jsonb_build_object(
        'month', b.month, 'subscription_cents', b.subscription_cents, 'extra_cents', b.extra_cents, 'addon_cents', b.addon_cents,
        'minutes', round(b.minutes), 'usage_cost_cents', round(b.minutes * v_cost_per_minute),
        -- Fixed costs count only in months with any business, so empty months before the first client are not a loss.
        'fixed_cost_cents', case when b.subscription_cents + b.extra_cents + b.minutes > 0 then v_fixed else 0 end) order by b.month) from by_month b), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'subscription_cents', c.subscription_cents, 'extra_cents', c.extra_cents,
        'minutes', round(c.minutes), 'usage_cost_cents', round(c.minutes * v_cost_per_minute)) order by (c.subscription_cents + c.extra_cents) desc, c.name)
      from by_client c where c.subscription_cents + c.extra_cents > 0 or c.minutes > 0), '[]'::jsonb),
    'mrr_cents', (select coalesce(sum(p.monthly_price_cents), 0) from public.client_billing b join public.plans p on p.id = b.plan_id
                  where b.status in ('trialing', 'active', 'past_due') and not b.cancel_at_period_end and app.can_access_client(b.client_id)),
    'ending_mrr_cents', (select coalesce(sum(p.monthly_price_cents), 0) from public.client_billing b join public.plans p on p.id = b.plan_id
                  where b.status in ('trialing', 'active', 'past_due') and b.cancel_at_period_end and app.can_access_client(b.client_id)),
    'subscribers', (select count(*) from public.client_billing b where b.status in ('trialing', 'active', 'past_due') and app.can_access_client(b.client_id)),
    'past_due', (select count(*) from public.client_billing b where b.status in ('past_due', 'unpaid') and app.can_access_client(b.client_id))
  ) into v_result;
  return v_result;
end $$;

-- A new client belongs to whoever creates it: the agency, or Divigner.
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
  v_agency uuid;
begin
  if not (app.is_staff() and app.has_perm('clients.manage')) then
    raise exception 'You do not have permission to create clients' using errcode = '42501';
  end if;

  select r.client_scope, p.agency_id into v_scope, v_agency
  from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = (select auth.uid());

  insert into public.clients (name, slug, timezone, brand_color, logo_url, created_by, agency_id)
  values (trim(p_name), lower(trim(p_slug)), p_timezone, nullif(p_brand_color, ''), nullif(p_logo_url, ''),
          (select auth.uid()), v_agency)
  returning * into v_client;

  -- Someone who only sees assigned clients is assigned to the one they create.
  if v_scope = 'assigned' then
    insert into public.staff_client_assignments (user_id, client_id)
    values ((select auth.uid()), v_client.id);
  end if;

  perform app.audit('client.created', 'client', v_client.id::text, v_client.id,
                    jsonb_build_object('name', v_client.name, 'slug', v_client.slug));
  return v_client;
end $$;

-- Team managers manage their own team only: Divigner's, or their agency's.
create or replace function app.can_manage_user(p_target public.profiles) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_target.side = 'divigner' then
      app.is_staff() and app.has_perm('team.manage') and p_target.agency_id is not distinct from app.my_agency_id()
    else app.has_perm('client_users.manage') and app.can_access_client(p_target.client_id)
  end
$$;

-- Each owner keeps at least one active Owner of its own.
create or replace function app.assert_not_last_owner(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_agency uuid;
begin
  select p.agency_id into v_agency from public.profiles p where p.id = p_user_id;
  if exists (
       select 1 from public.profiles p join public.roles r on r.id = p.role_id
       where p.id = p_user_id and r.key = 'owner' and p.is_active)
     and not exists (
       select 1 from public.profiles p join public.roles r on r.id = p.role_id
       where p.id <> p_user_id and r.key = 'owner' and p.is_active and p.agency_id is not distinct from v_agency) then
    raise exception 'There must always be at least one active Owner' using errcode = '42501';
  end if;
end $$;

create or replace function public.set_staff_assignments(p_user_id uuid, p_client_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app.is_staff() and app.has_perm('team.manage')) then
    raise exception 'You do not have permission to assign clients' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles
                 where id = p_user_id and side = 'divigner' and agency_id is not distinct from app.my_agency_id()) then
    raise exception 'Only your own team can be assigned clients' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_client_ids, '{}')) as x(id)
             where not exists (select 1 from public.clients c where c.id = x.id and c.agency_id is not distinct from app.my_agency_id())) then
    raise exception 'One of those clients is not yours to assign' using errcode = '42501';
  end if;
  delete from public.staff_client_assignments
  where user_id = p_user_id and client_id <> all (coalesce(p_client_ids, '{}'));
  insert into public.staff_client_assignments (user_id, client_id)
  select p_user_id, c from unnest(coalesce(p_client_ids, '{}')) as c
  on conflict do nothing;
  perform app.audit('user.assignments_changed', 'user', p_user_id::text, null,
                    jsonb_build_object('client_ids', coalesce(p_client_ids, '{}')));
end $$;

/** The public face of an agency: its name, logos and look. Nothing private. */
create function app.agency_brand(p_agency public.agencies) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', p_agency.id, 'name', p_agency.name, 'slug', p_agency.slug, 'domain', p_agency.domain,
    'logo_light_url', p_agency.logo_light_url, 'logo_dark_url', p_agency.logo_dark_url, 'icon_url', p_agency.icon_url,
    'theme', p_agency.theme)
$$;

-- Everything the app needs to know about the signed-in user, now with the agency whose look it wears.
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
                         'timezone', c.timezone, 'status', c.status) end,
    'agency', case when a.id is null then null else app.agency_brand(a) end
  )
  from public.profiles p
  join public.roles r on r.id = p.role_id
  left join public.clients c on c.id = p.client_id
  left join public.agencies a on a.id = coalesce(p.agency_id, c.agency_id)
  where p.id = (select auth.uid())
$$;

-- ── Agencies: what the app calls ─────────────────────────────────────────────

alter table public.agencies enable row level security;
-- Divigner's agency managers see every agency; an agency's staff see their own.
create policy agencies_read on public.agencies
  for select to authenticated using (
    ((select app.is_divigner()) and (select app.has_perm('agencies.manage')))
    or ((select app.is_staff()) and id = (select app.my_agency_id()))
  );
revoke all on public.agencies from anon, authenticated;
grant select on public.agencies to authenticated;

/** Divigner's agency managers, or the agency's own staff who may change its brand. */
create function app.can_manage_brand(p_agency_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_divigner() and app.has_perm('agencies.manage'))
      or (app.is_staff() and app.has_perm('brand.manage') and app.my_agency_id() = p_agency_id)
$$;

create function public.create_agency(
  p_name text,
  p_slug text,
  p_domain text default null,
  p_theme jsonb default null,
  p_payment_model text default null,
  p_fee_cents integer default null
) returns public.agencies
language plpgsql security definer set search_path = '' as $$
declare
  v_agency public.agencies;
begin
  if not (app.is_divigner() and app.has_perm('agencies.manage')) then
    raise exception 'You do not have permission to create agencies' using errcode = '42501';
  end if;
  insert into public.agencies (name, slug, domain, theme, payment_model, fee_cents, created_by)
  values (trim(p_name), lower(trim(p_slug)), nullif(lower(trim(coalesce(p_domain, ''))), ''), p_theme,
          nullif(p_payment_model, ''), p_fee_cents, (select auth.uid()))
  returning * into v_agency;
  insert into public.audit_log (actor_id, action, target_type, target_id, detail)
  values ((select auth.uid()), 'agency.created', 'agency', v_agency.id::text, jsonb_build_object('name', v_agency.name, 'slug', v_agency.slug));
  return v_agency;
end $$;

create function public.update_agency(
  p_agency_id uuid,
  p_name text,
  p_domain text,
  p_status text,
  p_payment_model text,
  p_fee_cents integer
) returns public.agencies
language plpgsql security definer set search_path = '' as $$
declare
  v_agency public.agencies;
begin
  if not (app.is_divigner() and app.has_perm('agencies.manage')) then
    raise exception 'You do not have permission to change agencies' using errcode = '42501';
  end if;
  update public.agencies
  set name = trim(p_name), domain = nullif(lower(trim(coalesce(p_domain, ''))), ''), status = p_status,
      payment_model = nullif(p_payment_model, ''), fee_cents = p_fee_cents
  where id = p_agency_id
  returning * into v_agency;
  if v_agency.id is null then
    raise exception 'That agency does not exist' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, detail)
  values ((select auth.uid()), 'agency.updated', 'agency', v_agency.id::text, jsonb_build_object('name', v_agency.name, 'status', v_agency.status));
  return v_agency;
end $$;

/** Saves an agency's look: its colours for the light and dark versions, whether pages move, and its logos. */
create function public.agency_set_brand(
  p_agency_id uuid,
  p_theme jsonb,
  p_logo_light_url text default null,
  p_logo_dark_url text default null,
  p_icon_url text default null
) returns public.agencies
language plpgsql security definer set search_path = '' as $$
declare
  v_agency public.agencies;
begin
  if not app.can_manage_brand(p_agency_id) then
    raise exception 'You do not have permission to change this brand' using errcode = '42501';
  end if;
  if p_theme is not null and not app.valid_theme(p_theme) then
    raise exception 'That look is not valid: every colour must be a six-digit hex colour' using errcode = '22023';
  end if;
  update public.agencies
  set theme = p_theme, logo_light_url = nullif(p_logo_light_url, ''), logo_dark_url = nullif(p_logo_dark_url, ''), icon_url = nullif(p_icon_url, '')
  where id = p_agency_id
  returning * into v_agency;
  if v_agency.id is null then
    raise exception 'That agency does not exist' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, agency_id, detail)
  values ((select auth.uid()), 'agency.brand_changed', 'agency', v_agency.id::text, app.my_agency_id(), '{}');
  return v_agency;
end $$;

/** The look for a sign-in page, by the address it was opened at (or the agency's short name). Open to visitors. */
create function public.brand_for_host(p_host text default null, p_slug text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select app.agency_brand(a)
  from public.agencies a
  where a.status = 'active'
    and ((p_host is not null and a.domain = lower(split_part(p_host, ':', 1)))
         or (p_slug is not null and a.slug = lower(p_slug)))
  order by (a.domain = lower(split_part(coalesce(p_host, ''), ':', 1))) desc nulls last
  limit 1
$$;

/**
 * What each agency uses, for Divigner: counts and totals only. No client or
 * avatar names leave an agency this way.
 */
create function public.agency_usage(p_from date, p_to date) returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_divigner() and app.has_perm('agencies.manage')) then
    raise exception 'You do not have permission to see agencies' using errcode = '42501';
  end if;
  return query
  select jsonb_build_object(
    'id', a.id, 'name', a.name, 'slug', a.slug, 'status', a.status, 'domain', a.domain,
    'payment_model', a.payment_model, 'fee_cents', a.fee_cents, 'created_at', a.created_at,
    'has_brand', a.theme is not null,
    'staff', (select count(*) from public.profiles p where p.agency_id = a.id and p.is_active),
    'clients', (select count(*) from public.clients c where c.agency_id = a.id),
    'active_clients', (select count(*) from public.clients c where c.agency_id = a.id and c.status = 'active'),
    'avatars', (select count(*) from public.avatars v join public.clients c on c.id = v.client_id where c.agency_id = a.id and v.unlinked_at is null),
    'minutes', (select coalesce(sum(d.billable_seconds), 0) / 60 from public.usage_daily d join public.clients c on c.id = d.client_id
                where c.agency_id = a.id and d.usage_date between p_from and p_to),
    'conversations', (select count(*) from public.conversations v join public.clients c on c.id = v.client_id
                      where c.agency_id = a.id and v.started_at::date between p_from and p_to),
    'glass_questions', (select count(*) from public.glass_calls g join public.clients c on c.id = g.client_id
                        where c.agency_id = a.id and g.status = 'ok' and g.usage_date between p_from and p_to),
    'last_call_at', (select max(coalesce(v.ended_at, v.started_at)) from public.conversations v join public.clients c on c.id = v.client_id where c.agency_id = a.id))
  from public.agencies a
  order by a.name;
end $$;

/** One agency's talk time by day, for Divigner. Totals only. */
create function public.agency_usage_by_day(p_agency_id uuid, p_from date, p_to date)
returns table (usage_date date, minutes numeric, conversations bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_divigner() and app.has_perm('agencies.manage')) then
    raise exception 'You do not have permission to see agencies' using errcode = '42501';
  end if;
  return query
  select d.usage_date, round(sum(d.billable_seconds) / 60.0, 1), sum(d.conversations)::bigint
  from public.usage_daily d join public.clients c on c.id = d.client_id
  where c.agency_id = p_agency_id and d.usage_date between p_from and p_to
  group by d.usage_date order by d.usage_date;
end $$;

/** An agency's own staff, for Divigner: the people who run the agency's side. Not its clients' users. */
create function public.agency_staff(p_agency_id uuid)
returns table (id uuid, full_name text, email text, role_name text, is_active boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_divigner() and app.has_perm('agencies.manage')) then
    raise exception 'You do not have permission to see agencies' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.email, r.name, p.is_active, p.created_at
  from public.profiles p join public.roles r on r.id = p.role_id
  where p.agency_id = p_agency_id and p.side = 'divigner'
  order by p.created_at;
end $$;

/** Whether the caller may invite staff into an agency: Divigner's agency managers, or that agency's team managers. */
create function public.can_invite_to_agency(p_agency_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.is_divigner() and app.has_perm('agencies.manage') and exists (select 1 from public.agencies a where a.id = p_agency_id))
      or (app.is_staff() and app.has_perm('team.manage') and app.my_agency_id() = p_agency_id)
$$;

/** The caller's own agency, for server functions. Null for Divigner. */
create function public.my_agency() returns uuid
language sql stable security definer set search_path = '' as $$
  select app.my_agency_id()
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;
grant execute on function app.agency_brand(public.agencies) to anon;

revoke execute on function
  public.create_agency(text, text, text, jsonb, text, integer),
  public.update_agency(uuid, text, text, text, text, integer),
  public.agency_set_brand(uuid, jsonb, text, text, text),
  public.agency_usage(date, date), public.agency_usage_by_day(uuid, date, date), public.agency_staff(uuid),
  public.can_invite_to_agency(uuid), public.my_agency(), public.brand_for_host(text, text)
from public, anon;
grant execute on function
  public.create_agency(text, text, text, jsonb, text, integer),
  public.update_agency(uuid, text, text, text, text, integer),
  public.agency_set_brand(uuid, jsonb, text, text, text),
  public.agency_usage(date, date), public.agency_usage_by_day(uuid, date, date), public.agency_staff(uuid),
  public.can_invite_to_agency(uuid), public.my_agency()
to authenticated, service_role;
grant execute on function public.brand_for_host(text, text) to anon, authenticated, service_role;

-- An agency's logos live beside the client logos, in a folder named for the agency.
create policy "logos: agency brand add" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and app.can_manage_brand(((storage.foldername(name))[1])::uuid));
