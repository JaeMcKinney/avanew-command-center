-- Extra talk time. A client who is running low can pay a fixed amount for more
-- minutes in the current billing period, without changing package. The price
-- per minute follows their own package, so staff do not keep a second price list.

insert into public.settings (key, value, description) values
  ('billing.topup_amounts_cents', '[1000, 2000, 5000]',
   'The amounts a client can pay for extra minutes, in cents.'),
  ('billing.topup_rate_percent', '100',
   'Price of an extra minute compared with the package''s own price per minute. 100 = the same, 125 = a quarter more.')
on conflict (key) do nothing;

create table public.usage_topups (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  amount_cents      integer not null check (amount_cents > 0),
  currency          text not null default 'usd',
  minutes           integer not null check (minutes > 0),
  status            text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  -- The billing period the minutes belong to. They do not carry over.
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  stripe_session_id text unique,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index usage_topups_client_idx on public.usage_topups (client_id, period_end desc);

alter table public.usage_topups enable row level security;
create policy usage_topups_read on public.usage_topups for select to authenticated
  using ((select app.has_perm('billing.view')) and app.can_access_client(client_id));
revoke all on public.usage_topups from anon, authenticated;
grant select on public.usage_topups to authenticated;

/** What each amount buys for this client right now: [{ amount_cents, minutes }]. Empty without a package. */
create function app.topup_options(p_client_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('amount_cents', a.cents, 'minutes', a.minutes) order by a.cents), '[]'::jsonb)
  from (
    select amount.cents,
           floor(amount.cents::numeric * p.included_minutes * 100
                 / (p.monthly_price_cents * greatest((select (s.value #>> '{}')::numeric from public.settings s where s.key = 'billing.topup_rate_percent'), 1)))::integer as minutes
    from public.client_billing b
    join public.plans p on p.id = b.plan_id and p.monthly_price_cents > 0
    cross join lateral (
      select (v #>> '{}')::integer as cents
      from jsonb_array_elements((select s.value from public.settings s where s.key = 'billing.topup_amounts_cents')) v
    ) amount
    where b.client_id = p_client_id and b.status in ('trialing', 'active', 'past_due')
  ) a
  where a.minutes > 0
$$;

create or replace function app.billing_snapshot(p_client_id uuid) returns jsonb
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
    'extra_minutes', x.minutes,
    'included_seconds', (p.included_minutes + x.minutes) * 60,
    'used_percent', case when p.included_minutes is null then null
                         else round(u.used * 100.0 / ((p.included_minutes + x.minutes) * 60), 1) end,
    'topup_options', app.topup_options(c.id))
  from public.clients c
  left join public.client_billing b on b.client_id = c.id
  left join public.plans p on p.id = b.plan_id
  cross join lateral app.usage_period(c.id) per
  -- Counted call by call, so a period that starts mid-day is measured from that moment.
  cross join lateral (
    select coalesce(sum(v.billable_seconds), 0)::bigint as used from public.conversations v
    where v.client_id = c.id and coalesce(v.started_at, v.ended_at) >= per.period_start and coalesce(v.started_at, v.ended_at) < per.period_end
  ) u
  -- Extra minutes bought during this period. They do not carry into the next one.
  cross join lateral (
    select coalesce(sum(t.minutes), 0)::integer as minutes from public.usage_topups t
    where t.client_id = c.id and t.status = 'paid' and t.created_at >= per.period_start and t.created_at < per.period_end
  ) x
  where c.id = p_client_id
$$;

/** Server only: the offer for one amount, with the period it would apply to. */
create function public.topup_offer(p_client_id uuid, p_amount_cents integer)
returns table (minutes integer, period_start timestamptz, period_end timestamptz, currency text)
language sql stable security definer set search_path = '' as $$
  select (o ->> 'minutes')::integer, per.period_start, per.period_end, coalesce(p.currency, 'usd')
  from jsonb_array_elements(app.topup_options(p_client_id)) o
  cross join lateral app.usage_period(p_client_id) per
  left join public.client_billing b on b.client_id = p_client_id
  left join public.plans p on p.id = b.plan_id
  where (o ->> 'amount_cents')::integer = p_amount_cents
$$;
revoke execute on function public.topup_offer(uuid, integer) from public, anon, authenticated;
grant execute on function public.topup_offer(uuid, integer) to service_role;
