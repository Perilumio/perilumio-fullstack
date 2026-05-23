-- Sublesson Vorbereitung:
--   Die ABU-Lektionen sollen jeweils 100 Fragen umfassen und in fünf
--   Unterlektionen (1/5 … 5/5) zu je 20 Fragen aufgeteilt werden. In der
--   aktuellen Datenstruktur ist jede Unterlektion eine eigene Zeile in
--   `public.lessons`, damit Fortschritt, Versuche und XP-Awards weiterhin
--   pro Unterlektion gespeichert werden.
--
--   Damit die UI eine Unterlektion klar als „x/y" beschriften kann, ergänzen
--   wir zwei optionale Spalten an `public.lessons`. Beide sind NULLABLE und
--   ohne Default – bestehende Lektionen (z. B. alte ABU-Lektionen mit 30
--   Fragen, Strassenbau, KV usw.) bleiben unverändert.
--
--   Wenn der gelieferte 100er-CSV-Katalog in das System eingespielt wird,
--   setzt die zugehörige Daten-Migration sublesson_index/sublesson_total auf
--   die richtigen Werte (1..5 bzw. 5). Bis dahin ist diese Migration nur ein
--   Strukturschritt und ändert keine Inhalte.

begin;

alter table public.lessons
  add column if not exists sublesson_index smallint;

alter table public.lessons
  add column if not exists sublesson_total smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lessons_sublesson_index_ck'
  ) then
    alter table public.lessons
      add constraint lessons_sublesson_index_ck
      check (
        (sublesson_index is null and sublesson_total is null)
        or (
          sublesson_index is not null and sublesson_total is not null
          and sublesson_index between 1 and sublesson_total
          and sublesson_total between 1 and 20
        )
      );
  end if;
end$$;

commit;
