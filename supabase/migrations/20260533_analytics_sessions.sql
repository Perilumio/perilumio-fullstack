-- Analytics sessions for Perilumio.
-- Tracks per-user app visits: frequency, duration, page views.
-- Datensparsam: only user_id + timestamps + counters. No IPs, no user agents.
-- Idempotent and safe to re-run.

-- ── analytics_sessions ────────────────────────────────────────────────────
create table if not exists public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  page_views integer not null default 1,
  active_course_key text,
  created_at timestamptz not null default now()
);

-- safety nets in case the table already existed without these columns
alter table public.analytics_sessions add column if not exists user_id uuid;
alter table public.analytics_sessions add column if not exists started_at timestamptz not null default now();
alter table public.analytics_sessions add column if not exists last_seen_at timestamptz not null default now();
alter table public.analytics_sessions add column if not exists ended_at timestamptz;
alter table public.analytics_sessions add column if not exists duration_seconds integer not null default 0;
alter table public.analytics_sessions add column if not exists page_views integer not null default 1;
alter table public.analytics_sessions add column if not exists active_course_key text;
alter table public.analytics_sessions add column if not exists created_at timestamptz not null default now();

create index if not exists analytics_sessions_user_idx on public.analytics_sessions (user_id, started_at desc);
create index if not exists analytics_sessions_last_seen_idx on public.analytics_sessions (last_seen_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.analytics_sessions enable row level security;

drop policy if exists "analytics-sessions-own-read"   on public.analytics_sessions;
drop policy if exists "analytics-sessions-own-insert" on public.analytics_sessions;
drop policy if exists "analytics-sessions-own-update" on public.analytics_sessions;
drop policy if exists "analytics-sessions-admin-read" on public.analytics_sessions;

-- Users may read and write only their own session rows.
create policy "analytics-sessions-own-read"
  on public.analytics_sessions for select
  using (auth.uid() = user_id);

create policy "analytics-sessions-own-insert"
  on public.analytics_sessions for insert
  with check (auth.uid() = user_id);

create policy "analytics-sessions-own-update"
  on public.analytics_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins may read all sessions for the admin analytics page.
create policy "analytics-sessions-admin-read"
  on public.analytics_sessions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Aggregation view for admin analytics ──────────────────────────────────
-- Per-user aggregates: visit count, total time, avg duration, last activity.
drop view if exists public.analytics_user_summary;
create view public.analytics_user_summary as
  select
    p.id                                                        as user_id,
    p.username,
    p.display_name,
    p.role,
    p.xp,
    p.level,
    p.battle_points,
    p.active_course_key,
    coalesce(s.session_count, 0)                                as session_count,
    coalesce(s.total_seconds, 0)                                as total_seconds,
    coalesce(s.avg_seconds, 0)                                  as avg_seconds,
    coalesce(s.total_page_views, 0)                             as total_page_views,
    s.last_seen_at
  from public.profiles p
  left join (
    select
      user_id,
      count(*)                          as session_count,
      sum(duration_seconds)::int        as total_seconds,
      avg(duration_seconds)::int        as avg_seconds,
      sum(page_views)::int              as total_page_views,
      max(last_seen_at)                 as last_seen_at
    from public.analytics_sessions
    group by user_id
  ) s on s.user_id = p.id;

grant select on public.analytics_user_summary to authenticated;

-- ── Admin progress aggregation view ───────────────────────────────────────
-- Per-user/per-course lesson stats. Used for the "Lernfortschritt" overview.
drop view if exists public.analytics_user_course_progress;
create view public.analytics_user_course_progress as
  select
    lp.user_id,
    m.course_key,
    count(*)                                                as lessons_started,
    sum(case when lp.passed then 1 else 0 end)::int         as lessons_passed,
    avg(lp.best_score)::int                                 as avg_best_score,
    max(lp.updated_at)                                      as last_progress_at
  from public.lesson_progress lp
  join public.lessons  l on l.id = lp.lesson_id
  join public.modules  m on m.id = l.module_id
  group by lp.user_id, m.course_key;

grant select on public.analytics_user_course_progress to authenticated;
