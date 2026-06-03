-- Streak-Spalten auf profiles. Wir speichern das Datum als DATE in Europe/Zurich
-- (siehe handle_streak_increment), damit ein Streak nicht durch Zeitzonen-
-- Sprünge bricht. current_streak = aktuelle ungebrochene Tage, longest_streak =
-- höchster je erreichter Wert, last_streak_date = letztes Datum, an dem der
-- User eine richtige Antwort gegeben hat.

alter table public.profiles
  add column if not exists current_streak integer not null default 0;

alter table public.profiles
  add column if not exists longest_streak integer not null default 0;

alter table public.profiles
  add column if not exists last_streak_date date;

-- RPC: idempotent pro Tag. Aufruf erfolgt von /api/lesson-answer nach einer
-- richtigen Antwort. Logik:
--   1. heute (Europe/Zurich) bestimmen
--   2. last_streak_date prüfen:
--        - = heute        → nichts tun (Streak schon gezählt)
--        - = heute - 1    → current_streak + 1
--        - sonst / NULL   → Streak auf 1 zurück
--   3. longest_streak nachziehen
--   4. last_streak_date = heute
-- Gibt die neuen Werte zurück, damit der Client direkt eine Toast/Animation
-- zeigen kann, wenn current_streak gestiegen ist.
create or replace function public.bump_streak(p_user_id uuid)
returns table (current_streak integer, longest_streak integer, increased boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  today_zh date := (now() at time zone 'Europe/Zurich')::date;
  prev_date date;
  prev_current integer;
  prev_longest integer;
  next_current integer;
  next_longest integer;
  did_increase boolean := false;
begin
  select p.last_streak_date, p.current_streak, p.longest_streak
    into prev_date, prev_current, prev_longest
    from public.profiles p
    where p.id = p_user_id
    for update;

  if prev_date = today_zh then
    -- Schon heute gezählt — keine Änderung.
    next_current := prev_current;
    next_longest := prev_longest;
  elsif prev_date = today_zh - interval '1 day' then
    next_current := prev_current + 1;
    next_longest := greatest(prev_longest, next_current);
    did_increase := true;
  else
    -- Lücke oder erster Tag.
    next_current := 1;
    next_longest := greatest(prev_longest, next_current);
    did_increase := true;
  end if;

  update public.profiles
    set current_streak = next_current,
        longest_streak = next_longest,
        last_streak_date = today_zh
    where id = p_user_id;

  return query select next_current, next_longest, did_increase;
end;
$$;

grant execute on function public.bump_streak(uuid) to authenticated;
