-- Add username + avatar_key to profiles.
-- Idempotent and safe to re-run.

-- 1. Columns
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_key text;

-- 2. Backfill username for existing profiles (deterministic from id when display_name is missing/dupes).
-- Strategy: prefer existing display_name (trimmed), strip invalid chars; if empty/too-short, fall back to "lumio_" + first 8 chars of id.
update public.profiles
set username = case
  when username is not null and length(trim(username)) >= 2 then username
  when display_name is not null
       and length(trim(regexp_replace(display_name, '[^A-Za-z0-9_\-\.]', '', 'g'))) between 2 and 24
       then trim(regexp_replace(display_name, '[^A-Za-z0-9_\-\.]', '', 'g'))
  else 'lumio_' || substr(replace(id::text, '-', ''), 1, 8)
end
where username is null or length(trim(username)) < 2;

-- 3. Resolve duplicate usernames (case-insensitive) before applying the unique index.
-- Keeps the oldest profile's username, appends a short id suffix to the rest.
with dupes as (
  select id,
         lower(username) as lname,
         row_number() over (partition by lower(username) order by created_at asc, id asc) as rn
  from public.profiles
  where username is not null
)
update public.profiles p
set username = p.username || '_' || substr(replace(p.id::text, '-', ''), 1, 4)
from dupes d
where p.id = d.id and d.rn > 1;

-- 4. Default avatar_key for existing rows.
update public.profiles
set avatar_key = 'lumio'
where avatar_key is null;

-- 5. Constraints (idempotent via DO blocks / IF NOT EXISTS).
alter table public.profiles
  alter column username set not null,
  alter column avatar_key set not null,
  alter column avatar_key set default 'lumio';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_length_ck'
  ) then
    alter table public.profiles
      add constraint profiles_username_length_ck
      check (char_length(username) between 2 and 24);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_chars_ck'
  ) then
    alter table public.profiles
      add constraint profiles_username_chars_ck
      check (username ~ '^[A-Za-z0-9_\-\.]+$');
  end if;
end$$;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username));

-- 6. Update the auth -> profile bridge trigger to populate new columns on signup.
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
  -- clamp length 2..24
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

  insert into public.profiles (id, display_name, username, avatar_key)
  values (
    new.id,
    coalesce(meta_display, candidate),
    candidate,
    'lumio'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 7. Re-create the leaderboard view to expose username + avatar_key.
create or replace view public.leaderboard as
  select id, display_name, username, avatar_key, xp, level, battle_points, created_at
  from public.profiles;

grant select on public.leaderboard to authenticated;
