-- Run once in the Supabase SQL editor (safe to re-run). Creates the image buckets and permissions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, '{image/jpeg,image/png,image/webp}'),
  ('posters', 'posters', true, 2097152, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;
-- Public buckets: anyone can view files by URL. Writes only inside your own folder (<user id>/...).
drop policy if exists img_insert on storage.objects;
drop policy if exists img_delete on storage.objects;
create policy img_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','posters') and (storage.foldername(name))[1] = auth.uid()::text);
create policy img_delete on storage.objects for delete to authenticated
  using (bucket_id in ('avatars','posters') and (storage.foldername(name))[1] = auth.uid()::text);
