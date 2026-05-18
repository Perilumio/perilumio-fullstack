import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { ProfileEditor } from '@/components/ProfileEditor';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AVATAR_KEY, avatarLabel } from '@/lib/avatars';

export const dynamic = 'force-dynamic';

function deriveUsername(user: { id: string; email?: string | null; user_metadata?: any }) {
  const fromMeta = (user.user_metadata?.username ?? user.user_metadata?.display_name ?? '') as string;
  const fromEmail = user.email?.split('@')[0] ?? '';
  const raw = (fromMeta || fromEmail || '').trim();
  const cleaned = raw.replace(/[^A-Za-z0-9_\-\.]/g, '');
  if (cleaned.length >= 2 && cleaned.length <= 24) return cleaned;
  return 'lumio_' + user.id.replace(/-/g, '').slice(0, 8);
}

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

  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('passed')
    .eq('user_id', user.id);
  const passedCount = (progress ?? []).filter((p: any) => p.passed).length;

  const username = profile?.username ?? deriveUsername(user);
  const avatarKey = profile?.avatar_key ?? DEFAULT_AVATAR_KEY;

  return (
    <AppShell>
      <section className="grid grid-2">
        <div className="card stack">
          <div className="hero">
            <div>
              <h1>Profil</h1>
              <p className="muted">Wähle deinen Avatar und Benutzernamen.</p>
            </div>
            <Avatar avatarKey={avatarKey} size="lg" testId="profile-current-avatar" />
          </div>
          <ProfileEditor initialUsername={username} initialAvatarKey={avatarKey} />
        </div>
        <div className="card stack">
          <h2>Konto</h2>
          <div>
            <strong>Anzeigename:</strong>{' '}
            <span data-testid="profile-display-username">{username}</span>
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
            <strong>XP:</strong> {profile?.xp ?? 0}
          </div>
          <div>
            <strong>Level:</strong> {profile?.level ?? 1}
          </div>
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
