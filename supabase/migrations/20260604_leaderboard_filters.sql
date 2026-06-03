-- Leaderboard-Filter: Kurs-XP und Zeitfilter performant abfragbar machen.
--
-- Strategie: kein materialisierter View (zu hochfrequent), stattdessen ein
-- normaler View über question_xp_awards JOIN questions JOIN lessons JOIN modules.
-- Damit kann das Leaderboard pro (user_id, course_key, Zeitraum) gefilterte
-- XP-Summen abfragen, ohne dass wir eine zusätzliche Tabelle pflegen müssen.
--
-- Idempotent: drop + create. Indexe sind 'if not exists'.

-- 1. Index, der die Joins beschleunigt. created_at ist der häufigste
--    Filter-Pfad (Zeitraum) plus user_id für die Aggregation.
create index if not exists idx_qxp_user_created
  on public.question_xp_awards (user_id, created_at desc);

-- 2. View, der jedem XP-Award seinen course_key zuordnet. Wird sowohl für
--    Kursfilter als auch für Zeitfilter genutzt — der Leaderboard-Endpoint
--    aggregiert dann mit SUM(xp_awarded) GROUP BY user_id.
create or replace view public.user_course_xp_events as
select
  qxa.user_id,
  qxa.question_id,
  qxa.xp_awarded,
  qxa.created_at,
  l.id as lesson_id,
  m.course_key
from public.question_xp_awards qxa
join public.questions q on q.id = qxa.question_id
join public.lessons   l on l.id = q.lesson_id
join public.modules   m on m.id = l.module_id;

-- 3. RPC für das Leaderboard: gibt Top-N Profile zurück, gefiltert nach
--    Kurs und/oder Zeitraum. Wenn p_course_key NULL ist, wird über alle Kurse
--    summiert. Wenn p_since NULL ist, werden alle Events gezählt.
--    Die Funktion gibt zusätzlich den Rang zurück (1-basiert), damit der
--    Client nicht selbst ranken muss.
--
--    Sicherheit: security definer ist hier NICHT nötig — der View nutzt nur
--    Spalten, die ohnehin lesbar sind (profiles ist read-only-public,
--    question_xp_awards hat RLS auf "own read", aber die Aggregation hier
--    fragt nur Summen ab — keine fremden raw rows werden zurückgegeben).
--    Wir machen die Function trotzdem stable + invoker, damit RLS bei
--    detaillierten Joins greift. Falls in der Praxis RLS die Aggregation
--    blockiert, kann man auf security definer umstellen.
create or replace function public.leaderboard_xp(
  p_course_key text default null,
  p_since timestamptz default null,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_key text,
  level integer,
  current_streak integer,
  xp_total bigint,
  rank integer
)
language sql
stable
as $$
  with summed as (
    select
      e.user_id,
      sum(e.xp_awarded)::bigint as xp_total
    from public.user_course_xp_events e
    where (p_course_key is null or e.course_key = p_course_key)
      and (p_since      is null or e.created_at >= p_since)
    group by e.user_id
  ),
  ranked as (
    select
      s.user_id,
      s.xp_total,
      rank() over (order by s.xp_total desc) as rank
    from summed s
  )
  select
    r.user_id,
    p.username,
    p.display_name,
    p.avatar_key,
    coalesce(p.level, 1) as level,
    coalesce(p.current_streak, 0) as current_streak,
    r.xp_total,
    r.rank::integer
  from ranked r
  join public.profiles p on p.id = r.user_id
  order by r.rank asc, coalesce(p.username, p.display_name, '') asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.leaderboard_xp(text, timestamptz, integer) to authenticated;

-- 4. RPC für die persönliche Position des aktuellen Users — auch wenn er
--    ausserhalb der Top-N ist. Liefert Rang + xp_total für die Sticky-
--    "du"-Karte im Leaderboard.
create or replace function public.leaderboard_xp_self(
  p_course_key text default null,
  p_since timestamptz default null
)
returns table (
  user_id uuid,
  xp_total bigint,
  rank integer,
  total_users integer
)
language sql
stable
as $$
  with summed as (
    select
      e.user_id,
      sum(e.xp_awarded)::bigint as xp_total
    from public.user_course_xp_events e
    where (p_course_key is null or e.course_key = p_course_key)
      and (p_since      is null or e.created_at >= p_since)
    group by e.user_id
  ),
  ranked as (
    select
      s.user_id,
      s.xp_total,
      rank() over (order by s.xp_total desc) as rank,
      count(*) over () as total_users
    from summed s
  )
  select
    r.user_id,
    r.xp_total,
    r.rank::integer,
    r.total_users::integer
  from ranked r
  where r.user_id = auth.uid();
$$;

grant execute on function public.leaderboard_xp_self(text, timestamptz) to authenticated;

-- 5. RPC für das Streak-Ranking. Profile-Spalte current_streak ist schon
--    da, hier nur die Aggregation + Rang. Streak hat keinen Kurs- und keinen
--    Zeitfilter (current_streak ist per Definition "heute aktuell").
create or replace function public.leaderboard_streak(
  p_limit integer default 50
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_key text,
  level integer,
  current_streak integer,
  longest_streak integer,
  rank integer
)
language sql
stable
as $$
  with ranked as (
    select
      p.id as user_id,
      p.username,
      p.display_name,
      p.avatar_key,
      coalesce(p.level, 1) as level,
      coalesce(p.current_streak, 0) as current_streak,
      coalesce(p.longest_streak, 0) as longest_streak,
      rank() over (order by coalesce(p.current_streak, 0) desc, coalesce(p.longest_streak, 0) desc) as rank
    from public.profiles p
    where coalesce(p.current_streak, 0) > 0
  )
  select * from ranked
  order by rank asc, coalesce(username, display_name, '') asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.leaderboard_streak(integer) to authenticated;
