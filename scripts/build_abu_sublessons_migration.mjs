#!/usr/bin/env node
// Generiert eine idempotente Migration, die den ABU-Fragenkatalog auf
// 100 Fragen pro Lektion (=Topic) bringt und jede Lektion in fünf
// Unterlektionen 1/5 … 5/5 zu je 20 Fragen aufteilt.
//
// Eingabe: supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv
//   Header: course_key,course_name,module_key,hk,sub_hk,topic,difficulty,
//           question_type,question,option_a,option_b,option_c,option_d,
//           correct_option,explanation,source,source_url
//
// Eine Lektion entspricht einem `module_key` (abu_l01..abu_l16). Der
// `topic`-Wert wird als Lektions-Titel verwendet. Die CSV-Reihenfolge
// innerhalb eines module_key wird stabil beibehalten und auf die
// Unterlektionen 1/5..5/5 verteilt (1..20 → 1/5, 21..40 → 2/5, …).
//
// Pro Ursprungs-Lektion erwartet das Skript exakt 100 Zeilen. Andernfalls
// bricht es ab. Die erzeugte Migration legt pro Unterlektion eine eigene
// Zeile in `public.lessons` an (Titel "<Topic> · 1/5" … "· 5/5"), setzt
// `sublesson_index/sublesson_total = (1..5, 5)` und upserted die 20 Fragen
// pro Unterlektion positionsbasiert. Überzählige Fragen mit position > 20
// werden gelöscht.

import fs from 'node:fs';
import path from 'node:path';

const SEED_PATH = 'supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv';
const OUT_PATH = 'supabase/migrations/20260537_abu_100_questions_sublessons.sql';

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

// Gruppieren nach module_key (abu_l01..abu_l16), Reihenfolge der CSV
// behalten. Ein module_key entspricht genau einer Lektion / einem Topic.
const byLesson = new Map();
for (const row of data) {
  const key = String(row.module_key || '').trim();
  if (!/^abu_l\d{2}$/.test(key)) {
    console.error(`Unerwarteter module_key in CSV: ${JSON.stringify(row.module_key)}`);
    process.exit(2);
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
  process.exit(3);
}

for (const l of lessons) {
  if (l.rows.length !== 100) {
    console.error(`Lektion ${l.module_key} (${l.lesson_title}) hat ${l.rows.length} Fragen, erwartet 100.`);
    process.exit(4);
  }
  if (!l.lesson_title) {
    console.error(`Lektion ${l.module_key} hat keinen topic.`);
    process.exit(5);
  }
}

const out = [];
out.push('-- ABU 100 Fragen pro Lektion, aufgeteilt in fünf Unterlektionen (1/5 .. 5/5).');
out.push('-- Generiert von scripts/build_abu_sublessons_migration.mjs.');
out.push('-- Idempotent: Modul/Lektionen werden per (course_key,title) gefunden,');
out.push('-- Fragen positionsbasiert geupserted (1..20 pro Unterlektion).');
out.push('-- Verändert ausschliesslich ABU-Inhalte; keine anderen Kurse.');
out.push('');
out.push('begin;');
out.push('');
out.push('do $$');
out.push('declare');
out.push('  v_module_id uuid;');
out.push('  v_lesson_id uuid;');
out.push('begin');
out.push(`  select id into v_module_id from public.modules where course_key = ${sqlString(MODULE_COURSE_KEY)} and title = ${sqlString(MODULE_TITLE)} limit 1;`);
out.push('  if v_module_id is null then');
out.push(`    insert into public.modules (title, description, course_key, position) values (${sqlString(MODULE_TITLE)}, null, ${sqlString(MODULE_COURSE_KEY)}, 100) returning id into v_module_id;`);
out.push('  end if;');
out.push('');

let globalPosition = 1;
for (const lesson of lessons) {
  const parentTitle = lesson.lesson_title;
  for (let sub = 1; sub <= 5; sub += 1) {
    const subTitle = `${parentTitle} · ${sub}/5`;
    const startIdx = (sub - 1) * 20;
    const subRows = lesson.rows.slice(startIdx, startIdx + 20);
    out.push(`  -- ${lesson.module_key}.${sub} ${subTitle}`);
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
        throw new Error(`Ungültige correct_option in Lektion ${lesson.module_key}/${sub}, Position ${pos}: ${r.correct_option}`);
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

// Alte ABU-Lektionen (vor der Sublesson-Aufteilung, ohne sublesson_index)
// hinter die neuen 80 Unterlektionen schieben, damit der Lernpfad mit den
// 16 neuen Themen beginnt. Fortschritt/Versuche bleiben erhalten.
out.push('  update public.lessons set position = position + 9000');
out.push('    where module_id = v_module_id and sublesson_index is null and position < 9000;');
out.push('');
out.push('end$$;');
out.push('');
out.push('commit;');
out.push('');

fs.writeFileSync(path.resolve(OUT_PATH), out.join('\n'));
console.log(`Migration geschrieben nach ${OUT_PATH}`);
console.log(`Lektionen: ${lessons.length}, Unterlektionen: ${lessons.length * 5}, Fragen total: ${lessons.length * 100}`);
