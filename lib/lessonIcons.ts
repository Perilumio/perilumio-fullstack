// Emoji icons surfaced in the Lernpfad overview to make lesson rows easier to
// scan. We keep the mapping in plain TypeScript (no icon library) so the UI
// stays dependency-free and works the same on mobile and desktop.
//
// Mapping is keyed on the cleaned ABU base lesson title (no trailing " · N/M"
// suffix), matching the 16 base lessons seeded by
// supabase/migrations/20260539_abu_smartlearn_rebuild_10x10.sql. Unknown titles
// fall back to a generic lesson icon, so non-ABU courses still render an icon.

const ABU_LESSON_ICONS: Record<string, string> = {
  'Kauf und Konsum: Budget, Kaufvertrag und Gewährleistung': '🛒',
  'Kauf und Konsum: Kredit, Betreibung und Bankgeschäfte': '💳',
  'Berufsbildung, Lehrvertrag und Lernorte': '🎓',
  'Rechtsgrundlagen, Personenrecht und Vertragsrecht': '⚖️',
  'Erwerbsarbeit, Arbeitsvertrag und Sozialpartnerschaft': '💼',
  'Geld und Unternehmen: Wirtschaftskreislauf und Wertschöpfung': '📈',
  'Geld und Unternehmen: Banken, SNB, Inflation und Kaufkraft': '🏦',
  'Risiko, Sicherheit und Versicherungen': '🛡️',
  'Staat, Rechte und Pflichten: Grundlagen der Schweiz': '🏛️',
  'Staat, Rechte und Pflichten: Wahlen, Abstimmungen und Einflussnahme': '🗳️',
  'Heimat, Migration und gesellschaftliche Orientierung': '🌍',
  'Partnerschaft, Familie, Ehe, Konkubinat und Erbrecht': '👨‍👩‍👧',
  'Wohnen, Miete, Zusammenleben und Wohnversicherungen': '🏠',
  'Steuern, Gerechtigkeit und öffentliche Aufgaben': '🧾',
  'Globalisierung, Nachhaltigkeit, Energie und internationale Beziehungen': '🌱',
  'Arbeit, Perspektiven, Vorsorge und Zukunftskompetenzen': '🧭',
};

const GENERIC_LESSON_ICON = '📘';

export function lessonIconForTitle(baseTitle: string): string {
  return ABU_LESSON_ICONS[baseTitle] ?? GENERIC_LESSON_ICON;
}
