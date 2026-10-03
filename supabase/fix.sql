-- Run once in the Supabase SQL editor (safe to re-run). Fixes "can't add media" caused by a missing profile row.
drop policy if exists p_ins on profiles;
create policy p_ins on profiles for insert to authenticated with check (id = auth.uid());
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
insert into profiles (id, username)
select id, coalesce(nullif(raw_user_meta_data->>'username',''), split_part(email,'@',1)) from auth.users
on conflict (id) do nothing;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update on group_members from authenticated;
grant update (color) on group_members to authenticated;
