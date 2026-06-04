import { AppShell } from '@/components/AppShell';
import { AdminGate } from '@/components/AdminGate';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { courseLabel } from '@/lib/courses-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LessonProgressRow = {
  user_id: string;
  lesson_id: string;
  best_score: number;
  passed: boolean;
  last_question_index: number;
  updated_at: string;
};

type LessonRow = { id: string; title: string; module_id: string; pass_score: number };
type ModuleRow = { id: string; title: string; course_key: string | null };
type ProfileRow = { id: string; username: string | null; display_name: string | null };
type QuestionRow = { lesson_id: string };

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

export default async function AnalyticsPage() {
  const access = await requireAdmin();
  if (!access.ok) {
    return <AppShell><section className="stack"><AdminGate /></section></AppShell>;
  }

  const [progressRes, lessonsRes, modulesRes, profilesRes, questionsRes] = await Promise.all([
    supabaseAdmin.from('lesson_progress').select('user_id,lesson_id,best_score,passed,last_question_index,updated_at'),
    supabaseAdmin.from('lessons').select('id,title,module_id,pass_score'),
    supabaseAdmin.from('modules').select('id,title,course_key'),
    supabaseAdmin.from('profiles').select('id,username,display_name'),
    supabaseAdmin.from('questions').select('lesson_id'),
  ]);

  const progress = (progressRes.data ?? []) as LessonProgressRow[];
  const lessons = (lessonsRes.data ?? []) as LessonRow[];
  const modules = (modulesRes.data ?? []) as ModuleRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const questions = (questionsRes.data ?? []) as QuestionRow[];

  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const totalQuestionsByLesson = new Map<string, number>();
  for (const q of questions) {
    totalQuestionsByLesson.set(q.lesson_id, (totalQuestionsByLesson.get(q.lesson_id) ?? 0) + 1);
  }

  type DropOff = {
    user_id: string;
    user_label: string;
    course_key: string | null;
    course_label: string;
    lesson_id: string;
    lesson_title: string;
    last_question_index: number;
    total_questions: number;
    percent: number;
    best_score: number;
    updated_at: string;
  };

  const dropOffs: DropOff[] = [];
  for (const p of progress) {
    if (p.passed) continue;
    if (!p.last_question_index || p.last_question_index <= 0) continue;
    const lesson = lessonById.get(p.lesson_id);
    if (!lesson) continue;
    const mod = moduleById.get(lesson.module_id);
    const profile = profileById.get(p.user_id);
    const total = totalQuestionsByLesson.get(p.lesson_id) ?? 0;
    const answered = Math.min(p.last_question_index, total || p.last_question_index);
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    dropOffs.push({
      user_id: p.user_id,
      user_label: profile?.username ?? profile?.display_name ?? p.user_id.slice(0, 8),
      course_key: mod?.course_key ?? null,
      course_label: mod?.course_key ? courseLabel(mod.course_key) : '—',
      lesson_id: p.lesson_id,
      lesson_title: lesson.title,
      last_question_index: p.last_question_index,
      total_questions: total,
      percent,
      best_score: p.best_score,
      updated_at: p.updated_at,
    });
  }
  dropOffs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  type LessonAgg = {
    lesson_id: string;
    lesson_title: string;
    course_label: string;
    drop_offs: number;
    avg_percent: number;
    last_progress_at: string;
  };
  const lessonAggMap = new Map<string, { sumPercent: number; count: number; lastTs: number; title: string; courseLabel: string }>();
  for (const d of dropOffs) {
    const entry = lessonAggMap.get(d.lesson_id) ?? { sumPercent: 0, count: 0, lastTs: 0, title: d.lesson_title, courseLabel: d.course_label };
    entry.sumPercent += d.percent;
    entry.count += 1;
    const ts = new Date(d.updated_at).getTime();
    if (ts > entry.lastTs) entry.lastTs = ts;
    lessonAggMap.set(d.lesson_id, entry);
  }
  const lessonAgg: LessonAgg[] = Array.from(lessonAggMap.entries()).map(([lesson_id, v]) => ({
    lesson_id,
    lesson_title: v.title,
    course_label: v.courseLabel,
    drop_offs: v.count,
    avg_percent: v.count > 0 ? Math.round(v.sumPercent / v.count) : 0,
    last_progress_at: new Date(v.lastTs).toISOString(),
  }));
  lessonAgg.sort((a, b) => b.drop_offs - a.drop_offs);

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">Admin · Analytics</span>
            <h1>Abbruchstellen & Export</h1>
            <p className="muted">Lektionen, die begonnen aber nicht bestanden wurden. Nur für Admins sichtbar.</p>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Export</h2>
          <p className="muted" style={{ margin: 0 }}>CSV-Downloads mit deutschen Spaltennamen, UTF-8.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <a className="btn btn-primary" href="/api/admin/analytics/export?type=dropoffs" download>
              Abbruchstellen exportieren
            </a>
            <a className="btn" href="/api/admin/analytics/export?type=users" download>
              Nutzerübersicht exportieren
            </a>
            <a className="btn" href="/api/admin/analytics/export?type=progress" download>
              Lernfortschritt exportieren
            </a>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Abbruchstellen</h2>
          <p className="muted" style={{ margin: 0 }}>
            Lektion begonnen (mind. eine Frage beantwortet), aber noch nicht bestanden. Insgesamt {dropOffs.length}.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nutzer</th>
                  <th>Kurs</th>
                  <th>Lektion</th>
                  <th>Letzte Frage / Total</th>
                  <th>Fortschritt</th>
                  <th>Best Score</th>
                  <th>Letzter Fortschritt</th>
                </tr>
              </thead>
              <tbody>
                {dropOffs.length === 0 && (
                  <tr><td colSpan={7} className="muted">Keine Abbruchstellen erkannt.</td></tr>
                )}
                {dropOffs.slice(0, 200).map((d) => (
                  <tr key={`${d.user_id}-${d.lesson_id}`}>
                    <td>{d.user_label}</td>
                    <td>{d.course_label}</td>
                    <td>{d.lesson_title}</td>
                    <td>{d.last_question_index} / {d.total_questions || '?'}</td>
                    <td>{d.percent}%</td>
                    <td>{d.best_score}</td>
                    <td>{formatRelative(d.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dropOffs.length > 200 && (
            <p className="muted" style={{ margin: 0 }}>Zeige Top 200 nach letztem Fortschritt. Vollständige Liste via CSV-Export.</p>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ margin: 0 }}>Top-Lektionen mit Abbrüchen</h2>
          <p className="muted" style={{ margin: 0 }}>Aggregiert nach Anzahl offener Fortschritte je Lektion.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Kurs</th>
                  <th>Lektion</th>
                  <th>Abbrüche</th>
                  <th>Ø Fortschritt</th>
                  <th>Letzter Fortschritt</th>
                </tr>
              </thead>
              <tbody>
                {lessonAgg.length === 0 && (
                  <tr><td colSpan={5} className="muted">Keine Daten.</td></tr>
                )}
                {lessonAgg.slice(0, 50).map((l) => (
                  <tr key={l.lesson_id}>
                    <td>{l.course_label}</td>
                    <td>{l.lesson_title}</td>
                    <td>{l.drop_offs}</td>
                    <td>{l.avg_percent}%</td>
                    <td>{formatRelative(l.last_progress_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
