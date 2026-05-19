import { AppShell, Lumio } from '@/components/AppShell';
import { AdminGate } from '@/components/AdminGate';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { courseLabel } from '@/lib/courses-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type UserSummary = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  role: string | null;
  xp: number | null;
  level: number | null;
  battle_points: number | null;
  active_course_key: string | null;
  session_count: number;
  total_seconds: number;
  avg_seconds: number;
  total_page_views: number;
  last_seen_at: string | null;
};

type CourseProgress = {
  user_id: string;
  course_key: string;
  lessons_started: number;
  lessons_passed: number;
  avg_best_score: number | null;
  last_progress_at: string | null;
};

type LessonProgressRow = {
  user_id: string;
  lesson_id: string;
  best_score: number;
  passed: boolean;
  last_question_index: number;
  updated_at: string;
};

type LessonRow = {
  id: string;
  title: string;
  module_id: string;
  pass_score: number;
};

type ModuleRow = {
  id: string;
  title: string;
  course_key: string | null;
};

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return `vor ${diffSec}s`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `vor ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `vor ${h}h`;
  const d = Math.floor(h / 24);
  return `vor ${d}d`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

export default async function AnalyticsPage() {
  const access = await requireAdmin();
  if (!access.ok) {
    return <AppShell><section className="stack"><AdminGate /></section></AppShell>;
  }

  const supabase = await createClient();

  const [summaryRes, courseProgressRes, lessonProgressRes, lessonsRes, modulesRes] = await Promise.all([
    supabase.from('analytics_user_summary').select('*'),
    supabase.from('analytics_user_course_progress').select('*'),
    supabase.from('lesson_progress').select('user_id,lesson_id,best_score,passed,last_question_index,updated_at'),
    supabase.from('lessons').select('id,title,module_id,pass_score'),
    supabase.from('modules').select('id,title,course_key'),
  ]);

  const summary = ((summaryRes.data ?? []) as UserSummary[]).slice().sort((a, b) => {
    const at = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bt = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bt - at;
  });
  const courseProgress = (courseProgressRes.data ?? []) as CourseProgress[];
  const lessonProgress = (lessonProgressRes.data ?? []) as LessonProgressRow[];
  const lessons = (lessonsRes.data ?? []) as LessonRow[];
  const modules = (modulesRes.data ?? []) as ModuleRow[];

  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const courseProgressByUser = new Map<string, CourseProgress[]>();
  for (const cp of courseProgress) {
    const list = courseProgressByUser.get(cp.user_id) ?? [];
    list.push(cp);
    courseProgressByUser.set(cp.user_id, list);
  }

  const lessonProgressByUser = new Map<string, LessonProgressRow[]>();
  for (const lp of lessonProgress) {
    const list = lessonProgressByUser.get(lp.user_id) ?? [];
    list.push(lp);
    lessonProgressByUser.set(lp.user_id, list);
  }

  const totalUsers = summary.length;
  const activeUsers7d = summary.filter((u) => {
    const d = daysSince(u.last_seen_at);
    return d !== null && d <= 7;
  }).length;
  const inactiveUsers = summary.filter((u) => {
    const d = daysSince(u.last_seen_at);
    return d === null || d > 7;
  }).length;
  const totalSessionTime = summary.reduce((acc, u) => acc + (u.total_seconds || 0), 0);
  const totalSessions = summary.reduce((acc, u) => acc + (u.session_count || 0), 0);

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">Admin · Analytics</span>
            <h1>Nutzeraktivität & Lernfortschritt</h1>
            <p className="muted">Sitzungen, Verweildauer und Fortschritt pro Kurs/Lektion. Nur für Admins sichtbar.</p>
          </div>
          <Lumio />
        </div>

        <div className="grid stats-grid">
          <div className="card stat-card"><div className="muted">Nutzer gesamt</div><div className="kpi">{totalUsers}</div></div>
          <div className="card stat-card"><div className="muted">Aktiv (7T)</div><div className="kpi">{activeUsers7d}</div></div>
          <div className="card stat-card"><div className="muted">Inaktiv (&gt;7T)</div><div className="kpi">{inactiveUsers}</div></div>
          <div className="card stat-card"><div className="muted">Sitzungen</div><div className="kpi">{totalSessions}</div></div>
          <div className="card stat-card"><div className="muted">Gesamtzeit</div><div className="kpi">{formatDuration(totalSessionTime)}</div></div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Nutzerübersicht</h2>
          <p className="muted" style={{ margin: 0 }}>Sortiert nach letzter Aktivität.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nutzer</th>
                  <th>Aktiver Kurs</th>
                  <th>Letzte Aktivität</th>
                  <th>Besuche</th>
                  <th>Gesamtzeit</th>
                  <th>Ø Sitzung</th>
                  <th>Lektionen ✓</th>
                  <th>XP / BP</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((u) => {
                  const userProgress = lessonProgressByUser.get(u.user_id) ?? [];
                  const passedCount = userProgress.filter((p) => p.passed).length;
                  return (
                    <tr key={u.user_id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{u.username ?? u.display_name ?? u.user_id.slice(0, 8)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{u.role ?? 'student'}</div>
                      </td>
                      <td>{u.active_course_key ? courseLabel(u.active_course_key) : '—'}</td>
                      <td>{formatRelative(u.last_seen_at)}</td>
                      <td>{u.session_count}</td>
                      <td>{formatDuration(u.total_seconds)}</td>
                      <td>{formatDuration(u.avg_seconds)}</td>
                      <td>{passedCount}/{userProgress.length}</td>
                      <td>{u.xp ?? 0} / {u.battle_points ?? 0}</td>
                    </tr>
                  );
                })}
                {summary.length === 0 && (
                  <tr><td colSpan={8} className="muted">Noch keine Daten.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Fortschritt pro Nutzer & Kurs</h2>
          <p className="muted" style={{ margin: 0 }}>Aggregiert aus <code>lesson_progress</code>.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nutzer</th>
                  <th>Kurs</th>
                  <th>Gestartet</th>
                  <th>Bestanden</th>
                  <th>Ø Score</th>
                  <th>Letzter Fortschritt</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactElement[] = [];
                  for (const u of summary) {
                    const userRows = courseProgressByUser.get(u.user_id) ?? [];
                    for (const cp of userRows) {
                      rows.push(
                        <tr key={`${u.user_id}-${cp.course_key}`}>
                          <td>{u.username ?? u.display_name ?? u.user_id.slice(0, 8)}</td>
                          <td>{courseLabel(cp.course_key)}</td>
                          <td>{cp.lessons_started}</td>
                          <td>{cp.lessons_passed}</td>
                          <td>{cp.avg_best_score ?? 0}</td>
                          <td>{formatRelative(cp.last_progress_at)}</td>
                        </tr>
                      );
                    }
                  }
                  if (rows.length === 0) {
                    return <tr><td colSpan={6} className="muted">Noch keine Fortschrittsdaten.</td></tr>;
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Schwache Lektionen</h2>
          <p className="muted" style={{ margin: 0 }}>Lektionen mit <code>best_score</code> &lt; <code>pass_score</code> und noch nicht bestanden.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nutzer</th>
                  <th>Kurs</th>
                  <th>Lektion</th>
                  <th>Best Score</th>
                  <th>Pass Score</th>
                  <th>Letzter Versuch</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const summaryById = new Map(summary.map((u) => [u.user_id, u]));
                  const weak = lessonProgress.filter((lp) => {
                    const lesson = lessonById.get(lp.lesson_id);
                    if (!lesson) return false;
                    return !lp.passed && lp.best_score < lesson.pass_score;
                  });
                  weak.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                  const top = weak.slice(0, 50);
                  if (top.length === 0) {
                    return <tr><td colSpan={6} className="muted">Keine schwachen Lektionen.</td></tr>;
                  }
                  return top.map((lp) => {
                    const lesson = lessonById.get(lp.lesson_id);
                    const mod = lesson ? moduleById.get(lesson.module_id) : null;
                    const u = summaryById.get(lp.user_id);
                    return (
                      <tr key={`${lp.user_id}-${lp.lesson_id}`}>
                        <td>{u?.username ?? u?.display_name ?? lp.user_id.slice(0, 8)}</td>
                        <td>{mod?.course_key ? courseLabel(mod.course_key) : '—'}</td>
                        <td>{lesson?.title ?? lp.lesson_id.slice(0, 8)}</td>
                        <td>{lp.best_score}</td>
                        <td>{lesson?.pass_score ?? 70}</td>
                        <td>{formatRelative(lp.updated_at)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Inaktive Nutzer (&gt; 7 Tage)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nutzer</th>
                  <th>Letzte Aktivität</th>
                  <th>Aktiver Kurs</th>
                  <th>Lektionen ✓</th>
                </tr>
              </thead>
              <tbody>
                {summary
                  .filter((u) => {
                    const d = daysSince(u.last_seen_at);
                    return d === null || d > 7;
                  })
                  .map((u) => {
                    const userProgress = lessonProgressByUser.get(u.user_id) ?? [];
                    const passedCount = userProgress.filter((p) => p.passed).length;
                    return (
                      <tr key={u.user_id}>
                        <td>{u.username ?? u.display_name ?? u.user_id.slice(0, 8)}</td>
                        <td>{u.last_seen_at ? formatRelative(u.last_seen_at) : 'nie'}</td>
                        <td>{u.active_course_key ? courseLabel(u.active_course_key) : '—'}</td>
                        <td>{passedCount}/{userProgress.length}</td>
                      </tr>
                    );
                  })}
                {inactiveUsers === 0 && (
                  <tr><td colSpan={4} className="muted">Alle Nutzer waren in den letzten 7 Tagen aktiv.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
