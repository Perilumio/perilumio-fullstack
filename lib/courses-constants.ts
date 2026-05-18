export type CourseKey = 'strassenbau' | 'abu';

type Course = { key: CourseKey; label: string; description: string };

// Definierte Kurse in beliebiger Reihenfolge. Die exportierte COURSES-Liste
// sortiert ABU immer an erste Stelle und alle weiteren Kurse alphabetisch
// nach Label, damit künftige Kurse automatisch korrekt einsortiert werden.
const COURSE_DEFINITIONS: ReadonlyArray<Course> = [
  { key: 'strassenbau', label: 'Strassenbau', description: 'Berufsspezifischer Kurs · Arbeitssicherheit' },
  { key: 'abu',         label: 'ABU',         description: 'Allgemeinbildung · QV-naher Kurs' },
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

export const DEFAULT_COURSE_KEY: CourseKey = 'strassenbau';
const KEYS = new Set(COURSES.map((c) => c.key));

export function isValidCourseKey(key: unknown): key is CourseKey {
  return typeof key === 'string' && KEYS.has(key as CourseKey);
}

export function courseLabel(key: string | null | undefined): string {
  const found = COURSES.find((c) => c.key === key);
  return found ? found.label : COURSES[0].label;
}
