#!/usr/bin/env node
// Entfernt redundante "im ABU"-Erwaehnungen aus dem ABU-Fragenkatalog:
//   1. Aus question-Prompts: "im ABU" (haupt­saechlich im Muster
//      "Welche Aussage beschreibt X im ABU am besten?").
//   2. Aus option_a..option_d und explanation: das Fueller-Suffix
//      " im Schweizer ABU-Kontext", das durch das Laengen-Smoothing
//      eingefuegt wurde und keinen inhaltlichen Mehrwert hat.
//
// Bezeichner ausserhalb des Fragetextes (z. B. Spalten course_name, hk,
// source) bleiben unangetastet — dort ist "ABU" ein Kurslabel und kein
// Fueller.
//
// Idempotent: nochmaliger Lauf produziert die identische Ausgabe.
// Eingabe und Ausgabe ist supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv.

import fs from 'node:fs';
import path from 'node:path';

const CSV_PATH = 'supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv';

const USER_FACING_FIELDS = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'explanation'];

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = []; let field = ''; let i = 0; let inQuotes = false;
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

function csvField(s) {
  const v = String(s ?? '');
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function rowsToCsv(header, objects) {
  const lines = [header.map(csvField).join(',')];
  for (const o of objects) lines.push(header.map(h => csvField(o[h])).join(','));
  return lines.join('\n') + '\n';
}

// Bereinigt ein einzelnes Feld. Gibt {text, removed} zurueck.
function cleanField(field, value) {
  let v = String(value ?? '');
  let removed = 0;

  // 1. Fueller-Suffix " im Schweizer ABU-Kontext" entfernen (Wort­grenze hinten).
  //    Das Suffix kann am Feldende stehen oder von Folge-Qualifizierern
  //    (z. B. " fuer die meisten Faelle") flankiert werden — in beiden Faellen
  //    nur das Suffix selbst entfernen.
  v = v.replace(/\s+im\s+Schweizer\s+ABU-Kontext\b/g, () => { removed += 1; return ''; });

  // 2. " im ABU" als Inline-Fueller in Frage-Prompts entfernen
  //    (z. B. "... X im ABU am besten?" -> "... X am besten?"). Wir betrachten
  //    nur die Spalte `question`, weil "ABU" in anderen Spalten (sofern noch
  //    vorhanden) entweder als Kurslabel oder als Subjekt erscheint.
  if (field === 'question') {
    v = v.replace(/\s+im\s+ABU\b/g, () => { removed += 1; return ''; });
  }

  // 3. Doppelte Leerzeichen aufraeumen, die durch das Entfernen entstehen koennten.
  v = v.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,;.!?])/g, '$1');

  return { text: v, removed };
}

const raw = fs.readFileSync(path.resolve(CSV_PATH), 'utf8');
const rows = parseCsv(raw);
const header = rows[0].map(h => h.trim());
const objs = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));

if (objs.length !== 1600) {
  console.error(`Erwartet 1600 Fragen, gefunden ${objs.length}`);
  process.exit(2);
}

const stats = { perField: {}, totalRemoved: 0, rowsTouched: 0 };
for (const f of USER_FACING_FIELDS) stats.perField[f] = 0;

for (const o of objs) {
  let touched = false;
  for (const f of USER_FACING_FIELDS) {
    const { text, removed } = cleanField(f, o[f]);
    if (removed > 0) {
      stats.perField[f] += removed;
      stats.totalRemoved += removed;
      touched = true;
    }
    o[f] = text;
  }
  if (touched) stats.rowsTouched += 1;
}

fs.writeFileSync(path.resolve(CSV_PATH), rowsToCsv(header, objs));

console.log('Redundante ABU-Erwaehnungen entfernt:');
for (const f of USER_FACING_FIELDS) {
  console.log(`  ${f}: ${stats.perField[f]}`);
}
console.log(`  total: ${stats.totalRemoved} (in ${stats.rowsTouched} Zeilen)`);

// Restliche ABU-Vorkommen melden — diese werden als beabsichtigt eingestuft
// (z. B. "ABU staerkt ..." als Subjekt einer Erklaerung).
let remaining = 0;
const samples = [];
for (const o of objs) {
  for (const f of USER_FACING_FIELDS) {
    const v = String(o[f] ?? '');
    if (/\bABU\b/.test(v)) {
      remaining += 1;
      if (samples.length < 5) samples.push(`${f}: ${v}`);
    }
  }
}
console.log(`Verbleibende ABU-Erwaehnungen in Frage-Inhalten: ${remaining}`);
samples.forEach(s => console.log('  ', s));
