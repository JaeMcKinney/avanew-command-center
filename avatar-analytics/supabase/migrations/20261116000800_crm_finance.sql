-- A light CRM for Divigner staff (a file on every client: details, contacts,
-- notes), the money side of the dashboard, uploaded client logos, and a
-- custom amount for extra minutes.

insert into public.permissions (key, side, label, description, sort) values
  ('crm.manage',   'divigner', 'Keep client files',
   'Add contacts and notes to a client''s file and edit their account details.', 52),
  ('finance.view', 'divigner', 'See revenue and profit',
   'See what clients have paid, monthly recurring revenue, costs and margin.', 56);

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r cross join public.permissions p
where (r.key = 'admin' and p.key in ('crm.manage', 'finance.view')) or (r.key = 'manager' and p.key = 'crm.manage')
on conflict do nothing;

insert into public.settings (key, value, description) values
  ('billing.topup_custom_min_cents', '500', 'Smallest custom amount a client can pay for extra minutes, in cents. 0 turns custom amounts off.'),
  ('billing.topup_custom_max_cents', '50000', 'Largest custom amount a client can pay for extra minutes, in cents.'),
  ('finance.cost_per_minute_cents', '0', 'What a minute of avatar talk time costs Divigner, in cents. Used for the profit estimate.'),
  ('finance.fixed_monthly_cost_cents', '0', 'Fixed monthly costs to set against revenue (platform plans and tools), in cents.')
on conflict (key) do nothing;

-- ── Client file ──────────────────────────────────────────────────────────────

alter table public.clients
  add column website text check (website is null or website ~ '^https?://'),
  add column industry text check (industry is null or length(industry) <= 80),
  add column phone text check (phone is null or length(phone) <= 40),
  add column address text check (address is null or length(address) <= 300),
  add column account_manager_id uuid references auth.users (id) on delete set null;

-- Uploaded logos are served from this project's storage, which is http on a developer's machine.
alter table public.clients drop constraint clients_logo_url_check;
alter table public.clients add constraint clients_logo_url_check check (logo_url is null or logo_url ~ '^https?://');

grant update (website, industry, phone, address, account_manager_id) on public.clients to authenticated;

create table public.client_contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) between 1 and 120),
  title      text check (title is null or length(title) <= 120),
  email      text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone      text check (phone is null or length(phone) <= 40),
  is_primary boolean not null default false,
  notes      text check (notes is null or length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_contacts_client_idx on public.client_contacts (client_id);

create table public.client_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 10000),
  kind       text not null default 'note' check (kind in ('note', 'call', 'meeting', 'email', 'task')),
  pinned     boolean not null default false,
  author_id  uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

alter table public.client_contacts enable row level security;
alter table public.client_notes    enable row level security;

-- The file is for staff only. Clients never see it.
create policy client_contacts_read on public.client_contacts for select to authenticated
  using ((select app.is_staff()) and app.can_access_client(client_id));
create policy client_contacts_write on public.client_contacts for all to authenticated
  using ((select app.has_perm('crm.manage')) and app.can_access_client(client_id))
  with check ((select app.has_perm('crm.manage')) and app.can_access_client(client_id));
create policy client_notes_read on public.client_notes for select to authenticated
  using ((select app.is_staff()) and app.can_access_client(client_id));
create policy client_notes_insert on public.client_notes for insert to authenticated
  with check ((select app.has_perm('crm.manage')) and app.can_access_client(client_id) and author_id = (select auth.uid()));
-- A note can be changed or removed by whoever wrote it, or by someone who manages the team.
create policy client_notes_update on public.client_notes for update to authenticated
  using ((select app.has_perm('crm.manage')) and app.can_access_client(client_id) and (author_id = (select auth.uid()) or (select app.has_perm('team.manage'))))
  with check ((select app.has_perm('crm.manage')) and app.can_access_client(client_id));
create policy client_notes_delete on public.client_notes for delete to authenticated
  using ((select app.has_perm('crm.manage')) and app.can_access_client(client_id) and (author_id = (select auth.uid()) or (select app.has_perm('team.manage'))));

revoke all on public.client_contacts, public.client_notes from anon, authenticated;
grant select, delete on public.client_contacts, public.client_notes to authenticated;
grant insert (client_id, full_name, title, email, phone, is_primary, notes, created_by) on public.client_contacts to authenticated;
grant update (full_name, title, email, phone, is_primary, notes, updated_at) on public.client_contacts to authenticated;
grant insert (client_id, body, kind, pinned, author_id) on public.client_notes to authenticated;
grant update (body, kind, pinned, updated_at) on public.client_notes to authenticated;

/** One row per client for the CRM list: account details, package, people and latest activity. */
create function public.crm_clients() returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'slug', c.slug, 'status', c.status, 'logo_url', c.logo_url, 'brand_color', c.brand_color,
    'website', c.website, 'industry', c.industry, 'phone', c.phone, 'created_at', c.created_at,
    'account_manager', (select pr.full_name from public.profiles pr where pr.id = c.account_manager_id),
    'plan', p.name, 'monthly_price_cents', case when b.status in ('trialing', 'active', 'past_due') and not b.cancel_at_period_end then p.monthly_price_cents else 0 end,
    'billing_status', coalesce(b.status, 'none'), 'cancel_at_period_end', coalesce(b.cancel_at_period_end, false), 'renews_at', b.current_period_end,
    'avatars', (select count(*) from public.avatars a where a.client_id = c.id and a.unlinked_at is null),
    'users', (select count(*) from public.profiles pr where pr.client_id = c.id and pr.is_active),
    'contacts', (select count(*) from public.client_contacts cc where cc.client_id = c.id),
    'primary_contact', (select jsonb_build_object('full_name', cc.full_name, 'email', cc.email, 'phone', cc.phone)
                        from public.client_contacts cc where cc.client_id = c.id order by cc.is_primary desc, cc.created_at limit 1),
    'notes', (select count(*) from public.client_notes n where n.client_id = c.id),
    'last_note_at', (select max(n.created_at) from public.client_notes n where n.client_id = c.id),
    'minutes_30d', (select coalesce(sum(d.billable_seconds), 0) / 60 from public.usage_daily d where d.client_id = c.id and d.usage_date >= current_date - 30),
    'last_call_at', (select max(coalesce(v.ended_at, v.started_at)) from public.conversations v where v.client_id = c.id),
    'paid_cents', (select coalesce(sum(i.amount_paid_cents), 0) from public.invoices i where i.client_id = c.id and i.status = 'paid')
                  + (select coalesce(sum(t.amount_cents), 0) from public.usage_topups t where t.client_id = c.id and t.status = 'paid'))
  from public.clients c
  left join public.client_billing b on b.client_id = c.id
  left join public.plans p on p.id = b.plan_id
  where app.is_staff() and app.can_access_client(c.id)
  order by c.name
$$;

-- ── Money ────────────────────────────────────────────────────────────────────

/** Revenue, cost and margin by month and by client between two dates, plus what recurs each month today. */
create function public.finance_summary(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cost_per_minute numeric;
  v_fixed numeric;
  v_result jsonb;
begin
  if not app.has_perm('finance.view') then
    raise exception 'You do not have permission to see finances' using errcode = '42501';
  end if;
  select coalesce((value #>> '{}')::numeric, 0) into v_cost_per_minute from public.settings where key = 'finance.cost_per_minute_cents';
  select coalesce((value #>> '{}')::numeric, 0) into v_fixed from public.settings where key = 'finance.fixed_monthly_cost_cents';

  with months as (
    select generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month')::date as month
  ),
  subscription as (
    select date_trunc('month', i.issued_at)::date as month, i.client_id, sum(i.amount_paid_cents) as cents
    from public.invoices i where i.status = 'paid' and i.issued_at::date between p_from and p_to group by 1, 2
  ),
  extra as (
    select date_trunc('month', t.paid_at)::date as month, t.client_id, sum(t.amount_cents) as cents, sum(t.minutes) as minutes
    from public.usage_topups t where t.status = 'paid' and t.paid_at::date between p_from and p_to group by 1, 2
  ),
  usage as (
    select date_trunc('month', d.usage_date)::date as month, d.client_id, sum(d.billable_seconds) / 60.0 as minutes
    from public.usage_daily d where d.usage_date between p_from and p_to group by 1, 2
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

revoke execute on function public.crm_clients(), public.finance_summary(date, date) from public, anon;
grant execute on function public.crm_clients(), public.finance_summary(date, date) to authenticated, service_role;

-- ── Uploaded client logos ────────────────────────────────────────────────────
-- Public to read (they appear on transcripts and in the portal); only staff
-- who manage clients can add or replace them. Files: logos/<client id>/<id>.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png'])
on conflict (id) do nothing;

create policy "logos: staff add" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (select app.has_perm('clients.manage')) and app.can_access_client(((storage.foldername(name))[1])::uuid));

-- ── Extra minutes for any amount ─────────────────────────────────────────────

create or replace function public.topup_offer(p_client_id uuid, p_amount_cents integer)
returns table (minutes integer, period_start timestamptz, period_end timestamptz, currency text)
language sql stable security definer set search_path = '' as $$
  with rule as (
    select
      greatest((select (s.value #>> '{}')::numeric from public.settings s where s.key = 'billing.topup_rate_percent'), 1) as rate,
      (select (s.value #>> '{}')::integer from public.settings s where s.key = 'billing.topup_custom_min_cents') as min_cents,
      (select (s.value #>> '{}')::integer from public.settings s where s.key = 'billing.topup_custom_max_cents') as max_cents,
      exists (select 1 from jsonb_array_elements((select s.value from public.settings s where s.key = 'billing.topup_amounts_cents')) v
              where (v #>> '{}')::integer = p_amount_cents) as listed
  )
  select floor(p_amount_cents::numeric * p.included_minutes * 100 / (p.monthly_price_cents * rule.rate))::integer,
         per.period_start, per.period_end, p.currency
  from public.client_billing b
  join public.plans p on p.id = b.plan_id and p.monthly_price_cents > 0
  cross join rule
  cross join lateral app.usage_period(p_client_id) per
  where b.client_id = p_client_id and b.status in ('trialing', 'active', 'past_due')
    -- A listed amount, or a whole-dollar amount inside the custom range.
    and (rule.listed or (rule.min_cents > 0 and p_amount_cents between rule.min_cents and rule.max_cents and p_amount_cents % 100 = 0))
    and floor(p_amount_cents::numeric * p.included_minutes * 100 / (p.monthly_price_cents * rule.rate)) > 0
$$;

/** For the Billing page: the custom range and what a dollar buys, or null when custom amounts are off. */
create function public.topup_custom_rule(p_client_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when app.has_perm('billing.view') and app.can_access_client(p_client_id) then (
    select jsonb_build_object(
      'min_cents', (select (s.value #>> '{}')::integer from public.settings s where s.key = 'billing.topup_custom_min_cents'),
      'max_cents', (select (s.value #>> '{}')::integer from public.settings s where s.key = 'billing.topup_custom_max_cents'),
      'minutes_per_dollar', p.included_minutes * 10000.0 / (p.monthly_price_cents
          * greatest((select (s.value #>> '{}')::numeric from public.settings s where s.key = 'billing.topup_rate_percent'), 1)),
      'currency', p.currency)
    from public.client_billing b join public.plans p on p.id = b.plan_id and p.monthly_price_cents > 0
    where b.client_id = p_client_id and b.status in ('trialing', 'active', 'past_due')
      and (select (s.value #>> '{}')::integer from public.settings s where s.key = 'billing.topup_custom_min_cents') > 0
  ) end
$$;
revoke execute on function public.topup_custom_rule(uuid) from public, anon;
grant execute on function public.topup_custom_rule(uuid) to authenticated, service_role;
