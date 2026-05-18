import { AppShell, Lumio } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import FriendsClient from '@/components/FriendsClient';

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_key: string | null;
  xp: number | null;
  battle_points: number | null;
};

export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AppShell>
        <section className="card stack" data-testid="friends-auth-required">
          <h1>Freunde</h1>
          <p className="muted">Bitte einloggen, um deine Freunde zu sehen.</p>
        </section>
      </AppShell>
    );
  }

  const { data: edges, error: edgesError } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', user.id);

  if (edgesError) {
    return (
      <AppShell>
        <section className="card stack" data-testid="friends-error">
          <h1>Freunde</h1>
          <p className="muted">Freunde konnten nicht geladen werden: {edgesError.message}</p>
        </section>
      </AppShell>
    );
  }

  const friendIds = (edges ?? []).map((e) => e.friend_id as string);
  let friends: ProfileRow[] = [];
  if (friendIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_key, xp, battle_points')
      .in('id', friendIds);
    if (profilesError) {
      return (
        <AppShell>
          <section className="card stack" data-testid="friends-error">
            <h1>Freunde</h1>
            <p className="muted">Freunde konnten nicht geladen werden: {profilesError.message}</p>
          </section>
        </AppShell>
      );
    }
    friends = (profiles ?? []) as ProfileRow[];
    friends.sort(
      (a, b) =>
        (b.xp ?? 0) - (a.xp ?? 0) ||
        (b.battle_points ?? 0) - (a.battle_points ?? 0) ||
        (a.username || a.display_name || '').localeCompare(b.username || b.display_name || ''),
    );
  }

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">Freunde</span>
            <h1>Dein Lernumfeld</h1>
            <p className="muted">Suche Nutzer, füge sie als Freund hinzu und vergleiche XP und Battlepunkte.</p>
          </div>
          <Lumio />
        </div>
        <FriendsClient friends={friends} />
      </section>
    </AppShell>
  );
}
