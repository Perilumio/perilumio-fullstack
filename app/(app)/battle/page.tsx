import Link from 'next/link';
import { AppShell, Lumio } from '@/components/AppShell';
import { BattleClient } from '@/components/BattleClient';
import { getActiveCourseKey, courseLabel } from '@/lib/courses';
import { getCourseQuestions } from '@/lib/data';

export const dynamic = 'force-dynamic';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function BattlePage() {
  const courseKey = await getActiveCourseKey();
  const rawQuestions = await getCourseQuestions(courseKey);

  const battleQuestions = shuffle(rawQuestions as any[])
    .slice(0, 5)
    .map((q) => {
      const options = [q.option_a, q.option_b, q.option_c, q.option_d];
      const correct = options[OPTION_KEYS.indexOf(q.correct_option)];
      return { prompt: q.prompt as string, options, correct };
    });

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill" data-testid="battle-course-indicator">Kurs: {courseLabel(courseKey)}</span>
            <h1>Quizbattle</h1>
            <p className="muted">Battle-Fragen aus deinem aktiven Kurs.</p>
          </div>
          <Lumio />
        </div>
        {battleQuestions.length === 0 ? (
          <div className="card stack" data-testid="battle-empty-state">
            <h2>Noch keine Battle-Fragen für {courseLabel(courseKey)}</h2>
            <p className="muted">
              Für diesen Kurs gibt es aktuell keine Fragen. Wähle einen anderen Kurs, um ein Battle zu starten.
            </p>
            <Link className="btn btn-primary" href="/courses" data-testid="battle-empty-courses-link">Zur Kursauswahl</Link>
          </div>
        ) : (
          <BattleClient questions={battleQuestions} courseName={courseLabel(courseKey)} />
        )}
      </section>
    </AppShell>
  );
}
