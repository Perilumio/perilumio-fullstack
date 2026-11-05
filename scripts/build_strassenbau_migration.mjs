#!/usr/bin/env node
// Generiert eine Migration, die den neuen Strassenbauer-Fragenkatalog
// (16 Lektionen je 30 Fragen) in den bestehenden Kurs 'strassenbau' einspielt.
//
// Die bestehenden Lektionen (Positionen 10..160) und Fragen bleiben mit ihren
// IDs erhalten und werden nur inhaltlich aktualisiert: L01 -> Position 10,
// L02 -> 20 usw.; Frage n einer Lektion -> question.position n.
// Fortschritt, XP-Vergabe und Battle-Antworten bleiben dadurch gueltig.
//
// Eingabe: supabase/seeds/strassenbau_fragenkatalog_bildungsplan.csv
// Ausgabe: supabase/migrations/20261105_strassenbau_bildungsplan.sql
import fs from 'node:fs';

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = []; let field = ''; let i = 0; let q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}
const s = (v) => "'" + String(v ?? '').trim().replace(/'/g, "''") + "'";

const rows = parseCsv(fs.readFileSync('supabase/seeds/strassenbau_fragenkatalog_bildungsplan.csv', 'utf8'));
const header = rows[0].map((h) => h.trim());
const data = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));

const lessons = new Map();
for (const r of data) {
  const n = Number(String(r.sub_hk).replace(/\D/g, ''));
  if (!lessons.has(n)) lessons.set(n, { topic: r.topic.trim(), qs: [] });
  const opt = String(r.correct_option).trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(opt)) throw new Error('correct_option ungueltig: ' + r.question);
  lessons.get(n).qs.push({ ...r, correct_option: opt });
}
if (lessons.size !== 16) throw new Error('Erwartet 16 Lektionen, gefunden ' + lessons.size);

const out = [];
out.push('-- Strassenbauer/in EFZ: neuer Fragenkatalog nach Bildungsplan Verkehrswegbau EFZ.');
out.push('-- Generiert durch scripts/build_strassenbau_migration.mjs. Aktualisiert bestehende');
out.push('-- Lektionen und Fragen in place (IDs bleiben erhalten).');
out.push('begin;');
out.push('create temp table _sb_new (lesson_pos int, q_pos int, prompt text, a text, b text, c text, d text, correct text, explanation text) on commit drop;');
out.push('create temp table _sb_titles (lesson_pos int, title text) on commit drop;');
for (const [n, l] of [...lessons].sort((x, y) => x[0] - y[0])) {
  if (l.qs.length !== 30) throw new Error(`L${n}: ${l.qs.length} Fragen statt 30`);
  out.push(`insert into _sb_titles values (${n * 10}, ${s(l.topic)});`);
  out.push('insert into _sb_new values');
  out.push(l.qs.map((q, i) => `  (${n * 10}, ${i + 1}, ${s(q.question)}, ${s(q.option_a)}, ${s(q.option_b)}, ${s(q.option_c)}, ${s(q.option_d)}, ${s(q.correct_option)}, ${s(q.explanation)})`).join(',\n') + ';');
}
out.push(`
-- Sicherheitspruefung: der Kurs muss genau 16 Lektionen (Positionen 10..160) mit je 30 Fragen haben.
do $$
declare n int;
begin
  select count(*) into n from public.questions q
    join public.lessons l on l.id = q.lesson_id
    join public.modules m on m.id = l.module_id
   where m.course_key = 'strassenbau' and l.position in (select lesson_pos from _sb_titles) and q.position between 1 and 30;
  if n <> 480 then raise exception 'Unerwartete Struktur im Kurs strassenbau: % Fragen statt 480', n; end if;
end $$;

update public.lessons l
   set title = t.title
  from _sb_titles t, public.modules m
 where m.id = l.module_id and m.course_key = 'strassenbau' and l.position = t.lesson_pos;

update public.questions q
   set prompt = n.prompt, option_a = n.a, option_b = n.b, option_c = n.c, option_d = n.d,
       correct_option = n.correct, explanation = n.explanation
  from _sb_new n, public.lessons l, public.modules m
 where l.id = q.lesson_id and m.id = l.module_id and m.course_key = 'strassenbau'
   and l.position = n.lesson_pos and q.position = n.q_pos;

commit;`);
fs.writeFileSync('supabase/migrations/20261105_strassenbau_bildungsplan.sql', out.join('\n') + '\n');
console.log('OK: 16 Lektionen, 480 Fragen');
