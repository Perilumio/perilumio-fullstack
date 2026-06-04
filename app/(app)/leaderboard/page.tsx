import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { LeaderboardFilters, type PeriodKey, type ScopeKey, type TabKey } from '@/components/LeaderboardFilters';
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

// Flammen-Pill je Zeile als dritte gestapelte Zeile. Bei einem Streak von 0
// bleibt die Pill sichtbar (dezenter Stil ueber .streak-pill[data-streak-current="0"]),
// damit jede Zeile konsistent dreizeilig ist.
function StreakPill({ streak }: { streak: number }) {
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

// Eine Ranglisten-Zeile. Wird sowohl fuer die Top 50 als auch fuer die optional
// unten angehaengte Self-Zeile verwendet, damit das Markup identisch bleibt.
function LbRow({
  item,
  rank,
  isMe,
  tab,
  selfBottom = false,
}: {
  item: Row;
  rank: number;
  isMe: boolean;
  tab: TabKey;
  selfBottom?: boolean;
}) {
  return (
    <div
      className="card lb-row"
      data-testid={selfBottom ? 'lb-self-row-bottom' : isMe ? 'leaderboard-row-me' : 'leaderboard-row'}
      data-me={isMe ? 'true' : undefined}
    >
      <span className="lb-rank">#{rank}</span>
      <Avatar avatarKey={item.avatar_key} size="sm" testId="leaderboard-row-avatar" fallbackLabel={nameOf(item)} />
      <div className="lb-meta lb-meta-rows">
        <strong data-testid="leaderboard-row-username">
          {nameOf(item)}
          {isMe && ' (du)'}
        </strong>
        {tab === 'streak' ? (
          <span className="lb-meta-streak">
            <StreakMain streak={Number(item.current_streak) || 0} />
          </span>
        ) : (
          <>
            <span className="muted">{item.scoreLabel}</span>
            <span className="lb-meta-streak">
              <StreakPill streak={Number(item.current_streak) || 0} />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function parseTab(v: string | undefined): TabKey {
  return v === 'bp' || v === 'streak' ? v : 'xp';
}
function parsePeriod(v: string | undefined): PeriodKey {
  return v === '30d' || v === '7d' || v === 'today' ? v : 'all';
}
function parseScope(v: string | undefined): ScopeKey {
  return v === 'friends' ? 'friends' : 'all';
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
  searchParams: Promise<{ tab?: string; course?: string; period?: string; scope?: string }>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const period = parsePeriod(sp.period);
  const course = isValidCourseKey(sp.course) ? sp.course : 'all';
  const scope = parseScope(sp.scope);
  const friendsOnly = scope === 'friends';

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
  // Eigener Rang, um den User unten anzuhaengen, falls er nicht in den Top 50 ist.
  let selfRank: number | null = null;
  // Anzahl Eintraege im aktuellen Scope (fuer "Rang X von Y"). Im Friends-Scope
  // zaehlt das nur den Freundeskreis (Freunde + ich).
  let selfTotal: number | null = null;
  let errorMessage: string | null = null;

  // Freundes-IDs (Freunde + ich) fuer die Scope-Filterung der BP- und Streak-
  // Listen, die direkt auf profiles gehen. Konvention wie auf der Friends-Page:
  // friendships ist unidirektional (ich folge friend_id), einseitiges Folgen
  // genuegt fuer den Filter. Im "Alle"-Scope wird das Set nicht gebraucht.
  let friendScopeIds: string[] = [user.id];
  if (friendsOnly) {
    const { data: edges } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id);
    friendScopeIds = [user.id, ...((edges ?? []).map((e) => e.friend_id as string))];
  }

  // Eigenes Profil fuer die optionale Self-Zeile (Name, Avatar, Streak).
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_key, current_streak')
    .eq('id', user.id)
    .maybeSingle();
  const mySelfStreak = Number((myProfile as any)?.current_streak) || 0;
  const mySelfScore = { score: 0, scoreLabel: '' };

  if (tab === 'xp') {
    const since = sinceFromPeriod(period);
    const courseArg = course === 'all' ? null : course;
    const [{ data: list, error: listErr }, { data: selfRows }] = await Promise.all([
      supabase.rpc('leaderboard_xp', { p_course_key: courseArg, p_since: since, p_limit: 50, p_friends_only: friendsOnly }),
      supabase.rpc('leaderboard_xp_self', { p_course_key: courseArg, p_since: since, p_friends_only: friendsOnly }),
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
    const selfData = Array.isArray(selfRows) ? selfRows[0] : selfRows;
    if (selfData && Number(selfData.rank) > 0) {
      selfRank = Number(selfData.rank);
      selfTotal = Number(selfData.total_users) || null;
      mySelfScore.score = Number(selfData.xp_total) || 0;
      mySelfScore.scoreLabel = `XP ${formatScore(Number(selfData.xp_total) || 0)}`;
    }
  } else if (tab === 'streak') {
    const { data: list, error: listErr } = await supabase.rpc('leaderboard_streak', { p_limit: 50, p_friends_only: friendsOnly });
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
    // Eigener Streak-Rang ueber Count-Query. Im Friends-Scope auf den
    // Freundeskreis (Freunde + ich) einschraenken.
    const myStreak = mySelfStreak;
    let higherQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('current_streak', myStreak);
    if (friendsOnly) higherQuery = higherQuery.in('id', friendScopeIds);
    const { count } = await higherQuery;
    selfRank = (count ?? 0) + 1;
    if (friendsOnly) {
      // Anzahl Personen im Scope mit Streak > 0 (wie die Liste selbst filtert),
      // plus ich, falls mein Streak 0 ist und ich nicht mitgezaehlt wuerde.
      const { count: scopeCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('id', friendScopeIds)
        .gt('current_streak', 0);
      selfTotal = (scopeCount ?? 0) + (myStreak > 0 ? 0 : 1);
    }
    mySelfScore.score = myStreak;
    mySelfScore.scoreLabel = streakLabel(myStreak);
  } else {
    // BP: bestehende Logik, Top 50 nach battle_points aus profiles. Im
    // Friends-Scope auf den Freundeskreis (Freunde + ich) einschraenken.
    let bpQuery = supabase
      .from('profiles')
      .select('id, username, display_name, avatar_key, battle_points, current_streak')
      .order('battle_points', { ascending: false })
      .limit(50);
    if (friendsOnly) bpQuery = bpQuery.in('id', friendScopeIds);
    const { data: list, error: listErr } = await bpQuery;
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
    let bpHigherQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('battle_points', myBp);
    if (friendsOnly) bpHigherQuery = bpHigherQuery.in('id', friendScopeIds);
    const { count } = await bpHigherQuery;
    selfRank = (count ?? 0) + 1;
    if (friendsOnly) selfTotal = friendScopeIds.length;
    mySelfScore.score = myBp;
    mySelfScore.scoreLabel = `BP ${formatScore(myBp)}`;
  }

  const meInTop = rows.some((r) => r.user_id === user.id);

  // Self-Zeile nur anhaengen, wenn der User nicht ohnehin in den Top 50 steht.
  const selfRow: (Row & { rank: number }) | null =
    !meInTop && selfRank != null
      ? {
          user_id: user.id,
          username: (myProfile as any)?.username ?? null,
          display_name: (myProfile as any)?.display_name ?? null,
          avatar_key: (myProfile as any)?.avatar_key ?? null,
          current_streak: mySelfStreak,
          score: mySelfScore.score,
          scoreLabel: mySelfScore.scoreLabel,
          rank: selfRank,
        }
      : null;

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
            <p className="muted hide-mobile">{subtitle}</p>
          </div>
        </div>

        <LeaderboardFilters
          courses={courseOptions}
          tab={tab}
          course={course}
          period={period}
          scope={scope}
        />

        {friendsOnly && rows.length > 0 && (
          <p className="muted lb-scope-hint" data-testid="lb-scope-hint">
            Nur deine Freunde
          </p>
        )}

        <div className="card stack" data-testid={`leaderboard-list-${tab}`}>
          {errorMessage ? (
            <p className="muted" data-testid="leaderboard-error">
              Rangliste konnte nicht geladen werden: {errorMessage}
            </p>
          ) : rows.length === 0 ? (
            friendsOnly ? (
              <p className="muted lb-scope-hint" data-testid="lb-scope-empty">
                Du hast noch keine Freunde hinzugefuegt. Suche nach Usern unter{' '}
                <a href="/friends">Freunde</a>.
              </p>
            ) : (
              <p className="muted" data-testid="leaderboard-empty">
                Noch keine Eintraege fuer diese Ansicht.
              </p>
            )
          ) : (
            <>
              {rows.map((item, index) => (
                <LbRow
                  key={item.user_id}
                  item={item}
                  rank={index + 1}
                  isMe={item.user_id === user.id}
                  tab={tab}
                />
              ))}
              {selfRow && (
                <>
                  <div className="lb-self-gap" aria-hidden="true">
                    <span className="muted">…</span>
                  </div>
                  <LbRow item={selfRow} rank={selfRow.rank} isMe tab={tab} selfBottom />
                </>
              )}
              {friendsOnly && selfRank != null && (
                <p className="muted lb-scope-hint" data-testid="lb-self-rank">
                  {`Rang #${selfRank} von ${selfTotal ?? rows.length} ${(selfTotal ?? rows.length) === 1 ? 'Freund' : 'Freunden'}`}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}
