import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { LearnClient } from '@/components/LearnClient';
import { getActiveCourseKey, courseLabel, isValidCourseKey, type CourseKey } from '@/lib/courses';
import { getCourseLessons } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function LearnPage({ searchParams }: { searchParams?: Promise<{ course?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const override = isValidCourseKey(params?.course) ? (params!.course as CourseKey) : null;
  const courseKey: CourseKey = override ?? (await getActiveCourseKey());
  const { lessons, questions } = await getCourseLessons(courseKey);

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill" data-testid="learn-course-indicator">Kurs: {courseLabel(courseKey)}</span>
            <h1>Lernpfad</h1>
            <p className="muted">Schritt für Schritt durch den aktiven Kurs.</p>
          </div>
        </div>
        {lessons.length === 0 ? (
          <div className="card stack" data-testid="learn-empty-state">
            <h2>Noch keine Inhalte für {courseLabel(courseKey)}</h2>
            <p className="muted">
              Für diesen Kurs sind aktuell keine Lektionen hinterlegt. Wir arbeiten daran. Wähle einen anderen Kurs, um weiterzulernen.
            </p>
            <Link className="btn btn-primary" href="/courses" data-testid="learn-empty-courses-link">Zur Kursauswahl</Link>
          </div>
        ) : (
          <LearnClient lessons={lessons as any} questions={questions as any} courseName={courseLabel(courseKey)} />
        )}
      </section>
    </AppShell>
  );
}
