-- Run once in the Supabase SQL editor (safe to re-run). Existing groups become "anime" groups.
alter table groups add column if not exists media_type text not null default 'anime'
  check (media_type in ('movie','series','cartoon','anime'));

create or replace function enforce_group_type() returns trigger language plpgsql as $$
declare gt text;
begin
  select media_type into gt from groups where id = new.group_id;
  if (select media_type from media where id = new.media_id) is distinct from gt then
    raise exception 'This group only accepts % titles', gt;
  end if;
  return new;
end $$;
drop trigger if exists group_type_check on group_media;
create trigger group_type_check before insert on group_media for each row execute function enforce_group_type();
