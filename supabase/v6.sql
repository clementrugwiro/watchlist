-- Run once in the Supabase SQL editor (safe to re-run).
-- 1) Completed titles, independent of any group
create table if not exists user_media (
  user_id uuid references profiles(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  completed_at timestamptz default now(),
  primary key (user_id, media_id));
alter table user_media enable row level security;
drop policy if exists um_own on user_media;
create policy um_own on user_media for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on user_media to authenticated;
create or replace function sync_completed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' then
    insert into user_media (user_id, media_id) values (new.user_id, new.media_id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists wp_completed on watch_progress;
create trigger wp_completed after insert or update of status on watch_progress for each row execute function sync_completed();
insert into user_media (user_id, media_id) select user_id, media_id from watch_progress where status = 'completed' on conflict do nothing;

-- 2) Editing media + Jikan link
alter table media add column if not exists mal_id integer;
alter table media add column if not exists synced_at timestamptz;
drop policy if exists m_upd on media;
create policy m_upd on media for update using (
  created_by = auth.uid()
  or exists (select 1 from group_media gm where gm.media_id = media.id and is_member(gm.group_id)));
create or replace function lock_media_type() returns trigger language plpgsql as $$
begin
  if new.media_type is distinct from old.media_type and exists (select 1 from group_media where media_id = old.id) then
    raise exception 'The type cannot change while the title is in a group'; end if;
  return new;
end $$;
drop trigger if exists media_type_lock on media;
create trigger media_type_lock before update of media_type on media for each row execute function lock_media_type();
