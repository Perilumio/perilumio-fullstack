-- Strassenbau-Lernpfad: nutzerfreundliche Titel ohne HK-/sub_hk-Präfixe und
-- stabile HK-Reihenfolge (HK1 → HK2 → HK7) ohne Datenverlust.
--
-- Diese Migration ist additiv und idempotent:
--   * Fügt public.modules.position hinzu (für deterministische Modul-Reihenfolge).
--   * Setzt Modul-Positionen anhand der Strassenbau-Handlungskompetenzbereiche
--     (HK1=10, HK2=20, HK7=30) und für ABU-Module einen hohen Default (100).
--   * Benennt Strassenbau-Module von "HK1 – …", "HK2 – …", "HK7 – …" auf
--     reine Klartext-Titel um (per id, nicht per delete/insert).
--   * Entfernt führende "X.Y "-Präfixe aus Strassenbau-Lektionstiteln
--     (regulärer Update, ohne die Zeilen-IDs zu ändern).
--   * Vergibt Lektionspositionen global im Kurs in HK-Reihenfolge
--     (HK1: 1..5, HK2: 6..10, HK7: 11..16), damit die UI ohne sichtbare
--     HK-Nummer trotzdem stabil ordnet.
--
-- Wichtig: Es werden ausschliesslich UPDATE-Statements auf modules/lessons
-- ausgeführt. Lesson-IDs bleiben erhalten → lesson_progress und
-- lesson_attempts bleiben verknüpft, kein Fortschrittsverlust. Fragen werden
-- nicht angefasst.

begin;

-- 1. modules.position hinzufügen (idempotent).
alter table public.modules
  add column if not exists position integer not null default 0;

-- 2. Modul-Reihenfolge für Strassenbau und ABU setzen (idempotent über where).
update public.modules
   set position = 10
 where course_key = 'strassenbau'
   and (title like 'HK1%' or title = 'Strassenbauarbeiten vorbereiten und ausführen');

update public.modules
   set position = 20
 where course_key = 'strassenbau'
   and (title like 'HK2%' or title = 'Baustelle einrichten und Bauwerke erstellen');

update public.modules
   set position = 30
 where course_key = 'strassenbau'
   and (title like 'HK7%' or title = 'Verkehrswege erstellen und sanieren');

-- ABU-Module hinter Strassenbau einsortieren (lassen sich später feiner sortieren).
update public.modules
   set position = 100
 where course_key = 'abu'
   and position = 0;

-- 3. Strassenbau-Modultitel auf nutzerfreundliche Klartext-Titel umbenennen.
--    Reihenfolge wichtig: erst HK1, dann HK2, dann HK7 (gleicher String-Präfix).
update public.modules
   set title = 'Strassenbauarbeiten vorbereiten und ausführen'
 where course_key = 'strassenbau'
   and title = 'HK1 – Strassenbauarbeiten vorbereiten und ausführen';

update public.modules
   set title = 'Baustelle einrichten und Bauwerke erstellen'
 where course_key = 'strassenbau'
   and title = 'HK2 – Baustelle einrichten und Bauwerke erstellen';

update public.modules
   set title = 'Verkehrswege erstellen und sanieren'
 where course_key = 'strassenbau'
   and title = 'HK7 – Verkehrswege erstellen und sanieren';

-- 4. Lektionstitel: führende "X.Y "-Sortier-/Kompetenznummern entfernen.
--    Beispiel: '1.1 Arbeitssicherheit und Notfall' → 'Arbeitssicherheit und Notfall'.
--    Match-Regex: optionale Ziffern.Ziffern + Leerzeichen am Anfang.
update public.lessons l
   set title = regexp_replace(l.title, '^\d+\.\d+\s+', '')
  from public.modules m
 where l.module_id = m.id
   and m.course_key = 'strassenbau'
   and l.title ~ '^\d+\.\d+\s+';

-- 5. Lektionspositionen global im Kurs in HK-Reihenfolge neu vergeben.
--    Wir wählen einen weiten Abstand (10er-Schritte) damit künftige Einfügungen
--    keine Bulk-Renummerierung erzwingen. Aktuelle Reihenfolge wird aus
--    module.position + bestehender lesson.position abgeleitet.
do $$
declare
  v_rec record;
  v_new_pos integer;
begin
  v_new_pos := 0;
  for v_rec in
    select l.id
      from public.lessons l
      join public.modules m on m.id = l.module_id
     where m.course_key = 'strassenbau'
     order by m.position asc, l.position asc, l.created_at asc, l.id asc
  loop
    v_new_pos := v_new_pos + 10;
    update public.lessons
       set position = v_new_pos
     where id = v_rec.id
       and position is distinct from v_new_pos;
  end loop;
end$$;

commit;
