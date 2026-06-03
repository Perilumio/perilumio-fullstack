// Level-System: Stufennamen, Berechnung der Stufe aus Level, XP-Schwelle bis
// zum nächsten Level. Die Stufenformel ist absichtlich kursneutral, damit sie
// für alle Berufe gleich funktioniert.
//
// Mapping (5 Stufen):
//   Level  1 –  4  → Anfänger:in
//   Level  5 – 10  → Lernende:r
//   Level 11 – 20  → Fortgeschritten
//   Level 21 – 35  → Profi
//   Level 36+      → Champion
//
// Diese Schwellen sind so gewählt, dass:
//   - Anfänger:in ist die kurze Onboarding-Phase (≈ 0–399 XP)
//   - Lernende:r ist der typische Bereich für aktive Wochen-Lerner (400–999)
//   - Fortgeschritten = mehrere Wochen Übung (1000–1999)
//   - Profi = ein ganzes Schuljahr engagiert (2000–3499)
//   - Champion ab 3500 XP (≈ 175 richtige Antworten)
// XP-pro-Level bleibt konstant bei 100, die Stufenwechsel sind also kalkulierbar.

export type LevelTier = {
  key: 'starter' | 'learner' | 'advanced' | 'pro' | 'champion';
  label: string;
  // Untere Level-Grenze (inklusiv).
  minLevel: number;
  // CSS-Farbe für Badge / Akzent.
  color: string;
};

export const LEVEL_TIERS: ReadonlyArray<LevelTier> = [
  { key: 'starter',   label: 'Anfänger:in',     minLevel: 1,  color: '#8ea2c9' },
  { key: 'learner',   label: 'Lernende:r',      minLevel: 5,  color: '#37b8ff' },
  { key: 'advanced',  label: 'Fortgeschritten', minLevel: 11, color: '#7bd8ff' },
  { key: 'pro',       label: 'Profi',           minLevel: 21, color: '#25d07f' },
  { key: 'champion',  label: 'Champion',        minLevel: 36, color: '#ffd84d' },
];

const XP_PER_LEVEL = 100;

// Aus dem Level (≥1) den passenden Tier liefern. Fällt auf den ersten Tier
// zurück, falls etwas Unsinniges (z. B. 0) reinkommt.
export function tierForLevel(level: number): LevelTier {
  const safeLevel = Math.max(1, Math.floor(level));
  let active = LEVEL_TIERS[0];
  for (const tier of LEVEL_TIERS) {
    if (safeLevel >= tier.minLevel) active = tier;
  }
  return active;
}

// Aus XP das Level berechnen — gleiche Formel wie in den API-Routes, damit
// Client und Server konsistent bleiben, ohne dass ein Round-Trip nötig ist.
export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
}

// Fortschritt innerhalb des aktuellen Levels. Gibt zurück, wieviel XP der
// User im aktuellen Level schon hat, wieviel bis zum nächsten Level fehlen,
// und einen 0–100 Prozentwert für die UI-Progressbar.
export function levelProgress(xp: number): {
  level: number;
  xpInLevel: number;
  xpForNext: number;
  percent: number;
  nextLevelTier: LevelTier;
} {
  const safeXp = Math.max(0, xp);
  const level = levelFromXp(safeXp);
  const xpInLevel = safeXp - (level - 1) * XP_PER_LEVEL;
  const xpForNext = XP_PER_LEVEL;
  const percent = Math.min(100, Math.round((xpInLevel / xpForNext) * 100));
  return {
    level,
    xpInLevel,
    xpForNext,
    percent,
    nextLevelTier: tierForLevel(level + 1),
  };
}
