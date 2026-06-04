import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { BattleClient } from '@/components/BattleClient';
import { getActiveCourseKey, courseLabel } from '@/lib/courses';
import { getCourseQuestions } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function BattlePage() {
  const courseKey = await getActiveCourseKey();
  const questions = await getCourseQuestions(courseKey);
  const hasQuestions = questions.length > 0;

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill" data-testid="battle-course-indicator">Kurs: {courseLabel(courseKey)}</span>
            <h1>
              <span className="hide-mobile">Quizbattle · Echtzeit-Duell</span>
              <span className="show-mobile">Quizbattle</span>
            </h1>
            <p className="muted hide-mobile">Trete in der Warteschlange an und kämpfe gegen einen echten Mitspieler im selben Kurs.</p>
          </div>
        </div>
        {!hasQuestions ? (
          <div className="card stack" data-testid="battle-empty-state">
            <h2>Noch keine Battle-Fragen für {courseLabel(courseKey)}</h2>
            <p className="muted">
              Für diesen Kurs gibt es aktuell keine Fragen. Wähle einen anderen Kurs, um ein Battle zu starten.
            </p>
            <Link className="btn btn-primary" href="/courses" data-testid="battle-empty-courses-link">Zur Kursauswahl</Link>
          </div>
        ) : (
          <BattleClient courseName={courseLabel(courseKey)} hasQuestions={hasQuestions} />
        )}
      </section>
    </AppShell>
  );
}
