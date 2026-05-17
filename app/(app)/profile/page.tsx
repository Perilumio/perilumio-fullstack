import { redirect } from 'next/navigation';
import { AppShell, Lumio } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Lehrling';
    const { data: inserted } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName }, { onConflict: 'id' })
      .select('*')
      .maybeSingle();
    profile = inserted ?? null;
  }

  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('passed')
    .eq('user_id', user.id);

  const passedCount = (progress ?? []).filter((p: any) => p.passed).length;

  return (
    <AppShell>
      <section className="grid grid-2">
        <div className="card stack">
          <div className="hero">
            <div>
              <h1>Profil</h1>
              <p className="muted">Persönlicher Fortschritt mit Lumio-Avatar.</p>
            </div>
            <div className="avatar">
              <Lumio />
            </div>
          </div>
          <div>
            <strong>Name:</strong> {profile?.display_name ?? user.email?.split('@')[0] ?? '—'}
          </div>
          <div>
            <strong>E-Mail:</strong> {user.email ?? '—'}
          </div>
          <div>
            <strong>User-ID:</strong>{' '}
            <code style={{ fontSize: '0.85em' }}>{user.id}</code>
          </div>
          <div>
            <strong>Rolle:</strong> {profile?.role ?? 'student'}
          </div>
          <div>
            <strong>XP:</strong> {profile?.xp ?? 0}
          </div>
          <div>
            <strong>Level:</strong> {profile?.level ?? 1}
          </div>
        </div>
        <div className="card stack">
          <h2>Fortschritt</h2>
          <div>
            <strong>Bestandene Lektionen:</strong> {passedCount}
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
    </AppShell>
  );
}
