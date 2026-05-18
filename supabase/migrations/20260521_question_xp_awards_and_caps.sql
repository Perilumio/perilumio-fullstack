-- Per-question XP award tracking + clamp existing impossible scores.
-- Idempotent and safe to re-run.

-- 1. Track which questions have already awarded XP to a user.
create table if not exists public.question_xp_awards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  xp_awarded integer not null default 20,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.question_xp_awards enable row level security;

drop policy if exists "qxp-own-read" on public.question_xp_awards;
create policy "qxp-own-read" on public.question_xp_awards
  for select using (auth.uid() = user_id);

drop policy if exists "qxp-own-write" on public.question_xp_awards;
create policy "qxp-own-write" on public.question_xp_awards
  for insert with check (auth.uid() = user_id);

-- 2. Cap existing impossible scores (>100) in production.
update public.lesson_progress
set best_score = 100
where best_score > 100;

update public.lesson_attempts
set score = 100
where score > 100;

update public.lesson_attempts
set correct_answers = total_questions
where correct_answers > total_questions;

-- 3. Defensive constraints so future inserts can't exceed 100.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lesson_progress_best_score_ck') then
    alter table public.lesson_progress
      add constraint lesson_progress_best_score_ck check (best_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesson_attempts_score_ck') then
    alter table public.lesson_attempts
      add constraint lesson_attempts_score_ck check (score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lesson_attempts_correct_le_total_ck') then
    alter table public.lesson_attempts
      add constraint lesson_attempts_correct_le_total_ck
      check (correct_answers >= 0 and correct_answers <= total_questions);
  end if;
end$$;
