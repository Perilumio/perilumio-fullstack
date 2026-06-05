import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { COURSES } from '@/lib/courses-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProfileRow = { id: string; active_course_key: string | null; xp: number | null };
type ProgressRow = { user_id: string; passed: boolean; lesson_id: string };
type LessonRow = { id: string; module_id: string };
type ModuleRow = { id: string; course_key: string | null };

type CourseStat = {
  course_key: string;
  course_label: string;
  enrolled: number;
  sequences_passed: number;
  avg_xp: number;
};

export default async function AnalyticsPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [profilesRes, progressRes, lessonsRes, modulesRes, activeRes, battlesRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,active_course_key,xp'),
    supabaseAdmin.from('lesson_progress').select('user_id,passed,lesson_id'),
    supabaseAdmin.from('lessons').select('id,module_id'),
    supabaseAdmin.from('modules').select('id,course_key'),
    supabaseAdmin.from('analytics_sessions').select('user_id').gte('last_seen_at', sevenDaysAgo),
    supabaseAdmin.from('battle_matches').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const progress = (progressRes.data ?? []) as ProgressRow[];
  const lessons = (lessonsRes.data ?? []) as LessonRow[];
  const modules = (modulesRes.data ?? []) as ModuleRow[];
  const activeRows = (activeRes.data ?? []) as { user_id: string }[];

  const totalUsers = profiles.length;
  const activeUsers7d = new Set(activeRows.map((r) => r.user_id)).size;
  const sequencesPassed = progress.filter((p) => p.passed).length;
  const battlesTotal = battlesRes.count ?? 0;

  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const lessonCourseKey = new Map<string, string | null>();
  for (const l of lessons) {
    lessonCourseKey.set(l.id, moduleById.get(l.module_id)?.course_key ?? null);
  }

  const passedByCourse = new Map<string, number>();
  for (const p of progress) {
    if (!p.passed) continue;
    const key = lessonCourseKey.get(p.lesson_id);
    if (!key) continue;
    passedByCourse.set(key, (passedByCourse.get(key) ?? 0) + 1);
  }

  const enrolledByCourse = new Map<string, number>();
  const xpSumByCourse = new Map<string, number>();
  for (const prof of profiles) {
    const key = prof.active_course_key;
    if (!key) continue;
    enrolledByCourse.set(key, (enrolledByCourse.get(key) ?? 0) + 1);
    xpSumByCourse.set(key, (xpSumByCourse.get(key) ?? 0) + (prof.xp ?? 0));
  }

  const courseStats: CourseStat[] = COURSES.map((c) => {
    const enrolled = enrolledByCourse.get(c.key) ?? 0;
    const xpSum = xpSumByCourse.get(c.key) ?? 0;
    return {
      course_key: c.key,
      course_label: c.label,
      enrolled,
      sequences_passed: passedByCourse.get(c.key) ?? 0,
      avg_xp: enrolled > 0 ? Math.round(xpSum / enrolled) : 0,
    };
  });

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">Admin · Statistiken</span>
            <h1>Statistiken</h1>
            <p className="muted">Kennzahlen und Auswertung pro Kurs. Nur fuer Admins sichtbar.</p>
          </div>
        </div>

        <div className="grid grid-4">
          <div className="card stack" data-testid="kpi-users-total">
            <span className="muted">User gesamt</span>
            <span className="kpi">{totalUsers}</span>
          </div>
          <div className="card stack" data-testid="kpi-users-active">
            <span className="muted">Aktive User (7T)</span>
            <span className="kpi">{activeUsers7d}</span>
          </div>
          <div className="card stack" data-testid="kpi-sequences">
            <span className="muted">Abgeschlossene Sequenzen</span>
            <span className="kpi">{sequencesPassed}</span>
          </div>
          <div className="card stack" data-testid="kpi-battles">
            <span className="muted">Battles gesamt</span>
            <span className="kpi">{battlesTotal}</span>
          </div>
        </div>

        <div className="card stack">
          <div className="topbar">
            <h2 style={{ margin: 0 }}>Pro Kurs</h2>
            <a
              className="btn btn-primary"
              href="/api/admin/analytics/export?type=courses"
              download
              data-testid="analytics-export-courses"
            >
              CSV-Export
            </a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" data-testid="analytics-courses-table">
              <thead>
                <tr>
                  <th>Kurs</th>
                  <th>Eingeschriebene User</th>
                  <th>Abgeschlossene Sequenzen</th>
                  <th>Durchschnittliche XP</th>
                </tr>
              </thead>
              <tbody>
                {courseStats.map((c) => (
                  <tr key={c.course_key} data-testid={`analytics-course-row-${c.course_key}`}>
                    <td>{c.course_label}</td>
                    <td>{c.enrolled}</td>
                    <td>{c.sequences_passed}</td>
                    <td>{c.avg_xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <Link href="/admin" className="btn">Zurueck zum Admin</Link>
        </div>
      </section>
    </AppShell>
  );
}
