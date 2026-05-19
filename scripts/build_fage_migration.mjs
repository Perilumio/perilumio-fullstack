#!/usr/bin/env node
// Generiert eine idempotente Supabase-Migration für den Kurs FaGe
// (Fachfrau/Fachmann Gesundheit EFZ) auf Basis der Bildungsplan-CSV
// (16 Lektionen je 30 Fragen, einspaltige Topic-Struktur).
//
// Ziele:
//   * course_key-CHECKs auf profiles.active_course_key, modules.course_key
//     und battle_matches.course_key auf
//     {abu, automechaniker, fage, schreiner, strassenbau} erweitern.
//   * Ein Modul mit course_key 'fage' wird nach (course_key, title)
//     gesucht oder angelegt.
//   * Pro CSV-Topic (sub_hk-Lektion) eine Lektion mit deterministischer
//     Position (10er-Schritte). Bestehende Lektionen werden anhand des
//     Titels wiedergefunden und mitaktualisiert.
//   * Fragen werden positionsbasiert per (lesson_id, position) UPSERTET;
//     bestehende question.id bleiben erhalten. Positionen > 30 werden
//     entfernt. Profile, lesson_progress, lesson_attempts unangetastet.
//
// Eingabe: supabase/seeds/fage_fragenkatalog_bildungsplan.csv
// Ausgabe: supabase/migrations/20260529_fage_bildungsplan.sql

import fs from 'node:fs';
import path from 'node:path';

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

function loadCsv(p) {
  const abs = path.resolve(p);
  const raw = fs.readFileSync(abs, 'utf8');
  return rowsToObjects(parseCsv(raw));
}

function expectedCorrectOption(s) {
  const v = String(s ?? '').trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(v)) throw new Error(`Ungültige correct_option: ${s}`);
  return v;
}

function groupByLesson(rows) {
  const map = new Map();
  for (const r of rows) {
    const subHk = String(r.sub_hk ?? '').trim();
    const topic = String(r.topic ?? '').trim();
    const moduleKey = String(r.module_key ?? '').trim();
    const hk = String(r.hk ?? '').trim();
    const key = `${subHk}|${topic}`;
    if (!map.has(key)) {
      map.set(key, { sub_hk: subHk, topic, module_key: moduleKey, hk, questions: [] });
    }
    map.get(key).questions.push(r);
  }
  return Array.from(map.values()).sort((a, b) => a.sub_hk.localeCompare(b.sub_hk, 'de'));
}

function lessonTitle(lesson) {
  if (lesson.sub_hk) return `${lesson.sub_hk} – ${lesson.topic}`;
  return lesson.topic;
}

function lessonPosition(index) {
  return (index + 1) * 10;
}

const COURSES = [
  {
    course_key: 'fage',
    csv: 'supabase/seeds/fage_fragenkatalog_bildungsplan.csv',
    moduleTitle: 'Fachfrau/Fachmann Gesundheit EFZ – Bildungsplan',
    moduleDescr: 'Bildungsplan Fachfrau/Fachmann Gesundheit EFZ (OdASanté/SBFI). 16 Lektionen entlang der Handlungskompetenzbereiche HKB A–H mit Fokus auf Berufsidentität, Pflege und Betreuung, Alltagsgestaltung, Medizinaltechnik, Krise/Notfall, Hygiene/Sicherheit, Logistik und Administration.',
    modulePosition: 100,
  },
];

const ALLOWED_KEYS = ['abu', 'automechaniker', 'fage', 'schreiner', 'strassenbau'];

const out = [];
out.push('-- FaGe (Fachfrau/Fachmann Gesundheit EFZ): Bildungsplan-Fragenkatalog (16 × 30 Fragen).');
out.push('-- Idempotent, additiv und ohne Datenverlust:');
out.push('--   * course_key-CHECK-Constraints werden auf');
out.push('--     abu/automechaniker/fage/schreiner/strassenbau erweitert.');
out.push('--   * Module werden nach (course_key, title) gesucht oder angelegt.');
out.push('--   * Lektionen werden nach (module_id, title) gesucht oder angelegt;');
out.push('--     position/pass_score werden gesetzt.');
out.push('--   * Fragen werden positionsbasiert UPSERTet: vorhandene (lesson_id,');
out.push('--     position) werden aktualisiert (question.id bleibt erhalten, FKs zu');
out.push('--     question_xp_awards / battle_answers bleiben intakt). Fehlende');
out.push('--     Positionen werden eingefügt. Positionen > 30 werden entfernt.');
out.push('--   * Profile, lesson_progress, lesson_attempts werden nicht angetastet.');
out.push('');
out.push('begin;');
out.push('');

out.push('-- ============================================================');
out.push('-- 1) course_key-CHECK-Constraints erweitern');
out.push('-- ============================================================');
const allowedList = ALLOWED_KEYS.map(sqlString).join(', ');

out.push('do $$');
out.push('begin');
out.push("  if exists (select 1 from pg_constraint where conname = 'profiles_active_course_key_ck') then");
out.push('    alter table public.profiles drop constraint profiles_active_course_key_ck;');
out.push('  end if;');
out.push('  alter table public.profiles');
out.push(`    add constraint profiles_active_course_key_ck check (active_course_key in (${allowedList}));`);
out.push('end$$;');
out.push('');

out.push('do $$');
out.push('begin');
out.push("  if exists (select 1 from pg_constraint where conname = 'modules_course_key_ck') then");
out.push('    alter table public.modules drop constraint modules_course_key_ck;');
out.push('  end if;');
out.push('  alter table public.modules');
out.push(`    add constraint modules_course_key_ck check (course_key in (${allowedList}));`);
out.push('end$$;');
out.push('');

out.push('do $$');
out.push('begin');
out.push("  if to_regclass('public.battle_matches') is not null then");
out.push("    if exists (select 1 from pg_constraint where conname = 'battle_matches_course_key_ck') then");
out.push('      alter table public.battle_matches drop constraint battle_matches_course_key_ck;');
out.push('    end if;');
out.push('    alter table public.battle_matches');
out.push(`      add constraint battle_matches_course_key_ck check (course_key in (${allowedList}));`);
out.push('  end if;');
out.push('end$$;');
out.push('');

for (const courseDef of COURSES) {
  const rows = loadCsv(courseDef.csv);
  for (const r of rows) {
    if (String(r.course_key).trim() !== courseDef.course_key) {
      throw new Error(`Unerwarteter course_key in ${courseDef.csv}: ${r.course_key}`);
    }
  }
  const lessons = groupByLesson(rows);
  if (lessons.length !== 16) throw new Error(`${courseDef.course_key}: ${lessons.length} Lektionen, erwartet 16`);

  out.push('-- ============================================================');
  out.push(`-- 2) ${courseDef.course_key.toUpperCase()}: 1 Modul, 16 Lektionen je 30 Fragen`);
  out.push('-- ============================================================');
  out.push('do $$');
  out.push('declare');
  out.push('  v_module_id uuid;');
  out.push('  v_lesson_id uuid;');
  out.push('begin');
  out.push(`  select id into v_module_id from public.modules where course_key = ${sqlString(courseDef.course_key)} and title = ${sqlString(courseDef.moduleTitle)} limit 1;`);
  out.push(`  if v_module_id is null then`);
  out.push(`    insert into public.modules (title, description, course_key, position)`);
  out.push(`    values (${sqlString(courseDef.moduleTitle)}, ${sqlString(courseDef.moduleDescr)}, ${sqlString(courseDef.course_key)}, ${courseDef.modulePosition})`);
  out.push(`    returning id into v_module_id;`);
  out.push(`  else`);
  out.push(`    update public.modules set description = ${sqlString(courseDef.moduleDescr)}, position = ${courseDef.modulePosition} where id = v_module_id;`);
  out.push(`  end if;`);

  lessons.forEach((lesson, idx) => {
    if (lesson.questions.length !== 30) {
      throw new Error(`${courseDef.course_key} Lektion ${lesson.sub_hk}: ${lesson.questions.length} Fragen, erwartet 30`);
    }
    const title = lessonTitle(lesson);
    const pos = lessonPosition(idx);
    out.push('');
    out.push(`  -- Lektion ${lesson.sub_hk}: ${title}`);
    out.push(`  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = ${sqlString(title)} limit 1;`);
    out.push(`  if v_lesson_id is null then`);
    out.push(`    insert into public.lessons (module_id, title, position, pass_score)`);
    out.push(`    values (v_module_id, ${sqlString(title)}, ${pos}, 70)`);
    out.push(`    returning id into v_lesson_id;`);
    out.push(`  else`);
    out.push(`    update public.lessons set position = ${pos}, pass_score = 70 where id = v_lesson_id;`);
    out.push(`  end if;`);
    lesson.questions.forEach((q, qi) => {
      const qPos = qi + 1;
      const correct = expectedCorrectOption(q.correct_option);
      out.push(`  update public.questions set prompt = ${sqlString(q.question)}, option_a = ${sqlString(q.option_a)}, option_b = ${sqlString(q.option_b)}, option_c = ${sqlString(q.option_c)}, option_d = ${sqlString(q.option_d)}, correct_option = ${sqlString(correct)}, explanation = ${sqlString(q.explanation)} where lesson_id = v_lesson_id and position = ${qPos};`);
      out.push(`  if not found then insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values (v_lesson_id, ${sqlString(q.question)}, ${sqlString(q.option_a)}, ${sqlString(q.option_b)}, ${sqlString(q.option_c)}, ${sqlString(q.option_d)}, ${sqlString(correct)}, ${sqlString(q.explanation)}, ${qPos}); end if;`);
    });
    out.push(`  delete from public.questions where lesson_id = v_lesson_id and position > 30;`);
  });

  out.push('end$$;');
  out.push('');
}

out.push('commit;');
out.push('');

const outputPath = 'supabase/migrations/20260529_fage_bildungsplan.sql';
fs.writeFileSync(outputPath, out.join('\n'));
console.log(`Migration geschrieben: ${outputPath}`);
console.log(`Lines: ${out.length}`);
for (const c of COURSES) {
  const rows = loadCsv(c.csv);
  console.log(`${c.course_key}: ${rows.length} Fragen, ${groupByLesson(rows).length} Lektionen`);
}
