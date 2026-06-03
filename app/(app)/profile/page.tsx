import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { ProfileEditor } from '@/components/ProfileEditor';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AVATAR_KEY, avatarLabel } from '@/lib/avatars';
import { COURSES, courseLabel, isValidCourseKey, DEFAULT_COURSE_KEY, type CourseKey } from '@/lib/courses';
import { LevelBadge } from '@/components/LevelBadge';
import { levelFromXp } from '@/lib/levels';

export const dynamic = 'force-dynamic';

// Kleines Flammen-Icon (SVG) fuer die Streak-Karte. Bewusst als Inline-SVG
// statt Emoji, damit kein Emoji im UI landet und die Farbe zum Design passt.
function FlameIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M12 2.5c1.6 2.7 1.2 4.6-.3 6.1-1.3 1.3-2.7 2.6-2.7 4.7a3 3 0 1 0 5.7 1.3c.8.9 1.3 2 1.3 3.2A6 6 0 1 1 7.5 13c0-3.1 2-5 3.2-6.6 1-1.4 1.5-2.7 1.3-3.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
        { id: user.id, display_name: username, username, avatar_key: DEFAULT_AVATAR_KEY, active_course_key: DEFAULT_COURSE_KEY },
        { onConflict: 'id' },
      )
      .select('*')
      .maybeSingle();
    profile = inserted ?? null;
  } else if (!profile.username || !profile.avatar_key || !profile.active_course_key) {
    const patch: Record<string, string> = {};
    if (!profile.username) patch.username = deriveUsername(user);
    if (!profile.avatar_key) patch.avatar_key = DEFAULT_AVATAR_KEY;
    if (!profile.active_course_key) patch.active_course_key = DEFAULT_COURSE_KEY;
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
    if (m?.id && isValidCourseKey(m.course_key)) {
      moduleCourse.set(m.id as string, m.course_key as CourseKey);
    }
  }
  const lessonCourse = new Map<string, CourseKey>();
  for (const l of (lessons ?? []) as any[]) {
    const ck = moduleCourse.get(l?.module_id as string);
    if (l?.id && ck) lessonCourse.set(l.id as string, ck);
  }

  const emptyByCourse = (): Record<CourseKey, number> =>
    Object.fromEntries(COURSES.map((c) => [c.key, 0])) as Record<CourseKey, number>;

  const totals: Record<CourseKey, number> = emptyByCourse();
  for (const ck of lessonCourse.values()) totals[ck] += 1;

  const passedByCourse: Record<CourseKey, number> = emptyByCourse();
  for (const row of (progress ?? []) as any[]) {
    if (!row?.passed) continue;
    const ck = lessonCourse.get(row.lesson_id as string);
    if (ck) passedByCourse[ck] += 1;
  }

  const courseStats: CourseStats[] = COURSES.map((c) => {
    const total = totals[c.key];
    const passed = passedByCourse[c.key];
    const percent = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { key: c.key, total, passed, percent };
  });

  const username = profile?.username ?? deriveUsername(user);
  const avatarKey = profile?.avatar_key ?? DEFAULT_AVATAR_KEY;
  const xp = profile?.xp ?? 0;
  const battlePoints = profile?.battle_points ?? 0;
  const currentStreak = Number(profile?.current_streak) || 0;
  const longestStreak = Number(profile?.longest_streak) || 0;
  const level = Number(profile?.level) || levelFromXp(xp);

  // Eigener Leaderboard-Rang (All-Time, alle Kurse) ueber die RPC. Fehler
  // duerfen die Profilseite nicht blockieren, dann zeigen wir den Block nicht.
  let selfRank: { rank: number; total: number } | null = null;
  const { data: selfRankRows } = await supabase.rpc('leaderboard_xp_self', {
    p_course_key: null,
    p_since: null,
  });
  const selfRow = Array.isArray(selfRankRows) ? selfRankRows[0] : selfRankRows;
  if (selfRow && Number(selfRow.rank) > 0) {
    selfRank = { rank: Number(selfRow.rank), total: Number(selfRow.total_users) || 0 };
  }
  const activeCourse: CourseKey = isValidCourseKey(profile?.active_course_key)
    ? (profile!.active_course_key as CourseKey)
    : DEFAULT_COURSE_KEY;

  const activeTotal = totals[activeCourse];
  const activePassed = passedByCourse[activeCourse];
  const activePercent = activeTotal > 0 ? Math.round((activePassed / activeTotal) * 100) : 0;

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

        <div className="card stack" data-testid="profile-editor-card">
          <h2>Avatar & Benutzername</h2>
          <p className="muted">Wähle deinen Avatar und Benutzernamen.</p>
          <ProfileEditor initialUsername={username} initialAvatarKey={avatarKey} />
        </div>

        <Link
          href="/courses"
          className="btn"
          data-testid="profile-switch-course-link"
        >
          Zur Kursauswahl
        </Link>

        <div className="grid stats-grid" data-testid="profile-stats">
          <div className="card stat-card">
            <div className="muted">XP</div>
            <div className="kpi" data-testid="profile-xp">{xp}</div>
            <div className="muted" style={{ fontSize: 12 }}>aus Lernpfad</div>
          </div>
          <div className="card stat-card">
            <div className="muted">BP</div>
            <div className="kpi" data-testid="profile-bp">{battlePoints}</div>
            <div className="muted" style={{ fontSize: 12 }}>aus Quizbattle</div>
          </div>
          <div className="card stat-card">
            <div className="muted">Lernfortschritt</div>
            <div className="kpi" data-testid="profile-overall-percent">{activePercent}%</div>
            <div className="muted" style={{ fontSize: 12 }} data-testid="profile-overall-counts">
              {activePassed}/{activeTotal} Lektionen · {courseLabel(activeCourse)}
            </div>
          </div>
        </div>

        <div className="grid grid-2" data-testid="profile-level-streak">
          <div className="card stack" data-testid="profile-level-card">
            <span className="pill">Stufe</span>
            <LevelBadge level={level} xp={xp} testId="profile-level-badge" />
          </div>

          <div className="card stack streak-card" data-testid="profile-streak-card">
            <span className="pill streak-pill" data-streak-current={currentStreak}>
              <FlameIcon />
              <span style={{ marginLeft: 6 }}>Streak</span>
            </span>
            <div className="streak-card-body">
              <div>
                <div className="kpi" data-testid="profile-streak-current">{currentStreak}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {currentStreak === 1 ? 'Tag in Folge' : 'Tage in Folge'}
                </div>
              </div>
              <div>
                <div className="kpi" data-testid="profile-streak-longest">{longestStreak}</div>
                <div className="muted" style={{ fontSize: 12 }}>laengste Serie</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card stack" data-testid="profile-rank-card">
          <span className="pill">Rangliste</span>
          {selfRank ? (
            <p data-testid="profile-rank-text">
              Rang <strong>#{selfRank.rank}</strong> von {selfRank.total} aktiven Lernenden
            </p>
          ) : (
            <p className="muted" data-testid="profile-rank-empty">
              Sammle XP im Lernpfad, um in die Rangliste aufgenommen zu werden.
            </p>
          )}
          <Link href="/leaderboard" className="btn" data-testid="profile-rank-link">
            Zur Rangliste
          </Link>
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

        <section className="stack">
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
              <span data-testid="profile-passed-count">{activePassed}</span>
              <span className="muted"> · {courseLabel(activeCourse)}</span>
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
