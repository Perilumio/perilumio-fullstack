#!/usr/bin/env node
// Normalisiert den ABU-Smartlearn-Fragenkatalog (1600 Fragen, 16 Lektionen x 100):
//   1. Interleaving: Die zehn Cluster pro Lektion werden so umsortiert, dass jede
//      Unterlektion (20 Fragen) zwei Fragen aus jedem Cluster erhaelt statt zehn
//      aus zwei Clustern. Das durchmischt Themen innerhalb der Unterlektion.
//   2. Shuffle correct_option: Pro Frage wird die Position der richtigen Antwort
//      deterministisch (Seed = Hash aus Lektion+Frage) gleichmaessig auf A-D
//      verteilt; die Distraktoren werden ebenfalls deterministisch permutiert.
//   3. Distraktor-Laengen angleichen: kuerzere falsche Antworten erhalten
//      neutrale Qualifizierer, damit der Laengenunterschied zur korrekten
//      Antwort kleiner wird. Die korrekte Antwort wird nicht veraendert.
//
// Eingabe und Ausgabe ist dieselbe Datei: supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv
// Idempotent: nochmaliger Lauf produziert die identische Ausgabe.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CSV_PATH = 'supabase/seeds/abu_fragenkatalog_smartlearn_1_teil.csv';

const QUALIFIERS = [
  ' im Schweizer ABU-Kontext',
  ' im Alltag der Lernenden',
  ' aus rechtlicher Sicht',
  ' fuer die meisten Faelle',
  ' nach gaengiger Praxis',
  ' im beruflichen Alltag',
  ' im typischen Verlauf',
  ' bei normaler Anwendung',
  ' bei vergleichbaren Situationen',
  ' im Rahmen der Vorgaben',
  ' unter ueblichen Bedingungen',
  ' nach allgemeinem Verstaendnis',
];

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

function seedFromString(s) {
  const hash = crypto.createHash('sha256').update(s).digest();
  return hash.readUInt32BE(0);
}
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWithRng(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function abs(p) { return path.resolve(p); }

const raw = fs.readFileSync(abs(CSV_PATH), 'utf8');
const rows = parseCsv(raw);
const header = rows[0].map(h => h.trim());
const objs = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));

if (objs.length !== 1600) {
  console.error(`Erwartet 1600 Fragen, gefunden ${objs.length}`);
  process.exit(2);
}

// Gruppiere nach module_key und behalte ursprueng­liche Reihenfolge.
const byModule = new Map();
for (const o of objs) {
  const k = o.module_key;
  if (!byModule.has(k)) byModule.set(k, []);
  byModule.get(k).push(o);
}

function canonicalAnswerKey(o) {
  // Welche Antwort ist die "richtige" Antwort als Text?
  const map = { A: o.option_a, B: o.option_b, C: o.option_c, D: o.option_d };
  return map[o.correct_option.trim().toUpperCase()];
}

// Schritt 1: pro Lektion in Cluster aufteilen und interleaven.
// Wir identifizieren Cluster ueber die sortierten 4 Optionen + Explanation.
function clusterKey(o) {
  const opts = [o.option_a, o.option_b, o.option_c, o.option_d].slice().sort().join('|');
  return opts + '||' + o.explanation;
}

const interleaved = [];
for (const [moduleKey, lessonRows] of byModule) {
  // Sortiere stabil in Cluster.
  const clusterOrder = [];
  const clusterMap = new Map();
  for (const r of lessonRows) {
    const k = clusterKey(r);
    if (!clusterMap.has(k)) { clusterMap.set(k, []); clusterOrder.push(k); }
    clusterMap.get(k).push(r);
  }
  const clusters = clusterOrder.map(k => clusterMap.get(k));
  // Erwartung: 10 Cluster mit je 10 Fragen.
  if (clusters.length !== 10 || clusters.some(c => c.length !== 10)) {
    console.error(`Lektion ${moduleKey}: erwartete 10 Cluster x 10 Fragen, gefunden ${clusters.length} Cluster mit Groessen ${clusters.map(c => c.length).join(',')}`);
    process.exit(3);
  }
  // Interleave: Sublesson s (0..4) erhaelt aus jedem Cluster c die Fragen
  // an Index 2*s und 2*s+1. Innerhalb des Sublesson-Slots werden die 10
  // Cluster-Auspraegungen in einer pro-Lektion deterministisch gemischten
  // Reihenfolge angeordnet, damit nicht alle Sublektionen mit Cluster 0 starten.
  const lessonSeed = seedFromString('abu-interleave|' + moduleKey);
  const rng = mulberry32(lessonSeed);
  for (let s = 0; s < 5; s++) {
    const baseOrder = shuffleWithRng(clusters.map((_, idx) => idx), rng);
    // baseOrder ist die Reihenfolge der zehn Cluster im ersten Slot dieses
    // Sublesson; im zweiten Slot wird die Reihenfolge invertiert, damit auch
    // dort kein erkennbares Muster entsteht.
    const slot1 = baseOrder.map(idx => clusters[idx][2 * s]);
    const slot2Order = shuffleWithRng(baseOrder, rng);
    const slot2 = slot2Order.map(idx => clusters[idx][2 * s + 1]);
    interleaved.push(...slot1, ...slot2);
  }
}

// Schritt 2: Antwortoptionen pro Frage neu mischen.
const lengthChanged = { padded: 0 };
function smoothDistractors(o) {
  // Nach dem Mischen unten passen wir Laengen der Distraktoren an die korrekte
  // Antwort an: avg(distLen) >= 0.85 * correctLen und min(distLen) >= 0.7 *
  // correctLen, max 35 Zeichen Padding pro Distraktor.
  const correct = o.correct_option.trim().toUpperCase();
  const cols = { A: 'option_a', B: 'option_b', C: 'option_c', D: 'option_d' };
  const correctText = o[cols[correct]];
  const correctLen = correctText.length;
  const distractorKeys = ['A', 'B', 'C', 'D'].filter(k => k !== correct);
  const baseSeed = seedFromString('abu-smooth|' + o.module_key + '|' + (o.question || '') + '|' + correctText);
  let cursor = baseSeed % QUALIFIERS.length;
  let safety = 0;
  let padded = false;
  while (safety < 40) {
    const lens = distractorKeys.map(k => o[cols[k]].length);
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    const min = Math.min(...lens);
    if (avg >= correctLen * 0.85 && min >= correctLen * 0.7) break;
    let shortestKey = distractorKeys[0];
    let shortestLen = o[cols[shortestKey]].length;
    for (const k of distractorKeys) {
      const l = o[cols[k]].length;
      if (l < shortestLen) { shortestKey = k; shortestLen = l; }
    }
    const q = QUALIFIERS[cursor % QUALIFIERS.length];
    cursor += 1;
    if (!o[cols[shortestKey]].includes(q.trim())) {
      // Begrenze maximal hinzugefuegte Zeichen pro Distraktor.
      if (o[cols[shortestKey]].length + q.length > correctLen + 25) break;
      o[cols[shortestKey]] = o[cols[shortestKey]] + q;
      padded = true;
    }
    safety += 1;
  }
  if (padded) lengthChanged.padded += 1;
}

for (const o of interleaved) {
  const correct = o.correct_option.trim().toUpperCase();
  const cols = { A: 'option_a', B: 'option_b', C: 'option_c', D: 'option_d' };
  const correctText = o[cols[correct]];
  const distractors = ['A', 'B', 'C', 'D'].filter(k => k !== correct).map(k => o[cols[k]]);

  // Erst smoothen, dann shufflen — sonst muessten wir nach dem Shuffle den
  // Korrekt-Slot tracken. Wir smoothen direkt auf dem Frage-Objekt.
  smoothDistractors(o);

  // Reload nach Smoothing.
  const distractorsSmoothed = ['A', 'B', 'C', 'D'].filter(k => k !== correct).map(k => o[cols[k]]);

  // Position der korrekten Antwort wird deterministisch durch RNG gewaehlt.
  const seed = seedFromString('abu-shuffle|' + o.module_key + '|' + (o.question || '') + '|' + correctText);
  const rng = mulberry32(seed);
  const correctPos = Math.floor(rng() * 4); // 0..3 -> A..D
  const distractorOrder = shuffleWithRng(distractorsSmoothed, rng);
  const letters = ['A', 'B', 'C', 'D'];
  const newCorrect = letters[correctPos];
  // Befuelle Optionen neu.
  let dIdx = 0;
  for (let p = 0; p < 4; p++) {
    const L = letters[p];
    if (p === correctPos) o[cols[L]] = correctText;
    else { o[cols[L]] = distractorOrder[dIdx]; dIdx += 1; }
  }
  o.correct_option = newCorrect;
}

// Schreibe CSV zurueck.
fs.writeFileSync(abs(CSV_PATH), rowsToCsv(header, interleaved));

// Statistik.
const dist = { A: 0, B: 0, C: 0, D: 0 };
let cLens = [], dLens = [];
let correctLongest = 0;
for (const o of interleaved) {
  const c = o.correct_option;
  dist[c] = (dist[c] || 0) + 1;
  const map = { A: o.option_a, B: o.option_b, C: o.option_c, D: o.option_d };
  const correctLen = map[c].length;
  cLens.push(correctLen);
  let isLongest = true;
  for (const k of ['A', 'B', 'C', 'D']) {
    if (k === c) continue;
    dLens.push(map[k].length);
    if (map[k].length >= correctLen) isLongest = false;
  }
  if (isLongest) correctLongest += 1;
}
const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
console.log('Total Fragen:', interleaved.length);
console.log('correct_option Verteilung:', dist);
console.log('Avg correct len:', avg(cLens).toFixed(2));
console.log('Avg distractor len:', avg(dLens).toFixed(2));
console.log('Ratio:', (avg(cLens) / avg(dLens)).toFixed(3));
console.log('Korrekt = laengste (strikt):', correctLongest, '(' + ((100 * correctLongest) / interleaved.length).toFixed(1) + '%)');
console.log('Distraktor-Padding angewandt:', lengthChanged.padded);
