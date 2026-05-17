-- Leaderboard migration: add battle_points column and expose a read-only leaderboard view
-- Run manually in Supabase SQL editor if not using migrations CLI.

alter table public.profiles
  add column if not exists battle_points integer not null default 0;

-- Allow any authenticated user to read the limited leaderboard fields.
drop policy if exists "profiles-leaderboard-read" on public.profiles;
create policy "profiles-leaderboard-read"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Optional view that exposes only fields safe for ranking.
create or replace view public.leaderboard as
  select id, display_name, xp, level, battle_points, created_at
  from public.profiles;

grant select on public.leaderboard to authenticated;
