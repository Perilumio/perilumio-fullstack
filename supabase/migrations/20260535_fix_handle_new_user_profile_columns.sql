-- Production incident: an earlier divergent definition of public.handle_new_user()
-- attempted to insert into public.profiles.email — a column that does not exist
-- in this schema. Every Supabase signUp therefore failed with
-- "record \"new\" has no field \"email\"" and no auth.users row was created.
--
-- This migration re-pins handle_new_user() to the canonical definition that
-- matches the actual columns on public.profiles: id, display_name, username,
-- avatar_key, active_course_key. It mirrors the production hotfix migration
-- (fix_handle_new_user_profile_columns) so future `supabase db push` runs
-- cannot reintroduce the bad column.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_username text;
  meta_display  text;
  email_prefix  text;
  base_name     text;
  candidate     text;
  i             int := 0;
begin
  meta_display  := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  meta_username := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  email_prefix  := nullif(split_part(coalesce(new.email, ''), '@', 1), '');

  base_name := coalesce(
    nullif(regexp_replace(coalesce(meta_username,  ''), '[^A-Za-z0-9_\-\.]', '', 'g'), ''),
    nullif(regexp_replace(coalesce(meta_display,   ''), '[^A-Za-z0-9_\-\.]', '', 'g'), ''),
    nullif(regexp_replace(coalesce(email_prefix,   ''), '[^A-Za-z0-9_\-\.]', '', 'g'), ''),
    'lumio_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  if char_length(base_name) > 24 then
    base_name := substr(base_name, 1, 24);
  end if;
  if char_length(base_name) < 2 then
    base_name := base_name || '__';
  end if;

  candidate := base_name;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    i := i + 1;
    candidate := substr(base_name, 1, greatest(2, 24 - char_length(i::text) - 1)) || '_' || i::text;
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
  on conflict (id) do update
    set display_name       = coalesce(public.profiles.display_name,       excluded.display_name),
        username           = coalesce(public.profiles.username,           excluded.username),
        avatar_key         = coalesce(public.profiles.avatar_key,         excluded.avatar_key),
        active_course_key  = coalesce(public.profiles.active_course_key,  excluded.active_course_key);

  return new;
end;
$$;

-- Trigger is already in place from earlier migrations, but recreate defensively
-- so a fresh `supabase db reset` always ends up with the trigger wired to the
-- corrected function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
