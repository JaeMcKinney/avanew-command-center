-- Billing: packages, each client's subscription, invoices, usage allowance,
-- and the notices sent about them. Stripe holds the money side; this keeps a
-- copy of what the screens need. Prices are data entered by staff, not code.

insert into public.permissions (key, side, label, description, sort) values
  ('billing.view',   'both',     'See billing',
   'See the package, price, usage against the allowance, and invoices.', 26),
  ('billing.manage', 'both',     'Manage billing',
   'Change package, update the payment method, and cancel or resume the subscription.', 27),
  ('plans.manage',   'divigner', 'Manage packages',
   'Create and edit the packages clients can subscribe to, and the usage limit rules.', 55);

insert into public.role_permissions (role_id, permission)
select r.id, p.key from public.roles r cross join public.permissions p
where (r.key = 'client_admin' and p.key in ('billing.view', 'billing.manage'))
   or (r.key = 'admin' and p.key in ('billing.view', 'billing.manage', 'plans.manage'))
   or (r.key = 'manager' and p.key = 'billing.view')
on conflict do nothing;

insert into public.settings (key, value, description) values
  ('usage.alert_percent', '90',
   'Email the client once when this percentage of the period''s included minutes is used.'),
  ('usage.pause_enabled', 'true',
   'Pause a client''s avatars when the included minutes are used up.'),
  ('usage.pause_percent', '100',
   'The percentage of included minutes at which avatars are paused.')
on conflict (key) do nothing;

alter table public.profiles add column phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');
comment on column public.profiles.phone is 'For text-message notices, once a text provider is connected. Not used yet.';

-- ── Packages ─────────────────────────────────────────────────────────────────

create table public.plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) between 1 and 60),
  description         text not null default '' check (length(description) <= 300),
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  currency            text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  included_minutes    integer not null check (included_minutes > 0),
  max_concurrent      integer check (max_concurrent is null or max_concurrent > 0),
  stripe_price_id     text unique check (stripe_price_id is null or stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  is_active           boolean not null default true,
  sort                integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Each client's subscription ───────────────────────────────────────────────

create table public.client_billing (
  client_id              uuid primary key references public.clients (id) on delete cascade,
  plan_id                uuid references public.plans (id) on delete restrict,
  status                 text not null default 'none'
                         check (status in ('none', 'incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'cancelled')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  cancel_requested_at    timestamptz,
  cancel_reason          text check (cancel_reason is null or length(cancel_reason) <= 1000),
  -- Set while avatars are paused because the allowance ran out, with what to put back.
  paused_for_usage_at    timestamptz,
  paused_deployments     jsonb not null default '[]',
  updated_at             timestamptz not null default now()
);

create table public.invoices (
  id                 text primary key,            -- Stripe's invoice id
  client_id          uuid not null references public.clients (id) on delete cascade,
  number             text,
  status             text not null,
  amount_due_cents   integer not null default 0,
  amount_paid_cents  integer not null default 0,
  currency           text not null default 'usd',
  hosted_invoice_url text,
  invoice_pdf        text,
  period_start       timestamptz,
  period_end         timestamptz,
  issued_at          timestamptz not null default now()
);
create index invoices_client_idx on public.invoices (client_id, issued_at desc);

-- Stripe may deliver an event more than once; each is handled once.
create table public.stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- ── Notices ──────────────────────────────────────────────────────────────────
-- One row per notice per person per channel. `period_start` makes "once per
-- billing period" notices (the usage warning) impossible to send twice.

create table public.notifications (
  id           bigint generated always as identity primary key,
  client_id    uuid not null references public.clients (id) on delete cascade,
  kind         text not null,
  channel      text not null check (channel in ('email', 'sms')),
  recipient    text not null,
  status       text not null check (status in ('sent', 'failed', 'skipped')),
  detail       text,
  period_start date not null default '1970-01-01',
  created_at   timestamptz not null default now(),
  unique (client_id, kind, channel, recipient, period_start)
);

alter table public.plans          enable row level security;
alter table public.client_billing enable row level security;
alter table public.invoices       enable row level security;
alter table public.stripe_events  enable row level security;
alter table public.notifications  enable row level security;

-- Anyone signed in can see the packages on offer; staff see retired ones too.
create policy plans_read on public.plans for select to authenticated
  using (is_active or (select app.is_staff()));
create policy plans_insert on public.plans for insert to authenticated
  with check ((select app.has_perm('plans.manage')));
create policy plans_update on public.plans for update to authenticated
  using ((select app.has_perm('plans.manage'))) with check ((select app.has_perm('plans.manage')));

create policy client_billing_read on public.client_billing for select to authenticated
  using ((select app.has_perm('billing.view')) and app.can_access_client(client_id));
create policy invoices_read on public.invoices for select to authenticated
  using ((select app.has_perm('billing.view')) and app.can_access_client(client_id));
create policy notifications_read on public.notifications for select to authenticated
  using ((select app.is_staff()) and (select app.has_perm('billing.view')) and app.can_access_client(client_id));

revoke all on public.plans, public.client_billing, public.invoices, public.stripe_events, public.notifications from anon, authenticated;
grant select on public.plans, public.client_billing, public.invoices, public.notifications to authenticated;
grant insert (name, description, monthly_price_cents, currency, included_minutes, max_concurrent, stripe_price_id, is_active, sort) on public.plans to authenticated;
grant update (name, description, monthly_price_cents, currency, included_minutes, max_concurrent, stripe_price_id, is_active, sort) on public.plans to authenticated;

create function app.touch_plan() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger plans_touch before update on public.plans for each row execute function app.touch_plan();

-- ── The usage period and how much of it is used ──────────────────────────────

/** The billing period a client is in: Stripe's when subscribed, otherwise the calendar month in their time zone. */
create function app.usage_period(p_client_id uuid)
returns table (period_start timestamptz, period_end timestamptz, timezone text)
language sql stable security definer set search_path = '' as $$
  select
    coalesce(b.current_period_start, date_trunc('month', now() at time zone c.timezone) at time zone c.timezone),
    coalesce(b.current_period_end, (date_trunc('month', now() at time zone c.timezone) + interval '1 month') at time zone c.timezone),
    c.timezone
  from public.clients c left join public.client_billing b
    on b.client_id = c.id and b.current_period_end > now() and b.status in ('trialing', 'active', 'past_due')
  where c.id = p_client_id
$$;

create function app.billing_snapshot(p_client_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'client_id', c.id,
    'status', coalesce(b.status, 'none'),
    'plan', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'name', p.name, 'description', p.description, 'monthly_price_cents', p.monthly_price_cents,
      'currency', p.currency, 'included_minutes', p.included_minutes, 'max_concurrent', p.max_concurrent) end,
    'period_start', (per.period_start at time zone per.timezone)::date,
    'period_end', (per.period_end at time zone per.timezone)::date,
    'renews_at', b.current_period_end,
    'cancel_at_period_end', coalesce(b.cancel_at_period_end, false),
    'has_payment_account', b.stripe_customer_id is not null,
    'has_subscription', b.stripe_subscription_id is not null and b.status not in ('none', 'cancelled'),
    'paused_for_usage', b.paused_for_usage_at is not null,
    'used_seconds', u.used,
    'included_seconds', p.included_minutes * 60,
    'used_percent', case when p.included_minutes is null then null
                         else round(u.used * 100.0 / (p.included_minutes * 60), 1) end)
  from public.clients c
  left join public.client_billing b on b.client_id = c.id
  left join public.plans p on p.id = b.plan_id
  cross join lateral app.usage_period(c.id) per
  -- Counted call by call, so a period that starts mid-day is measured from that moment.
  cross join lateral (
    select coalesce(sum(v.billable_seconds), 0)::bigint as used from public.conversations v
    where v.client_id = c.id and coalesce(v.started_at, v.ended_at) >= per.period_start and coalesce(v.started_at, v.ended_at) < per.period_end
  ) u
  where c.id = p_client_id
$$;

/** What the Billing page shows. */
create function public.billing_summary(p_client_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_perm('billing.view') and app.can_access_client(p_client_id)) then
    raise exception 'You do not have permission to see billing' using errcode = '42501';
  end if;
  return app.billing_snapshot(p_client_id);
end $$;

/** For the usage check: every client with a package, and where they stand. Server only. */
create function public.usage_standings() returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select app.billing_snapshot(b.client_id) || jsonb_build_object('client_status', c.status, 'client_name', c.name, 'slug', c.slug)
  from public.client_billing b join public.clients c on c.id = b.client_id
  where b.plan_id is not null and c.status in ('active', 'paused')
$$;

/** The people to tell about a client's billing: their own billing contacts, and Divigner's Owners. */
create function public.billing_contacts(p_client_id uuid)
returns table (email text, phone text, full_name text, side text)
language sql stable security definer set search_path = '' as $$
  select distinct u.email::text, pr.phone, pr.full_name, pr.side
  from public.profiles pr
  join auth.users u on u.id = pr.id
  join public.roles r on r.id = pr.role_id
  where pr.is_active and u.email is not null and (
    (pr.client_id = p_client_id and exists (
       select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission in ('billing.view', 'billing.manage')))
    or (pr.side = 'divigner' and r.key = 'owner'))
$$;

revoke execute on function public.billing_summary(uuid), public.usage_standings(), public.billing_contacts(uuid) from public, anon, authenticated;
grant execute on function public.billing_summary(uuid) to authenticated, service_role;
grant execute on function public.usage_standings(), public.billing_contacts(uuid) to service_role;
