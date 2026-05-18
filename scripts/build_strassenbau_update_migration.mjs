#!/usr/bin/env node
// Generiert eine idempotente Migration, welche die Strassenbau-Fragen
// in-place per (lesson_id, position) aktualisiert. Keine deletes — somit
// bleiben FKs zu question_xp_awards / battle_answers erhalten.
//
// Sortierung pro Lektion entspricht der Reihenfolge in der CSV (entspricht
// der ursprünglichen Insert-Reihenfolge der 20260524-Migration).
//
// Lektionstitel: 20260524 nutzt "X.Y Titel"; 20260525 strippt den Präfix.
// Wir matchen Lektionen über (module_id, position) anhand der per
// 20260525 vergebenen globalen Reihenfolge.

import fs from 'node:fs';
import path from 'node:path';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue; }
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

function sqlString(s) {
  return "'" + String(s ?? '').replace(/'/g, "''") + "'";
}

// Lesson-Titel: 20260524 vergibt "X.Y Titel"; 20260525 strippt den Präfix.
// Wir matchen über (course_key, title) mit beiden möglichen Varianten.
const lessonShortTitles = {
  '1.1': 'Arbeitssicherheit und Notfall',
  '1.2': 'Arbeitsvorbereitung',
  '1.3': 'Umweltschutz',
  '1.4': 'Ausmass und Rapport',
  '1.5': 'Maschineneinsatz',
  '2.1': 'Baustelleneinrichtung und Signalisation',
  '2.2': 'Vermessung',
  '2.3': 'Beton- und Schalungsarbeiten',
  '2.4': 'Fertigteile und Montage',
  '2.5': 'Baustelle abräumen',
  '7.1': 'Erdbau und Planum',
  '7.2': 'Leitungs- und Grabenbau',
  '7.3': 'Fundationen und Planien',
  '7.4': 'Pflästerung',
  '7.5': 'Asphalt-Belagseinbau',
  '7.6': 'Belagssanierung',
};

const csvPath = path.resolve('supabase/seeds/strassenbau_hk1_hk2_hk7.csv');
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const header = rows[0];
const idx = (name) => header.indexOf(name);
const col = {
  hk: idx('hk'),
  sub: idx('sub_hk'),
  q: idx('question'),
  a: idx('option_a'),
  b: idx('option_b'),
  c: idx('option_c'),
  d: idx('option_d'),
  corr: idx('correct_option'),
  exp: idx('explanation'),
};

const grouped = new Map();
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const key = `${row[col.hk]}|${row[col.sub]}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(row);
}

const out = [];
out.push("-- Strassenbau-Fragen: Antwortoptionen vereinheitlichen (Länge/Plausibilität).");
out.push("-- Aktualisiert Frage-Texte, Optionen und Erklärungen IN-PLACE per");
out.push("-- (lesson_id, position). Keine deletes/inserts auf public.questions —");
out.push("-- bestehende question.id bleiben erhalten, somit gehen FK-Daten in");
out.push("-- public.question_xp_awards und public.battle_answers nicht verloren.");
out.push("-- public.modules und public.lessons werden nicht angetastet; Lernfortschritt");
out.push("-- bleibt vollständig erhalten. Idempotent: erneute Ausführung ist sicher.");
out.push("--");
out.push("-- Lookup für Lektionen: Titel werden mit beiden bekannten Varianten gesucht");
out.push("-- (mit oder ohne 'X.Y '-Präfix), da 20260525_strassenbau_friendly_titles");
out.push("-- den Präfix in bestehenden Datenbanken bereits gestrippt hat.");
out.push("");
out.push("begin;");
out.push("");
out.push("do $$");
out.push("declare");
out.push("  v_lesson_id uuid;");
out.push("begin");

const subOrder = ['1.1','1.2','1.3','1.4','1.5','2.1','2.2','2.3','2.4','2.5','7.1','7.2','7.3','7.4','7.5','7.6'];
for (const sub of subOrder) {
  const hk = sub.startsWith('1.') ? 'HK1' : sub.startsWith('2.') ? 'HK2' : 'HK7';
  const shortTitle = lessonShortTitles[sub];
  const longTitle = `${sub} ${shortTitle}`;
  const key = `${hk}|${sub}`;
  const questions = grouped.get(key) ?? [];
  if (questions.length === 0) continue;
  out.push("");
  out.push(`  -- Lektion ${sub}: ${shortTitle}`);
  out.push(`  select l.id into v_lesson_id`);
  out.push(`    from public.lessons l`);
  out.push(`    join public.modules m on m.id = l.module_id`);
  out.push(`   where m.course_key = 'strassenbau'`);
  out.push(`     and l.title in (${sqlString(longTitle)}, ${sqlString(shortTitle)})`);
  out.push(`   limit 1;`);
  out.push(`  if v_lesson_id is not null then`);
  questions.forEach((q, i) => {
    const pos = i + 1;
    out.push(`    update public.questions set`);
    out.push(`      prompt = ${sqlString(q[col.q])},`);
    out.push(`      option_a = ${sqlString(q[col.a])},`);
    out.push(`      option_b = ${sqlString(q[col.b])},`);
    out.push(`      option_c = ${sqlString(q[col.c])},`);
    out.push(`      option_d = ${sqlString(q[col.d])},`);
    out.push(`      correct_option = ${sqlString(q[col.corr])},`);
    out.push(`      explanation = ${sqlString(q[col.exp])}`);
    out.push(`    where lesson_id = v_lesson_id and position = ${pos};`);
  });
  out.push(`  end if;`);
  out.push(`  v_lesson_id := null;`);
}

out.push("end$$;");
out.push("");
out.push("commit;");
out.push("");

const outputPath = 'supabase/migrations/20260526_strassenbau_uniform_answers.sql';
fs.writeFileSync(outputPath, out.join('\n'));
console.log(`Migration geschrieben: ${outputPath}`);
console.log(`Fragen total: ${Array.from(grouped.values()).reduce((a,b)=>a+b.length,0)}`);
console.log(`Lines: ${out.length}`);
