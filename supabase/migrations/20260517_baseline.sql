-- Baseline + leaderboard migration for Perilumio.
-- Safe to run on an empty public schema AND safe to re-run on a fully populated one.
-- All statements are idempotent. No DROP TABLE / DROP COLUMN anywhere.

create extension if not exists pgcrypto;

-- ── profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Lehrling',
  role text not null default 'student' check (role in ('student','admin')),
  xp integer not null default 0,
  level integer not null default 1,
  battle_points integer not null default 0,
  created_at timestamptz not null default now()
);
-- safety nets for older databases that already had profiles without battle_points
alter table public.profiles add column if not exists battle_points integer not null default 0;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.profiles add column if not exists role text not null default 'student';

-- ── content tables ─────────────────────────────────────────────────────────
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  position integer not null,
  pass_score integer not null default 70,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  prompt text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  explanation text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  best_score integer not null default 0,
  passed boolean not null default false,
  last_question_index integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create table if not exists public.lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  score integer not null,
  correct_answers integer not null,
  total_questions integer not null,
  created_at timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_attempts enable row level security;

drop policy if exists "profiles-select-own" on public.profiles;
create policy "profiles-select-own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles-update-own" on public.profiles;
create policy "profiles-update-own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles-leaderboard-read" on public.profiles;
create policy "profiles-leaderboard-read" on public.profiles
  for select to authenticated using (true);

drop policy if exists "modules-readable" on public.modules;
create policy "modules-readable" on public.modules for select using (true);

drop policy if exists "lessons-readable" on public.lessons;
create policy "lessons-readable" on public.lessons for select using (true);

drop policy if exists "questions-readable" on public.questions;
create policy "questions-readable" on public.questions for select using (true);

drop policy if exists "progress-own-read" on public.lesson_progress;
create policy "progress-own-read" on public.lesson_progress
  for select using (auth.uid() = user_id);

drop policy if exists "progress-own-write" on public.lesson_progress;
create policy "progress-own-write" on public.lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "attempts-own-read" on public.lesson_attempts;
create policy "attempts-own-read" on public.lesson_attempts
  for select using (auth.uid() = user_id);

drop policy if exists "attempts-own-write" on public.lesson_attempts;
create policy "attempts-own-write" on public.lesson_attempts
  for insert with check (auth.uid() = user_id);

-- ── auth → profile bridge ─────────────────────────────────────────────────
-- Trigger: every new auth.users row gets a public.profiles row automatically.
-- SECURITY DEFINER + explicit search_path so RLS does not block the insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Lehrling')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: create profiles for any auth.users that pre-date this migration.
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', 'Lehrling')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ── leaderboard view ──────────────────────────────────────────────────────
create or replace view public.leaderboard as
  select id, display_name, xp, level, battle_points, created_at
  from public.profiles;

grant select on public.leaderboard to authenticated;

-- ── seed content (optional, idempotent) ───────────────────────────────────
insert into public.modules (title, description)
values ('Arbeitssicherheit', 'Strassenbau MVP Modul')
on conflict do nothing;

with mod as (
  select id from public.modules where title = 'Arbeitssicherheit' limit 1
)
insert into public.lessons (module_id, title, position, pass_score)
select mod.id, seed.title, seed.position, 70
from mod,
  (values
    ('Einführung in Arbeitssicherheit', 1),
    ('PSA auf der Baustelle',           2),
    ('Baustellenabsicherung',           3),
    ('Verhalten im Gefahrenbereich',    4),
    ('Notfall und Meldung',             5)
  ) as seed(title, position)
on conflict do nothing;
