#!/usr/bin/env node
// Generiert eine einzige idempotente Migration für ABU und Strassenbau
// auf Basis der 30-Fragen-Kataloge in supabase/seeds/.
//
// Ziele:
//   * Bestehende Module/Lektionen NICHT löschen — werden nach (course_key, title)
//     gesucht/angelegt.
//   * Fragen werden positionsbasiert per (lesson_id, position) UPDATED, wenn
//     vorhanden; fehlende Positionen werden eingefügt. Bestehende question.id
//     bleiben erhalten, damit FKs zu question_xp_awards / battle_answers
//     intakt bleiben. Nutzerprofile und Fortschritt bleiben unberührt.
//   * Überzählige Fragen ab Position > 30 (z. B. falls jemand >30 hatte) werden
//     entfernt, damit der Bestand deterministisch auf 30 Fragen pro Lektion
//     gebracht wird. (In der Realität hat keine Lektion >8 Fragen, dieser
//     Schritt ist defensiv.)
//   * Strassenbau-Lektionspositionen werden global im Kurs in 10er-Schritten
//     anhand HK1/HK2/HK7-Reihenfolge gehalten (10..160) — kompatibel zur
//     bestehenden Migration 20260525_strassenbau_friendly_titles.
//
// Die Migration ist die einzige nötige Folge-Migration nach 20260525;
// sie deckt die in 20260526 vorgenommenen Wording-Anpassungen vollständig
// ab (alle Fragen werden ohnehin neu geschrieben).

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

const abu = loadCsv('supabase/seeds/abu_fragenkatalog_30_pro_lektion.csv');
const stb = loadCsv('supabase/seeds/strassenbau_fragenkatalog_30_pro_lektion.csv');

// ABU: 1 Modul, 11 Lektionen je 30 Fragen.
const abuModuleTitle = 'Allgemeinbildung (ABU) – RLP 2025';
const abuModuleDescr = 'Allgemeinbildender Unterricht nach dem Rahmenlehrplan ABU (SBFI, 2025). Lernbereiche Sprache & Kommunikation und Gesellschaft mit den Aspekten Ethik, Identität & Sozialisation, Kultur, Ökologie, Politik, Recht, Technologie/Digitalisierung und Wirtschaft.';

// Strassenbau: 3 Module (HK1, HK2, HK7), je 5/5/6 Lektionen je 30 Fragen.
const stbModules = {
  stb_hk1: {
    title: 'Strassenbauarbeiten vorbereiten und ausführen',
    description: 'Handlungskompetenzbereich 1: Arbeitssicherheit, Arbeitsvorbereitung, Umweltschutz, Ausmass/Rapport und Maschineneinsatz.',
    position: 10,
    legacyTitle: 'HK1 – Strassenbauarbeiten vorbereiten und ausführen',
  },
  stb_hk2: {
    title: 'Baustelle einrichten und Bauwerke erstellen',
    description: 'Handlungskompetenzbereich 2: Baustelleneinrichtung, Vermessung, Beton- und Schalungsarbeiten, Fertigteile und Baustellenabbau.',
    position: 20,
    legacyTitle: 'HK2 – Baustelle einrichten und Bauwerke erstellen',
  },
  stb_hk7: {
    title: 'Verkehrswege erstellen und sanieren',
    description: 'Handlungskompetenzbereich 7: Erd-, Leitungs-, Planie-, Pflästerungs- und Asphaltarbeiten inkl. Sanierung.',
    position: 30,
    legacyTitle: 'HK7 – Verkehrswege erstellen und sanieren',
  },
};

function groupByLesson(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.course_key}|${r.module_key}|${r.lesson_position}|${r.lesson_title}`;
    if (!map.has(key)) {
      map.set(key, {
        course_key: r.course_key,
        module_key: r.module_key,
        lesson_position: Number(r.lesson_position),
        lesson_title: r.lesson_title,
        questions: [],
      });
    }
    map.get(key).questions.push(r);
  }
  for (const v of map.values()) v.questions.sort((a, b) => Number(a.position) - Number(b.position));
  return Array.from(map.values());
}

function expectedCorrectOption(s) {
  const v = String(s ?? '').trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(v)) throw new Error(`Ungültige correct_option: ${s}`);
  return v;
}

const out = [];
out.push("-- ABU + Strassenbau: 30 Fragen pro Lektion (Single-Choice, A–D).");
out.push("-- Idempotent, additiv und ohne Datenverlust:");
out.push("--   * Module werden nach (course_key, title) gesucht oder angelegt.");
out.push("--   * Lektionen werden nach (module_id, title) gesucht oder angelegt;");
out.push("--     position/pass_score werden gesetzt.");
out.push("--   * Fragen werden positionsbasiert UPSERTet: vorhandene (lesson_id,");
out.push("--     position) werden aktualisiert (question.id bleibt erhalten, FKs zu");
out.push("--     question_xp_awards / battle_answers bleiben intakt). Fehlende");
out.push("--     Positionen werden eingefügt. Positionen > 30 werden entfernt.");
out.push("--   * Profile, lesson_progress, lesson_attempts werden nicht angetastet.");
out.push("--");
out.push("-- Diese Migration deckt die in 20260526_strassenbau_uniform_answers.sql");
out.push("-- vorgenommenen Wording-Anpassungen vollständig ab; alle Fragen werden");
out.push("-- gemäss CSV-Katalog neu gesetzt.");
out.push("");
out.push("begin;");
out.push("");

// ABU Block
out.push("-- ============================================================");
out.push("-- ABU: 1 Modul, 11 Lektionen je 30 Fragen");
out.push("-- ============================================================");
out.push("do $$");
out.push("declare");
out.push("  v_module_id uuid;");
out.push("  v_lesson_id uuid;");
out.push("begin");
out.push(`  select id into v_module_id from public.modules where course_key = 'abu' and title = ${sqlString(abuModuleTitle)} limit 1;`);
out.push(`  if v_module_id is null then`);
out.push(`    insert into public.modules (title, description, course_key, position)`);
out.push(`    values (${sqlString(abuModuleTitle)}, ${sqlString(abuModuleDescr)}, 'abu', 100)`);
out.push(`    returning id into v_module_id;`);
out.push(`  else`);
out.push(`    update public.modules set description = ${sqlString(abuModuleDescr)} where id = v_module_id;`);
out.push(`  end if;`);

const abuLessons = groupByLesson(abu).sort((a, b) => a.lesson_position - b.lesson_position);
for (const lesson of abuLessons) {
  if (lesson.questions.length !== 30) throw new Error(`ABU Lektion ${lesson.lesson_title}: ${lesson.questions.length} Fragen, erwartet 30`);
  out.push('');
  out.push(`  -- Lektion ${lesson.lesson_position}: ${lesson.lesson_title}`);
  out.push(`  select id into v_lesson_id from public.lessons where module_id = v_module_id and title = ${sqlString(lesson.lesson_title)} limit 1;`);
  out.push(`  if v_lesson_id is null then`);
  out.push(`    insert into public.lessons (module_id, title, position, pass_score)`);
  out.push(`    values (v_module_id, ${sqlString(lesson.lesson_title)}, ${lesson.lesson_position}, 70)`);
  out.push(`    returning id into v_lesson_id;`);
  out.push(`  else`);
  out.push(`    update public.lessons set position = ${lesson.lesson_position}, pass_score = 70 where id = v_lesson_id;`);
  out.push(`  end if;`);
  for (const q of lesson.questions) {
    const pos = Number(q.position);
    const correct = expectedCorrectOption(q.correct_option);
    out.push(`  update public.questions set prompt = ${sqlString(q.question)}, option_a = ${sqlString(q.option_a)}, option_b = ${sqlString(q.option_b)}, option_c = ${sqlString(q.option_c)}, option_d = ${sqlString(q.option_d)}, correct_option = ${sqlString(correct)}, explanation = ${sqlString(q.explanation)} where lesson_id = v_lesson_id and position = ${pos};`);
    out.push(`  if not found then insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values (v_lesson_id, ${sqlString(q.question)}, ${sqlString(q.option_a)}, ${sqlString(q.option_b)}, ${sqlString(q.option_c)}, ${sqlString(q.option_d)}, ${sqlString(correct)}, ${sqlString(q.explanation)}, ${pos}); end if;`);
  }
  out.push(`  delete from public.questions where lesson_id = v_lesson_id and position > 30;`);
}
out.push('end$$;');
out.push('');

// Strassenbau Block
out.push("-- ============================================================");
out.push("-- Strassenbau: 3 Module (HK1/HK2/HK7), 16 Lektionen je 30 Fragen");
out.push("-- ============================================================");
out.push("do $$");
out.push("declare");
out.push("  v_module_id uuid;");
out.push("  v_lesson_id uuid;");
out.push("begin");

const stbLessonsByModule = new Map();
for (const l of groupByLesson(stb)) {
  if (!stbLessonsByModule.has(l.module_key)) stbLessonsByModule.set(l.module_key, []);
  stbLessonsByModule.get(l.module_key).push(l);
}
for (const arr of stbLessonsByModule.values()) arr.sort((a, b) => a.lesson_position - b.lesson_position);

const moduleOrder = ['stb_hk1', 'stb_hk2', 'stb_hk7'];
for (const mk of moduleOrder) {
  const meta = stbModules[mk];
  const lessons = stbLessonsByModule.get(mk) ?? [];
  if (lessons.length === 0) continue;
  out.push('');
  out.push(`  -- Modul ${mk.toUpperCase()}: ${meta.title}`);
  out.push(`  select id into v_module_id from public.modules where course_key = 'strassenbau' and title in (${sqlString(meta.title)}, ${sqlString(meta.legacyTitle)}) order by case when title = ${sqlString(meta.title)} then 0 else 1 end limit 1;`);
  out.push(`  if v_module_id is null then`);
  out.push(`    insert into public.modules (title, description, course_key, position)`);
  out.push(`    values (${sqlString(meta.title)}, ${sqlString(meta.description)}, 'strassenbau', ${meta.position})`);
  out.push(`    returning id into v_module_id;`);
  out.push(`  else`);
  out.push(`    update public.modules set title = ${sqlString(meta.title)}, description = ${sqlString(meta.description)}, position = ${meta.position} where id = v_module_id;`);
  out.push(`  end if;`);
  for (const lesson of lessons) {
    if (lesson.questions.length !== 30) throw new Error(`Strassenbau Lektion ${lesson.lesson_title}: ${lesson.questions.length} Fragen, erwartet 30`);
    out.push('');
    out.push(`  -- Lektion (pos ${lesson.lesson_position}): ${lesson.lesson_title}`);
    // Match title in modernem oder Legacy-Format (mit "X.Y "-Präfix).
    out.push(`  select id into v_lesson_id from public.lessons where module_id = v_module_id and (title = ${sqlString(lesson.lesson_title)} or title ~ ('^[0-9]+\\.[0-9]+ ' || ${sqlString(lesson.lesson_title)})) order by case when title = ${sqlString(lesson.lesson_title)} then 0 else 1 end limit 1;`);
    out.push(`  if v_lesson_id is null then`);
    out.push(`    insert into public.lessons (module_id, title, position, pass_score)`);
    out.push(`    values (v_module_id, ${sqlString(lesson.lesson_title)}, ${lesson.lesson_position}, 70)`);
    out.push(`    returning id into v_lesson_id;`);
    out.push(`  else`);
    out.push(`    update public.lessons set title = ${sqlString(lesson.lesson_title)}, position = ${lesson.lesson_position}, pass_score = 70 where id = v_lesson_id;`);
    out.push(`  end if;`);
    for (const q of lesson.questions) {
      const pos = Number(q.position);
      const correct = expectedCorrectOption(q.correct_option);
      out.push(`  update public.questions set prompt = ${sqlString(q.question)}, option_a = ${sqlString(q.option_a)}, option_b = ${sqlString(q.option_b)}, option_c = ${sqlString(q.option_c)}, option_d = ${sqlString(q.option_d)}, correct_option = ${sqlString(correct)}, explanation = ${sqlString(q.explanation)} where lesson_id = v_lesson_id and position = ${pos};`);
      out.push(`  if not found then insert into public.questions (lesson_id, prompt, option_a, option_b, option_c, option_d, correct_option, explanation, position) values (v_lesson_id, ${sqlString(q.question)}, ${sqlString(q.option_a)}, ${sqlString(q.option_b)}, ${sqlString(q.option_c)}, ${sqlString(q.option_d)}, ${sqlString(correct)}, ${sqlString(q.explanation)}, ${pos}); end if;`);
    }
    out.push(`  delete from public.questions where lesson_id = v_lesson_id and position > 30;`);
  }
}

out.push('end$$;');
out.push('');
out.push('commit;');
out.push('');

const outputPath = 'supabase/migrations/20260527_abu_strassenbau_30_questions.sql';
fs.writeFileSync(outputPath, out.join('\n'));
console.log(`Migration geschrieben: ${outputPath}`);
console.log(`Lines: ${out.length}`);
console.log(`ABU Fragen: ${abu.length}, Strassenbau Fragen: ${stb.length}`);
