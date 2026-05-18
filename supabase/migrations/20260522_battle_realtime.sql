-- Real-time 2-player Quizbattle: matches + answers tables.
-- Idempotent and safe to re-run on any environment.

-- ── battle_matches ─────────────────────────────────────────────────────────
create table if not exists public.battle_matches (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  status text not null default 'waiting'
    check (status in ('waiting','active','finished','cancelled')),
  player1_id uuid not null references public.profiles(id) on delete cascade,
  player2_id uuid references public.profiles(id) on delete cascade,
  question_ids jsonb not null default '[]'::jsonb,
  question_count integer not null default 0,
  current_question_index integer not null default 0,
  player1_score integer not null default 0,
  player2_score integer not null default 0,
  bp_awarded boolean not null default false,
  winner_id uuid references public.profiles(id) on delete set null,
  result text check (result in ('player1','player2','draw')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_activity_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'battle_matches_course_key_ck') then
    alter table public.battle_matches
      add constraint battle_matches_course_key_ck
      check (course_key in ('strassenbau','abu'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'battle_matches_distinct_players_ck') then
    alter table public.battle_matches
      add constraint battle_matches_distinct_players_ck
      check (player2_id is null or player2_id <> player1_id);
  end if;
end$$;

create index if not exists battle_matches_player1_idx on public.battle_matches (player1_id);
create index if not exists battle_matches_player2_idx on public.battle_matches (player2_id);
create index if not exists battle_matches_status_idx on public.battle_matches (status);
-- Only one waiting match per course (used for matchmaking selection).
create index if not exists battle_matches_waiting_course_idx
  on public.battle_matches (course_key, created_at)
  where status = 'waiting';

-- ── battle_answers ─────────────────────────────────────────────────────────
create table if not exists public.battle_answers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_index integer not null,
  question_id uuid references public.questions(id) on delete set null,
  selected_option text check (selected_option in ('A','B','C','D')),
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, user_id, question_index)
);

create index if not exists battle_answers_match_idx on public.battle_answers (match_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.battle_matches enable row level security;
alter table public.battle_answers enable row level security;

-- Players can read their own matches.
drop policy if exists "battle_matches-read-own" on public.battle_matches;
create policy "battle_matches-read-own" on public.battle_matches
  for select to authenticated
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- Players can read their own answers and their opponent's answers within the same match.
drop policy if exists "battle_answers-read-own-match" on public.battle_answers;
create policy "battle_answers-read-own-match" on public.battle_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.battle_matches m
      where m.id = battle_answers.match_id
        and (m.player1_id = auth.uid() or m.player2_id = auth.uid())
    )
  );

-- Note: All writes to battle_matches and battle_answers go through the service-role API.
-- We intentionally do NOT add INSERT/UPDATE policies for authenticated; the API layer
-- enforces business rules (matchmaking, idempotency, BP awards, etc).
