#!/usr/bin/env node
// Glättet Antwortlängen in CSVs mit Spalten option_a..option_d und correct_option,
// damit die korrekte Antwort nicht systematisch länger ist als die Distraktoren.
//
// Vorgehen:
//   * Distraktoren werden mit neutralen Qualifizierern verlängert, ohne ihren
//     fachlichen Wahrheitsgehalt zu verändern (sie bleiben falsch).
//   * Die korrekte Option wird unverändert gelassen.
//   * Pro Frage wird ein deterministischer Pool an Qualifizierern reihum
//     verwendet, damit das Resultat reproduzierbar bleibt.
//   * Es wird so viel Padding angefügt, bis die mittlere Distraktorlänge
//     mindestens 80 % der Länge der korrekten Antwort erreicht.
//
// Verwendung:
//   node scripts/smooth_answer_lengths.mjs <csv-pfad> [<weitere-pfade>]

import fs from 'node:fs';
import path from 'node:path';

const QUALIFIERS = [
  ' im normalen Werkstattbetrieb',
  ' bei sachgemässer Ausführung',
  ' im üblichen Berufsalltag',
  ' nach gängiger Praxis',
  ' unter typischen Arbeitsbedingungen',
  ' im Rahmen der Routine',
  ' bei vergleichbaren Aufgaben',
  ' im konkreten Auftrag',
  ' im laufenden Tagesgeschäft',
  ' im Werkstattumfeld',
  ' im Produktionsalltag',
  ' bei sachgemässem Ablauf',
];

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

function csvField(s) {
  const v = String(s ?? '');
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function rowsToCsv(rows) {
  return rows.map(r => r.map(csvField).join(',')).join('\n') + '\n';
}

function smooth(csvPath) {
  const abs = path.resolve(csvPath);
  const raw = fs.readFileSync(abs, 'utf8');
  const rows = parseCsv(raw);
  const header = rows[0];
  const idx = (name) => header.indexOf(name);
  const cA = idx('option_a');
  const cB = idx('option_b');
  const cC = idx('option_c');
  const cD = idx('option_d');
  const cCorrect = idx('correct_option');
  const cQ = idx('question');
  if ([cA, cB, cC, cD, cCorrect].some(v => v < 0)) {
    throw new Error(`Erwartete Spalten fehlen: ${csvPath}`);
  }

  let modified = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const correct = String(row[cCorrect] ?? '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correct)) continue;
    const cols = { A: cA, B: cB, C: cC, D: cD };
    const correctLen = String(row[cols[correct]] ?? '').length;
    const distractorKeys = ['A', 'B', 'C', 'D'].filter(k => k !== correct);
    let qualifierCursor = (r * 7) % QUALIFIERS.length;
    let changed = false;
    let safety = 0;
    while (safety < 20) {
      const distLens = distractorKeys.map(k => String(row[cols[k]] ?? '').length);
      const avgDist = distLens.reduce((a, b) => a + b, 0) / distLens.length;
      const minLen = Math.min(...distLens);
      // Akzeptiert: Distraktoren-Mittel ≥ 80 % der Korrektlänge UND Min-Distraktor ≥ 70 %.
      if (avgDist >= correctLen * 0.8 && minLen >= correctLen * 0.7) break;
      // Wähle den kürzesten Distraktor und hänge eine Qualifizierung an.
      let shortestKey = distractorKeys[0];
      let shortestLen = String(row[cols[shortestKey]] ?? '').length;
      for (const k of distractorKeys) {
        const l = String(row[cols[k]] ?? '').length;
        if (l < shortestLen) { shortestKey = k; shortestLen = l; }
      }
      const q = QUALIFIERS[qualifierCursor % QUALIFIERS.length];
      qualifierCursor += 1;
      const current = String(row[cols[shortestKey]] ?? '');
      // Vermeide Doppelaufnahme desselben Qualifiers.
      if (current.includes(q.trim())) continue;
      row[cols[shortestKey]] = current + q;
      changed = true;
      safety += 1;
    }
    if (changed) modified += 1;
  }
  fs.writeFileSync(abs, rowsToCsv(rows));
  console.log(`${csvPath}: ${modified} Fragen geglättet (von ${rows.length - 1}).`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/smooth_answer_lengths.mjs <csv-path> [<more>]');
  process.exit(2);
}
for (const p of args) smooth(p);
