-- Run once in the Supabase SQL editor (safe to re-run). Also run v7.sql if you have not yet.
alter table media add column if not exists anilist_id integer;
alter table media add column if not exists mal_status text;
