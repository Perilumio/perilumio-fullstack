#!/usr/bin/env node
// Misst pro Frage die Längen der Optionen A-D und meldet:
//   - Spread (max - min)
//   - ob die korrekte Antwort die längste ist
// Verwendung: node scripts/check_answer_lengths.mjs <csv-pfad> [--verbose]
//
// Verwendet einen einfachen CSV-Parser (RFC 4180-kompatibel), um Abhängigkeit
// von papaparse zu vermeiden.

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

const csvPath = process.argv[2] ?? 'supabase/seeds/strassenbau_hk1_hk2_hk7.csv';
const absPath = path.resolve(csvPath);
const raw = fs.readFileSync(absPath, 'utf8');
const rows = parseCsv(raw);
if (rows.length === 0) {
  console.error('Leere CSV');
  process.exit(1);
}
const header = rows[0].map(h => h.trim());
const idx = (name) => header.indexOf(name);
const colQ = idx('question');
const colA = idx('option_a');
const colB = idx('option_b');
const colC = idx('option_c');
const colD = idx('option_d');
const colCorrect = idx('correct_option');
if ([colQ, colA, colB, colC, colD, colCorrect].some(v => v < 0)) {
  console.error('Erwartete Spalten fehlen.');
  process.exit(1);
}

let total = 0;
let correctIsLongest = 0;
let correctIsShortest = 0;
const spreads = [];
const flagged = [];

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const opts = {
    A: (row[colA] ?? '').length,
    B: (row[colB] ?? '').length,
    C: (row[colC] ?? '').length,
    D: (row[colD] ?? '').length,
  };
  const correct = (row[colCorrect] ?? '').trim().toUpperCase();
  if (!['A','B','C','D'].includes(correct)) continue;
  total += 1;
  const lengths = Object.values(opts);
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  spreads.push(max - min);
  const correctLen = opts[correct];
  if (correctLen === max && lengths.filter(l => l === max).length === 1) correctIsLongest += 1;
  if (correctLen === min && lengths.filter(l => l === min).length === 1) correctIsShortest += 1;
  const distractors = ['A','B','C','D'].filter(k => k !== correct).map(k => opts[k]);
  const avgDistractor = distractors.reduce((a,b) => a+b, 0) / distractors.length;
  const ratio = correctLen / Math.max(1, avgDistractor);
  if (correctLen >= max && ratio >= 1.4) {
    flagged.push({ prompt: (row[colQ] || '').slice(0, 80), correctLen, avgDistractor: Math.round(avgDistractor), ratio: Number(ratio.toFixed(2)) });
  }
}

const sortedSpreads = [...spreads].sort((a,b) => a-b);
const median = sortedSpreads[Math.floor(sortedSpreads.length/2)];
const avg = Math.round(spreads.reduce((a,b)=>a+b,0)/spreads.length);
const maxSpread = Math.max(...spreads);

console.log(`Datei: ${csvPath}`);
console.log(`Fragen total: ${total}`);
console.log(`Korrekte = längste Option (eindeutig): ${correctIsLongest} (${Math.round(100*correctIsLongest/total)} %)`);
console.log(`Korrekte = kürzeste Option (eindeutig): ${correctIsShortest} (${Math.round(100*correctIsShortest/total)} %)`);
console.log(`Längen-Spread (Zeichen): max=${maxSpread}, median=${median}, avg=${avg}`);
console.log(`Fragen mit korrekter Antwort deutlich länger als Distraktoren (Ratio >= 1.4 und längste): ${flagged.length}`);
if (flagged.length > 0 && process.argv.includes('--verbose')) {
  for (const f of flagged.slice(0, 30)) {
    console.log(`  - [${f.correctLen}/${f.avgDistractor} avg, x${f.ratio}] ${f.prompt}`);
  }
}

const ratioBad = correctIsLongest / total;
if (ratioBad > 0.5) {
  console.error(`\nWARNUNG: ${Math.round(100*ratioBad)} % der Fragen haben die korrekte als längste Option (eindeutig). Ziel: < 35 %.`);
  process.exit(1);
}
process.exit(0);
