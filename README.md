# Perilumio Release-Version

Diese Version entwickelt den MVP zu einer saubereren Release-Basis weiter.

## Enthalten
- Login mit Supabase Auth
- Dark UI mit Lumio
- Dashboard, Lernpfad, Profil, Freunde, Ranglisten und Quizbattle
- Speichern von Lektionen über /api/lesson-complete
- Speichern von Battle-Ergebnissen über /api/battle-result
- Aggregierte Admin-Statistiken über /api/stats-summary
- CSV-Import für Fragen

## Was jetzt echter ist
- Lernfortschritt wird serverseitig als Versuch + Fortschritt gespeichert
- XP und Level werden beim Abschliessen von Lektionen aktualisiert
- Battle belohnt den Nutzer und aktualisiert Profilwerte
- Admin sieht aggregierte Zahlen für Nutzer, Fortschritte und Versuche

## Setup
1. npm install
2. Supabase-Projekt anlegen
3. SQL aus supabase/schema.sql ausführen
4. .env.example nach .env.local kopieren
5. Demo-Nutzer anlegen
6. npm run dev

## Nächste sinnvolle Schritte
- Registrierung und Passwort-Reset fertig integrieren
- Protected Routes mit Middleware
- echte Freunde-Relationen in Postgres
- persistente Battle-Historie und Matchmaking
- bessere Rollenprüfung für Admins


## ABU Seed v3
- Datei: supabase/seeds/abu_qv_questions.csv
- SQL-Basis: supabase/seeds/abu_qv_seed.sql
- Ablauf: zuerst Module/Lektionen via SQL anlegen, danach Fragen per Import laden
- Lernseite /learn?course=abu lädt den Kurs aus Supabase statt aus hartcodierten Daten


## Admin Import v4
- Neuer Admin-Workflow für CSV-Import im UI
- Server Action: app/actions/import-course.ts
- Komponente: components/AdminImportCard.tsx
- Ziel: ABU-Fragen direkt über den Admin-Bereich in Supabase laden


## Admin Import v5
- Preview vor dem Import
- CSV-Validierung für Pflichtspalten
- Prüfung von correct_option (A-D)
- Fehlerliste bei fehlerhaften Zeilen


## Admin v6
- Tabellenansicht für Fragen
- Speichern/Löschen via Server Actions
- Import-Historie als UI-Skeleton
- Admin-Bereich bündelt Import und Content-Pflege


## Admin v7
- Suche in Fragen und Erklärungen
- Filter nach correct_option
- Bulk-Delete für ausgewählte Fragen
- Import-Logs via import_logs-Tabelle


## Auth v8
- lib/auth.ts mit getCurrentProfile() und requireAdmin()
- /admin zeigt Gate für Nicht-Admins
- Server Actions prüfen Admin-Rolle vor Import/CRUD
- Login-Skeleton unter app/(auth)/login/page.tsx


## ABU Unterlektionen (Smartlearn 1. Teil → 16 × 10 × 10 = 1600 Fragen)
- Strukturmigration: `supabase/migrations/20260536_lesson_sublesson_columns.sql`
  ergänzt `public.lessons` um die nullable Spalten `sublesson_index` und
  `sublesson_total`. Bestehende Lektionen und Fortschrittsdaten bleiben unberührt.
- UI: `components/LearnClient.tsx` liest `sublesson_index/sublesson_total` aus
  der DB und zeigt dynamisch ein Pill „1/N"…„N/N" (aktuell N = 10). XP-,
  Battle- und Progress-Logik bleiben unverändert, da jede Unterlektion eine
  eigenständige `lessons`-Zeile mit eigener UUID ist.
- Eingabe-CSV: `supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv`
  (16 Topics × 100 Fragen). Generator
  `node scripts/build_abu_smartlearn_migration.mjs` erzeugt die destruktive
  und idempotente Daten-Migration
  `20260539_abu_smartlearn_rebuild_10x10.sql`: 16 Basis-Lektionen × 10
  Sequenzen × 10 Fragen (Titel: `<Topic> · 1/10` … `· 10/10`). Verändert
  ausschliesslich ABU-Inhalte (course_key = `abu`).


## Native Apps

Der native Wrapper basiert auf Capacitor. Die App laedt im Remote-Modus die
Production-URL https://perilumio-fullstack-ftmf.vercel.app im WebView. Die
Verzeichnisse `ios/` und `android/` sind Source und werden eingecheckt.

### Voraussetzungen
- Xcode 16 oder neuer
- Android Studio Hedgehog oder neuer
- Java 21
- Node 20 oder neuer

### Workflow
- `npx cap sync` nach Aenderungen an Konfiguration oder Plugins ausfuehren
- `npx cap open ios` oeffnet das Projekt in Xcode, dort Bundle-ID und Signing
  einrichten (Bundle-ID: ch.perilumio.app)
- `npx cap open android` oeffnet das Projekt in Android Studio, dort Keystore
  generieren und Signing konfigurieren (Application-ID: ch.perilumio.app)

### Hinweise
- App-Icons und Splash-Bilder werden separat ueber @capacitor/assets erzeugt und
  sind nicht Teil dieses Setups
- Push-Notifications sind vorbereitet (Permission-Request beim Start), der
  Token-Versand benoetigt spaeter einen APNs-Key (iOS) und einen
  FCM-Service-Account (Android)
- Die Seiten /datenschutz und /impressum enthalten Platzhalter und muessen vor
  der App-Store-Einreichung mit verbindlichen Texten ersetzt werden
