import { AppShell, Lumio } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { LeaderboardFilters, type PeriodKey, type TabKey } from '@/components/LeaderboardFilters';
import { createClient } from '@/lib/supabase/server';
import { COURSES, courseLabel, isValidCourseKey } from '@/lib/courses';

export const dynamic = 'force-dynamic';

function formatScore(n: number) { return new Intl.NumberFormat('de-CH').format(n); }

function nameOf(row: { username?: string | null; display_name?: string | null }) {
  return row.username || row.display_name || 'Lehrling';
}

function FlameIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5c1.6 2.7 1.2 4.6-.3 6.1-1.3 1.3-2.7 2.6-2.7 4.7a3 3 0 1 0 5.7 1.3c.8.9 1.3 2 1.3 3.2A6 6 0 1 1 7.5 13c0-3.1 2-5 3.2-6.6 1-1.4 1.5-2.7 1.3-3.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function streakLabel(streak: number) {
  return streak === 1 ? '1 Tag' : `${streak} Tage`;
}

// Flammen-Pill je Zeile, nur sichtbar wenn ein aktiver Streak laeuft. Nutzt die
// bestehende .streak-pill-Klasse fuer kraeftigen Kontrast und gut lesbare Groesse.
function StreakPill({ streak }: { streak: number }) {
  if (streak <= 0) return null;
  return (
    <span
      className="pill streak-pill lb-streak-pill"
      data-testid="lb-streak-pill"
      data-streak-current={streak}
      title={`Streak: ${streakLabel(streak)}`}
    >
      <FlameIcon size={16} />
      {streakLabel(streak)}
    </span>
  );
}

// Grosser Streak-Hauptwert fuer den Streak-Tab: prominent und mittig in der Zeile.
function StreakMain({ streak }: { streak: number }) {
  return (
    <span
      className="lb-streak-main"
      data-testid="lb-streak-main"
      title={`Streak: ${streakLabel(streak)}`}
    >
      <FlameIcon size={24} />
      <strong>{streak}</strong>
      <span className="muted">{streak === 1 ? 'Tag' : 'Tage'}</span>
    </span>
  );
}

type Row = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_key: string | null;
  current_streak?: number | null;
  score: number;
  scoreLabel: string;
};

function parseTab(v: string | undefined): TabKey {
  return v === 'bp' || v === 'streak' ? v : 'xp';
}
function parsePeriod(v: string | undefined): PeriodKey {
  return v === '30d' || v === '7d' || v === 'today' ? v : 'all';
}

// Zeit-Filter clientneutral aufloesen: ISO-Zeitstempel, der an die RPC geht.
// "Heute" startet um Mitternacht in Europe/Zurich.
function sinceFromPeriod(period: PeriodKey): string | null {
  const now = new Date();
  if (period === 'all') return null;
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000).toISOString();
  if (period === '7d') return new Date(now.getTime() - 7 * 86400000).toISOString();
  // today: Mitternacht in Europe/Zurich
  const zurichNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Zurich' }));
  zurichNow.setHours(0, 0, 0, 0);
  const offsetMs = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Zurich' })).getTime();
  return new Date(zurichNow.getTime() + offsetMs).toISOString();
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; course?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const period = parsePeriod(sp.period);
  const course = isValidCourseKey(sp.course) ? sp.course : 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AppShell>
        <section className="card stack" data-testid="leaderboard-auth-required">
          <h1>Rangliste</h1>
          <p className="muted">Bitte einloggen, um die Rangliste zu sehen.</p>
        </section>
      </AppShell>
    );
  }

  const courseOptions = COURSES.map((c) => ({ key: c.key, label: c.label }));

  let rows: Row[] = [];
  let selfCard: { rank: number; total: number | null; score: number; scoreLabel: string; streak: number } | null = null;
  let errorMessage: string | null = null;

  // Eigener Streak-Wert fuer die "du"-Karte (in allen Tabs sichtbar).
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('current_streak')
    .eq('id', user.id)
    .maybeSingle();
  const mySelfStreak = Number((myProfile as any)?.current_streak) || 0;

  if (tab === 'xp') {
    const since = sinceFromPeriod(period);
    const courseArg = course === 'all' ? null : course;
    const [{ data: list, error: listErr }, { data: selfRows }] = await Promise.all([
      supabase.rpc('leaderboard_xp', { p_course_key: courseArg, p_since: since, p_limit: 50 }),
      supabase.rpc('leaderboard_xp_self', { p_course_key: courseArg, p_since: since }),
    ]);
    if (listErr) errorMessage = listErr.message;
    rows = ((list ?? []) as any[]).map((r) => ({
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_key: r.avatar_key,
      current_streak: r.current_streak,
      score: Number(r.xp_total) || 0,
      scoreLabel: `XP ${formatScore(Number(r.xp_total) || 0)}`,
    }));
    const selfRow = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    if (selfRow && Number(selfRow.rank) > 0) {
      selfCard = {
        rank: Number(selfRow.rank),
        total: Number(selfRow.total_users) || null,
        score: Number(selfRow.xp_total) || 0,
        scoreLabel: `XP ${formatScore(Number(selfRow.xp_total) || 0)}`,
        streak: mySelfStreak,
      };
    }
  } else if (tab === 'streak') {
    const { data: list, error: listErr } = await supabase.rpc('leaderboard_streak', { p_limit: 50 });
    if (listErr) errorMessage = listErr.message;
    rows = ((list ?? []) as any[]).map((r) => ({
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_key: r.avatar_key,
      current_streak: r.current_streak,
      score: Number(r.current_streak) || 0,
      scoreLabel: `${Number(r.current_streak) || 0} Tage`,
    }));
    // Eigener Streak-Rang ueber Count-Query.
    const myStreak = mySelfStreak;
    if (myStreak > 0) {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('current_streak', myStreak);
      selfCard = {
        rank: (count ?? 0) + 1,
        total: null,
        score: myStreak,
        scoreLabel: streakLabel(myStreak),
        streak: myStreak,
      };
    }
  } else {
    // BP: bestehende Logik, Top 50 nach battle_points aus profiles.
    const { data: list, error: listErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_key, battle_points, current_streak')
      .order('battle_points', { ascending: false })
      .limit(50);
    if (listErr) errorMessage = listErr.message;
    rows = ((list ?? []) as any[]).map((r) => ({
      user_id: r.id,
      username: r.username,
      display_name: r.display_name,
      avatar_key: r.avatar_key,
      current_streak: r.current_streak,
      score: Number(r.battle_points) || 0,
      scoreLabel: `BP ${formatScore(Number(r.battle_points) || 0)}`,
    }));
    const { data: me } = await supabase
      .from('profiles')
      .select('battle_points')
      .eq('id', user.id)
      .maybeSingle();
    const myBp = Number((me as any)?.battle_points) || 0;
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('battle_points', myBp);
    selfCard = {
      rank: (count ?? 0) + 1,
      total: null,
      score: myBp,
      scoreLabel: `BP ${formatScore(myBp)}`,
      streak: mySelfStreak,
    };
  }

  const meInTop = rows.some((r) => r.user_id === user.id);

  const heading =
    tab === 'xp' ? 'Top Lernende' : tab === 'bp' ? 'Battlepunkte' : 'Laengste Serien';
  const subtitle =
    tab === 'xp'
      ? course === 'all'
        ? 'Live-Ranking nach gesammelten XP.'
        : `Live-Ranking nach XP im Kurs ${courseLabel(course)}.`
      : tab === 'bp'
        ? 'Battlepunkte aus tatsaechlich gespielten Quizbattles.'
        : 'Ranking nach aktueller Lern-Serie.';

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero" data-testid="leaderboard-header">
          <div>
            <span className="pill">Rangliste</span>
            <h1>{heading}</h1>
            <p className="muted">{subtitle}</p>
          </div>
          <Lumio />
        </div>

        <LeaderboardFilters
          courses={courseOptions}
          tab={tab}
          course={course}
          period={period}
        />

        <div className="card stack" data-testid={`leaderboard-list-${tab}`}>
          {errorMessage ? (
            <p className="muted" data-testid="leaderboard-error">
              Rangliste konnte nicht geladen werden: {errorMessage}
            </p>
          ) : rows.length === 0 ? (
            <p className="muted" data-testid="leaderboard-empty">
              Noch keine Eintraege fuer diese Ansicht.
            </p>
          ) : (
            rows.map((item, index) => {
              const isMe = item.user_id === user.id;
              return (
                <div
                  className="card lb-row"
                  key={item.user_id}
                  data-testid={isMe ? 'leaderboard-row-me' : 'leaderboard-row'}
                  data-me={isMe ? 'true' : undefined}
                >
                  <span className="lb-rank">#{index + 1}</span>
                  <Avatar avatarKey={item.avatar_key} size="sm" testId="leaderboard-row-avatar" />
                  <div className="lb-meta">
                    <strong data-testid="leaderboard-row-username">
                      {nameOf(item)}
                      {isMe && ' (du)'}
                    </strong>
                    {tab !== 'streak' && <span className="muted">{item.scoreLabel}</span>}
                  </div>
                  {tab === 'streak' ? (
                    <StreakMain streak={Number(item.current_streak) || 0} />
                  ) : (
                    <StreakPill streak={Number(item.current_streak) || 0} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {selfCard && (
        <div className="lb-self-sticky" data-testid="lb-self-card" data-in-top={meInTop ? 'true' : undefined}>
          <div className="card lb-row lb-self-row">
            <span className="lb-rank">#{selfCard.rank}</span>
            <div className="lb-meta">
              <strong>Dein Rang</strong>
              <span className="muted">
                {selfCard.scoreLabel}
                {selfCard.total ? ` · von ${selfCard.total} Lernenden` : ''}
              </span>
            </div>
            {tab !== 'streak' && <StreakPill streak={selfCard.streak} />}
            {meInTop && <span className="muted lb-self-hint">bereits in den Top 50</span>}
          </div>
        </div>
      )}
    </AppShell>
  );
}
