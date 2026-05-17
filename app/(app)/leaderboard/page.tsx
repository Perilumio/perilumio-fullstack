import { AppShell, Lumio } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

type LeaderboardRow = { id: string; display_name: string | null; xp: number | null; battle_points: number | null };

export const dynamic = 'force-dynamic';

function formatScore(n: number){ return new Intl.NumberFormat('de-CH').format(n); }

export default async function LeaderboardPage(){
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if(!user){
    return <AppShell><section className="card stack" data-testid="leaderboard-auth-required"><h1>Rangliste</h1><p className="muted">Bitte einloggen, um die Rangliste zu sehen.</p></section></AppShell>;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, xp, battle_points')
    .order('xp', { ascending: false })
    .limit(50);

  if(error){
    return <AppShell><section className="card stack" data-testid="leaderboard-error"><h1>Rangliste</h1><p className="muted">Rangliste konnte nicht geladen werden: {error.message}</p></section></AppShell>;
  }

  const rows = (data ?? []) as LeaderboardRow[];
  const xpRanking = [...rows].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0) || (a.display_name ?? '').localeCompare(b.display_name ?? ''));
  const battleRanking = [...rows].sort((a, b) => (b.battle_points ?? 0) - (a.battle_points ?? 0) || (a.display_name ?? '').localeCompare(b.display_name ?? ''));

  const empty = rows.length === 0;

  return <AppShell><section className="grid grid-2">
    <div className="card stack" data-testid="leaderboard-xp">
      <div className="hero"><div><span className="pill">Rangliste XP’s</span><h1>Top Lernende</h1><p className="muted">Live-Ranking auf Basis registrierter Nutzer.</p></div><Lumio /></div>
      {empty
        ? <p className="muted" data-testid="leaderboard-empty">Noch keine Lernenden registriert.</p>
        : xpRanking.map((item, index) => {
            const isMe = item.id === user.id;
            return <div className="card" key={item.id} data-testid={isMe ? 'leaderboard-xp-row-me' : 'leaderboard-xp-row'}>
              <strong>#{index + 1} {item.display_name || 'Lehrling'}{isMe && ' (du)'}</strong>
              <div className="muted">XP {formatScore(item.xp ?? 0)}</div>
            </div>;
          })
      }
    </div>
    <div className="card stack" data-testid="leaderboard-battle">
      <div className="hero"><div><span className="pill">Battleking</span><h1>Battlepunkte</h1><p className="muted">Battlepunkte aus tatsächlich gespielten Quizbattles.</p></div><Lumio /></div>
      {empty
        ? <p className="muted">Noch keine Battlepunkte vergeben.</p>
        : battleRanking.map((item, index) => {
            const isMe = item.id === user.id;
            return <div className="card" key={item.id} data-testid={isMe ? 'leaderboard-battle-row-me' : 'leaderboard-battle-row'}>
              <strong>#{index + 1} {item.display_name || 'Lehrling'}{isMe && ' (du)'}</strong>
              <div className="muted">BP {formatScore(item.battle_points ?? 0)}</div>
            </div>;
          })
      }
    </div>
  </section></AppShell>;
}
