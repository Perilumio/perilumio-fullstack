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
// Level-Kurve (sanft ansteigend, decelerating):
//   Das höchste benannte Level (Champion-Start = Level 36) wird erst nach
//   320 abgeschlossenen Sequenzen erreicht. Eine Sequenz liefert im Schnitt
//   rund 250 XP (10 Fragen × 20 XP + 50 XP Bonus beim Bestehen), also gilt
//   bei 320 Sequenzen ein XP-Total von 80'000.
//
//   Die Schwelle wächst super-linear (Exponent 1.5), damit die ersten Levels
//   schnell und die letzten langsamer kommen — typische Spieldynamik:
//     xpThreshold(level) = XP_AT_MAX_LEVEL * ((level-1)/(MAX_LEVEL-1)) ** 1.5
//   und invers:
//     levelFromXp(xp) = floor((xp / XP_AT_MAX_LEVEL) ** (1/1.5) * (MAX_LEVEL-1)) + 1
//
//   Sanity (XP_PER_SEQUENCE = 250):
//     Level  1 → 0 Sequenzen
//     Level  5 → ~12 Sequenzen
//     Level 11 → ~49 Sequenzen
//     Level 21 → ~138 Sequenzen
//     Level 36 → 320 Sequenzen (Max)

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

// Höchstes benanntes Level (Champion-Start). Bleibt unverändert.
export const MAX_LEVEL = 36;
// Durchschnittliche XP pro abgeschlossener Sequenz (10 Fragen × 20 XP + 50 XP
// Bestehens-Bonus). Annahme, dokumentiert im PR-Body.
export const XP_PER_SEQUENCE = 250;
// Sequenzen bis zum Max-Level und das daraus folgende XP-Total.
export const SEQUENCES_AT_MAX_LEVEL = 320;
export const XP_AT_MAX_LEVEL = SEQUENCES_AT_MAX_LEVEL * XP_PER_SEQUENCE;
// Exponent der Kurve. > 1 → spätere Levels brauchen mehr XP (decelerating).
const LEVEL_CURVE_EXPONENT = 1.5;

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

// XP-Schwelle, ab der ein Level erreicht ist. Level 1 = 0 XP, Level MAX_LEVEL
// = XP_AT_MAX_LEVEL. Dazwischen super-linear ansteigend.
export function xpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  if (safeLevel <= 1) return 0;
  const ratio = (safeLevel - 1) / (MAX_LEVEL - 1);
  return Math.round(XP_AT_MAX_LEVEL * Math.pow(ratio, LEVEL_CURVE_EXPONENT));
}

// Aus XP das Level berechnen — gleiche Formel wie in den API-Routes, damit
// Client und Server konsistent bleiben, ohne dass ein Round-Trip nötig ist.
// Inverse von xpForLevel, geklemmt auf [1, MAX_LEVEL].
export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, xp);
  if (safeXp <= 0) return 1;
  const ratio = Math.pow(safeXp / XP_AT_MAX_LEVEL, 1 / LEVEL_CURVE_EXPONENT);
  const level = Math.floor(ratio * (MAX_LEVEL - 1)) + 1;
  return Math.max(1, Math.min(MAX_LEVEL, level));
}

// Fortschritt innerhalb des aktuellen Levels. Gibt zurück, wieviel XP der
// User im aktuellen Level schon hat, wieviel bis zum nächsten Level fehlen,
// und einen 0–100 Prozentwert für die UI-Progressbar. Beim Max-Level ist der
// Balken voll und es gibt kein nächstes Level mehr.
export function levelProgress(xp: number): {
  level: number;
  xpInLevel: number;
  xpForNext: number;
  percent: number;
  nextLevelTier: LevelTier;
} {
  const safeXp = Math.max(0, xp);
  const level = levelFromXp(safeXp);
  const currentThreshold = xpForLevel(level);
  if (level >= MAX_LEVEL) {
    return {
      level,
      xpInLevel: safeXp - currentThreshold,
      xpForNext: 0,
      percent: 100,
      nextLevelTier: tierForLevel(level),
    };
  }
  const nextThreshold = xpForLevel(level + 1);
  const span = Math.max(1, nextThreshold - currentThreshold);
  const xpInLevel = safeXp - currentThreshold;
  const percent = Math.min(100, Math.max(0, Math.round((xpInLevel / span) * 100)));
  return {
    level,
    xpInLevel,
    xpForNext: span,
    percent,
    nextLevelTier: tierForLevel(level + 1),
  };
}
