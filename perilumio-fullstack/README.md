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
