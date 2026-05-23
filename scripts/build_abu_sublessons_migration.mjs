#!/usr/bin/env node
// Generiert eine idempotente Migration, die den ABU-Fragenkatalog auf
// 100 Fragen pro Lektion erweitert und jede Lektion in fünf Unterlektionen
// 1/5 … 5/5 zu je 20 Fragen aufteilt.
//
// Eingabe:  supabase/seeds/abu_fragenkatalog_100_pro_lektion.csv
//           (gleicher Header wie supabase/seeds/abu_fragenkatalog_30_pro_lektion.csv)
//
// Pro Ursprungs-Lektion erwartet das Skript exakt 100 Zeilen (Fragen 1..100
// in stabiler Originalreihenfolge). Die 100 Fragen werden 1..20 → 1/5,
// 21..40 → 2/5, 41..60 → 3/5, 61..80 → 4/5, 81..100 → 5/5 zugeordnet.
//
// Die erzeugte Migration:
//   * legt ein neues Lektions-Row pro Unterlektion an (Titel
//     "<Original> · 1/5" … "· 5/5"), sucht/upserted nach (module_id, title),
//   * setzt sublesson_index/sublesson_total = (1..5, 5),
//   * fügt die 20 Fragen je Unterlektion mit position 1..20 ein und setzt
//     überzählige Positionen > 20 zurück.
//
// Wenn der CSV fehlt, bricht das Skript mit einem klaren Hinweis ab. Dieser
// Schritt ist absichtlich kein Datenfabrikat – der Katalog wird vom Nutzer
// geliefert.

import fs from 'node:fs';
import path from 'node:path';

const SEED_PATH = 'supabase/seeds/abu_fragenkatalog_100_pro_lektion.csv';
const OUT_PATH = 'supabase/migrations/20260537_abu_100_questions_sublessons.sql';

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

function sqlString(s) {
  return "'" + String(s ?? '').replace(/'/g, "''") + "'";
}

const seedAbs = path.resolve(SEED_PATH);
if (!fs.existsSync(seedAbs)) {
  console.error(`ABU 100-Fragen-CSV fehlt: ${SEED_PATH}`);
  console.error('Lege die vom Nutzer gelieferte Datei dort ab und führe das Skript erneut aus.');
  process.exit(1);
}

const data = rowsToObjects(parseCsv(fs.readFileSync(seedAbs, 'utf8')));

const byLesson = new Map();
for (const row of data) {
  const key = `${row.lesson_position}::${row.lesson_title}`;
  if (!byLesson.has(key)) {
    byLesson.set(key, {
      lesson_position: Number(row.lesson_position),
      lesson_title: row.lesson_title,
      module_key: row.module_key,
      module_title: row.module_title,
      rows: [],
    });
  }
  byLesson.get(key).rows.push(row);
}

const lessons = [...byLesson.values()].sort((a, b) => a.lesson_position - b.lesson_position);

for (const l of lessons) {
  if (l.rows.length !== 100) {
    console.error(`Lektion ${l.lesson_position} (${l.lesson_title}) hat ${l.rows.length} Fragen, erwartet 100.`);
    process.exit(2);
  }
  l.rows.sort((a, b) => Number(a.position) - Number(b.position));
}

const moduleTitle = lessons[0]?.module_title ?? 'Allgemeinbildung (ABU) – RLP 2025';
const moduleKey = 'abu';

const out = [];
out.push('-- ABU 100 Fragen pro Lektion, aufgeteilt in fünf Unterlektionen (1/5 .. 5/5).');
out.push('-- Generiert von scripts/build_abu_sublessons_migration.mjs.');
out.push('-- Idempotent: bestehende Unterlektionen werden anhand des Titels gefunden,');
out.push('-- Fragen positionsbasiert geupserted (1..20 pro Unterlektion).');
out.push('');
out.push('begin;');
out.push('');
out.push('do $$');
out.push('declare');
out.push('  v_module_id uuid;');
out.push('  v_lesson_id uuid;');
out.push('begin');
out.push(`  select id into v_module_id from public.modules where course_key = ${sqlString(moduleKey)} and title = ${sqlString(moduleTitle)} limit 1;`);
out.push('  if v_module_id is null then');
out.push(`    insert into public.modules (title, description, course_key, position) values (${sqlString(moduleTitle)}, null, ${sqlString(moduleKey)}, 100) returning id into v_module_id;`);
out.push('  end if;');
out.push('');

let globalPosition = 1;
for (const lesson of lessons) {
  const parentTitle = lesson.lesson_title;
  for (let sub = 1; sub <= 5; sub += 1) {
    const subTitle = `${parentTitle} · ${sub}/5`;
    const startIdx = (sub - 1) * 20;
    const subRows = lesson.rows.slice(startIdx, startIdx + 20);
    out.push(`  -- ${lesson.lesson_position}.${sub} ${subTitle}`);
    out.push(`  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = ${sqlString(subTitle)} limit 1;`);
    out.push('  if v_lesson_id is null then');
    out.push(`    insert into public.lessons (module_id, title, position, pass_score, sublesson_index, sublesson_total) values (v_module_id, ${sqlString(subTitle)}, ${globalPosition}, 70, ${sub}, 5) returning id into v_lesson_id;`);
    out.push('  else');
    out.push(`    update public.lessons set position = ${globalPosition}, pass_score = 70, sublesson_index = ${sub}, sublesson_total = 5 where id = v_lesson_id;`);
    out.push('  end if;');
    subRows.forEach((r, idx) => {
      const pos = idx + 1;
      const correct = String(r.correct_option || '').trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(correct)) {
        throw new Error(`Ungültige correct_option in Lektion ${lesson.lesson_position}/${sub}, Position ${pos}: ${r.correct_option}`);
      }
      const cols = `prompt = ${sqlString(r.question)}, option_a = ${sqlString(r.option_a)}, option_b = ${sqlString(r.option_b)}, option_c = ${sqlString(r.option_c)}, option_d = ${sqlString(r.option_d)}, correct_option = ${sqlString(correct)}, explanation = ${sqlString(r.explanation)}`;
      out.push(`  update public.questions set ${cols} where lesson_id = v_lesson_id and position = ${pos};`);
      out.push(`  if not found then insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values (v_lesson_id, ${sqlString(r.question)}, ${sqlString(r.option_a)}, ${sqlString(r.option_b)}, ${sqlString(r.option_c)}, ${sqlString(r.option_d)}, ${sqlString(correct)}, ${sqlString(r.explanation)}, ${pos}); end if;`);
    });
    out.push('  delete from public.questions where lesson_id = v_lesson_id and position > 20;');
    out.push('');
    globalPosition += 1;
  }
}

out.push('end$$;');
out.push('');
out.push('commit;');
out.push('');

fs.writeFileSync(path.resolve(OUT_PATH), out.join('\n'));
console.log(`Migration geschrieben nach ${OUT_PATH}`);
console.log(`Lektionen: ${lessons.length}, Unterlektionen: ${lessons.length * 5}, Fragen total: ${lessons.length * 100}`);
