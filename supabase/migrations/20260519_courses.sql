-- Add course concept: per-user active course + per-module course_key.
-- Idempotent and safe to re-run on any environment.

-- 1. profiles.active_course_key with sensible default and validation.
alter table public.profiles
  add column if not exists active_course_key text not null default 'strassenbau';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_active_course_key_ck'
  ) then
    alter table public.profiles
      add constraint profiles_active_course_key_ck
      check (active_course_key in ('strassenbau','abu'));
  end if;
end$$;

-- Backfill any rows that somehow have null (defensive; column is NOT NULL).
update public.profiles
set active_course_key = 'strassenbau'
where active_course_key is null;

-- 2. modules.course_key so content can be filtered per course.
alter table public.modules
  add column if not exists course_key text;

-- Backfill existing modules by title heuristics (idempotent):
--   * "Allgemeinbildung QV" → 'abu'
--   * everything else (incl. "Arbeitssicherheit") → 'strassenbau'
update public.modules
set course_key = case
  when course_key is not null then course_key
  when lower(coalesce(title,'')) like '%allgemeinbildung%' or lower(coalesce(title,'')) like 'abu%' then 'abu'
  else 'strassenbau'
end
where course_key is null;

-- Enforce values once backfilled.
alter table public.modules
  alter column course_key set not null,
  alter column course_key set default 'strassenbau';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'modules_course_key_ck'
  ) then
    alter table public.modules
      add constraint modules_course_key_ck
      check (course_key in ('strassenbau','abu'));
  end if;
end$$;

create index if not exists modules_course_key_idx on public.modules (course_key);

-- 3. Ensure an ABU module exists even if no questions exist yet.
--    We don't seed lessons/questions here — empty state is rendered by the app.
insert into public.modules (title, description, course_key)
select 'Allgemeinbildung QV', 'QV-naher ABU-Kurs für Sprache, Gesellschaft und Alltag.', 'abu'
where not exists (
  select 1 from public.modules where course_key = 'abu'
);

-- 4. Update the auth -> profile bridge to set active_course_key on signup.
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
    'strassenbau'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
