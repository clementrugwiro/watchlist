-- Run once in the Supabase SQL editor (safe to re-run).
-- Mixed-type groups, drop cartoon, watch sites, and in-app alerts (new titles + new episodes).

-- 1) Groups can hold anime, movies, and series together
drop trigger if exists group_type_check on group_media;
drop function if exists enforce_group_type();
alter table groups drop column if exists media_type;

-- 2) Cartoons fold into movies (public catalogs almost always file them as films)
update media set media_type = 'movie' where media_type = 'cartoon';
do $$ declare r record;
begin
  for r in select c.conname
    from pg_constraint c
    where c.conrelid = 'media'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%media_type%'
  loop execute format('alter table media drop constraint %I', r.conname); end loop;
end $$;
alter table media add constraint media_media_type_check check (media_type in ('movie','series','anime'));

-- 3) Shared "where to watch" list. Language is french, english, or both. kinds is the media types the site is good for.
create table if not exists watch_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  language text not null check (language in ('french','english','both')),
  kinds text[] not null default '{movie,series,anime}',
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now());
create unique index if not exists watch_sites_url on watch_sites (url);
alter table watch_sites enable row level security;
drop policy if exists ws_read on watch_sites;
drop policy if exists ws_write on watch_sites;
create policy ws_read on watch_sites for select to authenticated using (true);
create policy ws_write on watch_sites for all to authenticated using (true) with check (true);
grant select, insert, update, delete on watch_sites to authenticated;

insert into watch_sites (name, url, language, kinds, created_by) select * from (values
  ('Crunchyroll', 'https://www.crunchyroll.com', 'both', array['anime'], null::uuid),
  ('Animation Digital Network', 'https://animationdigitalnetwork.com', 'french', array['anime'], null),
  ('Netflix', 'https://www.netflix.com', 'both', array['movie','series','anime'], null),
  ('Prime Video', 'https://www.primevideo.com', 'both', array['movie','series','anime'], null),
  ('Disney+', 'https://www.disneyplus.com', 'both', array['movie','series','anime'], null),
  ('Max', 'https://www.max.com', 'english', array['movie','series'], null),
  ('Apple TV', 'https://tv.apple.com', 'both', array['movie','series'], null),
  ('Canal+', 'https://www.canalplus.com', 'french', array['movie','series'], null),
  ('France.tv', 'https://www.france.tv', 'french', array['movie','series'], null)
) as s(name, url, language, kinds, created_by)
where not exists (select 1 from watch_sites) on conflict (url) do nothing;

-- 4) Persistent alerts so the home-screen icon can show a count, and so popups survive a refresh
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('media','episode')),
  title text not null,
  body text not null,
  url text not null,
  group_id uuid references groups(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  created_at timestamptz default now(),
  read_at timestamptz);
create index if not exists alerts_unread on alerts (user_id) where read_at is null;
alter table alerts enable row level security;
drop policy if exists al_read on alerts;
drop policy if exists al_upd on alerts;
create policy al_read on alerts for select to authenticated using (user_id = auth.uid());
create policy al_upd on alerts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on alerts to authenticated;
revoke insert, delete on alerts from authenticated;

create or replace function notify_group_media() returns trigger language plpgsql security definer set search_path = public as $$
declare t text; gname text;
begin
  select title into t from media where id = new.media_id;
  select name into gname from groups where id = new.group_id;
  insert into alerts (user_id, kind, title, body, url, group_id, media_id)
  select gm.user_id, 'media', coalesce(gname, 'Group'),
    coalesce(t, 'A title') || ' was added to the group',
    '/g/' || new.group_id, new.group_id, new.media_id
  from group_members gm
  where gm.group_id = new.group_id
    and gm.user_id is distinct from coalesce(new.added_by, auth.uid());
  return new;
end $$;
drop trigger if exists group_media_alert on group_media;
create trigger group_media_alert after insert on group_media for each row execute function notify_group_media();

-- One alert per viewer per title even if many episodes are inserted in the same statement
create or replace function notify_new_episodes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into alerts (user_id, kind, title, body, url, media_id)
  select u.uid, 'episode', m.title,
    case when c.n = 1 then 'A new episode was added'
         else c.n || ' new episodes were added' end,
    '/m/' || m.id, m.id
  from (select media_id, count(*)::int as n from new_rows group by media_id) c
  join media m on m.id = c.media_id and m.media_type in ('anime','series')
  join lateral (
    select user_id as uid from watchlist where media_id = m.id and status in ('watching','completed')
    union
    select user_id from watch_progress where media_id = m.id and status in ('watching','completed')
  ) u on true
  where u.uid is distinct from auth.uid();
  return null;
end $$;
drop trigger if exists episodes_alert on episodes;
create trigger episodes_alert after insert on episodes
  referencing new table as new_rows
  for each statement execute function notify_new_episodes();

-- Realtime so the open app can show a phone popup
do $$ begin
  alter publication supabase_realtime add table alerts;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table group_media;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table episodes;
exception when duplicate_object then null; when undefined_object then null;
end $$;
