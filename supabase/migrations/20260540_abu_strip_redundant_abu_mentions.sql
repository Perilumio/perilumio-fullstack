-- Bereinigt redundante "im ABU"- und " im Schweizer ABU-Kontext"-Erwaehnungen
-- in den ABU-Frage-Inhalten. Wirkt nur auf Fragen, deren Lektion zu einem
-- Modul mit course_key = 'abu' gehoert. Idempotent: ein zweiter Lauf
-- veraendert keine Zeilen, weil die Muster dann bereits entfernt sind.
--
-- Zwei Bereinigungen:
--   1. " im Schweizer ABU-Kontext" als Inline-Fueller in prompt/options/explanation
--      (vom Antwort-Smoothing eingefuegt) entfernen.
--   2. " im ABU" als Fueller im prompt (typisches Muster
--      "Welche Aussage beschreibt X im ABU am besten?").
--
-- Verbleibende ABU-Vorkommen (z. B. "ABU staerkt ..." als Subjekt einer
-- Erklaerung) sind beabsichtigt und werden nicht angefasst.

begin;

-- Schritt 1: " im Schweizer ABU-Kontext" entfernen aus prompt + alle Optionen + explanation.
-- Schritt 2: zusaetzlich " im ABU" aus prompt entfernen.
-- Schritt 3: doppelte Leerzeichen und Leerzeichen vor Satzzeichen normalisieren.
with abu_questions as (
  select q.id
    from public.questions q
    join public.lessons l on l.id = q.lesson_id
    join public.modules m on m.id = l.module_id
   where m.course_key = 'abu'
)
update public.questions q
   set
     prompt      = regexp_replace(
                     regexp_replace(
                       regexp_replace(q.prompt, '\s+im\s+Schweizer\s+ABU-Kontext\M', '', 'g'),
                       '\s+im\s+ABU\M', '', 'g'),
                     '\s+([,;.!?])', '\1', 'g'),
     option_a    = regexp_replace(regexp_replace(q.option_a, '\s+im\s+Schweizer\s+ABU-Kontext\M', '', 'g'), '\s+([,;.!?])', '\1', 'g'),
     option_b    = regexp_replace(regexp_replace(q.option_b, '\s+im\s+Schweizer\s+ABU-Kontext\M', '', 'g'), '\s+([,;.!?])', '\1', 'g'),
     option_c    = regexp_replace(regexp_replace(q.option_c, '\s+im\s+Schweizer\s+ABU-Kontext\M', '', 'g'), '\s+([,;.!?])', '\1', 'g'),
     option_d    = regexp_replace(regexp_replace(q.option_d, '\s+im\s+Schweizer\s+ABU-Kontext\M', '', 'g'), '\s+([,;.!?])', '\1', 'g'),
     explanation = regexp_replace(regexp_replace(coalesce(q.explanation, ''), '\s+im\s+Schweizer\s+ABU-Kontext\M', '', 'g'), '\s+([,;.!?])', '\1', 'g')
  from abu_questions a
 where q.id = a.id
   and (
        q.prompt      ~ '\s+im\s+Schweizer\s+ABU-Kontext\M'
     or q.prompt      ~ '\s+im\s+ABU\M'
     or q.option_a    ~ '\s+im\s+Schweizer\s+ABU-Kontext\M'
     or q.option_b    ~ '\s+im\s+Schweizer\s+ABU-Kontext\M'
     or q.option_c    ~ '\s+im\s+Schweizer\s+ABU-Kontext\M'
     or q.option_d    ~ '\s+im\s+Schweizer\s+ABU-Kontext\M'
     or q.explanation ~ '\s+im\s+Schweizer\s+ABU-Kontext\M'
   );

commit;
