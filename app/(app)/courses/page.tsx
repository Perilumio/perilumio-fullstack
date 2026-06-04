import { AppShell } from '@/components/AppShell';
import { CoursePicker } from '@/components/CoursePicker';
import { getActiveCourseKey, courseLabel } from '@/lib/courses';

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  const active = await getActiveCourseKey();
  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">Kurse</span>
            <h1>Wähle deinen Kurs</h1>
            <p className="muted">
              <span className="hide-mobile">Aktiver Kurs: </span>
              <strong data-testid="active-course-display">{courseLabel(active)}</strong>
            </p>
          </div>
        </div>
        <CoursePicker activeCourseKey={active} />
      </section>
    </AppShell>
  );
}
