export type CourseKey = 'strassenbau' | 'abu' | 'automechaniker' | 'schreiner' | 'fage' | 'kv' | 'informatiker' | 'detailhandel';

type Course = { key: CourseKey; label: string; description: string; comingSoon: boolean };

// Definierte Kurse in beliebiger Reihenfolge. Die exportierte COURSES-Liste
// sortiert ABU immer an erste Stelle und alle weiteren Kurse alphabetisch
// nach Label, damit künftige Kurse automatisch korrekt einsortiert werden.
// comingSoon: nur ABU ist aktuell aktivierbar, alle anderen Kurse sind als
// "Coming Soon" markiert und koennen nicht als aktiver Kurs gesetzt werden.
const COURSE_DEFINITIONS: ReadonlyArray<Course> = [
  { key: 'strassenbau',    label: 'Strassenbau',    description: 'Berufsspezifischer Kurs · Arbeitssicherheit',          comingSoon: true },
  { key: 'abu',            label: 'ABU',            description: 'Allgemeinbildung · QV-naher Kurs',                     comingSoon: false },
  { key: 'automechaniker', label: 'Automechaniker', description: 'Berufsspezifischer Kurs · Bildungsplan EFZ',           comingSoon: true },
  { key: 'schreiner',      label: 'Schreiner',      description: 'Berufsspezifischer Kurs · Bildungsplan EFZ',           comingSoon: true },
  { key: 'fage',           label: 'FaGe',           description: 'Fachfrau/Fachmann Gesundheit · Bildungsplan EFZ',      comingSoon: true },
  { key: 'kv',             label: 'KV',             description: 'Kauffrau/Kaufmann · Bildungsplan EFZ (BiVo 2023)',     comingSoon: true },
  { key: 'informatiker',   label: 'Informatik',     description: 'Informatiker/in · Bildungsplan EFZ (BiVo 2021)',       comingSoon: true },
  { key: 'detailhandel',   label: 'Detailhandel',   description: 'Detailhandelsfachfrau/-mann · Bildungsplan EFZ',       comingSoon: true },
];

export function sortCourses<T extends { key: CourseKey; label: string }>(courses: ReadonlyArray<T>): T[] {
  const abu = courses.filter((c) => c.key === 'abu');
  const rest = courses
    .filter((c) => c.key !== 'abu')
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  return [...abu, ...rest];
}

export const COURSES: ReadonlyArray<Course> = sortCourses(COURSE_DEFINITIONS);

export const DEFAULT_COURSE_KEY: CourseKey = 'abu';
const KEYS = new Set(COURSES.map((c) => c.key));

export function isValidCourseKey(key: unknown): key is CourseKey {
  return typeof key === 'string' && KEYS.has(key as CourseKey);
}

export function courseLabel(key: string | null | undefined): string {
  const found = COURSES.find((c) => c.key === key);
  return found ? found.label : COURSES[0].label;
}

// Ein Kurs ist aktivierbar, wenn er ein gueltiger Schluessel ist und nicht als
// Coming Soon markiert ist. Unbekannte Schluessel gelten nicht als aktivierbar.
export function isCourseSelectable(key: string | null | undefined): boolean {
  const found = COURSES.find((c) => c.key === key);
  return !!found && !found.comingSoon;
}

export function isComingSoonCourse(key: string | null | undefined): boolean {
  const found = COURSES.find((c) => c.key === key);
  return !!found && found.comingSoon;
}
