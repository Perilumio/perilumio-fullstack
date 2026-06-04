import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { LearnPageClient } from '@/components/LearnPageClient';
import { getActiveCourseKey, courseLabel, isValidCourseKey, type CourseKey } from '@/lib/courses';
import { getCourseLessons } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LearnPage({ searchParams }: { searchParams?: Promise<{ course?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const override = isValidCourseKey(params?.course) ? (params!.course as CourseKey) : null;
  const courseKey: CourseKey = override ?? (await getActiveCourseKey());
  const { lessons, questions } = await getCourseLessons(courseKey);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const lessonIds = (lessons as { id: string }[]).map((l) => l.id);
  let progress: { lesson_id: string; best_score: number; passed: boolean; last_question_index: number }[] = [];
  let streak = { current: 0, longest: 0 };
  if (auth.user) {
    if (lessonIds.length > 0) {
      const { data } = await supabase
        .from('lesson_progress')
        .select('lesson_id, best_score, passed, last_question_index')
        .eq('user_id', auth.user.id)
        .in('lesson_id', lessonIds);
      progress = data ?? [];
    }
    // Streak-Werte initial vom Profil ziehen. Wenn der User heute schon gelernt
    // hat, ist current bereits aktuell — sonst zeigen wir den letzten Stand
    // und ein Treffer heute bringt ihn live nach oben.
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, last_streak_date')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (profile) {
      // Wenn der letzte Streak-Tag älter als gestern ist (= heute 0:00 minus
      // 1 Tag), ist der Streak gebrochen und wir zeigen 0 an, ohne in der DB
      // zu schreiben (das passiert erst beim nächsten Treffer via RPC).
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Zurich' }));
      today.setHours(0, 0, 0, 0);
      const last = (profile as any).last_streak_date
        ? new Date(`${(profile as any).last_streak_date}T00:00:00`)
        : null;
      const diffDays = last
        ? Math.round((today.getTime() - last.getTime()) / 86400000)
        : null;
      const displayCurrent = diffDays === null || diffDays > 1
        ? 0
        : Number((profile as any).current_streak) || 0;
      streak = {
        current: displayCurrent,
        longest: Number((profile as any).longest_streak) || 0,
      };
    }
  }

  return (
    <AppShell>
      <section className="stack">
        {lessons.length === 0 ? (
          <>
            <div className="card hero">
              <div>
                <span className="pill" data-testid="learn-course-indicator">Kurs: {courseLabel(courseKey)}</span>
                <h1>Lernpfad</h1>
                <p className="muted">Schritt für Schritt durch den aktiven Kurs.</p>
              </div>
            </div>
            <div className="card stack" data-testid="learn-empty-state">
              <h2>Noch keine Inhalte für {courseLabel(courseKey)}</h2>
              <p className="muted">
                Für diesen Kurs sind aktuell keine Lektionen hinterlegt. Wir arbeiten daran. Wähle einen anderen Kurs, um weiterzulernen.
              </p>
              <Link className="btn btn-primary" href="/courses" data-testid="learn-empty-courses-link">Zur Kursauswahl</Link>
            </div>
          </>
        ) : (
          <LearnPageClient
            lessons={lessons as any}
            questions={questions as any}
            progress={progress}
            courseName={courseLabel(courseKey)}
            courseLabel={courseLabel(courseKey)}
            userId={auth.user?.id ?? null}
            initialStreak={streak.current}
            initialLongest={streak.longest}
          />
        )}
      </section>
    </AppShell>
  );
}
