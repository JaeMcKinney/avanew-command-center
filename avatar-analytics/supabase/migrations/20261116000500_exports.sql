-- Transcript exports. People build a PDF or ZIP in their browser; to email it
-- to themselves, copy a link, or send it to Dropbox, the file is first put in
-- a private bucket and reached through a link that expires.
--
-- Files live at  exports/<client id>/<user id>/<random id>/<file name>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 52428800, array['application/pdf', 'application/zip'])
on conflict (id) do nothing;

-- A person may only add files under their own folder, for a client whose
-- transcripts they may read. Nobody reads the bucket directly: downloads go
-- through expiring links made by the export-share function.
create policy "exports: add your own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select app.has_perm('transcripts.view'))
    and app.can_access_client(((storage.foldername(name))[1])::uuid)
  );

/** Export files older than the given number of days, for the clean-up job. */
create function public.expired_export_paths(p_days integer default 7)
returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'exports' and o.created_at < now() - make_interval(days => greatest(p_days, 0))
  order by o.created_at
  limit 1000
$$;

revoke execute on function public.expired_export_paths(integer) from public, anon, authenticated;
grant execute on function public.expired_export_paths(integer) to service_role;
