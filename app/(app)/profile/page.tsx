import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { ProfileEditor } from '@/components/ProfileEditor';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AVATAR_KEY, avatarLabel } from '@/lib/avatars';
import { COURSES, courseLabel, type CourseKey } from '@/lib/courses';

export const dynamic = 'force-dynamic';

function deriveUsername(user: { id: string; email?: string | null; user_metadata?: any }) {
  const fromMeta = (user.user_metadata?.username ?? user.user_metadata?.display_name ?? '') as string;
  const fromEmail = user.email?.split('@')[0] ?? '';
  const raw = (fromMeta || fromEmail || '').trim();
  const cleaned = raw.replace(/[^A-Za-z0-9_\-\.]/g, '');
  if (cleaned.length >= 2 && cleaned.length <= 24) return cleaned;
  return 'lumio_' + user.id.replace(/-/g, '').slice(0, 8);
}

type CourseStats = { key: CourseKey; total: number; passed: number; percent: number };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const username = deriveUsername(user);
    const { data: inserted } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, display_name: username, username, avatar_key: DEFAULT_AVATAR_KEY },
        { onConflict: 'id' },
      )
      .select('*')
      .maybeSingle();
    profile = inserted ?? null;
  } else if (!profile.username || !profile.avatar_key) {
    const patch: Record<string, string> = {};
    if (!profile.username) patch.username = deriveUsername(user);
    if (!profile.avatar_key) patch.avatar_key = DEFAULT_AVATAR_KEY;
    const { data: updated } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('*')
      .maybeSingle();
    profile = updated ?? profile;
  }

  const [{ data: modules }, { data: lessons }, { data: progress }, { count: attemptsCount }] =
    await Promise.all([
      supabase.from('modules').select('id, course_key'),
      supabase.from('lessons').select('id, module_id'),
      supabase.from('lesson_progress').select('lesson_id, passed').eq('user_id', user.id),
      supabase
        .from('lesson_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

  const moduleCourse = new Map<string, CourseKey>();
  for (const m of (modules ?? []) as any[]) {
    if (m?.id && (m.course_key === 'abu' || m.course_key === 'strassenbau')) {
      moduleCourse.set(m.id as string, m.course_key as CourseKey);
    }
  }
  const lessonCourse = new Map<string, CourseKey>();
  for (const l of (lessons ?? []) as any[]) {
    const ck = moduleCourse.get(l?.module_id as string);
    if (l?.id && ck) lessonCourse.set(l.id as string, ck);
  }

  const totals: Record<CourseKey, number> = { abu: 0, strassenbau: 0 };
  for (const ck of lessonCourse.values()) totals[ck] += 1;

  const passedByCourse: Record<CourseKey, number> = { abu: 0, strassenbau: 0 };
  const passedLessonIds = new Set<string>();
  for (const row of (progress ?? []) as any[]) {
    if (!row?.passed) continue;
    passedLessonIds.add(row.lesson_id as string);
    const ck = lessonCourse.get(row.lesson_id as string);
    if (ck) passedByCourse[ck] += 1;
  }

  const courseStats: CourseStats[] = COURSES.map((c) => {
    const total = totals[c.key];
    const passed = passedByCourse[c.key];
    const percent = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { key: c.key, total, passed, percent };
  });

  const totalLessons = totals.abu + totals.strassenbau;
  const totalPassed = passedByCourse.abu + passedByCourse.strassenbau;
  const overallPercent = totalLessons > 0 ? Math.round((totalPassed / totalLessons) * 100) : 0;

  const username = profile?.username ?? deriveUsername(user);
  const avatarKey = profile?.avatar_key ?? DEFAULT_AVATAR_KEY;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const battlePoints = profile?.battle_points ?? 0;
  const activeCourse = (profile?.active_course_key ?? 'strassenbau') as CourseKey;
  const xpIntoLevel = xp % 100;
  const xpToNextLevel = 100 - xpIntoLevel;

  return (
    <AppShell>
      <section className="stack" data-testid="profile-page">
        <div className="card hero" data-testid="profile-hero">
          <div>
            <span className="pill">Profil</span>
            <h1 data-testid="profile-display-username">{username}</h1>
            <p className="muted">
              Aktiver Kurs:{' '}
              <strong data-testid="profile-active-course">{courseLabel(activeCourse)}</strong>
            </p>
          </div>
          <Avatar avatarKey={avatarKey} size="lg" testId="profile-current-avatar" />
        </div>

        <div className="grid grid-4" data-testid="profile-stats">
          <div className="card">
            <div className="muted">XP</div>
            <div className="kpi" data-testid="profile-xp">{xp}</div>
            <div className="muted" style={{ fontSize: 12 }}>aus Lernpfad</div>
          </div>
          <div className="card">
            <div className="muted">Level</div>
            <div className="kpi" data-testid="profile-level">{level}</div>
            <div className="muted" style={{ fontSize: 12 }} data-testid="profile-xp-to-next">
              noch {xpToNextLevel} XP
            </div>
          </div>
          <div className="card">
            <div className="muted">Battlepunkte</div>
            <div className="kpi" data-testid="profile-bp">{battlePoints}</div>
            <div className="muted" style={{ fontSize: 12 }}>aus Quizbattle</div>
          </div>
          <div className="card">
            <div className="muted">Gesamtfortschritt</div>
            <div className="kpi" data-testid="profile-overall-percent">{overallPercent}%</div>
            <div className="muted" style={{ fontSize: 12 }} data-testid="profile-overall-counts">
              {totalPassed}/{totalLessons} Lektionen
            </div>
          </div>
        </div>

        <div className="card stack" data-testid="profile-course-progress">
          <div className="hero">
            <div>
              <span className="pill">Kursfortschritt</span>
              <h2 style={{ margin: '8px 0 4px' }}>Pro Kurs</h2>
              <p className="muted">Bestandene Lektionen je Kurs.</p>
            </div>
          </div>
          {courseStats.map((c) => (
            <div
              key={c.key}
              className="card"
              data-testid={`profile-course-row-${c.key}`}
              style={{ padding: 14 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <strong data-testid={`profile-course-label-${c.key}`}>{courseLabel(c.key)}</strong>
                <span className="muted" data-testid={`profile-course-counts-${c.key}`}>
                  {c.passed}/{c.total} Lektionen · {c.percent}%
                </span>
              </div>
              <div
                aria-hidden="true"
                style={{
                  marginTop: 10,
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(76,123,255,.18)',
                  overflow: 'hidden',
                }}
              >
                <div
                  data-testid={`profile-course-bar-${c.key}`}
                  style={{
                    width: `${c.percent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg,#33c7ff,#2372ff)',
                    boxShadow: '0 0 18px rgba(55,184,255,.4)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <section className="grid grid-2">
          <div className="card stack" data-testid="profile-editor-card">
            <h2>Avatar & Benutzername</h2>
            <p className="muted">Wähle deinen Avatar und Benutzernamen.</p>
            <ProfileEditor initialUsername={username} initialAvatarKey={avatarKey} />
          </div>
          <div className="card stack" data-testid="profile-account-card">
            <h2>Konto</h2>
            <div>
              <strong>Anzeigename:</strong>{' '}
              <span data-testid="profile-display-username-row">{username}</span>
            </div>
            <div>
              <strong>Avatar:</strong>{' '}
              <span data-testid="profile-display-avatar-label">{avatarLabel(avatarKey)}</span>
            </div>
            <div>
              <strong>E-Mail:</strong> {user.email ?? '—'}
            </div>
            <div>
              <strong>Rolle:</strong> {profile?.role ?? 'student'}
            </div>
            <div>
              <strong>Versuche gesamt:</strong>{' '}
              <span data-testid="profile-attempts-count">{attemptsCount ?? 0}</span>
            </div>
            <div>
              <strong>Bestandene Lektionen:</strong>{' '}
              <span data-testid="profile-passed-count">{totalPassed}</span>
            </div>
            <div>
              <strong>Konto erstellt:</strong>{' '}
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('de-DE')
                : user.created_at
                  ? new Date(user.created_at).toLocaleDateString('de-DE')
                  : '—'}
            </div>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
