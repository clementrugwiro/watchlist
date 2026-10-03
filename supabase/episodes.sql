-- Run once in the Supabase SQL editor (safe to re-run).
-- Any member of a group that contains a title (or the title's creator) can add episodes.
-- Only the creator can edit or delete episodes.
drop policy if exists e_all on episodes;
drop policy if exists e_ins on episodes;
drop policy if exists e_mod on episodes;
drop policy if exists e_del on episodes;
create policy e_ins on episodes for insert to authenticated with check (
  exists (select 1 from media m where m.id = media_id and m.created_by = auth.uid())
  or exists (select 1 from group_media gm where gm.media_id = episodes.media_id and is_member(gm.group_id)));
create policy e_mod on episodes for update using (
  exists (select 1 from media m where m.id = media_id and m.created_by = auth.uid()));
create policy e_del on episodes for delete using (
  exists (select 1 from media m where m.id = media_id and m.created_by = auth.uid()));
