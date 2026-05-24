#!/usr/bin/env node
// Erzeugt eine destruktive + idempotente Migration, die den ABU-Kurs
// vollständig aus supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv neu
// aufbaut: 16 Lektionen (= topics) × 10 Sequenzen × 10 Fragen = 1600 Fragen.
//
// Ablauf der erzeugten Migration:
//   1. Sichere FK-Verkettung vorbereiten: ABU-Fortschritt, ABU-Versuche und
//      ABU-Fragen werden über ON DELETE CASCADE der lessons gelöscht. battle_answers.question_id
//      ist auf SET NULL gesetzt – kein Eingriff nötig.
//   2. Alle Lektionen aller Module mit course_key = 'abu' löschen (cascade
//      räumt questions, lesson_progress, lesson_attempts, question_xp_awards).
//   3. Sicherstellen, dass genau ein ABU-Modul (Titel: 'Allgemeinbildung (ABU) – RLP 2025')
//      existiert. Etwaige veraltete ABU-Module bleiben ohne Lektionen leer
//      (Schema kennt keinen Modul-Cascade vom Kurs, daher sind diese Module
//      harmlos und werden von der UI ignoriert, wenn sie leer sind).
//   4. Pro Lektion 10 Sublesson-Zeilen in `lessons` einfügen
//      ('<topic> · 1/10' .. '· 10/10') mit sublesson_index/sublesson_total.
//   5. Pro Sublesson die 10 Fragen positionsbasiert (1..10) einfügen.
//
// Verändert ausschliesslich ABU-Inhalte (course_key = 'abu'). Andere Kurse
// werden nicht angerührt.

import fs from 'node:fs';
import path from 'node:path';

const SEED_PATH = 'supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv';
const OUT_PATH = 'supabase/migrations/20260539_abu_smartlearn_rebuild_10x10.sql';

const SUB_COUNT = 10;
const QUESTIONS_PER_SUB = 10;

const MODULE_TITLE = 'Allgemeinbildung (ABU) – RLP 2025';
const MODULE_COURSE_KEY = 'abu';

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += c; i += 1; continue;
    }
    if (c === '"') { inQuotes = true; i += 1; continue; }
    if (c === ',') { row.push(field); field = ''; i += 1; continue; }
    if (c === '\r') { i += 1; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += c; i += 1;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function rowsToObjects(rows) {
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function sqlString(s) { return "'" + String(s ?? '').replace(/'/g, "''") + "'"; }

const seedAbs = path.resolve(SEED_PATH);
if (!fs.existsSync(seedAbs)) {
  console.error(`ABU-CSV fehlt: ${SEED_PATH}`);
  process.exit(1);
}

const data = rowsToObjects(parseCsv(fs.readFileSync(seedAbs, 'utf8')));

if (data.length !== 1600) {
  console.error(`Erwartet 1600 Fragen, gefunden: ${data.length}`);
  process.exit(2);
}

const byLesson = new Map();
for (const row of data) {
  const key = String(row.module_key || '').trim();
  if (!/^abu_l\d{2}$/.test(key)) {
    console.error(`Unerwarteter module_key: ${JSON.stringify(row.module_key)}`);
    process.exit(3);
  }
  if (String(row.course_key || '').trim().toLowerCase() !== 'abu') {
    console.error(`Zeile mit course_key != abu: ${key}`);
    process.exit(4);
  }
  if (!byLesson.has(key)) {
    byLesson.set(key, {
      module_key: key,
      lesson_position: Number(key.slice(-2)),
      lesson_title: String(row.topic || '').trim(),
      rows: [],
    });
  }
  byLesson.get(key).rows.push(row);
}

const lessons = [...byLesson.values()].sort((a, b) => a.lesson_position - b.lesson_position);
if (lessons.length !== 16) {
  console.error(`Erwartet 16 ABU-Lektionen, gefunden: ${lessons.length}`);
  process.exit(5);
}
for (const l of lessons) {
  if (l.rows.length !== 100) {
    console.error(`Lektion ${l.module_key} hat ${l.rows.length} Fragen, erwartet 100.`);
    process.exit(6);
  }
  if (!l.lesson_title) {
    console.error(`Lektion ${l.module_key} hat keinen topic.`);
    process.exit(7);
  }
}

const out = [];
out.push('-- ABU Smartlearn 1. Teil: vollständiger destruktiver Neuaufbau (10×10).');
out.push('-- Generiert von scripts/build_abu_smartlearn_migration.mjs.');
out.push(`-- Inhalt: 16 Lektionen × ${SUB_COUNT} Sequenzen × ${QUESTIONS_PER_SUB} Fragen = 1600 Fragen.`);
out.push('-- Idempotent: löscht alle ABU-Lektionen (cascade auf Fragen, Fortschritt,');
out.push('-- Versuche und question_xp_awards) und baut den Kurs frisch aus dem CSV auf.');
out.push('-- Verändert ausschliesslich ABU-Inhalte (course_key = ' + sqlString(MODULE_COURSE_KEY) + ').');
out.push('');
out.push('begin;');
out.push('');
out.push('do $$');
out.push('declare');
out.push('  v_module_id uuid;');
out.push('  v_lesson_id uuid;');
out.push('begin');
out.push('  -- 1. Alle ABU-Lektionen löschen. Cascade räumt:');
out.push('  --    questions (FK lesson_id on delete cascade),');
out.push('  --    lesson_progress (FK lesson_id on delete cascade),');
out.push('  --    lesson_attempts (FK lesson_id on delete cascade),');
out.push('  --    question_xp_awards (FK question_id on delete cascade über questions).');
out.push('  --    battle_answers.question_id ist on delete set null und bleibt intakt.');
out.push('  delete from public.lessons');
out.push('   where module_id in (select id from public.modules where course_key = ' + sqlString(MODULE_COURSE_KEY) + ');');
out.push('');
out.push('  -- 2. Kanonisches ABU-Modul sicherstellen.');
out.push(`  select id into v_module_id from public.modules where course_key = ${sqlString(MODULE_COURSE_KEY)} and title = ${sqlString(MODULE_TITLE)} limit 1;`);
out.push('  if v_module_id is null then');
out.push(`    insert into public.modules (title, description, course_key, position) values (${sqlString(MODULE_TITLE)}, null, ${sqlString(MODULE_COURSE_KEY)}, 100) returning id into v_module_id;`);
out.push('  end if;');
out.push('');

let globalPosition = 1;
for (const lesson of lessons) {
  const parentTitle = lesson.lesson_title;
  for (let sub = 1; sub <= SUB_COUNT; sub += 1) {
    const subTitle = `${parentTitle} · ${sub}/${SUB_COUNT}`;
    const startIdx = (sub - 1) * QUESTIONS_PER_SUB;
    const subRows = lesson.rows.slice(startIdx, startIdx + QUESTIONS_PER_SUB);
    out.push(`  -- ${lesson.module_key}.${sub} ${subTitle}`);
    out.push(`  insert into public.lessons (module_id, title, position, pass_score, sublesson_index, sublesson_total) values (v_module_id, ${sqlString(subTitle)}, ${globalPosition}, 70, ${sub}, ${SUB_COUNT}) returning id into v_lesson_id;`);
    subRows.forEach((r, idx) => {
      const pos = idx + 1;
      const correct = String(r.correct_option || '').trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(correct)) {
        throw new Error(`Ungültige correct_option in Lektion ${lesson.module_key}/${sub}, Position ${pos}: ${r.correct_option}`);
      }
      out.push(`  insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values (v_lesson_id, ${sqlString(r.question)}, ${sqlString(r.option_a)}, ${sqlString(r.option_b)}, ${sqlString(r.option_c)}, ${sqlString(r.option_d)}, ${sqlString(correct)}, ${sqlString(r.explanation)}, ${pos});`);
    });
    out.push('');
    globalPosition += 1;
  }
}

out.push('end$$;');
out.push('');
out.push('commit;');
out.push('');

fs.writeFileSync(path.resolve(OUT_PATH), out.join('\n'));
console.log(`Migration geschrieben: ${OUT_PATH}`);
console.log(`Lektionen: ${lessons.length}, Sequenzen: ${lessons.length * SUB_COUNT}, Fragen: ${lessons.length * SUB_COUNT * QUESTIONS_PER_SUB}`);
