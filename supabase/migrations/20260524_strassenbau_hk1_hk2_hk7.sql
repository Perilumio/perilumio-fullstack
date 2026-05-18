-- Strassenbau Fragenkatalog (HK1, HK2, HK7) für course_key = 'strassenbau'.
-- Quelle: strassenbauer_fragenkatalog_hk1_hk2_hk7.csv (76 single_choice Fragen).
-- Aufbau:
--   * 3 Module pro Handlungskompetenzbereich (HK1, HK2, HK7) unter course_key = 'strassenbau'.
--   * Lektionen pro sub_hk (z. B. 1.1, 1.2, ... 7.6).
--   * Fragen pro Lektion mit Optionen A-D, korrekter Antwort und Erklärung.
-- Idempotenz:
--   * Module werden per (course_key, title) gesucht/angelegt.
--   * Lektionen werden per (module_id, title) gesucht/angelegt.
--   * Fragen werden pro Lektion vollständig ersetzt (delete + insert), so dass keine Duplikate entstehen.
--   * Bestehende Strassenbau-Platzhalter ('Arbeitssicherheit' aus dem Baseline-Seed) ohne Fortschritt werden entfernt; mit Fortschritt werden sie unverändert belassen.
-- lesson_progress / lesson_attempts auf neue Lektionen bleiben erhalten, solange die Lessons-Titel stabil sind.

begin;

-- Bereinige Baseline-Platzhalter unter course_key='strassenbau', wenn keinerlei Fortschritt daran hängt.
do $$
declare
  v_placeholder_id uuid;
  v_has_progress boolean;
begin
  select id into v_placeholder_id
    from public.modules
    where course_key = 'strassenbau' and title = 'Arbeitssicherheit'
    limit 1;
  if v_placeholder_id is not null then
    select exists (
      select 1
        from public.lesson_progress lp
        join public.lessons l on l.id = lp.lesson_id
       where l.module_id = v_placeholder_id
      union all
      select 1
        from public.lesson_attempts la
        join public.lessons l on l.id = la.lesson_id
       where l.module_id = v_placeholder_id
    ) into v_has_progress;
    if not v_has_progress then
      delete from public.modules where id = v_placeholder_id;
    end if;
  end if;
end$$;

do $$
declare
  v_module_id uuid;
  v_lesson_id uuid;
begin

  -- ============================================================
  -- Modul HK1
  -- ============================================================
  select id into v_module_id
    from public.modules
    where course_key = 'strassenbau' and title = 'HK1 – Strassenbauarbeiten vorbereiten und ausführen'
    limit 1;
  if v_module_id is null then
    insert into public.modules (title, description, course_key)
    values ('HK1 – Strassenbauarbeiten vorbereiten und ausführen', 'Handlungskompetenzbereich 1: Arbeitssicherheit, Arbeitsvorbereitung, Umweltschutz, Ausmass/Rapport und Maschineneinsatz.', 'strassenbau')
    returning id into v_module_id;
  else
    update public.modules
       set description = 'Handlungskompetenzbereich 1: Arbeitssicherheit, Arbeitsvorbereitung, Umweltschutz, Ausmass/Rapport und Maschineneinsatz.',
           course_key  = 'strassenbau'
     where id = v_module_id;
  end if;

  -- Lektion 1.1: 1.1 Arbeitssicherheit und Notfall
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '1.1 Arbeitssicherheit und Notfall' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '1.1 Arbeitssicherheit und Notfall', 1, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 1, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche persönliche Schutzausrüstung gehört auf einer normalen Strassenbaustelle zur Grundausrüstung?', 'Helm, Sicherheitsschuhe und Warnkleidung', 'Turnschuhe, Sonnenbrille und leichte Jacke', 'Nur Handschuhe', 'Nur Gehörschutz', 'A', 'Helm, Sicherheitsschuhe und Warnkleidung gehören zur grundlegenden PSA und müssen gemäss Vorschriften konsequent getragen werden.', 1),
    (v_lesson_id, 'Was ist der wichtigste Zweck der persönlichen Schutzausrüstung?', 'Sie ersetzt die Baustellensignalisation', 'Sie schützt die arbeitende Person vor Verletzungen und Gesundheitsrisiken', 'Sie beschleunigt den Arbeitsablauf automatisch', 'Sie ist nur bei Regen vorgeschrieben', 'B', 'PSA reduziert Verletzungs- und Gesundheitsrisiken, ersetzt aber keine weiteren Sicherheitsmassnahmen.', 2),
    (v_lesson_id, 'Welche Gefahr ist beim Arbeiten neben dem öffentlichen Verkehr besonders zu beachten?', 'Zu wenig Beton im Mischer', 'Blendung durch Bürobeleuchtung', 'Anprall durch Fahrzeuge oder Maschinen', 'Zu tiefe Raumtemperatur', 'C', 'Verkehr und Maschinenbewegungen gehören zu den zentralen Gefahren auf Strassenbaustellen.', 3),
    (v_lesson_id, 'Was muss ein Lernender im Notfall zuerst sicherstellen?', 'Dass die Arbeit fertiggestellt wird', 'Dass die Unfallstelle gesichert ist und Hilfe alarmiert wird', 'Dass alle Werkzeuge gereinigt sind', 'Dass der Rapport vollständig ist', 'B', 'Im Notfall haben Sicherung der Unfallstelle, Eigenschutz und Alarmierung Vorrang.', 4),
    (v_lesson_id, 'Warum ist Alkohol- oder Drogenkonsum vor der Arbeit besonders gefährlich?', 'Weil dadurch nur die Arbeitsgeschwindigkeit steigt', 'Weil Konzentration, Reaktion und Urteilsfähigkeit beeinträchtigt werden', 'Weil Maschinen dadurch weniger Treibstoff brauchen', 'Weil dies nur bei Büroarbeiten relevant ist', 'B', 'Substanzen können Reaktionsfähigkeit und Urteilsvermögen stark beeinträchtigen und erhöhen das Unfallrisiko.', 5),
    (v_lesson_id, 'Du bemerkst eine ungesicherte Grube neben einem Gehweg. Was ist die fachlich richtige Reaktion?', 'Weiterarbeiten, wenn niemand hineinfällt', 'Grube sichern oder melden und Zugang für Dritte verhindern', 'Nur ein Werkzeug danebenlegen', 'Die Grube mit Wasser füllen', 'B', 'Gefahrenstellen müssen sofort gesichert oder gemeldet werden, besonders wenn Dritte gefährdet sind.', 6);

  -- Lektion 1.2: 1.2 Arbeitsvorbereitung
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '1.2 Arbeitsvorbereitung' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '1.2 Arbeitsvorbereitung', 2, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 2, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche Unterlagen helfen bei der Vorbereitung einer Tagesbaustelle besonders?', 'Baupläne, Auftrag, Materialliste und Sicherheitsvorgaben', 'Ferienplan und private Notizen', 'Nur ein Foto der Baustelle', 'Nur der Wetterbericht', 'A', 'Für die Vorbereitung braucht es Auftrag, Pläne, Material, Maschinen und Sicherheitsvorgaben.', 1),
    (v_lesson_id, 'Warum wird ein Arbeitsablauf vor Beginn sinnvoll geordnet?', 'Damit unnötige Wege, Wartezeiten und Fehler vermieden werden', 'Damit die Baustelle länger dauert', 'Damit weniger Sicherheitsregeln gelten', 'Damit keine Maschinen gebraucht werden', 'A', 'Eine sinnvolle Reihenfolge erhöht Effizienz, Qualität und Sicherheit.', 2),
    (v_lesson_id, 'Was bedeutet es, Material und Geräte gemäss Auftrag bereitzustellen?', 'Alles verfügbare Material auf die Baustelle bringen', 'Nur das benötigte Material und passende Geräte rechtzeitig organisieren', 'Material erst nach Arbeitsende bestellen', 'Geräte ungeprüft verwenden', 'B', 'Passendes Material und geeignete Geräte müssen rechtzeitig und auftragsbezogen bereitstehen.', 3),
    (v_lesson_id, 'Welche Folge kann eine schlecht vorbereitete Baustelle haben?', 'Weniger Unfallrisiko', 'Höhere Qualität ohne Kontrolle', 'Verzögerungen, Mehrkosten und Sicherheitsprobleme', 'Automatisch weniger Materialverbrauch', 'C', 'Mangelhafte Vorbereitung führt häufig zu Verzögerungen, Fehlern, Mehrkosten und erhöhtem Risiko.', 4);

  -- Lektion 1.3: 1.3 Umweltschutz
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '1.3 Umweltschutz' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '1.3 Umweltschutz', 3, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 3, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist beim Entsorgen von Baustellenmaterialien richtig?', 'Alles in dieselbe Mulde werfen', 'Materialien trennen und fachgerecht entsorgen', 'Nur sichtbaren Abfall trennen', 'Gefährliche Stoffe im Boden versickern lassen', 'B', 'Materialien müssen getrennt und gemäss Entsorgungsvorgaben verwertet oder entsorgt werden.', 1),
    (v_lesson_id, 'Wozu dient das Mehrmuldenkonzept?', 'Zur getrennten Sammlung verschiedener Abfall- und Wertstoffarten', 'Zur Lagerung von Trinkwasser', 'Zum Transport von Personen', 'Zur Verdichtung von Asphalt', 'A', 'Das Mehrmuldenkonzept unterstützt die fachgerechte Trennung und Wiederverwertung.', 2),
    (v_lesson_id, 'Warum dürfen Treibstoffe nicht ungesichert auf der Baustelle gelagert werden?', 'Weil sie die Farbe verlieren', 'Weil sie Boden und Grundwasser verschmutzen können', 'Weil sie Beton schneller härten lassen', 'Weil sie nur im Winter gefährlich sind', 'B', 'Treibstoffe und gefährliche Stoffe können bei Austritt Boden und Grundwasser schädigen.', 3),
    (v_lesson_id, 'Welche Massnahme reduziert Staub auf einer Baustelle?', 'Material trocken aufwirbeln', 'Flächen bei Bedarf befeuchten und staubarme Arbeitsweise wählen', 'Abfälle verbrennen', 'Maschinen im Leerlauf laufen lassen', 'B', 'Befeuchten und angepasste Arbeitsmethoden können Staubemissionen reduzieren.', 4),
    (v_lesson_id, 'Ein Kanister mit Diesel läuft aus. Was ist zuerst zu tun?', 'Weiterarbeiten und später reinigen', 'Ausbreitung stoppen, Bindemittel einsetzen und Vorgesetzte informieren', 'Diesel mit Wasser wegspülen', 'Den Kanister in die Baugrube werfen', 'B', 'Bei umweltgefährdenden Stoffen sind Sofortmassnahmen nötig: Ausbreitung stoppen, aufnehmen und melden.', 5);

  -- Lektion 1.4: 1.4 Ausmass und Rapport
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '1.4 Ausmass und Rapport' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '1.4 Ausmass und Rapport', 4, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 4, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche Angabe gehört in einen Tagesrapport?', 'Lieblingswerkzeug', 'Mengen, Personal, Maschinen und ausgeführte Arbeiten', 'Privatadresse aller Mitarbeitenden', 'Wetter von letzter Woche', 'B', 'Rapporte müssen nachvollziehbare Angaben zu Leistung, Personal, Maschinen und Mengen enthalten.', 1),
    (v_lesson_id, 'Wozu dient ein Ausmass?', 'Zur Ermittlung und Dokumentation ausgeführter Mengen', 'Zur Auswahl der Pausenzeit', 'Zum Dekorieren der Baustelle', 'Zum Ersetzen der Sicherheitsvorschriften', 'A', 'Ein Ausmass dokumentiert Mengen und ist wichtig für Kontrolle, Abrechnung und Nachvollziehbarkeit.', 2),
    (v_lesson_id, 'Was macht eine Baustellenskizze nachvollziehbar?', 'Schöne Farben ohne Masse', 'Masse, Lagebezug, Beschriftung und klare Darstellung', 'Nur ein Pfeil', 'Eine mündliche Erklärung ohne Zeichnung', 'B', 'Eine gute Skizze enthält relevante Masse, Lagebezüge und verständliche Beschriftungen.', 3),
    (v_lesson_id, 'Warum muss eine Dokumentation auch für Dritte verständlich sein?', 'Damit andere Personen Arbeiten kontrollieren, weiterführen oder abrechnen können', 'Damit sie möglichst geheim bleibt', 'Damit keine Pläne mehr nötig sind', 'Damit Fehler nicht auffallen', 'A', 'Dokumentationen müssen Arbeiten für Kontrolle, Übergabe und Abrechnung nachvollziehbar machen.', 4);

  -- Lektion 1.5: 1.5 Maschineneinsatz
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '1.5 Maschineneinsatz' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '1.5 Maschineneinsatz', 5, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 5, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist vor der Inbetriebnahme einer Kleinmaschine zu prüfen?', 'Nur die Farbe der Maschine', 'Betriebsbereitschaft, sichtbare Schäden und Sicherheitsvorrichtungen', 'Ob sie neu aussieht', 'Ob sie möglichst laut läuft', 'B', 'Vor dem Einsatz sind Zustand, Sicherheitsvorrichtungen und Betriebsbereitschaft zu kontrollieren.', 1),
    (v_lesson_id, 'Was gehört zum Parkdienst einer Maschine?', 'Reinigung, Kontrolle, Schmierung und korrektes Abstellen gemäss Vorgaben', 'Maschine ungereinigt stehen lassen', 'Treibstoff in den Boden leeren', 'Nur den Schlüssel abziehen', 'A', 'Parkdienst umfasst Reinigung, Kontrolle, Pflege und sicheres Abstellen.', 2),
    (v_lesson_id, 'Warum müssen Treibstoffe und Schmiermittel passend zur Maschine gewählt werden?', 'Damit Motor und Bauteile korrekt funktionieren und Schäden vermieden werden', 'Damit die Maschine schwerer wird', 'Damit mehr Rauch entsteht', 'Damit Wartung überflüssig wird', 'A', 'Falsche Betriebsstoffe können Maschinen beschädigen und Umwelt- oder Sicherheitsprobleme verursachen.', 3),
    (v_lesson_id, 'Eine Maschine zeigt vor Arbeitsbeginn einen Defekt an der Sicherheitsvorrichtung. Was ist richtig?', 'Trotzdem verwenden, wenn es schnell gehen muss', 'Nicht verwenden und den Defekt melden', 'Sicherheitsvorrichtung entfernen', 'Nur langsam damit arbeiten', 'B', 'Defekte Sicherheitsvorrichtungen sind ein Ausschlussgrund für den Einsatz und müssen gemeldet werden.', 4);

  -- ============================================================
  -- Modul HK2
  -- ============================================================
  select id into v_module_id
    from public.modules
    where course_key = 'strassenbau' and title = 'HK2 – Baustelle einrichten und Bauwerke erstellen'
    limit 1;
  if v_module_id is null then
    insert into public.modules (title, description, course_key)
    values ('HK2 – Baustelle einrichten und Bauwerke erstellen', 'Handlungskompetenzbereich 2: Baustelleneinrichtung, Vermessung, Beton- und Schalungsarbeiten, Fertigteile und Baustellenabbau.', 'strassenbau')
    returning id into v_module_id;
  else
    update public.modules
       set description = 'Handlungskompetenzbereich 2: Baustelleneinrichtung, Vermessung, Beton- und Schalungsarbeiten, Fertigteile und Baustellenabbau.',
           course_key  = 'strassenbau'
     where id = v_module_id;
  end if;

  -- Lektion 2.1: 2.1 Baustelleneinrichtung und Signalisation
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '2.1 Baustelleneinrichtung und Signalisation' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '2.1 Baustelleneinrichtung und Signalisation', 1, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 1, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was gehört zu einer betriebsbereiten Baustelle?', 'Sichere Zugänge, korrekte Signalisation und bereitgestellte Arbeitsmittel', 'Nur eine offene Materialfläche', 'Keine Absperrung', 'Werkzeuge ohne Ordnung', 'A', 'Eine Baustelle ist betriebsbereit, wenn Sicherheit, Organisation und Arbeitsmittel gewährleistet sind.', 1),
    (v_lesson_id, 'Warum muss die Baustellensignalisation normgerecht aufgestellt werden?', 'Damit Verkehrsteilnehmende und Arbeitende rechtzeitig geschützt und geführt werden', 'Damit die Baustelle schöner aussieht', 'Damit weniger Material gebraucht wird', 'Damit keine Pläne nötig sind', 'A', 'Normgerechte Signalisation schützt Arbeitende, Verkehr und Dritte.', 2),
    (v_lesson_id, 'Was ist bei der Einrichtung einer Baustelle besonders wichtig?', 'Material so lagern, dass Wege sicher und Abläufe effizient bleiben', 'Material zufällig verteilen', 'Zufahrten blockieren', 'Warnkleidung vermeiden', 'A', 'Sichere und effiziente Abläufe hängen stark von guter Ordnung und Materialplatzierung ab.', 3),
    (v_lesson_id, 'Was kontrollierst du vor Arbeitsbeginn auf einer eingerichteten Baustelle?', 'Nur ob Kaffee vorhanden ist', 'Betriebsbereitschaft, Sicherheit für Personal und Dritte sowie Vollständigkeit', 'Nur die Farbe der Absperrung', 'Ob niemand Fragen stellt', 'B', 'Die Einrichtung muss auf Sicherheit, Vollständigkeit und Betriebsbereitschaft geprüft werden.', 4);

  -- Lektion 2.2: 2.2 Vermessung
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '2.2 Vermessung' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '2.2 Vermessung', 2, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 2, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Wozu dienen Referenzpunkte beim Abstecken?', 'Zur genauen Übertragung von Lage und Höhe auf die Baustelle', 'Zur Dekoration der Baustelle', 'Zum Lagern von Werkzeugen', 'Zum Messen der Lufttemperatur', 'A', 'Referenzpunkte ermöglichen die genaue Übertragung von Plänen ins Gelände.', 1),
    (v_lesson_id, 'Welche Folge kann eine falsche Höhenmessung haben?', 'Falsches Gefälle, Wasseransammlungen oder fehlerhafte Anschlüsse', 'Automatisch bessere Verdichtung', 'Weniger Kontrollbedarf', 'Mehr Sicherheit ohne Massnahmen', 'A', 'Höhenfehler können Funktion, Entwässerung und Anschlüsse stark beeinträchtigen.', 2),
    (v_lesson_id, 'Wie sind Messgeräte auf der Baustelle zu behandeln?', 'Sorgfältig, geschützt und gemäss Bedienungsvorgaben', 'Wie Schaufeln', 'Ungeschützt im Regen', 'Nur grob, weil Messungen immer gleich bleiben', 'A', 'Messgeräte müssen sorgfältig behandelt werden, weil Messfehler grosse Folgen haben können.', 3),
    (v_lesson_id, 'Wann ist eine Kontrollmessung besonders sinnvoll?', 'Wenn Lage oder Höhe entscheidend für Folgearbeiten ist', 'Nur nach Feierabend', 'Wenn keine Pläne vorhanden sind', 'Nie, wenn schnell gearbeitet wird', 'A', 'Kontrollmessungen sichern die Qualität, besonders bei massgebenden Höhen und Linien.', 4);

  -- Lektion 2.3: 2.3 Beton- und Schalungsarbeiten
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '2.3 Beton- und Schalungsarbeiten' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '2.3 Beton- und Schalungsarbeiten', 3, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 3, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche Aufgabe hat eine Schalung beim Betonieren?', 'Sie gibt dem Beton bis zum Erhärten die gewünschte Form', 'Sie ersetzt die Bewehrung', 'Sie dient nur als Dekoration', 'Sie macht Nachbehandlung unnötig', 'A', 'Schalungen halten den frischen Beton in Form, bis er ausreichend erhärtet ist.', 1),
    (v_lesson_id, 'Welche Funktion hat Bewehrung im Stahlbeton?', 'Sie nimmt vor allem Zugkräfte auf und verbessert die Tragfähigkeit', 'Sie macht Beton flüssiger', 'Sie ersetzt die Schalung', 'Sie verhindert jede Rissbildung vollständig', 'A', 'Bewehrung ergänzt Beton, indem sie Zugkräfte aufnehmen kann.', 2),
    (v_lesson_id, 'Warum wird Beton verdichtet?', 'Um Hohlräume zu reduzieren und eine dichte, tragfähige Struktur zu erhalten', 'Um mehr Luft einzubauen', 'Um Beton schneller zu verschmutzen', 'Um die Schalung zu entfernen', 'A', 'Verdichtung reduziert Lufteinschlüsse und verbessert Festigkeit und Dauerhaftigkeit.', 3),
    (v_lesson_id, 'Warum ist die Nachbehandlung von Beton wichtig?', 'Sie schützt vor zu schnellem Austrocknen und unterstützt die Festigkeitsentwicklung', 'Sie ersetzt jede Kontrolle', 'Sie macht Beton sofort voll belastbar', 'Sie dient nur der Optik', 'A', 'Nachbehandlung verhindert schädliches Austrocknen und unterstützt die Erhärtung.', 4);

  -- Lektion 2.4: 2.4 Fertigteile und Montage
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '2.4 Fertigteile und Montage' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '2.4 Fertigteile und Montage', 4, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 4, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Worauf müssen Betonfertigteile beim Versetzen aufliegen?', 'Auf einer vorbereiteten, tragfähigen und ebenen Unterlage', 'Auf losem Abfall', 'Direkt auf Wasser', 'Auf ungeprüftem Humus', 'A', 'Fertigteile benötigen eine geeignete Unterlage, damit Lage und Stabilität stimmen.', 1),
    (v_lesson_id, 'Warum müssen Versetzvorschriften eingehalten werden?', 'Damit Bauteile sicher, lagegenau und ohne Schäden montiert werden', 'Damit die Arbeit beliebig wird', 'Damit keine Kontrolle nötig ist', 'Damit mehr Material verbraucht wird', 'A', 'Versetzvorschriften sichern Qualität, Sicherheit und Dauerhaftigkeit.', 2),
    (v_lesson_id, 'Wie schützt man Fertigteile während des Bauprozesses?', 'Durch sorgfältigen Transport, geeignete Lagerung und Schutz vor Beschädigung', 'Durch Werfen auf die Baustelle', 'Durch Lagern im Fahrweg', 'Durch Entfernen aller Kanten', 'A', 'Fertigteile müssen vor mechanischen Schäden und Witterung geschützt werden.', 3),
    (v_lesson_id, 'Was kann bei einer visuellen Kontrolle von Fertigteilen erkannt werden?', 'Beschädigungen, falsche Lage, schiefe Ausrichtung oder Montagefehler', 'Nur das Gewicht', 'Nur das Alter des Betons', 'Keine fachlichen Mängel', 'A', 'Sichtkontrollen helfen, Schäden und Ausführungsmängel frühzeitig zu erkennen.', 4);

  -- Lektion 2.5: 2.5 Baustelle abräumen
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '2.5 Baustelle abräumen' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '2.5 Baustelle abräumen', 5, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 5, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was bedeutet Baustelle fachgerecht abräumen?', 'Material, Inventar und Signalisation geordnet entfernen und Zustand gemäss Vorgabe herstellen', 'Alles liegen lassen', 'Nur Maschinen abholen', 'Abfälle vergraben', 'A', 'Beim Abräumen wird die Baustelle vollständig und vorschriftsgemäss zurückgegeben.', 1),
    (v_lesson_id, 'Was ist beim Entfernen der Baustellensignalisation wichtig?', 'Sie darf erst entfernt werden, wenn keine Gefahr oder Verkehrsführung mehr besteht', 'Sie wird immer zuerst entfernt', 'Sie bleibt immer stehen', 'Sie wird ungeordnet am Strassenrand gelagert', 'A', 'Signalisation schützt bis zum Ende der Gefährdung und muss kontrolliert entfernt werden.', 2),
    (v_lesson_id, 'Was bedeutet Transporttauglichkeit von Material?', 'Material ist gesichert, sauber vorbereitet und kann ohne Gefahr transportiert werden', 'Material liegt lose auf dem Fahrzeug', 'Material ist möglichst nass', 'Material wird ohne Kontrolle geladen', 'A', 'Transporttaugliches Material ist für sicheren Abtransport vorbereitet und gesichert.', 3),
    (v_lesson_id, 'Warum wird die Baustelle vor der Rückgabe kontrolliert?', 'Um Vollständigkeit, Sicherheit und vorgegebenen Zustand zu bestätigen', 'Um die Arbeit zu verzögern', 'Um Fehler zu verstecken', 'Um keine Meldung machen zu müssen', 'A', 'Die Abschlusskontrolle stellt sicher, dass alle Vorgaben erfüllt sind.', 4);

  -- ============================================================
  -- Modul HK7
  -- ============================================================
  select id into v_module_id
    from public.modules
    where course_key = 'strassenbau' and title = 'HK7 – Verkehrswege erstellen und sanieren'
    limit 1;
  if v_module_id is null then
    insert into public.modules (title, description, course_key)
    values ('HK7 – Verkehrswege erstellen und sanieren', 'Handlungskompetenzbereich 7: Erd-, Leitungs-, Planie-, Pflästerungs- und Asphaltarbeiten inkl. Sanierung.', 'strassenbau')
    returning id into v_module_id;
  else
    update public.modules
       set description = 'Handlungskompetenzbereich 7: Erd-, Leitungs-, Planie-, Pflästerungs- und Asphaltarbeiten inkl. Sanierung.',
           course_key  = 'strassenbau'
     where id = v_module_id;
  end if;

  -- Lektion 7.1: 7.1 Erdbau und Planum
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '7.1 Erdbau und Planum' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '7.1 Erdbau und Planum', 1, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 1, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist beim Humusabtrag besonders wichtig?', 'Humus getrennt abtragen und sauber deponieren', 'Humus mit Kies vermischen', 'Humus als Fundationsschicht verwenden', 'Humus in die Kanalisation spülen', 'A', 'Bodenmaterialien müssen getrennt behandelt und deponiert werden.', 1),
    (v_lesson_id, 'Warum werden Bodenmaterialien getrennt deponiert?', 'Damit sie fachgerecht wiederverwendet oder entsorgt werden können', 'Damit mehr Platz verbraucht wird', 'Damit sie sich schneller vermischen', 'Damit keine Kontrolle nötig ist', 'A', 'Getrennte Deponierung ermöglicht korrekte Wiederverwendung, Entsorgung und Qualitätssicherung.', 2),
    (v_lesson_id, 'Was ist ein Planum im Strassenbau?', 'Eine profilgerechte, vorbereitete Unterlage für den weiteren Oberbau', 'Eine fertige Asphaltdeckschicht', 'Ein Rapportformular', 'Ein Baustellenfahrzeug', 'A', 'Das Planum bildet die vorbereitete Grundlage für weitere Schichten.', 3),
    (v_lesson_id, 'Warum ist die Tragfähigkeit des Planums wichtig?', 'Sie beeinflusst die Stabilität und Lebensdauer des Strassenaufbaus', 'Sie bestimmt die Farbe des Asphalts', 'Sie ersetzt die Entwässerung', 'Sie ist nur für Gehwege relevant', 'A', 'Ein tragfähiges Planum ist Voraussetzung für einen dauerhaften Strassenoberbau.', 4),
    (v_lesson_id, 'Welche Massnahme reduziert Gefahren bei Aushubarbeiten?', 'Grabenränder sichern und sichere Abstände zu Lasten einhalten', 'Material direkt an die Grabenkante kippen', 'Ohne Kontrolle in den Graben steigen', 'Absperrungen entfernen', 'A', 'Sicherung, Abstand und Kontrolle reduzieren Einsturz- und Unfallgefahren.', 5);

  -- Lektion 7.2: 7.2 Leitungs- und Grabenbau
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '7.2 Leitungs- und Grabenbau' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '7.2 Leitungs- und Grabenbau', 2, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 2, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Wozu dient eine Grabenspriessung?', 'Sie verhindert das Einstürzen der Grabenwände', 'Sie ersetzt das Rohr', 'Sie erhöht den Wasserverbrauch', 'Sie dient nur als Markierung', 'A', 'Spriessungen sichern Gräben gegen Einsturz und schützen Personen.', 1),
    (v_lesson_id, 'Welche Aufgabe hat die Bettungsschicht bei Rohrleitungen?', 'Sie trägt und schützt das Rohr in richtiger Lage', 'Sie verschliesst das Rohr', 'Sie ersetzt den Schacht', 'Sie verhindert jede Kontrolle', 'A', 'Eine fachgerechte Bettung sichert Lage, Schutz und Funktion der Leitung.', 2),
    (v_lesson_id, 'Was ist beim Verlegen von Kanalisationsrohren entscheidend?', 'Richtige Höhenlage, Linienführung und Gefälle', 'Möglichst viele Richtungswechsel', 'Unkontrollierte Neigung', 'Direktes Verlegen auf grossen Steinen', 'A', 'Höhe, Linie und Gefälle bestimmen die Funktion der Leitung.', 3),
    (v_lesson_id, 'Warum müssen Schachtabdeckungen auf Gefälle und Höhe versetzt werden?', 'Damit sie bündig, sicher und entwässerungsgerecht in die Oberfläche passen', 'Damit sie möglichst hervorstehen', 'Damit Fahrzeuge ausweichen müssen', 'Damit Wasser stehen bleibt', 'A', 'Schachtabdeckungen müssen zur fertigen Oberfläche und zum Gefälle passen.', 4),
    (v_lesson_id, 'Welche Folge kann eine falsche Rohrneigung haben?', 'Ablagerungen, Rückstau oder mangelhafte Entwässerung', 'Bessere Selbstreinigung', 'Automatisch mehr Stabilität', 'Weniger Unterhalt', 'A', 'Falsche Neigung beeinträchtigt die Funktion von Entwässerung und Kanalisation.', 5);

  -- Lektion 7.3: 7.3 Fundationen und Planien
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '7.3 Fundationen und Planien' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '7.3 Fundationen und Planien', 3, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 3, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Wozu können Geotextilien im Strassenbau dienen?', 'Zum Trennen, Filtern oder Stabilisieren von Schichten', 'Zum Ersetzen aller Fundationsschichten', 'Zum Färben des Belags', 'Zum Rapportieren der Arbeit', 'A', 'Geotextilien werden je nach Produkt zum Trennen, Filtern, Schützen oder Stabilisieren eingesetzt.', 1),
    (v_lesson_id, 'Was beschreibt eine profilgerechte Rohplanie?', 'Eine grob hergestellte Planie in richtiger Form und Höhe', 'Eine fertige Deckschicht', 'Eine Betonfuge', 'Eine Abfallmulde', 'A', 'Die Rohplanie bereitet Form und Höhe für weitere Schichten vor.', 2),
    (v_lesson_id, 'Warum muss die Feinplanie präzise erstellt werden?', 'Weil sie Ebenheit, Schichtdicke und Qualität der folgenden Schichten beeinflusst', 'Weil sie nur optisch wichtig ist', 'Weil sie keine Höhenvorgaben hat', 'Weil sie später nicht belastet wird', 'A', 'Die Feinplanie beeinflusst die Genauigkeit und Qualität des Oberbaus.', 3),
    (v_lesson_id, 'Woran kann ungenügende Verdichtung visuell erkennbar sein?', 'An starken Radeindrücken oder nachgebendem Material', 'An sauberer Warnkleidung', 'An einem neuen Meterstab', 'An der Farbe des Himmels', 'A', 'Radeindrücke und nachgebende Stellen können Hinweise auf ungenügende Verdichtung sein.', 4),
    (v_lesson_id, 'Welche Faktoren beeinflussen die Lebensdauer eines Strassenoberbaus stark?', 'Tragfähigkeit, Verdichtung, Materialqualität und Entwässerung', 'Nur die Farbe des Belags', 'Nur die Pausenlänge', 'Nur die Anzahl Mitarbeitender', 'A', 'Strassenoberbau hält länger, wenn Material, Verdichtung, Tragfähigkeit und Entwässerung stimmen.', 5);

  -- Lektion 7.4: 7.4 Pflästerung
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '7.4 Pflästerung' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '7.4 Pflästerung', 4, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 4, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Welche Funktion haben Randabschlüsse?', 'Sie begrenzen und stabilisieren Flächen und führen Linien', 'Sie ersetzen die Fundation', 'Sie dienen nur als Sitzgelegenheit', 'Sie verhindern jede Entwässerung', 'A', 'Randabschlüsse begrenzen, stabilisieren und gestalten Verkehrsflächen.', 1),
    (v_lesson_id, 'Was ist vor dem Versetzen von Randabschlüssen zu kontrollieren?', 'Höhe, Linie und Lage gemäss Plan', 'Nur die Farbe der Steine', 'Ob genug Pausenzeit bleibt', 'Ob der Beton schon eingebaut ist', 'A', 'Randabschlüsse müssen nach korrekter Höhe und Linienführung versetzt werden.', 2),
    (v_lesson_id, 'Welche Aufgabe haben Dilatationsfugen?', 'Sie nehmen Bewegungen auf und verhindern unkontrollierte Schäden', 'Sie erhöhen den Wasserstau', 'Sie ersetzen den Beton', 'Sie dienen nur der Beschriftung', 'A', 'Dilatationsfugen ermöglichen Bewegungen und reduzieren Riss- oder Abplatzschäden.', 3),
    (v_lesson_id, 'Was ist beim Verlegen von Betonverbundsteinen wichtig?', 'Fugenbild, Ebenheit, Verband und Gefälle einhalten', 'Steine ungeordnet werfen', 'Ohne Bettung verlegen', 'Gefälle ignorieren', 'A', 'Qualität entsteht durch korrekten Verband, Fugenbild, Ebenheit und Gefälle.', 4),
    (v_lesson_id, 'Welche Kontrolle ist nach Versetzarbeiten sinnvoll?', 'Linienführung, Fugenbild, Höhenlage und Ebenheit prüfen', 'Nur zählen, wie viele Steine übrig sind', 'Keine Kontrolle, wenn es gerade aussieht', 'Nur das Werkzeug reinigen', 'A', 'Nach Versetzarbeiten müssen Linie, Höhe, Ebenheit und Fugen kontrolliert werden.', 5);

  -- Lektion 7.5: 7.5 Asphalt-Belagseinbau
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '7.5 Asphalt-Belagseinbau' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '7.5 Asphalt-Belagseinbau', 5, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 5, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist Walzasphalt?', 'Ein bitumenhaltiges Mischgut, das eingebaut und verdichtet wird', 'Ein reiner Beton', 'Ein Holzbelag', 'Ein Dämmstoff', 'A', 'Walzasphalt ist ein bitumenhaltiger Belag, der eingebaut und mit Walzen verdichtet wird.', 1),
    (v_lesson_id, 'Welche Angaben braucht man grundsätzlich zur Berechnung einer Belagsmenge?', 'Fläche, Schichtdicke und Materialkennwert', 'Nur die Anzahl Arbeiter', 'Nur die Lufttemperatur', 'Nur die Farbe des Belags', 'A', 'Belagsmengen werden aus Fläche, Dicke und Materialkennwerten abgeleitet.', 2),
    (v_lesson_id, 'Wozu dient ein Haftvermittler beim Belagseinbau?', 'Er verbessert den Verbund zwischen Unterlage und neuer Belagsschicht', 'Er ersetzt die Verdichtung', 'Er kühlt den Asphalt vollständig ab', 'Er macht Gefälle überflüssig', 'A', 'Haftvermittler verbessert den Schichtenverbund.', 3),
    (v_lesson_id, 'Warum müssen Quer- und Längsfugen fachgerecht ausgebildet werden?', 'Damit keine Schwachstellen, Wassereintritte oder Ausbrüche entstehen', 'Damit der Belag schneller auskühlt', 'Damit weniger Verdichtung nötig ist', 'Damit Unebenheiten grösser werden', 'A', 'Fugen sind sensible Bereiche und müssen dicht, tragfähig und sauber ausgebildet sein.', 4),
    (v_lesson_id, 'Warum muss Asphalt rechtzeitig verdichtet werden?', 'Weil er mit sinkender Temperatur schlechter verdichtbar wird', 'Weil er nach dem Einbau flüssig bleiben soll', 'Weil Verdichtung nur der Optik dient', 'Weil Verdichtung vor dem Einbau erfolgt', 'A', 'Asphalt muss im geeigneten Temperaturfenster verdichtet werden.', 5),
    (v_lesson_id, 'Wann werden Schachtabdeckungen beim Belagseinbau auf definitive Höhe gebracht?', 'Vor oder im Zusammenhang mit dem definitiven Belagsniveau', 'Erst nach mehreren Jahren', 'Nie', 'Immer tiefer als die Fahrbahn', 'A', 'Schachtabdeckungen müssen zur fertigen Oberfläche passen.', 6),
    (v_lesson_id, 'Welche Folge kann ungenügende Verdichtung von Asphalt haben?', 'Spurrinnen, offene Struktur und verkürzte Lebensdauer', 'Automatisch bessere Dichtigkeit', 'Keine Auswirkung', 'Höhere Tragfähigkeit ohne Kontrolle', 'A', 'Ungenügende Verdichtung reduziert Dauerhaftigkeit und kann Verformungen verursachen.', 7);

  -- Lektion 7.6: 7.6 Belagssanierung
  select id into v_lesson_id
    from public.lessons where module_id = v_module_id and title = '7.6 Belagssanierung' limit 1;
  if v_lesson_id is null then
    insert into public.lessons (module_id, title, position, pass_score)
    values (v_module_id, '7.6 Belagssanierung', 6, 70)
    returning id into v_lesson_id;
  else
    update public.lessons set position = 6, pass_score = 70 where id = v_lesson_id;
  end if;
  delete from public.questions where lesson_id = v_lesson_id;
  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values
    (v_lesson_id, 'Was ist vor dem Ausfräsen einer Sanierungsstelle zu tun?', 'Sanierungsstelle gemäss Vorgabe anzeichnen', 'Belag zufällig entfernen', 'Haftvermittler sofort auf Schmutz spritzen', 'Schachtabdeckung entfernen ohne Plan', 'A', 'Sanierungsflächen müssen vor dem Ausbau klar und fachgerecht angezeichnet werden.', 1),
    (v_lesson_id, 'Warum muss eine Sanierungsfläche vor dem Einbau gereinigt werden?', 'Damit Haftvermittler und neuer Belag gut haften', 'Damit der Belag weniger tragfähig wird', 'Damit Wasser eingeschlossen wird', 'Damit keine Fuge nötig ist', 'A', 'Saubere Unterlagen sind Voraussetzung für Haftung und Qualität.', 2),
    (v_lesson_id, 'Welche Aufgabe haben Fugenband oder Fugenmasse bei Sanierungen?', 'Sie dichten Anschlüsse ab und reduzieren Wassereintritt', 'Sie ersetzen den Asphalt', 'Sie verhindern jede Temperaturänderung', 'Sie dienen nur der Farbe', 'A', 'Fugenmaterial schützt Anschlussbereiche vor Wasser und Schäden.', 3),
    (v_lesson_id, 'Wann kann Asphaltarmierung eingesetzt werden?', 'Wenn sie gemäss Vorgabe zur Verstärkung oder Rissüberbrückung vorgesehen ist', 'Immer statt Verdichtung', 'Nur als Dekoration', 'Nie bei Belagssanierungen', 'A', 'Asphaltarmierung kann je nach Schadensbild und Vorgabe zur Verstärkung eingesetzt werden.', 4),
    (v_lesson_id, 'Wie ist ausgebauter bitumenhaltiger Belag zu behandeln?', 'Umweltgerecht deponieren, entsorgen oder verwerten gemäss Vorgaben', 'In die Kanalisation werfen', 'Mit Humus mischen', 'Auf der Baustelle verbrennen', 'A', 'Ausgebauter Belag muss gemäss Umwelt- und Entsorgungsvorgaben behandelt werden.', 5),
    (v_lesson_id, 'Was wird bei der visuellen Kontrolle einer sanierten Belagsfläche geprüft?', 'Höhe, Lage, Gefälle, Struktur und Anschlussbereiche', 'Nur die Anzahl Maschinen', 'Nur die Farbe der Warnwesten', 'Nur der Name des Mischwerks', 'A', 'Die Kontrolle umfasst Oberfläche, Lage, Höhe, Gefälle und Anschlüsse.', 6);

end$$;

commit;
