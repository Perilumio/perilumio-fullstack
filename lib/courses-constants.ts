export type CourseKey = 'strassenbau' | 'abu';

export const COURSES: ReadonlyArray<{ key: CourseKey; label: string; description: string }> = [
  { key: 'strassenbau', label: 'Strassenbau', description: 'Berufsspezifischer Kurs · Arbeitssicherheit' },
  { key: 'abu',         label: 'ABU',         description: 'Allgemeinbildung · QV-naher Kurs' },
];

export const DEFAULT_COURSE_KEY: CourseKey = 'strassenbau';
const KEYS = new Set(COURSES.map((c) => c.key));

export function isValidCourseKey(key: unknown): key is CourseKey {
  return typeof key === 'string' && KEYS.has(key as CourseKey);
}

export function courseLabel(key: string | null | undefined): string {
  const found = COURSES.find((c) => c.key === key);
  return found ? found.label : COURSES[0].label;
}
