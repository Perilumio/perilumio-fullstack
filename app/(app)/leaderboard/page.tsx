import { AppShell, Lumio } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/server';

type LeaderboardRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_key: string | null;
  xp: number | null;
  battle_points: number | null;
};

export const dynamic = 'force-dynamic';

function formatScore(n: number) { return new Intl.NumberFormat('de-CH').format(n); }

function nameOf(row: LeaderboardRow) {
  return row.username || row.display_name || 'Lehrling';
}

export default async function LeaderboardPage() {
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

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_key, xp, battle_points')
    .order('xp', { ascending: false })
    .limit(50);

  if (error) {
    return (
      <AppShell>
        <section className="card stack" data-testid="leaderboard-error">
          <h1>Rangliste</h1>
          <p className="muted">Rangliste konnte nicht geladen werden: {error.message}</p>
        </section>
      </AppShell>
    );
  }

  const rows = (data ?? []) as LeaderboardRow[];
  const xpRanking = [...rows].sort(
    (a, b) => (b.xp ?? 0) - (a.xp ?? 0) || nameOf(a).localeCompare(nameOf(b)),
  );
  const battleRanking = [...rows].sort(
    (a, b) => (b.battle_points ?? 0) - (a.battle_points ?? 0) || nameOf(a).localeCompare(nameOf(b)),
  );
  const empty = rows.length === 0;

  return (
    <AppShell>
      <section className="grid grid-2">
        <div className="card stack" data-testid="leaderboard-xp">
          <div className="hero">
            <div>
              <span className="pill">Rangliste XP’s</span>
              <h1>Top Lernende</h1>
              <p className="muted">Live-Ranking auf Basis registrierter Nutzer.</p>
            </div>
            <Lumio />
          </div>
          {empty ? (
            <p className="muted" data-testid="leaderboard-empty">Noch keine Lernenden registriert.</p>
          ) : (
            xpRanking.map((item, index) => {
              const isMe = item.id === user.id;
              return (
                <div
                  className="card lb-row"
                  key={item.id}
                  data-testid={isMe ? 'leaderboard-xp-row-me' : 'leaderboard-xp-row'}
                >
                  <span className="lb-rank">#{index + 1}</span>
                  <Avatar
                    avatarKey={item.avatar_key}
                    size="sm"
                    testId="leaderboard-row-avatar"
                  />
                  <div className="lb-meta">
                    <strong data-testid="leaderboard-row-username">
                      {nameOf(item)}
                      {isMe && ' (du)'}
                    </strong>
                    <span className="muted">XP {formatScore(item.xp ?? 0)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="card stack" data-testid="leaderboard-battle">
          <div className="hero">
            <div>
              <span className="pill">Battleking</span>
              <h1>Battlepunkte</h1>
              <p className="muted">Battlepunkte aus tatsächlich gespielten Quizbattles.</p>
            </div>
            <Lumio />
          </div>
          {empty ? (
            <p className="muted">Noch keine Battlepunkte vergeben.</p>
          ) : (
            battleRanking.map((item, index) => {
              const isMe = item.id === user.id;
              return (
                <div
                  className="card lb-row"
                  key={item.id}
                  data-testid={isMe ? 'leaderboard-battle-row-me' : 'leaderboard-battle-row'}
                >
                  <span className="lb-rank">#{index + 1}</span>
                  <Avatar
                    avatarKey={item.avatar_key}
                    size="sm"
                    testId="leaderboard-row-avatar"
                  />
                  <div className="lb-meta">
                    <strong data-testid="leaderboard-row-username">
                      {nameOf(item)}
                      {isMe && ' (du)'}
                    </strong>
                    <span className="muted">BP {formatScore(item.battle_points ?? 0)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </AppShell>
  );
}
