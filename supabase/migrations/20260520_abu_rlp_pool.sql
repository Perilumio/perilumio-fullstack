-- ABU Fragenpool basierend auf dem Rahmenlehrplan für die Allgemeinbildung
-- in der beruflichen Grundbildung (SBFI, 2025).
--
-- Struktur:
--   * 1 ABU-Modul (course_key = 'abu')
--   * 11 Lektionen, ausgerichtet an Lernbereichen (Sprache & Kommunikation,
--     Gesellschaft mit Aspekten Ethik, Identität/Sozialisation, Kultur, Ökologie,
--     Politik, Recht, technologische/digitale Transformation, Wirtschaft) und
--     fächerübergreifenden Kompetenzen (Quellen/KI-Beurteilung, Laufbahn).
--   * 80 originale MC-Fragen (je 4 Antworten, eine richtige, Erklärung).
--
-- Idempotenz:
--   * Modul wird per Titel + course_key gefunden oder angelegt.
--   * Lektionen werden per (module_id, title) gefunden oder angelegt.
--     lesson_progress / lesson_attempts bleiben dadurch unangetastet.
--   * Fragen werden pro Lektion vollständig ersetzt (delete + insert),
--     damit die Migration deterministisch ist und keine Duplikate erzeugt.
--   * Es werden KEINE Profile, kein Fortschritt und keine fremden Module
--     verändert.

begin;

do $$
declare
  v_module_id uuid;
  v_lesson_id uuid;
  v_module_title    constant text := 'Allgemeinbildung (ABU) – RLP 2025';
  v_module_descr    constant text := 'Allgemeinbildender Unterricht nach dem Rahmenlehrplan ABU (SBFI, 2025). Lernbereiche Sprache & Kommunikation und Gesellschaft mit den Aspekten Ethik, Identität & Sozialisation, Kultur, Ökologie, Politik, Recht, Technologie/Digitalisierung und Wirtschaft.';
begin
  -- 1) Modul
  select id into v_module_id
  from public.modules
  where course_key = 'abu' and title = v_module_title
  limit 1;

  if v_module_id is null then
    insert into public.modules (title, description, course_key)
    values (v_module_title, v_module_descr, 'abu')
    returning id into v_module_id;
  else
    update public.modules
    set description = v_module_descr
    where id = v_module_id;
  end if;

  -- Hilfs-CTE-Style: pro Lektion -> upsert (by title) + replace questions.
  -- Wir nutzen ein einziges Pattern, kein PL/pgSQL-Loop, damit der SQL-Text
  -- gut lesbar bleibt.

  ----------------------------------------------------------------------------
  -- Lektion 1: Orientierung im ABU
  ----------------------------------------------------------------------------
  select id into v_lesson_id
  from public.lessons where module_id = v_module_id and title = 'Orientierung im ABU' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Orientierung im ABU', 1, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 1, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist das Ziel des Allgemeinbildenden Unterrichts (ABU)?', 'Nur Mathematik vertiefen', 'Persönlichkeit, Gesellschaft und Sprache fördern', 'Den Lehrbetrieb ersetzen', 'Ausschliesslich Berufsfachwissen vermitteln', 'B', 'Der ABU fördert Persönlichkeit, Gesellschaft und Sprache und ergänzt das berufliche Fachwissen.', 1),
    (v_lesson_id, 'Welche zwei Lernbereiche umfasst der ABU laut Rahmenlehrplan?', 'Sport und Musik', 'Sprache & Kommunikation und Gesellschaft', 'Mathematik und Physik', 'Religion und Kunst', 'B', 'Der Rahmenlehrplan ABU benennt die Lernbereiche Sprache & Kommunikation und Gesellschaft.', 2),
    (v_lesson_id, 'Welches Dokument bildet die rechtliche Grundlage des ABU?', 'Die Hausordnung der Schule', 'Der Rahmenlehrplan ABU des SBFI', 'Die Schulordnung des Lehrbetriebs', 'Das Obligationenrecht', 'B', 'Der Rahmenlehrplan ABU des SBFI ist die fachliche und rechtliche Grundlage.', 3),
    (v_lesson_id, 'Welcher Aspekt gehört NICHT zum Lernbereich Gesellschaft?', 'Ethik', 'Wirtschaft', 'Rechtschreibung', 'Politik', 'C', 'Rechtschreibung gehört zum Lernbereich Sprache & Kommunikation, nicht zu Gesellschaft.', 4),
    (v_lesson_id, 'Wozu dient das Qualifikationsverfahren (QV) im ABU?', 'Es prüft ausschliesslich die Note in Mathematik', 'Es schliesst die Allgemeinbildung am Lehrende ab', 'Es ersetzt die Berufsschule', 'Es ist freiwillig', 'B', 'Das QV schliesst den ABU am Ende der Lehre ab und bewertet Sprache, Gesellschaft und Vertiefungsarbeit.', 5),
    (v_lesson_id, 'Was bedeutet «lebenslanges Lernen» im ABU-Kontext?', 'Nur in der Schule lernen', 'Lernen über das ganze Berufsleben hinweg', 'Nur als Kind lernen', 'Nur im Lehrbetrieb lernen', 'B', 'Lebenslanges Lernen meint, sich beruflich und persönlich kontinuierlich weiterzuentwickeln.', 6),
    (v_lesson_id, 'Welche Kompetenz wird im ABU besonders gefördert?', 'Auswendiglernen ohne Verständnis', 'Kritisch-reflexives Denken', 'Schweigen in Diskussionen', 'Abschreiben aus dem Internet', 'B', 'Kritisch-reflexives Denken ist eine zentrale Schlüsselkompetenz des ABU.', 7),
    (v_lesson_id, 'Was ist eine «überfachliche Kompetenz»?', 'Eine Fähigkeit, die nur im Fach Mathematik nützt', 'Eine Fähigkeit, die fächerübergreifend hilft, z. B. Teamarbeit', 'Eine Note auf dem Zeugnis', 'Ein Schulbuch', 'B', 'Überfachliche Kompetenzen wirken über einzelne Fächer hinaus, z. B. Kommunikation, Teamarbeit, Problemlösen.', 8);

  ----------------------------------------------------------------------------
  -- Lektion 2: Sprache & Kommunikation
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Sprache & Kommunikation' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Sprache & Kommunikation', 2, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 2, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche vier Sprachhandlungen werden im ABU besonders geübt?', 'Singen, Tanzen, Rechnen, Zeichnen', 'Rezipieren, Produzieren, Interagieren, Kooperieren', 'Nur Lesen und Schreiben', 'Programmieren und Designen', 'B', 'Im ABU werden Rezeption, Produktion, Interaktion und Kooperation in mündlicher und schriftlicher Form geübt.', 1),
    (v_lesson_id, 'Welcher Text ist argumentativ?', 'Eine Bedienungsanleitung', 'Ein Leserbrief, der eine Meinung begründet', 'Eine Einkaufsliste', 'Ein Wetterbericht', 'B', 'Argumentative Texte vertreten eine Meinung und stützen sie mit Begründungen.', 2),
    (v_lesson_id, 'Was unterscheidet einen erklärenden von einem erzählenden Text?', 'Er ist immer länger', 'Er macht einen Sachverhalt verständlich, statt eine Geschichte zu erzählen', 'Er enthält keine Sätze', 'Er ist nur mündlich', 'B', 'Erklärende Texte machen Zusammenhänge verständlich; erzählende Texte berichten von einem Geschehen.', 3),
    (v_lesson_id, 'Welche Kommunikationsform ist «asynchron»?', 'Telefongespräch', 'Live-Diskussion', 'E-Mail', 'Persönliches Gespräch', 'C', 'Bei asynchroner Kommunikation reagieren die Beteiligten zeitversetzt, z. B. via E-Mail.', 4),
    (v_lesson_id, 'Was ist aktives Zuhören?', 'Während der andere spricht das Handy nutzen', 'Aufmerksam folgen, nachfragen und das Verstandene spiegeln', 'Sofort widersprechen', 'Die Aussagen ignorieren', 'B', 'Aktives Zuhören bedeutet, aufmerksam zu folgen und das Verständnis zu sichern.', 5),
    (v_lesson_id, 'Welche Anrede passt in eine formelle Geschäftsmail?', 'Hi, was läuft', 'Sehr geehrte Frau Meier', 'Hey du', 'Servus zusammen', 'B', 'In formellen Geschäftsmails ist «Sehr geehrte/r» die übliche Anrede.', 6),
    (v_lesson_id, 'Welche Sprachebene gehört in einen offiziellen Bericht?', 'Dialekt und Umgangssprache', 'Standardsprache, sachlich und präzise', 'Ironie und Slang', 'Reine Emojis', 'B', 'Berichte verlangen die sachliche Standardsprache.', 7),
    (v_lesson_id, 'Wozu dient eine Inhaltsangabe?', 'Den Originaltext ersetzen', 'Den wesentlichen Inhalt eines Textes kurz wiedergeben', 'Persönliche Meinung des Autors loben', 'Den Text wörtlich abschreiben', 'B', 'Inhaltsangaben fassen einen Text knapp und sachlich zusammen.', 8);

  ----------------------------------------------------------------------------
  -- Lektion 3: Quellen, Medien & KI
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Quellen, Medien & KI' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Quellen, Medien & KI', 3, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 3, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche Quelle ist in der Regel am verlässlichsten?', 'Anonymer Kommentar in einem Forum', 'Behördenpublikation mit Autor und Datum', 'Bild ohne Quelle in den sozialen Medien', 'Werbeanzeige mit Versprechen', 'B', 'Quellen mit klar erkennbaren Autoren, Datum und Institution sind in der Regel verlässlicher.', 1),
    (v_lesson_id, 'Was ist «Fake News»?', 'Lustige Werbung', 'Bewusst falsche oder irreführende Information, die als Nachricht erscheint', 'Eine echte Schlagzeile', 'Ein offizielles Gesetz', 'B', 'Fake News sind bewusst falsche oder irreführende Inhalte im Nachrichtenformat.', 2),
    (v_lesson_id, 'Was solltest du tun, bevor du eine Schlagzeile teilst?', 'Sie sofort weiterleiten', 'Quelle, Datum und Inhalt prüfen', 'Nur die Überschrift lesen und teilen', 'Den Autor sperren', 'B', 'Mediennutzung verlangt Quellenprüfung vor dem Teilen.', 3),
    (v_lesson_id, 'Wozu dient eine Quellenangabe in einer schriftlichen Arbeit?', 'Den Text länger zu machen', 'Aussagen nachvollziehbar zu belegen', 'Den Autor zu beleidigen', 'Die Schrift zu verschönern', 'B', 'Quellenangaben machen Aussagen überprüfbar und schützen vor Plagiat.', 4),
    (v_lesson_id, 'Was ist beim Einsatz von KI-Werkzeugen (z. B. Chatbots) im ABU besonders wichtig?', 'Antworten ungeprüft übernehmen', 'Ergebnisse kritisch prüfen und transparent kennzeichnen', 'Den eigenen Namen anstelle der KI angeben', 'KI ausschliesslich für Geheimes nutzen', 'B', 'KI-Ergebnisse sind nicht automatisch korrekt; sie müssen geprüft und gekennzeichnet werden.', 5),
    (v_lesson_id, 'Was sind «Halluzinationen» bei KI-Sprachmodellen?', 'Bunte Bilder', 'Erfundene oder falsche Aussagen, die plausibel klingen', 'Technische Fehlermeldungen', 'Werbung', 'B', 'KI kann plausibel klingende, aber falsche Inhalte erzeugen – das nennt man Halluzinationen.', 6),
    (v_lesson_id, 'Was schützt das Urheberrecht?', 'Nur Software', 'Geistige Schöpfungen wie Texte, Bilder und Musik', 'Nur Geld', 'Werkzeuge im Lager', 'B', 'Das Urheberrecht schützt geistige Schöpfungen mit individuellem Charakter.', 7),
    (v_lesson_id, 'Wie erkennt man eine seriöse Internetseite eher?', 'Viele Pop-ups, kein Impressum', 'Klar genanntes Impressum, Autor und Datum', 'Nur Emojis', 'Aggressive Werbung', 'B', 'Impressum, Autor und Datum sind Hinweise auf eine seriöse Seite.', 8);

  ----------------------------------------------------------------------------
  -- Lektion 4: Politik & Demokratie in der Schweiz
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Politik & Demokratie in der Schweiz' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Politik & Demokratie in der Schweiz', 4, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 4, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Aus wie vielen Kammern besteht die Schweizer Bundesversammlung?', 'Eine', 'Zwei (Nationalrat und Ständerat)', 'Drei', 'Vier', 'B', 'Die Bundesversammlung besteht aus Nationalrat und Ständerat.', 1),
    (v_lesson_id, 'Wer wählt den Bundesrat?', 'Das Volk direkt', 'Die Vereinigte Bundesversammlung', 'Der Bundespräsident allein', 'Die Kantonsregierungen', 'B', 'Die Vereinigte Bundesversammlung wählt die sieben Bundesräte.', 2),
    (v_lesson_id, 'Was ist eine Volksinitiative?', 'Ein Vorschlag des Bundesrates', 'Ein Antrag aus dem Volk auf Verfassungsänderung', 'Ein Gerichtsurteil', 'Eine Steuererhöhung', 'B', 'Mit 100 000 gültigen Unterschriften kann das Volk eine Verfassungsänderung verlangen.', 3),
    (v_lesson_id, 'Welche Staatsebenen kennt die Schweiz?', 'Nur Gemeinden', 'Bund, Kantone und Gemeinden', 'Nur den Bund', 'Bund und EU', 'B', 'Der föderale Aufbau der Schweiz umfasst Bund, Kantone und Gemeinden.', 4),
    (v_lesson_id, 'Ab welchem Alter darf man in der Schweiz auf Bundesebene abstimmen?', '16', '18', '20', '25', 'B', 'Die politischen Rechte auf Bundesebene gelten ab 18 Jahren.', 5),
    (v_lesson_id, 'Was bedeutet «Gewaltenteilung»?', 'Alle Macht liegt bei einer Person', 'Legislative, Exekutive und Judikative sind getrennt', 'Das Militär regiert', 'Die Kirche regiert', 'B', 'Gewaltenteilung trennt Gesetzgebung, Regierung und Justiz.', 6),
    (v_lesson_id, 'Was ist ein fakultatives Referendum?', 'Eine Pflichtabstimmung', 'Eine Abstimmung auf Verlangen von Bürgerinnen und Bürgern oder Kantonen', 'Eine Wahl ohne Stimmrecht', 'Ein Gerichtsurteil', 'B', 'Mit Unterschriften kann gegen ein vom Parlament beschlossenes Gesetz abgestimmt werden.', 7);

  ----------------------------------------------------------------------------
  -- Lektion 5: Recht im Alltag & in der Arbeitswelt
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Recht im Alltag & in der Arbeitswelt' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Recht im Alltag & in der Arbeitswelt', 5, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 5, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welches Gesetz regelt das Arbeitsverhältnis privater Arbeitgeber in der Schweiz vor allem?', 'Strassenverkehrsgesetz', 'Obligationenrecht (Arbeitsvertragsrecht)', 'Gleichstellungsverordnung', 'Lebensmittelgesetz', 'B', 'Das Arbeitsverhältnis ist im OR (Art. 319 ff.) geregelt.', 1),
    (v_lesson_id, 'Wer schliesst den Lehrvertrag ab?', 'Nur die lernende Person', 'Lernende, Lehrbetrieb und – wenn minderjährig – die gesetzliche Vertretung', 'Die Berufsschule', 'Das Kantonsgericht', 'B', 'Beim Lehrvertrag sind Lernende, Lehrbetrieb und ggf. die gesetzliche Vertretung Parteien.', 2),
    (v_lesson_id, 'Was ist die maximale wöchentliche Arbeitszeit für Jugendliche unter 18 in der Regel?', 'Die gleiche wie für Erwachsene im Betrieb, maximal aber 9 Std./Tag', 'Unbeschränkt', '60 Stunden pro Woche', 'Keine Begrenzung', 'A', 'Für Jugendliche gelten besondere Schutzvorschriften (ArG, Jugendarbeitsschutzverordnung).', 3),
    (v_lesson_id, 'Was ist ein Vertrag?', 'Ein einseitiges Versprechen', 'Eine übereinstimmende Willenserklärung von mindestens zwei Parteien', 'Eine Quittung', 'Ein Steuerformular', 'B', 'Ein Vertrag entsteht durch übereinstimmende, gegenseitige Willenserklärungen.', 4),
    (v_lesson_id, 'Was passiert beim Online-Kauf bei einem Vertrag mit einem 14-Jährigen ohne Zustimmung der Eltern in der Regel?', 'Er ist immer gültig', 'Er ist ohne Zustimmung der gesetzlichen Vertretung in der Regel schwebend unwirksam', 'Er führt zu Gefängnis', 'Er ist ungültig wegen Wettbewerbsrecht', 'B', 'Minderjährige sind nur beschränkt handlungsfähig; grössere Käufe brauchen die Zustimmung der gesetzlichen Vertretung.', 5),
    (v_lesson_id, 'Welches Element gehört NICHT zwingend in einen schriftlichen Mietvertrag?', 'Parteien', 'Mietzins', 'Mietobjekt', 'Lieblingsfarbe der Mieterin', 'D', 'Persönliche Vorlieben sind kein Vertragsbestandteil. Parteien, Objekt und Mietzins schon.', 6),
    (v_lesson_id, 'Was ist eine Kündigungsfrist?', 'Eine Pause', 'Die Zeit zwischen Kündigung und Vertragsende', 'Eine Lohnerhöhung', 'Eine Strafe', 'B', 'Die Kündigungsfrist ist der zeitliche Abstand zwischen Aussprache der Kündigung und Beendigung des Vertrags.', 7);

  ----------------------------------------------------------------------------
  -- Lektion 6: Wirtschaft, Konsum & Geld
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Wirtschaft, Konsum & Geld' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Wirtschaft, Konsum & Geld', 6, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 6, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist ein Budget?', 'Eine Schuld', 'Geplante Übersicht über Einnahmen und Ausgaben', 'Ein Bankkredit', 'Ein Sparkonto', 'B', 'Ein Budget plant Einnahmen und Ausgaben für einen bestimmten Zeitraum.', 1),
    (v_lesson_id, 'Welche Ausgabe ist ein Fixposten?', 'Pizza am Wochenende', 'Monatliche Miete', 'Souvenirs in den Ferien', 'Spontanes Kino', 'B', 'Fixkosten fallen regelmässig in gleicher Höhe an, z. B. Miete.', 2),
    (v_lesson_id, 'Was bedeutet «Brutto»?', 'Nach Abzug aller Abgaben', 'Vor Abzug von Sozialabgaben und Steuern', 'Inkl. Trinkgeld', 'Nur Sachleistungen', 'B', 'Bruttolohn ist der Lohn vor Abzug der Sozialversicherungsbeiträge.', 3),
    (v_lesson_id, 'Welche Sozialversicherung sichert die Existenz im Alter (1. Säule)?', 'Pensionskasse', 'AHV', 'Krankenkasse', 'Hausratversicherung', 'B', 'Die AHV ist die staatliche 1. Säule der Altersvorsorge.', 4),
    (v_lesson_id, 'Was ist die Funktion der Mehrwertsteuer (MWST)?', 'Sie ersetzt den Lohn', 'Sie ist eine Konsumsteuer auf Waren und Dienstleistungen', 'Sie schützt Tiere', 'Sie ist eine Sondergebühr für Banken', 'B', 'Die MWST ist eine allgemeine Verbrauchssteuer in der Schweiz.', 5),
    (v_lesson_id, 'Was ist «Inflation»?', 'Allgemeiner Preisanstieg', 'Sinkende Preise', 'Eine neue Währung', 'Eine Steuer', 'A', 'Inflation bedeutet, dass das allgemeine Preisniveau steigt und Geld an Kaufkraft verliert.', 6),
    (v_lesson_id, 'Welcher Zahlungsweg führt am schnellsten in eine Schuldenfalle?', 'Sofortige Bezahlung in bar im Rahmen des Budgets', 'Wiederholte Käufe «auf Rechnung», ohne das Budget zu prüfen', 'Sparen vor dem Kauf', 'Bewusster Konsumverzicht', 'B', 'Kauf auf Rechnung ohne Übersicht über das Budget führt häufig in Verschuldung.', 7);

  ----------------------------------------------------------------------------
  -- Lektion 7: Ökologie & Nachhaltigkeit
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Ökologie & Nachhaltigkeit' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Ökologie & Nachhaltigkeit', 7, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 7, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche drei Dimensionen umfasst nachhaltige Entwicklung üblicherweise?', 'Sport, Musik, Kunst', 'Wirtschaft, Umwelt, Gesellschaft', 'Strom, Wasser, Gas', 'Bund, Kanton, Gemeinde', 'B', 'Nachhaltigkeit wird klassisch über die drei Dimensionen Wirtschaft, Umwelt und Gesellschaft beschrieben.', 1),
    (v_lesson_id, 'Was ist ein «erneuerbarer» Energieträger?', 'Erdöl', 'Sonnenenergie', 'Steinkohle', 'Erdgas', 'B', 'Sonnenenergie zählt zu den erneuerbaren Energieträgern.', 2),
    (v_lesson_id, 'Welches Verhalten reduziert den Ressourcenverbrauch im Alltag am ehesten?', 'Geräte im Dauerbetrieb laufen lassen', 'Reparieren statt sofort ersetzen', 'Häufiger neu kaufen', 'Längere Heisswasserduschen', 'B', 'Reparieren verlängert die Lebensdauer und schont Ressourcen.', 3),
    (v_lesson_id, 'Was bedeutet «Kreislaufwirtschaft»?', 'Geld kreist im Betrieb', 'Materialien werden möglichst lange im Kreislauf gehalten', 'Maschinen laufen im Kreis', 'Lager wird leer gefahren', 'B', 'Kreislaufwirtschaft setzt auf Wiederverwendung, Reparatur und Recycling.', 4),
    (v_lesson_id, 'Was ist der «ökologische Fussabdruck»?', 'Eine Schuhgrösse', 'Ein Mass für die genutzte Naturfläche pro Person', 'Eine Wanderroute', 'Ein Recyclingsymbol', 'B', 'Der ökologische Fussabdruck schätzt, wie viel Naturfläche eine Person beansprucht.', 5),
    (v_lesson_id, 'Welche Strategie ist meist die ökologisch beste in der Abfallhierarchie?', 'Vermeiden vor Wiederverwenden vor Recyceln vor Entsorgen', 'Sofort verbrennen', 'Alles vergraben', 'Alles in den Hausmüll', 'A', 'Die Abfallhierarchie priorisiert: vermeiden, wiederverwenden, recyceln, dann entsorgen.', 6),
    (v_lesson_id, 'Was bedeutet «systemisches Denken» bei Nachhaltigkeit?', 'Nur eine Ursache betrachten', 'Wechselwirkungen zwischen Mensch, Umwelt und Wirtschaft mitdenken', 'Nur an die Zukunft denken', 'Nur an die Vergangenheit denken', 'B', 'Systemisches Denken bezieht Wechselwirkungen zwischen den Bereichen mit ein.', 7);

  ----------------------------------------------------------------------------
  -- Lektion 8: Identität, Gesundheit & Sozialisation
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Identität, Gesundheit & Sozialisation' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Identität, Gesundheit & Sozialisation', 8, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 8, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was meint «Sozialisation»?', 'Eine Krankheit', 'Den Prozess, in dem Menschen Werte, Normen und Rollen erlernen', 'Eine Partyform', 'Eine Vereinsmitgliedschaft', 'B', 'Sozialisation ist das lebenslange Hineinwachsen in Gesellschaft, Werte und Rollen.', 1),
    (v_lesson_id, 'Welche Aussage zur Gesundheit ist richtig?', 'Gesundheit umfasst nur den Körper', 'Gesundheit hat körperliche, psychische und soziale Anteile', 'Gesundheit ist Privatsache der Eltern', 'Gesundheit hängt nur vom Wetter ab', 'B', 'Die WHO und der ABU verstehen Gesundheit ganzheitlich (körperlich, psychisch, sozial).', 2),
    (v_lesson_id, 'Welcher Faktor stärkt die psychische Gesundheit eher?', 'Daueranspannung ohne Erholung', 'Regelmässiger Schlaf, soziale Kontakte und Pausen', 'Soziale Isolation', 'Verzicht auf Bewegung', 'B', 'Schlaf, Bewegung und soziale Bindung wirken sich positiv auf die psychische Gesundheit aus.', 3),
    (v_lesson_id, 'Was ist ein «Wert»?', 'Eine Münze', 'Eine grundlegende Überzeugung darüber, was wichtig ist', 'Ein Steuerbetrag', 'Eine Telefonnummer', 'B', 'Werte sind grundlegende Überzeugungen, die unser Verhalten leiten.', 4),
    (v_lesson_id, 'Was bedeutet «Rollenverhalten» in der Gesellschaft?', 'Nur in Filmen mitspielen', 'Erwartetes Verhalten in bestimmten sozialen Positionen', 'Sport im Verein', 'Schwarzfahren', 'B', 'Soziale Rollen sind mit Erwartungen verknüpft, z. B. als Lernende, Kundin, Kollege.', 5),
    (v_lesson_id, 'Welche Aussage zu Sucht ist korrekt?', 'Nur Drogen können süchtig machen', 'Auch Verhaltensweisen wie übermässige Mediennutzung können süchtig machen', 'Sucht ist immer Zeichen von Faulheit', 'Sucht ist keine Krankheit', 'B', 'Es gibt stoffgebundene und verhaltensbezogene Süchte (z. B. Medien-, Spielsucht).', 6),
    (v_lesson_id, 'Was ist ein «Vorurteil»?', 'Eine geprüfte Tatsache', 'Eine ungeprüfte Annahme über eine Person oder Gruppe', 'Ein Gerichtsurteil', 'Eine Note auf dem Zeugnis', 'B', 'Vorurteile sind ungeprüfte, oft pauschale Annahmen, die Diskriminierung begünstigen.', 7);

  ----------------------------------------------------------------------------
  -- Lektion 9: Ethik, Kultur & Diversität
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Ethik, Kultur & Diversität' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Ethik, Kultur & Diversität', 9, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 9, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was untersucht Ethik?', 'Wie der Mensch im Schnitt isst', 'Was moralisch gut, richtig oder gerecht ist', 'Wie Maschinen funktionieren', 'Wie das Wetter entsteht', 'B', 'Ethik ist die Lehre vom richtigen Handeln und stellt Fragen nach Gut und Gerecht.', 1),
    (v_lesson_id, 'Welches Vorgehen ist eine «Perspektivenübernahme»?', 'Die eigene Sicht durchsetzen', 'Versuchen, die Sichtweise einer anderen Person nachzuvollziehen', 'Ignorieren', 'Schreiend reagieren', 'B', 'Perspektivenübernahme bedeutet, sich in andere hineinzuversetzen.', 2),
    (v_lesson_id, 'Welche Aussage über Kultur ist korrekt?', 'Kultur ist statisch und unveränderlich', 'Kultur ist dynamisch und entwickelt sich', 'Kultur ist nur Hochkultur', 'Kultur gibt es nur im Theater', 'B', 'Kulturen verändern sich und sind keine festen Blöcke.', 3),
    (v_lesson_id, 'Was bedeutet «Diversität»?', 'Vielfalt von Menschen und Lebensentwürfen', 'Einheitlichkeit', 'Kleidergrösse', 'Lautstärke', 'A', 'Diversität bezeichnet Vielfalt, z. B. nach Herkunft, Geschlecht, Alter, Religion.', 4),
    (v_lesson_id, 'Welcher Grundsatz schützt vor Diskriminierung?', 'Recht auf Stille', 'Gleichheit vor dem Gesetz', 'Recht auf Verkehr', 'Recht auf Eigentum allein', 'B', 'Die Rechtsgleichheit ist in der Bundesverfassung verankert.', 5),
    (v_lesson_id, 'Was ist ein ethischer Konflikt am Arbeitsplatz?', 'Stau auf der Autobahn', 'Wenn Werte oder Pflichten gegeneinander stehen', 'Wenn der Drucker streikt', 'Wenn die Kaffeemaschine leer ist', 'B', 'Ethische Konflikte entstehen, wenn Werte (z. B. Loyalität vs. Wahrhaftigkeit) kollidieren.', 6),
    (v_lesson_id, 'Welche Reaktion ist konstruktiv bei Diskriminierungserfahrungen am Arbeitsplatz?', 'Schweigen und hoffen', 'Vorfall dokumentieren und mit Vertrauensperson/Vorgesetzter besprechen', 'Mit Gewalt antworten', 'Sofort kündigen ohne Klärung', 'B', 'Dokumentieren und das Gespräch mit zuständigen Stellen suchen ist die empfohlene Vorgehensweise.', 7);

  ----------------------------------------------------------------------------
  -- Lektion 10: Beruf, Laufbahn & lebenslanges Lernen
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Beruf, Laufbahn & lebenslanges Lernen' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Beruf, Laufbahn & lebenslanges Lernen', 10, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 10, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist die Berufsmaturität (BM)?', 'Eine Lehre ohne Abschluss', 'Eine Maturität, die parallel oder nach der Lehre erworben wird und Hochschulzugang ermöglicht', 'Ein Sprachzertifikat', 'Eine Mitgliedskarte', 'B', 'Die BM erweitert die Lehre um Allgemeinbildung und öffnet den Weg an Fachhochschulen.', 1),
    (v_lesson_id, 'Wozu dient eine höhere Berufsbildung (z. B. eidg. Fachausweis)?', 'Zum Zeitvertreib', 'Zur beruflichen Spezialisierung und Weiterentwicklung', 'Zur Ferienplanung', 'Zur Steuererklärung', 'B', 'Höhere Berufsbildung vertieft Fachwissen und erhöht die Karrierechancen.', 2),
    (v_lesson_id, 'Was sind «SMART»-Ziele?', 'Schnell, mager, ausführlich, riskant, total', 'Spezifisch, messbar, attraktiv, realistisch, terminiert', 'Software, Marketing, Algorithmus, Roboter, Technik', 'Schule, Mathe, Arbeit, Recht, Test', 'B', 'SMART hilft, Ziele klar und überprüfbar zu formulieren.', 3),
    (v_lesson_id, 'Was gehört in ein gutes Bewerbungsdossier?', 'Foto vom letzten Urlaub', 'Bewerbungsschreiben, Lebenslauf und relevante Zeugnisse', 'Lieblingsrezept', 'Liste der Lieblingsserien', 'B', 'Ein vollständiges Dossier besteht aus Bewerbungsschreiben, CV und Zeugnissen.', 4),
    (v_lesson_id, 'Was ist eine «Lernstrategie»?', 'Ein Zufall', 'Eine geplante Vorgehensweise, um Inhalte besser zu lernen', 'Ein Computerspiel', 'Eine Pause', 'B', 'Lernstrategien (z. B. Verstehen, Wiederholen, Anwenden) verbessern den Lernerfolg.', 5),
    (v_lesson_id, 'Welche Eigenschaft hilft besonders in einem sich wandelnden Arbeitsmarkt?', 'Starrheit', 'Anpassungsfähigkeit und Bereitschaft zur Weiterbildung', 'Verschlossenheit', 'Vermeidung von Veränderung', 'B', 'Anpassungsfähigkeit und Weiterbildung sind zentrale Schlüsselkompetenzen.', 6),
    (v_lesson_id, 'Was bedeutet «Networking» im Berufsleben?', 'Nur Verkabelung', 'Aufbau und Pflege beruflicher Kontakte', 'Werbung machen', 'Internetkauf', 'B', 'Networking bezeichnet das bewusste Pflegen von Kontakten zur beruflichen Entwicklung.', 7);

  ----------------------------------------------------------------------------
  -- Lektion 11: Vorbereitung auf das QV (Vertiefung & Vernetzung)
  ----------------------------------------------------------------------------
  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = 'Vorbereitung auf das QV' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, 'Vorbereitung auf das QV', 11, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 11, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche Elemente werden im QV der Allgemeinbildung in der Regel bewertet?', 'Nur das mündliche Examen', 'Vertiefungsarbeit, schriftliche Schlussprüfung und Erfahrungsnote', 'Nur die Erfahrungsnote', 'Nur die Vertiefungsarbeit', 'B', 'Das QV ABU setzt sich aus Vertiefungsarbeit, Schlussprüfung und Erfahrungsnote zusammen.', 1),
    (v_lesson_id, 'Was ist eine Vertiefungsarbeit (VA)?', 'Ein anonymer Test', 'Eine selbst gewählte, schriftliche Arbeit zu einem ABU-Thema', 'Ein Sporttag', 'Eine Werkstattprüfung', 'B', 'Die VA ist eine selbständige schriftliche Arbeit zu einem gewählten Thema des ABU.', 2),
    (v_lesson_id, 'Was gehört zu einer fairen Argumentation?', 'Personen angreifen statt Argumente', 'Behauptung mit Begründung und Beleg verbinden', 'Lautstärke entscheidet', 'Schlagworte ohne Quellen', 'B', 'Sachliche Argumentation stützt Behauptungen mit Begründungen und Belegen.', 3),
    (v_lesson_id, 'Welcher Schritt ist beim Lösen einer ABU-Aufgabe sinnvoll?', 'Sofort raten', 'Aufgabe lesen, verstehen, planen, lösen, prüfen', 'Nur die Antwort abschreiben', 'Aufgabe ignorieren', 'B', 'Strukturiertes Vorgehen (lesen, verstehen, planen, lösen, prüfen) erhöht die Lösungsqualität.', 4),
    (v_lesson_id, 'Was tun, wenn eine Quelle im QV unbekannt erscheint?', 'Trotzdem unbesehen übernehmen', 'Inhalt, Autorin, Datum und Plausibilität prüfen', 'Quelle weglassen und erfinden', 'Den Lehrer beschuldigen', 'B', 'Quellenkritik ist eine zentrale Kompetenz – auch in der Prüfung.', 5),
    (v_lesson_id, 'Welche Aussage zur Zeitplanung im QV ist sinnvoll?', 'Alle Aufgaben in der letzten Minute lösen', 'Aufgabenzeit überblicken, schwierige Aufgaben markieren, später lösen', 'Nur die letzte Aufgabe bearbeiten', 'Sofort abgeben', 'B', 'Zeitmanagement: Überblick verschaffen, priorisieren, Schwieriges später lösen.', 6),
    (v_lesson_id, 'Welche Haltung hilft im QV und im Berufsalltag gleichermassen?', 'Pessimistisch alles ablehnen', 'Lernbereit, sorgfältig und reflektiert handeln', 'Aufgaben aussitzen', 'Verantwortung verschieben', 'B', 'Lernbereitschaft, Sorgfalt und Reflexion sind zentrale Schlüsselhaltungen des ABU.', 7);

end$$;

commit;
