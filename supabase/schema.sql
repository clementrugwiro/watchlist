-- OPTIONAL RESET (wipes data!): uncomment if you already ran the earlier schema.
-- drop table if exists progress, items, category_members, categories, watch_progress, group_media, ratings, episodes, media, group_members, groups, profiles cascade;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null, avatar_url text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table groups (
  id uuid primary key default gen_random_uuid(), name text not null,
  created_by uuid not null references profiles(id) on delete cascade, created_at timestamptz default now());
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  color text not null default '#3B82F6', joined_at timestamptz default now(),
  primary key (group_id, user_id));
create table media (
  id uuid primary key default gen_random_uuid(), title text not null, description text,
  media_type text not null check (media_type in ('movie','series','cartoon','anime')),
  genre text[] default '{}', poster_url text, release_date date,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz default now());
create table episodes (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media(id) on delete cascade,
  season_number integer not null, episode_number integer not null,
  title text, description text, duration_minutes integer, release_date date,
  unique (media_id, season_number, episode_number));
create table ratings (
  user_id uuid references profiles(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  primary key (user_id, media_id));
create table group_media (
  group_id uuid references groups(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned','watching','completed','dropped')),
  added_by uuid references profiles(id) on delete set null, added_at timestamptz default now(),
  primary key (group_id, media_id));
create table watch_progress (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  media_id uuid references media(id) on delete cascade,
  episode_id uuid references episodes(id) on delete set null,
  status text not null default 'watching' check (status in ('not_started','watching','completed','dropped')),
  watched_at timestamptz default now(),
  primary key (group_id, user_id, media_id));

-- helpers (security definer avoids policy recursion)
create or replace function is_member(cat uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members where group_id = cat and user_id = auth.uid()) $$;
create or replace function is_owner(cat uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from groups where id = cat and created_by = auth.uid()) $$;

-- profile row on sign-up (username comes from sign-up metadata)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles (id, username) values (new.id, new.raw_user_meta_data->>'username'); return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- creator joins the group automatically (uses one of the 4 slots)
create or replace function add_owner_member() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into group_members (group_id, user_id) values (new.id, new.created_by); return new; end $$;
create trigger group_owner after insert on groups for each row execute function add_owner_member();

-- max 4 members, enforced in the database
create or replace function enforce_group_limit() returns trigger language plpgsql as $$
begin
  perform 1 from groups where id = new.group_id for update;
  if (select count(*) from group_members where group_id = new.group_id) >= 4 then
    raise exception 'A group can have at most 4 members'; end if;
  return new;
end $$;
create trigger group_limit before insert on group_members for each row execute function enforce_group_limit();

-- row-level security
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table media enable row level security;
alter table episodes enable row level security;
alter table ratings enable row level security;
alter table group_media enable row level security;
alter table watch_progress enable row level security;

create policy p_read on profiles for select to authenticated using (true);
create policy p_upd on profiles for update using (id = auth.uid());
create policy g_read on groups for select using (is_member(id));
create policy g_ins on groups for insert with check (created_by = auth.uid());
create policy g_upd on groups for update using (created_by = auth.uid());
create policy g_del on groups for delete using (created_by = auth.uid());
create policy gm_read on group_members for select using (is_member(group_id));
create policy gm_ins on group_members for insert with check (is_owner(group_id));
create policy gm_del on group_members for delete using (is_owner(group_id) or user_id = auth.uid());
create policy gm_upd on group_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy m_read on media for select to authenticated using (true);
create policy m_ins on media for insert to authenticated with check (created_by = auth.uid());
create policy m_upd on media for update using (created_by = auth.uid());
create policy m_del on media for delete using (created_by = auth.uid());
create policy e_read on episodes for select to authenticated using (true);
create policy e_all on episodes for all
  using (exists (select 1 from media m where m.id = media_id and m.created_by = auth.uid()))
  with check (exists (select 1 from media m where m.id = media_id and m.created_by = auth.uid()));
create policy r_read on ratings for select to authenticated using (true);
create policy r_own on ratings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gmd_all on group_media for all using (is_member(group_id)) with check (is_member(group_id));
create policy wp_read on watch_progress for select using (is_member(group_id));
create policy wp_own on watch_progress for all
  using (user_id = auth.uid() and is_member(group_id)) with check (user_id = auth.uid() and is_member(group_id));

-- API grants; members may change only their own color
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update on group_members from authenticated;
grant update (color) on group_members to authenticated;
