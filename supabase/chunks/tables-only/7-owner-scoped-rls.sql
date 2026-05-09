-- ===========================================================================
-- Owner-scoped RLS policies
-- ---------------------------------------------------------------------------
-- super_user / owner / admin    → see/edit ALL rows
-- bd / partner                  → see/edit only rows where owner_id = auth.uid()
--
-- Run this in Supabase SQL Editor. Idempotent — safe to re-run.
-- ===========================================================================

-- Helper that returns the caller's role. SECURITY DEFINER lets it read profiles
-- regardless of the caller's RLS, which avoids recursive policy evaluation.
create or replace function public.current_user_role()
returns team_role
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_user_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Replace the wide-open "allow_all_authenticated" policy on each table with
-- two policies: one for admin-level roles, one for owner-scoped roles.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  scoped_tables text[] := array[
    'companies', 'contacts', 'deals', 'leads', 'activities', 'tasks'
  ];
begin
  foreach t in array scoped_tables loop
    execute format('drop policy if exists "allow_all_authenticated" on public.%I', t);
    execute format('drop policy if exists "%I_admin_all" on public.%I', t, t);
    execute format('drop policy if exists "%I_owner_scoped" on public.%I', t, t);

    execute format($f$
      create policy "%I_admin_all" on public.%I
        for all to authenticated
        using (public.current_user_role() in ('super_user', 'owner', 'admin'))
        with check (public.current_user_role() in ('super_user', 'owner', 'admin'))
    $f$, t, t);

    execute format($f$
      create policy "%I_owner_scoped" on public.%I
        for all to authenticated
        using (
          public.current_user_role() in ('bd', 'partner')
          and owner_id = auth.uid()
        )
        with check (
          public.current_user_role() in ('bd', 'partner')
          and owner_id = auth.uid()
        )
    $f$, t, t);
  end loop;
end $$;

-- Tell PostgREST to reload its cached schema so the new policies take effect immediately.
notify pgrst, 'reload schema';
