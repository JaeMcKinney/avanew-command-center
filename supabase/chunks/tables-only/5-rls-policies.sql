-- Update is_owner() to include super_user
create or replace function public.is_owner() returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'super_user')
  );
$$;

-- Enable RLS and add permissive policies for all CRM tables
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'companies','contacts','pipeline_stages','deals','activities',
      'leads','tasks','partners','vendors','cashflow_transactions',
      'bank_connections','bank_accounts','bank_transactions',
      'cashflow_sync_logs','role_permissions'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%I authenticated all" on public.%I;', t, t);
    execute format(
      'create policy "%I authenticated all" on public.%I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end$$;
