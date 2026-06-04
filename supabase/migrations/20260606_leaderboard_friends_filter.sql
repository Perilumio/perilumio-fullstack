-- Leaderboard Friends-Filter: bestehende RPCs um optionalen Parameter
-- p_friends_only erweitern. Wenn true, wird die Rangliste auf den
-- Freundeskreis des aufrufenden Users plus den User selbst eingeschraenkt.
--
-- Freundschafts-Konvention (siehe 20260523_friendships.sql und die Friends-
-- Page): friendships ist unidirektional (user_id "folgt" friend_id). Fuer den
-- Leaderboard-Filter gilt die gleiche Logik wie auf der Friends-Page: als
-- "Freunde" zaehlen alle friend_id-Eintraege, bei denen user_id = auth.uid()
-- ist, plus der User selbst. Einseitiges Folgen genuegt also; es wird keine
-- beidseitige Freundschaft verlangt. So bleibt die Filter-Semantik mit der
-- bestehenden Friends-Ansicht konsistent.
--
-- Sicherheit: Die Functions bleiben invoker-rights (kein security definer).
-- Dadurch greift die friendships-RLS-Policy "friendships-own-read"
-- (auth.uid() = user_id), und ein User kann ausschliesslich nach den eigenen
-- Freundschaften filtern.
--
-- Idempotent: create or replace; gleiche Signaturen werden ueberschrieben.

-- Helper: Set der fuer den aktuellen User sichtbaren Freundschafts-IDs
-- (Freunde + er selbst). Stable, invoker-rights, damit die friendships-RLS
-- greift.
create or replace function public.friend_scope_ids()
returns table (id uuid)
language sql
stable
as $$
  select auth.uid() as id
  union
  select f.friend_id
  from public.friendships f
  where f.user_id = auth.uid();
$$;

grant execute on function public.friend_scope_ids() to authenticated;

-- 1. leaderboard_xp mit p_friends_only.
create or replace function public.leaderboard_xp(
  p_course_key text default null,
  p_since timestamptz default null,
  p_limit integer default 50,
  p_friends_only boolean default false
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
  with scope as (
    select id from public.friend_scope_ids()
  ),
  summed as (
    select
      e.user_id,
      sum(e.xp_awarded)::bigint as xp_total
    from public.user_course_xp_events e
    where (p_course_key is null or e.course_key = p_course_key)
      and (p_since      is null or e.created_at >= p_since)
      and (not p_friends_only or e.user_id in (select id from scope))
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

grant execute on function public.leaderboard_xp(text, timestamptz, integer, boolean) to authenticated;

-- 2. leaderboard_xp_self mit p_friends_only. total_users zaehlt im Friends-
--    Scope nur Eintraege aus dem Freundeskreis, damit "Rang X von Y Freunden"
--    inhaltlich korrekt ist.
create or replace function public.leaderboard_xp_self(
  p_course_key text default null,
  p_since timestamptz default null,
  p_friends_only boolean default false
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
  with scope as (
    select id from public.friend_scope_ids()
  ),
  summed as (
    select
      e.user_id,
      sum(e.xp_awarded)::bigint as xp_total
    from public.user_course_xp_events e
    where (p_course_key is null or e.course_key = p_course_key)
      and (p_since      is null or e.created_at >= p_since)
      and (not p_friends_only or e.user_id in (select id from scope))
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

grant execute on function public.leaderboard_xp_self(text, timestamptz, boolean) to authenticated;

-- 3. leaderboard_streak mit p_friends_only.
create or replace function public.leaderboard_streak(
  p_limit integer default 50,
  p_friends_only boolean default false
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
  with scope as (
    select id from public.friend_scope_ids()
  ),
  ranked as (
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
      and (not p_friends_only or p.id in (select id from scope))
  )
  select * from ranked
  order by rank asc, coalesce(username, display_name, '') asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.leaderboard_streak(integer, boolean) to authenticated;
