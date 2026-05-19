-- New accounts should start on ABU as their initial active course.
-- This migration:
--   1. Switches the profiles.active_course_key column default to 'abu'.
--   2. Recreates the auth -> profile bridge trigger so new signups land on ABU.
--   3. Backfills only rows that have no active course set (defensive — column is NOT NULL,
--      but this also protects against any future ALTER that drops the NOT NULL).
-- Existing users who already have an active_course_key keep their current value.

alter table public.profiles
  alter column active_course_key set default 'abu';

update public.profiles
set active_course_key = 'abu'
where active_course_key is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_username text;
  meta_display  text;
  base_username text;
  candidate     text;
  i             int := 0;
begin
  meta_display := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  meta_username := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');

  base_username := coalesce(
    nullif(regexp_replace(coalesce(meta_username, ''), '[^A-Za-z0-9_\-\.]', '', 'g'), ''),
    nullif(regexp_replace(coalesce(meta_display, ''),  '[^A-Za-z0-9_\-\.]', '', 'g'), ''),
    'lumio_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  if char_length(base_username) > 24 then
    base_username := substr(base_username, 1, 24);
  end if;
  if char_length(base_username) < 2 then
    base_username := base_username || '__';
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    i := i + 1;
    candidate := substr(base_username, 1, greatest(2, 24 - char_length(i::text) - 1)) || '_' || i::text;
    if i > 50 then
      candidate := 'lumio_' || substr(replace(new.id::text, '-', ''), 1, 8);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, display_name, username, avatar_key, active_course_key)
  values (
    new.id,
    coalesce(meta_display, candidate),
    candidate,
    'lumio',
    'abu'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
