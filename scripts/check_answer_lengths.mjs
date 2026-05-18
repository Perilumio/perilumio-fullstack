#!/usr/bin/env node
// Validiert einen Fragenkatalog im 30-pro-Lektion-Format (oder ältere
// Strassenbau-Variante). Prüft:
//   * Fragen pro Lektion ≥ 30 (Soll: exakt 30, gewarnt wird ab < 30).
//   * Antwortlängen-Auffälligkeiten (Spread, korrekt = längste, Ratio).
//   * Verteilung correct_option A/B/C/D (akzeptabel: jede 15–40 %).
//
// Verwendung:
//   node scripts/check_answer_lengths.mjs <csv-pfad> [--verbose]
//   node scripts/check_answer_lengths.mjs --all          # ABU + Strassenbau

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

function findCol(header, ...names) {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

function validate(csvPath, opts = {}) {
  const verbose = opts.verbose ?? false;
  const minPerLesson = opts.minPerLesson ?? 30;
  const absPath = path.resolve(csvPath);
  const raw = fs.readFileSync(absPath, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    console.error(`Leere CSV: ${csvPath}`);
    return { ok: false };
  }
  const header = rows[0].map(h => h.trim());
  const colQ = findCol(header, 'question', 'prompt');
  const colA = findCol(header, 'option_a');
  const colB = findCol(header, 'option_b');
  const colC = findCol(header, 'option_c');
  const colD = findCol(header, 'option_d');
  const colCorrect = findCol(header, 'correct_option');
  const colLessonTitle = findCol(header, 'lesson_title', 'topic');
  const colLessonPos = findCol(header, 'lesson_position');
  if ([colQ, colA, colB, colC, colD, colCorrect].some(v => v < 0)) {
    console.error(`Erwartete Spalten fehlen in ${csvPath}.`);
    return { ok: false };
  }

  let total = 0;
  let correctIsLongest = 0;
  let correctIsShortest = 0;
  const spreads = [];
  const flagged = [];
  const lessonCounts = new Map();
  const correctDist = { A: 0, B: 0, C: 0, D: 0 };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const opts = {
      A: (row[colA] ?? '').length,
      B: (row[colB] ?? '').length,
      C: (row[colC] ?? '').length,
      D: (row[colD] ?? '').length,
    };
    const correct = (row[colCorrect] ?? '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correct)) continue;
    total += 1;
    correctDist[correct] += 1;
    const lessonKey = colLessonPos >= 0
      ? `${row[colLessonPos]} | ${row[colLessonTitle] ?? ''}`
      : (row[colLessonTitle] ?? '(unbekannt)');
    lessonCounts.set(lessonKey, (lessonCounts.get(lessonKey) ?? 0) + 1);
    const lengths = Object.values(opts);
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    spreads.push(max - min);
    const correctLen = opts[correct];
    if (correctLen === max && lengths.filter(l => l === max).length === 1) correctIsLongest += 1;
    if (correctLen === min && lengths.filter(l => l === min).length === 1) correctIsShortest += 1;
    const distractors = ['A', 'B', 'C', 'D'].filter(k => k !== correct).map(k => opts[k]);
    const avgDistractor = distractors.reduce((a, b) => a + b, 0) / distractors.length;
    const ratio = correctLen / Math.max(1, avgDistractor);
    if (correctLen >= max && ratio >= 1.4) {
      flagged.push({ prompt: (row[colQ] || '').slice(0, 80), correctLen, avgDistractor: Math.round(avgDistractor), ratio: Number(ratio.toFixed(2)) });
    }
  }

  const sortedSpreads = [...spreads].sort((a, b) => a - b);
  const median = sortedSpreads[Math.floor(sortedSpreads.length / 2)] ?? 0;
  const avg = spreads.length ? Math.round(spreads.reduce((a, b) => a + b, 0) / spreads.length) : 0;
  const maxSpread = spreads.length ? Math.max(...spreads) : 0;

  console.log(`\n=== ${csvPath} ===`);
  console.log(`Fragen total: ${total}`);
  console.log(`Lektionen: ${lessonCounts.size}`);
  const shortLessons = [...lessonCounts.entries()].filter(([, n]) => n < minPerLesson);
  if (shortLessons.length > 0) {
    console.error(`FEHLER: ${shortLessons.length} Lektionen unter Soll (${minPerLesson}):`);
    for (const [k, n] of shortLessons) console.error(`  - ${k}: ${n}`);
  } else {
    console.log(`Pro Lektion: ≥ ${minPerLesson} Fragen ✓`);
  }
  console.log(`Korrekte = längste Option (eindeutig): ${correctIsLongest} (${Math.round(100 * correctIsLongest / Math.max(1, total))} %)`);
  console.log(`Korrekte = kürzeste Option (eindeutig): ${correctIsShortest} (${Math.round(100 * correctIsShortest / Math.max(1, total))} %)`);
  console.log(`Längen-Spread (Zeichen): max=${maxSpread}, median=${median}, avg=${avg}`);
  console.log(`Auffällige Fragen (korrekte deutlich länger): ${flagged.length}`);
  if (flagged.length > 0 && verbose) {
    for (const f of flagged.slice(0, 30)) {
      console.log(`  - [${f.correctLen}/${f.avgDistractor} avg, x${f.ratio}] ${f.prompt}`);
    }
  }
  const distPct = Object.fromEntries(
    Object.entries(correctDist).map(([k, n]) => [k, Math.round(100 * n / Math.max(1, total))])
  );
  console.log(`correct_option Verteilung: A=${distPct.A}% B=${distPct.B}% C=${distPct.C}% D=${distPct.D}%`);

  let ok = true;
  if (shortLessons.length > 0) ok = false;
  const longestRatio = correctIsLongest / Math.max(1, total);
  if (longestRatio > 0.5) {
    console.error(`WARNUNG: ${Math.round(100 * longestRatio)} % der Fragen haben die korrekte als längste Option. Ziel: < 35 %.`);
    ok = false;
  }
  for (const k of ['A', 'B', 'C', 'D']) {
    if (distPct[k] < 15 || distPct[k] > 40) {
      console.error(`WARNUNG: correct_option ${k} bei ${distPct[k]} % (akzeptabel 15–40 %).`);
      ok = false;
    }
  }
  return { ok, total, lessons: lessonCounts.size };
}

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
let csvPaths;
if (args.includes('--all') || args.length === 0) {
  csvPaths = [
    'supabase/seeds/abu_fragenkatalog_30_pro_lektion.csv',
    'supabase/seeds/strassenbau_fragenkatalog_30_pro_lektion.csv',
  ];
} else {
  csvPaths = args.filter(a => !a.startsWith('--'));
}

let allOk = true;
for (const p of csvPaths) {
  const res = validate(p, { verbose });
  if (!res.ok) allOk = false;
}
process.exit(allOk ? 0 : 1);
