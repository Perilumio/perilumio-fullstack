-- Strassenbau-Fragen: Antwortoptionen vereinheitlichen (Länge/Plausibilität).
-- Aktualisiert Frage-Texte, Optionen und Erklärungen IN-PLACE per
-- (lesson_id, position). Keine deletes/inserts auf public.questions —
-- bestehende question.id bleiben erhalten, somit gehen FK-Daten in
-- public.question_xp_awards und public.battle_answers nicht verloren.
-- public.modules und public.lessons werden nicht angetastet; Lernfortschritt
-- bleibt vollständig erhalten. Idempotent: erneute Ausführung ist sicher.
--
-- Lookup für Lektionen: Titel werden mit beiden bekannten Varianten gesucht
-- (mit oder ohne 'X.Y '-Präfix), da 20260525_strassenbau_friendly_titles
-- den Präfix in bestehenden Datenbanken bereits gestrippt hat.

begin;

do $$
declare
  v_lesson_id uuid;
begin

  -- Lektion 1.1: Arbeitssicherheit und Notfall
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('1.1 Arbeitssicherheit und Notfall', 'Arbeitssicherheit und Notfall')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Welche persönliche Schutzausrüstung gehört auf einer normalen Strassenbaustelle zur Grundausrüstung?',
      option_a = 'Helm, Sicherheitsschuhe und Warnkleidung',
      option_b = 'Turnschuhe, Sonnenbrille und Sommerjacke',
      option_c = 'Handschuhe, Cap und Stoffhose',
      option_d = 'Gehörschutz, Sandalen und Polohemd',
      correct_option = 'A',
      explanation = 'Helm, Sicherheitsschuhe und Warnkleidung gehören zur grundlegenden PSA und müssen gemäss Vorschriften konsequent getragen werden.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Was ist der wichtigste Zweck der persönlichen Schutzausrüstung?',
      option_a = 'Sie ersetzt die Baustellensignalisation und Sperren',
      option_b = 'Sie schützt vor Verletzungen und Gesundheitsrisiken',
      option_c = 'Sie beschleunigt den Arbeitsablauf gemäss Vorgabe',
      option_d = 'Sie ist nur bei Regen oder Schnee vorgeschrieben',
      correct_option = 'B',
      explanation = 'PSA reduziert Verletzungs- und Gesundheitsrisiken, ersetzt aber keine weiteren Sicherheitsmassnahmen.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Welche Gefahr ist beim Arbeiten neben dem öffentlichen Verkehr besonders zu beachten?',
      option_a = 'Zu wenig Beton in der Mischtrommel',
      option_b = 'Blendung durch falsche Bürobeleuchtung',
      option_c = 'Anprall durch Fahrzeuge oder Maschinen',
      option_d = 'Zu tiefe Raum- und Lagertemperatur',
      correct_option = 'C',
      explanation = 'Verkehr und Maschinenbewegungen gehören zu den zentralen Gefahren auf Strassenbaustellen.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Was muss ein Lernender im Notfall zuerst sicherstellen?',
      option_a = 'Dass die Arbeit zügig fertiggestellt wird',
      option_b = 'Dass die Stelle gesichert und Hilfe alarmiert ist',
      option_c = 'Dass alle Werkzeuge gereinigt und versorgt sind',
      option_d = 'Dass der Tagesrapport ordnungsgemäss vorliegt',
      correct_option = 'B',
      explanation = 'Im Notfall haben Sicherung der Unfallstelle, Eigenschutz und Alarmierung Vorrang.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Warum ist Alkohol- oder Drogenkonsum vor der Arbeit besonders gefährlich?',
      option_a = 'Weil dadurch die Arbeitsgeschwindigkeit unkontrolliert steigt',
      option_b = 'Weil Konzentration, Reaktion und Urteil beeinträchtigt sind',
      option_c = 'Weil Maschinen dadurch deutlich weniger Treibstoff verbrauchen',
      option_d = 'Weil dies nur bei reinen Büroarbeiten relevant wird',
      correct_option = 'B',
      explanation = 'Substanzen können Reaktionsfähigkeit und Urteilsvermögen stark beeinträchtigen und erhöhen das Unfallrisiko.'
    where lesson_id = v_lesson_id and position = 5;
    update public.questions set
      prompt = 'Du bemerkst eine ungesicherte Grube neben einem Gehweg. Was ist die fachlich richtige Reaktion?',
      option_a = 'Weiterarbeiten und Passanten verbal warnen',
      option_b = 'Sichern oder melden und Zugang verhindern',
      option_c = 'Werkzeug als Markierung daneben legen',
      option_d = 'Grube mit Wasser auffüllen lassen',
      correct_option = 'B',
      explanation = 'Gefahrenstellen müssen sofort gesichert oder gemeldet werden, besonders wenn Dritte gefährdet sind.'
    where lesson_id = v_lesson_id and position = 6;
  end if;
  v_lesson_id := null;

  -- Lektion 1.2: Arbeitsvorbereitung
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('1.2 Arbeitsvorbereitung', 'Arbeitsvorbereitung')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Welche Unterlagen helfen bei der Vorbereitung einer Tagesbaustelle besonders?',
      option_a = 'Plan, Auftrag, Materialliste, Sicherheit',
      option_b = 'Ferienplan und private Notizen vom Vortag',
      option_c = 'Ein Foto der Baustelle vom Vorarbeiter',
      option_d = 'Wetterbericht der vergangenen Woche',
      correct_option = 'A',
      explanation = 'Für die Vorbereitung braucht es Auftrag, Pläne, Material, Maschinen und Sicherheitsvorgaben.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Warum wird ein Arbeitsablauf vor Beginn sinnvoll geordnet?',
      option_a = 'Damit Wege, Wartezeiten und Fehler sinken',
      option_b = 'Damit die Baustelle möglichst lange dauert',
      option_c = 'Damit weniger Sicherheitsregeln gelten müssen',
      option_d = 'Damit gar keine Maschinen gebraucht werden',
      correct_option = 'A',
      explanation = 'Eine sinnvolle Reihenfolge erhöht Effizienz, Qualität und Sicherheit.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Was bedeutet es, Material und Geräte gemäss Auftrag bereitzustellen?',
      option_a = 'Sämtliches verfügbares Material auf die Baustelle bringen',
      option_b = 'Nur benötigtes Material und passende Geräte rechtzeitig',
      option_c = 'Das Material erst nach Arbeitsende kurzfristig bestellen',
      option_d = 'Vorhandene Geräte ungeprüft und ohne Kontrolle nutzen',
      correct_option = 'B',
      explanation = 'Passendes Material und geeignete Geräte müssen rechtzeitig und auftragsbezogen bereitstehen.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Welche Folge kann eine schlecht vorbereitete Baustelle haben?',
      option_a = 'Tendenziell weniger Unfälle und Risiken',
      option_b = 'Höhere Qualität ohne weitere Kontrollen',
      option_c = 'Verzögerungen, Mehrkosten und Risiken',
      option_d = 'Automatisch tieferer Materialverbrauch',
      correct_option = 'C',
      explanation = 'Mangelhafte Vorbereitung führt häufig zu Verzögerungen, Fehlern, Mehrkosten und erhöhtem Risiko.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 1.3: Umweltschutz
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('1.3 Umweltschutz', 'Umweltschutz')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Was ist beim Entsorgen von Baustellenmaterialien richtig?',
      option_a = 'Alles unsortiert in dieselbe Mulde werfen',
      option_b = 'Materialien trennen und fachgerecht entsorgen',
      option_c = 'Nur den sichtbaren Abfall oberflächlich trennen',
      option_d = 'Gefährliche Stoffe direkt im Boden versickern',
      correct_option = 'B',
      explanation = 'Materialien müssen getrennt und gemäss Entsorgungsvorgaben verwertet oder entsorgt werden.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Wozu dient das Mehrmuldenkonzept?',
      option_a = 'Zur getrennten Sammlung verschiedener Stoffarten',
      option_b = 'Zur sicheren Lagerung von Trinkwasser auf der Baustelle',
      option_c = 'Zum Transport von Personen zwischen Bauabschnitten',
      option_d = 'Zur mechanischen Verdichtung von Walzasphalt',
      correct_option = 'A',
      explanation = 'Das Mehrmuldenkonzept unterstützt die fachgerechte Trennung und Wiederverwertung.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Warum dürfen Treibstoffe nicht ungesichert auf der Baustelle gelagert werden?',
      option_a = 'Weil sie an der Sonne ihre Farbe verlieren können',
      option_b = 'Weil sie Boden und Grundwasser verschmutzen können',
      option_c = 'Weil sie den Beton schneller aushärten lassen können',
      option_d = 'Weil sie nur in den Wintermonaten gefährlich sind',
      correct_option = 'B',
      explanation = 'Treibstoffe und gefährliche Stoffe können bei Austritt Boden und Grundwasser schädigen.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Welche Massnahme reduziert Staub auf einer Baustelle?',
      option_a = 'Trockenes Material aktiv aufwirbeln lassen',
      option_b = 'Flächen befeuchten und staubarm arbeiten',
      option_c = 'Abfälle und Reste auf der Baustelle verbrennen',
      option_d = 'Maschinen ständig im Leerlauf weiterlaufen lassen',
      correct_option = 'B',
      explanation = 'Befeuchten und angepasste Arbeitsmethoden können Staubemissionen reduzieren.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Ein Kanister mit Diesel läuft aus. Was ist zuerst zu tun?',
      option_a = 'Weiterarbeiten und nach Feierabend reinigen',
      option_b = 'Stoppen, Bindemittel einsetzen, Vorgesetzte melden',
      option_c = 'Diesel mit Wasser in die Wiese spülen',
      option_d = 'Den Kanister in die offene Baugrube werfen',
      correct_option = 'B',
      explanation = 'Bei umweltgefährdenden Stoffen sind Sofortmassnahmen nötig: Ausbreitung stoppen, aufnehmen und melden.'
    where lesson_id = v_lesson_id and position = 5;
  end if;
  v_lesson_id := null;

  -- Lektion 1.4: Ausmass und Rapport
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('1.4 Ausmass und Rapport', 'Ausmass und Rapport')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Welche Angabe gehört in einen Tagesrapport?',
      option_a = 'Persönliches Lieblingswerkzeug der Lernenden',
      option_b = 'Mengen, Personal, Maschinen und Arbeiten',
      option_c = 'Privatadresse aller Mitarbeitenden der Equipe',
      option_d = 'Wetterbericht der gesamten Vorwoche',
      correct_option = 'B',
      explanation = 'Rapporte müssen nachvollziehbare Angaben zu Leistung, Personal, Maschinen und Mengen enthalten.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Wozu dient ein Ausmass?',
      option_a = 'Zur Ermittlung und Dokumentation der Mengen',
      option_b = 'Zur Festlegung der Pausenzeit für die Equipe',
      option_c = 'Zum dekorativen Beschriften der Baustelle',
      option_d = 'Zum Ersetzen geltender Sicherheitsvorschriften',
      correct_option = 'A',
      explanation = 'Ein Ausmass dokumentiert Mengen und ist wichtig für Kontrolle, Abrechnung und Nachvollziehbarkeit.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Was macht eine Baustellenskizze nachvollziehbar?',
      option_a = 'Möglichst viele Farben ohne klare Masse',
      option_b = 'Masse, Lagebezug und klare Beschriftung',
      option_c = 'Nur ein einzelner Pfeil als Markierung',
      option_d = 'Eine mündliche Erklärung ohne Zeichnung',
      correct_option = 'B',
      explanation = 'Eine gute Skizze enthält relevante Masse, Lagebezüge und verständliche Beschriftungen.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Warum muss eine Dokumentation auch für Dritte verständlich sein?',
      option_a = 'Damit Kontrolle, Weiterarbeit und Abrechnung möglich sind',
      option_b = 'Damit der Inhalt möglichst geheim und vertraulich bleibt',
      option_c = 'Damit künftig gar keine Baupläne mehr nötig werden',
      option_d = 'Damit kleine Ausführungsfehler weniger stark auffallen',
      correct_option = 'A',
      explanation = 'Dokumentationen müssen Arbeiten für Kontrolle, Übergabe und Abrechnung nachvollziehbar machen.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 1.5: Maschineneinsatz
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('1.5 Maschineneinsatz', 'Maschineneinsatz')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Was ist vor der Inbetriebnahme einer Kleinmaschine zu prüfen?',
      option_a = 'Nur die äussere Farbe der Maschine',
      option_b = 'Zustand, Sicherheit und Betriebsbereitschaft',
      option_c = 'Ob sie optisch fabrikneu aussieht',
      option_d = 'Ob sie möglichst laut betrieben wird',
      correct_option = 'B',
      explanation = 'Vor dem Einsatz sind Zustand, Sicherheitsvorrichtungen und Betriebsbereitschaft zu kontrollieren.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Was gehört zum Parkdienst einer Maschine?',
      option_a = 'Reinigen, Kontrollieren, Schmieren, Abstellen',
      option_b = 'Maschine ungereinigt am Standort belassen',
      option_c = 'Treibstoff offen in den Boden entleeren',
      option_d = 'Lediglich den Zündschlüssel sauber abziehen',
      correct_option = 'A',
      explanation = 'Parkdienst umfasst Reinigung, Kontrolle, Pflege und sicheres Abstellen.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Warum müssen Treibstoffe und Schmiermittel passend zur Maschine gewählt werden?',
      option_a = 'Damit Motor und Bauteile sauber funktionieren',
      option_b = 'Damit die Maschine spürbar schwerer wird',
      option_c = 'Damit sichtbar mehr Abgasrauch entsteht',
      option_d = 'Damit weitere Wartungsarbeiten entfallen',
      correct_option = 'A',
      explanation = 'Falsche Betriebsstoffe können Maschinen beschädigen und Umwelt- oder Sicherheitsprobleme verursachen.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Eine Maschine zeigt vor Arbeitsbeginn einen Defekt an der Sicherheitsvorrichtung. Was ist richtig?',
      option_a = 'Trotzdem nutzen wenn es zeitlich dringend ist',
      option_b = 'Maschine nicht verwenden und den Defekt melden',
      option_c = 'Sicherheitsvorrichtung kurzerhand selbst entfernen',
      option_d = 'Maschine nur im langsamen Modus weiter nutzen',
      correct_option = 'B',
      explanation = 'Defekte Sicherheitsvorrichtungen sind ein Ausschlussgrund für den Einsatz und müssen gemeldet werden.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 2.1: Baustelleneinrichtung und Signalisation
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('2.1 Baustelleneinrichtung und Signalisation', 'Baustelleneinrichtung und Signalisation')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Was gehört zu einer betriebsbereiten Baustelle?',
      option_a = 'Zugänge, Signalisation und Arbeitsmittel',
      option_b = 'Nur eine offene und ebene Materialfläche',
      option_c = 'Eine Baustelle gänzlich ohne Absperrung',
      option_d = 'Werkzeuge ohne erkennbare Ordnung',
      correct_option = 'A',
      explanation = 'Eine Baustelle ist betriebsbereit, wenn Sicherheit, Organisation und Arbeitsmittel gewährleistet sind.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Warum muss die Baustellensignalisation normgerecht aufgestellt werden?',
      option_a = 'Damit Verkehr und Arbeitende geschützt werden',
      option_b = 'Damit die Baustelle insgesamt schöner aussieht',
      option_c = 'Damit weniger Material und Personal nötig ist',
      option_d = 'Damit keinerlei Baupläne mehr nötig werden',
      correct_option = 'A',
      explanation = 'Normgerechte Signalisation schützt Arbeitende, Verkehr und Dritte.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Was ist bei der Einrichtung einer Baustelle besonders wichtig?',
      option_a = 'Material lagern für sichere Wege und Abläufe',
      option_b = 'Material grossflächig und zufällig verteilen',
      option_c = 'Zufahrten und Notausgänge blockieren',
      option_d = 'Warnkleidung auf der Baustelle vermeiden',
      correct_option = 'A',
      explanation = 'Sichere und effiziente Abläufe hängen stark von guter Ordnung und Materialplatzierung ab.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Was kontrollierst du vor Arbeitsbeginn auf einer eingerichteten Baustelle?',
      option_a = 'Nur ob auf der Baustelle Kaffee vorhanden ist',
      option_b = 'Sicherheit, Vollständigkeit, Betriebsbereitschaft',
      option_c = 'Nur die Farbe der eingesetzten Absperrungen',
      option_d = 'Nur ob niemand Rückfragen zur Arbeit stellt',
      correct_option = 'B',
      explanation = 'Die Einrichtung muss auf Sicherheit, Vollständigkeit und Betriebsbereitschaft geprüft werden.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 2.2: Vermessung
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('2.2 Vermessung', 'Vermessung')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Wozu dienen Referenzpunkte beim Abstecken?',
      option_a = 'Zur genauen Übertragung von Lage und Höhe',
      option_b = 'Zur ästhetischen Dekoration der Baustelle',
      option_c = 'Zum geordneten Lagern von Handwerkzeugen',
      option_d = 'Zum Messen von Lufttemperatur und Wind',
      correct_option = 'A',
      explanation = 'Referenzpunkte ermöglichen die genaue Übertragung von Plänen ins Gelände.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Welche Folge kann eine falsche Höhenmessung haben?',
      option_a = 'Falsches Gefälle und fehlerhafte Anschlüsse',
      option_b = 'Automatisch deutlich bessere Verdichtung',
      option_c = 'Insgesamt weniger Kontrollbedarf im Bauprozess',
      option_d = 'Mehr Sicherheit auch ohne weitere Massnahmen',
      correct_option = 'A',
      explanation = 'Höhenfehler können Funktion, Entwässerung und Anschlüsse stark beeinträchtigen.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Wie sind Messgeräte auf der Baustelle zu behandeln?',
      option_a = 'Sorgfältig und gemäss Bedienungsvorgaben',
      option_b = 'Gleich behandelt wie einfache Schaufeln',
      option_c = 'Ungeschützt im Regen und im Schmutz',
      option_d = 'Grob da Messungen ohnehin gleich sind',
      correct_option = 'A',
      explanation = 'Messgeräte müssen sorgfältig behandelt werden, weil Messfehler grosse Folgen haben können.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Wann ist eine Kontrollmessung besonders sinnvoll?',
      option_a = 'Wenn Lage oder Höhe für Folgearbeiten zählt',
      option_b = 'Ausschliesslich nach dem regulären Feierabend',
      option_c = 'Wenn überhaupt keine Pläne vorhanden sind',
      option_d = 'Nie wenn besonders schnell gearbeitet wird',
      correct_option = 'A',
      explanation = 'Kontrollmessungen sichern die Qualität, besonders bei massgebenden Höhen und Linien.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 2.3: Beton- und Schalungsarbeiten
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('2.3 Beton- und Schalungsarbeiten', 'Beton- und Schalungsarbeiten')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Welche Aufgabe hat eine Schalung beim Betonieren?',
      option_a = 'Sie gibt dem Beton bis zum Erhärten die Form',
      option_b = 'Sie ersetzt die statisch nötige Bewehrung',
      option_c = 'Sie dient ausschliesslich der Dekoration',
      option_d = 'Sie macht jede Nachbehandlung unnötig',
      correct_option = 'A',
      explanation = 'Schalungen halten den frischen Beton in Form, bis er ausreichend erhärtet ist.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Welche Funktion hat Bewehrung im Stahlbeton?',
      option_a = 'Sie nimmt Zugkräfte auf und stützt die Tragfähigkeit',
      option_b = 'Sie macht den Frischbeton beim Einbau flüssiger',
      option_c = 'Sie ersetzt die ringsum aufgestellte Schalung',
      option_d = 'Sie verhindert jede Form von Rissbildung im Beton',
      correct_option = 'A',
      explanation = 'Bewehrung ergänzt Beton, indem sie Zugkräfte aufnehmen kann.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Warum wird Beton verdichtet?',
      option_a = 'Um Hohlräume zu reduzieren und tragfähig zu sein',
      option_b = 'Um zusätzliche Luftblasen aktiv einzubauen',
      option_c = 'Um die Oberfläche schneller zu verschmutzen',
      option_d = 'Um die Schalung anschliessend zu entfernen',
      correct_option = 'A',
      explanation = 'Verdichtung reduziert Lufteinschlüsse und verbessert Festigkeit und Dauerhaftigkeit.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Warum ist die Nachbehandlung von Beton wichtig?',
      option_a = 'Schutz vor Austrocknen und für die Festigkeit',
      option_b = 'Ersetzt jede sonstige Kontrolle und Prüfung',
      option_c = 'Macht den Beton sofort voll belastbar',
      option_d = 'Dient lediglich der optischen Wirkung',
      correct_option = 'A',
      explanation = 'Nachbehandlung verhindert schädliches Austrocknen und unterstützt die Erhärtung.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 2.4: Fertigteile und Montage
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('2.4 Fertigteile und Montage', 'Fertigteile und Montage')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Worauf müssen Betonfertigteile beim Versetzen aufliegen?',
      option_a = 'Vorbereitete, tragfähige und ebene Unterlage',
      option_b = 'Auf losem und durchfeuchtetem Bauabfall',
      option_c = 'Direkt auf stehendem Wasser im Graben',
      option_d = 'Auf ungeprüftem Humus oder Oberboden',
      correct_option = 'A',
      explanation = 'Fertigteile benötigen eine geeignete Unterlage, damit Lage und Stabilität stimmen.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Warum müssen Versetzvorschriften eingehalten werden?',
      option_a = 'Damit Teile sicher, lagegenau und unbeschädigt sind',
      option_b = 'Damit die ausgeführte Arbeit beliebig wird',
      option_c = 'Damit später keine Kontrolle mehr nötig ist',
      option_d = 'Damit sichtbar mehr Material verbraucht wird',
      correct_option = 'A',
      explanation = 'Versetzvorschriften sichern Qualität, Sicherheit und Dauerhaftigkeit.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Wie schützt man Fertigteile während des Bauprozesses?',
      option_a = 'Sorgfältiger Transport, geeignete Lagerung',
      option_b = 'Mit Schwung auf die Baustelle werfen',
      option_c = 'Direkt im Bereich von Fahrwegen lagern',
      option_d = 'Sämtliche Kanten vorab grob entfernen',
      correct_option = 'A',
      explanation = 'Fertigteile müssen vor mechanischen Schäden und Witterung geschützt werden.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Was kann bei einer visuellen Kontrolle von Fertigteilen erkannt werden?',
      option_a = 'Schäden, falsche Lage, Montagefehler',
      option_b = 'Nur das exakte Gewicht des Bauteils',
      option_c = 'Nur das Alter des verwendeten Betons',
      option_d = 'Praktisch keinerlei fachliche Mängel',
      correct_option = 'A',
      explanation = 'Sichtkontrollen helfen, Schäden und Ausführungsmängel frühzeitig zu erkennen.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 2.5: Baustelle abräumen
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('2.5 Baustelle abräumen', 'Baustelle abräumen')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Was bedeutet Baustelle fachgerecht abräumen?',
      option_a = 'Material, Inventar, Signalisation geordnet entfernen',
      option_b = 'Sämtliches Material auf der Baustelle liegen lassen',
      option_c = 'Lediglich die eingesetzten Maschinen abholen lassen',
      option_d = 'Anfallende Abfälle direkt im Aushub vergraben',
      correct_option = 'A',
      explanation = 'Beim Abräumen wird die Baustelle vollständig und vorschriftsgemäss zurückgegeben.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Was ist beim Entfernen der Baustellensignalisation wichtig?',
      option_a = 'Entfernen erst wenn keine Gefahr mehr besteht',
      option_b = 'Sie wird grundsätzlich immer zuerst entfernt',
      option_c = 'Sie bleibt nach Bauende dauerhaft bestehen',
      option_d = 'Sie wird unsortiert am Strassenrand gelagert',
      correct_option = 'A',
      explanation = 'Signalisation schützt bis zum Ende der Gefährdung und muss kontrolliert entfernt werden.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Was bedeutet Transporttauglichkeit von Material?',
      option_a = 'Gesichert, sauber, ohne Gefahr transportierbar',
      option_b = 'Material liegt lose und ungesichert auf dem Lkw',
      option_c = 'Material ist möglichst nass und schwer geladen',
      option_d = 'Material wird ungeprüft und sehr eilig geladen',
      correct_option = 'A',
      explanation = 'Transporttaugliches Material ist für sicheren Abtransport vorbereitet und gesichert.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Warum wird die Baustelle vor der Rückgabe kontrolliert?',
      option_a = 'Bestätigung Vollständigkeit, Sicherheit, Zustand',
      option_b = 'Um die laufende Arbeit gezielt zu verzögern',
      option_c = 'Um aufgetretene Fehler vor Dritten zu verstecken',
      option_d = 'Um keine offizielle Meldung machen zu müssen',
      correct_option = 'A',
      explanation = 'Die Abschlusskontrolle stellt sicher, dass alle Vorgaben erfüllt sind.'
    where lesson_id = v_lesson_id and position = 4;
  end if;
  v_lesson_id := null;

  -- Lektion 7.1: Erdbau und Planum
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('7.1 Erdbau und Planum', 'Erdbau und Planum')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Was ist beim Humusabtrag besonders wichtig?',
      option_a = 'Humus getrennt abtragen und sauber lagern',
      option_b = 'Humus mit Kies und Splitt vermischen',
      option_c = 'Humus als Fundationsschicht einbauen',
      option_d = 'Humus in die Mischkanalisation spülen',
      correct_option = 'A',
      explanation = 'Bodenmaterialien müssen getrennt behandelt und deponiert werden.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Warum werden Bodenmaterialien getrennt deponiert?',
      option_a = 'Für korrekte Wiederverwendung oder Entsorgung',
      option_b = 'Damit nachher deutlich mehr Platz verbraucht wird',
      option_c = 'Damit sich die Materialien schneller vermischen',
      option_d = 'Damit keine weitere Kontrolle mehr nötig wird',
      correct_option = 'A',
      explanation = 'Getrennte Deponierung ermöglicht korrekte Wiederverwendung, Entsorgung und Qualitätssicherung.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Was ist ein Planum im Strassenbau?',
      option_a = 'Profilgerechte Unterlage für den Oberbau',
      option_b = 'Die fertig eingebaute Asphaltdeckschicht',
      option_c = 'Ein Standard-Rapportformular der Baustelle',
      option_d = 'Ein häufig genutztes Baustellenfahrzeug',
      correct_option = 'A',
      explanation = 'Das Planum bildet die vorbereitete Grundlage für weitere Schichten.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Warum ist die Tragfähigkeit des Planums wichtig?',
      option_a = 'Sie beeinflusst Stabilität und Lebensdauer der Strasse',
      option_b = 'Sie bestimmt die Farbe des aufgebrachten Asphalts',
      option_c = 'Sie ersetzt eine fachgerecht eingebaute Entwässerung',
      option_d = 'Sie ist ausschliesslich für Gehwege wirklich relevant',
      correct_option = 'A',
      explanation = 'Ein tragfähiges Planum ist Voraussetzung für einen dauerhaften Strassenoberbau.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Welche Massnahme reduziert Gefahren bei Aushubarbeiten?',
      option_a = 'Grabenränder sichern und Abstände einhalten',
      option_b = 'Material direkt an die Grabenkante kippen lassen',
      option_c = 'Ohne weitere Kontrolle in den Graben steigen',
      option_d = 'Sämtliche Absperrungen rund um den Graben entfernen',
      correct_option = 'A',
      explanation = 'Sicherung, Abstand und Kontrolle reduzieren Einsturz- und Unfallgefahren.'
    where lesson_id = v_lesson_id and position = 5;
  end if;
  v_lesson_id := null;

  -- Lektion 7.2: Leitungs- und Grabenbau
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('7.2 Leitungs- und Grabenbau', 'Leitungs- und Grabenbau')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Wozu dient eine Grabenspriessung?',
      option_a = 'Sie verhindert das Einstürzen der Grabenwände',
      option_b = 'Sie ersetzt das eigentliche Kanalisationsrohr',
      option_c = 'Sie erhöht den Wasserverbrauch der Baustelle',
      option_d = 'Sie dient nur als optische Markierungslinie',
      correct_option = 'A',
      explanation = 'Spriessungen sichern Gräben gegen Einsturz und schützen Personen.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Welche Aufgabe hat die Bettungsschicht bei Rohrleitungen?',
      option_a = 'Sie trägt und schützt das Rohr in richtiger Lage',
      option_b = 'Sie verschliesst die Öffnung des verlegten Rohrs',
      option_c = 'Sie ersetzt den ringsum eingebauten Schacht',
      option_d = 'Sie verhindert jede künftige Kontrollmöglichkeit',
      correct_option = 'A',
      explanation = 'Eine fachgerechte Bettung sichert Lage, Schutz und Funktion der Leitung.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Was ist beim Verlegen von Kanalisationsrohren entscheidend?',
      option_a = 'Richtige Höhenlage, Linie und Gefälle',
      option_b = 'Möglichst viele Richtungswechsel pro Strecke',
      option_c = 'Unkontrollierte und wechselnde Neigung',
      option_d = 'Direkt auf grossen Brocken im Graben verlegen',
      correct_option = 'A',
      explanation = 'Höhe, Linie und Gefälle bestimmen die Funktion der Leitung.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Warum müssen Schachtabdeckungen auf Gefälle und Höhe versetzt werden?',
      option_a = 'Damit sie bündig und entwässerungsgerecht liegen',
      option_b = 'Damit sie deutlich aus der Oberfläche hervorstehen',
      option_c = 'Damit Fahrzeuge den Schächten dauerhaft ausweichen',
      option_d = 'Damit Wasser auf der Oberfläche stehen bleibt',
      correct_option = 'A',
      explanation = 'Schachtabdeckungen müssen zur fertigen Oberfläche und zum Gefälle passen.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Welche Folge kann eine falsche Rohrneigung haben?',
      option_a = 'Ablagerungen, Rückstau, mangelhafte Entwässerung',
      option_b = 'Bessere Selbstreinigung der gesamten Leitung',
      option_c = 'Automatisch deutlich höhere Stabilität der Trasse',
      option_d = 'Spürbar geringerer Unterhalt über viele Jahre',
      correct_option = 'A',
      explanation = 'Falsche Neigung beeinträchtigt die Funktion von Entwässerung und Kanalisation.'
    where lesson_id = v_lesson_id and position = 5;
  end if;
  v_lesson_id := null;

  -- Lektion 7.3: Fundationen und Planien
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('7.3 Fundationen und Planien', 'Fundationen und Planien')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Wozu können Geotextilien im Strassenbau dienen?',
      option_a = 'Trennen, Filtern oder Stabilisieren von Schichten',
      option_b = 'Vollständiger Ersatz aller Fundationsschichten',
      option_c = 'Einfärben des Belags in unterschiedlichen Farben',
      option_d = 'Tagesrapport für die ausgeführten Arbeiten',
      correct_option = 'A',
      explanation = 'Geotextilien werden je nach Produkt zum Trennen, Filtern, Schützen oder Stabilisieren eingesetzt.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Was beschreibt eine profilgerechte Rohplanie?',
      option_a = 'Grobe Planie mit richtiger Form und Höhe',
      option_b = 'Eine fertig verdichtete Asphaltdeckschicht',
      option_c = 'Eine Dilatationsfuge im Betonbelag',
      option_d = 'Eine offene Mulde für Bauabfall',
      correct_option = 'A',
      explanation = 'Die Rohplanie bereitet Form und Höhe für weitere Schichten vor.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Warum muss die Feinplanie präzise erstellt werden?',
      option_a = 'Sie steuert Ebenheit, Dicke und Folgequalität',
      option_b = 'Weil sie ausschliesslich optisch entscheidend ist',
      option_c = 'Weil für sie überhaupt keine Höhe gilt',
      option_d = 'Weil sie später nicht mehr belastet wird',
      correct_option = 'A',
      explanation = 'Die Feinplanie beeinflusst die Genauigkeit und Qualität des Oberbaus.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Woran kann ungenügende Verdichtung visuell erkennbar sein?',
      option_a = 'Starke Radeindrücke und nachgebendes Material',
      option_b = 'Sauber gewaschene und gebügelte Warnkleidung',
      option_c = 'Ein neu erworbener Klappmeterstab der Equipe',
      option_d = 'Die Farbe und Bewölkung des Himmels',
      correct_option = 'A',
      explanation = 'Radeindrücke und nachgebende Stellen können Hinweise auf ungenügende Verdichtung sein.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Welche Faktoren beeinflussen die Lebensdauer eines Strassenoberbaus stark?',
      option_a = 'Tragfähigkeit, Verdichtung, Material, Entwässerung',
      option_b = 'Nur die optische Farbe des fertigen Belags',
      option_c = 'Lediglich Länge und Häufigkeit der Pausen',
      option_d = 'Allein die Anzahl Mitarbeitender pro Schicht',
      correct_option = 'A',
      explanation = 'Strassenoberbau hält länger, wenn Material, Verdichtung, Tragfähigkeit und Entwässerung stimmen.'
    where lesson_id = v_lesson_id and position = 5;
  end if;
  v_lesson_id := null;

  -- Lektion 7.4: Pflästerung
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('7.4 Pflästerung', 'Pflästerung')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Welche Funktion haben Randabschlüsse?',
      option_a = 'Begrenzen, stabilisieren und Linien führen',
      option_b = 'Sie ersetzen vollständig die Fundationsschicht',
      option_c = 'Sie dienen nur als bequeme Sitzgelegenheit',
      option_d = 'Sie verhindern jede Form der Entwässerung',
      correct_option = 'A',
      explanation = 'Randabschlüsse begrenzen, stabilisieren und gestalten Verkehrsflächen.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Was ist vor dem Versetzen von Randabschlüssen zu kontrollieren?',
      option_a = 'Höhe, Linie und Lage gemäss Plan',
      option_b = 'Nur die Farbe der eingebauten Steine',
      option_c = 'Lediglich ob genug Pausenzeit bleibt',
      option_d = 'Ob der Beton bereits eingebaut wurde',
      correct_option = 'A',
      explanation = 'Randabschlüsse müssen nach korrekter Höhe und Linienführung versetzt werden.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Welche Aufgabe haben Dilatationsfugen?',
      option_a = 'Bewegungen aufnehmen und Schäden vermeiden',
      option_b = 'Sie erhöhen den Wasserstau in der Fläche',
      option_c = 'Sie ersetzen den umliegenden Beton bei Bedarf',
      option_d = 'Sie dienen nur der Beschriftung der Fläche',
      correct_option = 'A',
      explanation = 'Dilatationsfugen ermöglichen Bewegungen und reduzieren Riss- oder Abplatzschäden.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Was ist beim Verlegen von Betonverbundsteinen wichtig?',
      option_a = 'Fugen, Ebenheit, Verband und Gefälle',
      option_b = 'Steine ungeordnet auf die Fläche werfen',
      option_c = 'Verlegen ohne jegliche Bettungsschicht',
      option_d = 'Das vorgegebene Gefälle bewusst ignorieren',
      correct_option = 'A',
      explanation = 'Qualität entsteht durch korrekten Verband, Fugenbild, Ebenheit und Gefälle.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Welche Kontrolle ist nach Versetzarbeiten sinnvoll?',
      option_a = 'Linie, Fugen, Höhe und Ebenheit prüfen',
      option_b = 'Lediglich übrig gebliebene Steine zählen',
      option_c = 'Keine Kontrolle wenn es gerade aussieht',
      option_d = 'Nur das eingesetzte Werkzeug reinigen',
      correct_option = 'A',
      explanation = 'Nach Versetzarbeiten müssen Linie, Höhe, Ebenheit und Fugen kontrolliert werden.'
    where lesson_id = v_lesson_id and position = 5;
  end if;
  v_lesson_id := null;

  -- Lektion 7.5: Asphalt-Belagseinbau
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('7.5 Asphalt-Belagseinbau', 'Asphalt-Belagseinbau')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Was ist Walzasphalt?',
      option_a = 'Bitumenmischgut, eingebaut und verdichtet',
      option_b = 'Ein hochfester reiner Zementbeton mit Fasern',
      option_c = 'Ein dekorativer Bodenbelag aus Hartholz',
      option_d = 'Ein wärmedämmender Mineralfaserstoff zum Einbau',
      correct_option = 'A',
      explanation = 'Walzasphalt ist ein bitumenhaltiger Belag, der eingebaut und mit Walzen verdichtet wird.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Welche Angaben braucht man grundsätzlich zur Berechnung einer Belagsmenge?',
      option_a = 'Fläche, Schichtdicke und Materialkennwert',
      option_b = 'Nur die aktuelle Anzahl Arbeiter',
      option_c = 'Lediglich die Lufttemperatur in Grad',
      option_d = 'Allein die Farbe des fertigen Belags',
      correct_option = 'A',
      explanation = 'Belagsmengen werden aus Fläche, Dicke und Materialkennwerten abgeleitet.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Wozu dient ein Haftvermittler beim Belagseinbau?',
      option_a = 'Verbund zwischen Unterlage und neuer Schicht',
      option_b = 'Er ersetzt die anschliessende Verdichtung',
      option_c = 'Er kühlt den heissen Asphalt vollständig ab',
      option_d = 'Er macht ein Gefälle der Fläche überflüssig',
      correct_option = 'A',
      explanation = 'Haftvermittler verbessert den Schichtenverbund.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Warum müssen Quer- und Längsfugen fachgerecht ausgebildet werden?',
      option_a = 'Damit keine Schwachstellen oder Ausbrüche entstehen',
      option_b = 'Damit der Belag deutlich schneller auskühlt',
      option_c = 'Damit erheblich weniger Verdichtung nötig wird',
      option_d = 'Damit Unebenheiten in der Fläche grösser werden',
      correct_option = 'A',
      explanation = 'Fugen sind sensible Bereiche und müssen dicht, tragfähig und sauber ausgebildet sein.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Warum muss Asphalt rechtzeitig verdichtet werden?',
      option_a = 'Weil er mit sinkender Temperatur schlechter wird',
      option_b = 'Weil er nach dem Einbau flüssig bleiben muss',
      option_c = 'Weil Verdichtung nur der Optik dient',
      option_d = 'Weil Verdichtung schon vor dem Einbau erfolgt',
      correct_option = 'A',
      explanation = 'Asphalt muss im geeigneten Temperaturfenster verdichtet werden.'
    where lesson_id = v_lesson_id and position = 5;
    update public.questions set
      prompt = 'Wann werden Schachtabdeckungen beim Belagseinbau auf definitive Höhe gebracht?',
      option_a = 'Vor oder mit dem definitiven Belagsniveau',
      option_b = 'Erst mehrere Jahre nach dem Einbau',
      option_c = 'Grundsätzlich nie nach dem Einbau',
      option_d = 'Stets sichtbar tiefer als die Fahrbahn',
      correct_option = 'A',
      explanation = 'Schachtabdeckungen müssen zur fertigen Oberfläche passen.'
    where lesson_id = v_lesson_id and position = 6;
    update public.questions set
      prompt = 'Welche Folge kann ungenügende Verdichtung von Asphalt haben?',
      option_a = 'Spurrinnen, offene Struktur, kürzere Lebensdauer',
      option_b = 'Automatisch deutlich bessere Dichtigkeit',
      option_c = 'Vollkommen ohne Auswirkung auf den Belag',
      option_d = 'Höhere Tragfähigkeit ganz ohne Kontrolle',
      correct_option = 'A',
      explanation = 'Ungenügende Verdichtung reduziert Dauerhaftigkeit und kann Verformungen verursachen.'
    where lesson_id = v_lesson_id and position = 7;
  end if;
  v_lesson_id := null;

  -- Lektion 7.6: Belagssanierung
  select l.id into v_lesson_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau'
     and l.title in ('7.6 Belagssanierung', 'Belagssanierung')
   limit 1;
  if v_lesson_id is not null then
    update public.questions set
      prompt = 'Was ist vor dem Ausfräsen einer Sanierungsstelle zu tun?',
      option_a = 'Sanierungsstelle gemäss Vorgabe anzeichnen',
      option_b = 'Belag ohne Plan und Markierung entfernen',
      option_c = 'Haftvermittler direkt auf den Schmutz spritzen',
      option_d = 'Die Schachtabdeckung ohne Plan ausbauen',
      correct_option = 'A',
      explanation = 'Sanierungsflächen müssen vor dem Ausbau klar und fachgerecht angezeichnet werden.'
    where lesson_id = v_lesson_id and position = 1;
    update public.questions set
      prompt = 'Warum muss eine Sanierungsfläche vor dem Einbau gereinigt werden?',
      option_a = 'Damit Haftvermittler und Belag gut haften',
      option_b = 'Damit der neue Belag weniger tragfähig wird',
      option_c = 'Damit darunter Wasser eingeschlossen bleibt',
      option_d = 'Damit gar keine Anschlussfuge nötig wird',
      correct_option = 'A',
      explanation = 'Saubere Unterlagen sind Voraussetzung für Haftung und Qualität.'
    where lesson_id = v_lesson_id and position = 2;
    update public.questions set
      prompt = 'Welche Aufgabe haben Fugenband oder Fugenmasse bei Sanierungen?',
      option_a = 'Anschlüsse abdichten und Wassereintritt mindern',
      option_b = 'Sie ersetzen vollständig den eingebauten Asphalt',
      option_c = 'Sie verhindern jede Form der Temperaturänderung',
      option_d = 'Sie dienen ausschliesslich der Farbgebung',
      correct_option = 'A',
      explanation = 'Fugenmaterial schützt Anschlussbereiche vor Wasser und Schäden.'
    where lesson_id = v_lesson_id and position = 3;
    update public.questions set
      prompt = 'Wann kann Asphaltarmierung eingesetzt werden?',
      option_a = 'Gemäss Vorgabe zur Verstärkung oder Rissüberbrückung',
      option_b = 'Grundsätzlich immer anstelle der Verdichtung',
      option_c = 'Ausschliesslich als rein dekoratives Element',
      option_d = 'Niemals im Rahmen von Belagssanierungen',
      correct_option = 'A',
      explanation = 'Asphaltarmierung kann je nach Schadensbild und Vorgabe zur Verstärkung eingesetzt werden.'
    where lesson_id = v_lesson_id and position = 4;
    update public.questions set
      prompt = 'Wie ist ausgebauter bitumenhaltiger Belag zu behandeln?',
      option_a = 'Umweltgerecht entsorgen oder verwerten gemäss Vorgaben',
      option_b = 'Einfach in die Kanalisation oder den Bach werfen',
      option_c = 'Mit Humus und Bauabfall vermischt deponieren',
      option_d = 'Direkt vor Ort offen auf der Baustelle verbrennen',
      correct_option = 'A',
      explanation = 'Ausgebauter Belag muss gemäss Umwelt- und Entsorgungsvorgaben behandelt werden.'
    where lesson_id = v_lesson_id and position = 5;
    update public.questions set
      prompt = 'Was wird bei der visuellen Kontrolle einer sanierten Belagsfläche geprüft?',
      option_a = 'Höhe, Lage, Gefälle, Struktur, Anschlüsse',
      option_b = 'Nur die Anzahl der eingesetzten Maschinen',
      option_c = 'Nur die Farbe der getragenen Warnwesten',
      option_d = 'Lediglich der Name des liefernden Mischwerks',
      correct_option = 'A',
      explanation = 'Die Kontrolle umfasst Oberfläche, Lage, Höhe, Gefälle und Anschlüsse.'
    where lesson_id = v_lesson_id and position = 6;
  end if;
  v_lesson_id := null;
end$$;

commit;
