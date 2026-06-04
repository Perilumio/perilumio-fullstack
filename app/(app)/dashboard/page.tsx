import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { StreakBadge } from '@/components/StreakBadge';
import { getDashboardData } from '@/lib/data';
import { courseLabel } from '@/lib/courses';

// Streak-Anzeige analog zu /learn: ist der letzte Streak-Tag aelter als
// gestern, gilt die Serie als gebrochen und wir zeigen 0 an, ohne in der DB
// zu schreiben (der naechste Treffer setzt den Wert via RPC neu).
function displayStreak(profile: any): number {
  const raw = Number(profile?.current_streak) || 0;
  if (raw <= 0) return 0;
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Zurich' }));
  today.setHours(0, 0, 0, 0);
  const last = profile?.last_streak_date
    ? new Date(`${profile.last_streak_date}T00:00:00`)
    : null;
  const diffDays = last ? Math.round((today.getTime() - last.getTime()) / 86400000) : null;
  return diffDays === null || diffDays > 1 ? 0 : raw;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TileDef = {
  href: string;
  title: string;
  sub: string;
  testId: string;
  icon: 'courses' | 'path' | 'battle' | 'leaderboard' | 'profile' | 'friends';
};

const TILES: ReadonlyArray<TileDef> = [
  { href: '/learn',       title: 'Lernpfad',    sub: 'Schritt für Schritt',   testId: 'menu-tile-learn',       icon: 'path' },
  { href: '/battle',      title: 'Quizbattle',  sub: 'Im Duell antreten',     testId: 'menu-tile-battle',      icon: 'battle' },
  { href: '/courses',     title: 'Kurse',       sub: 'Aktiven Kurs wählen',   testId: 'menu-tile-courses',     icon: 'courses' },
  { href: '/profile',     title: 'Profil',      sub: 'Fortschritt & Konto',   testId: 'menu-tile-profile',     icon: 'profile' },
  { href: '/leaderboard', title: 'Rangliste',   sub: 'Bestenliste ansehen',   testId: 'menu-tile-leaderboard', icon: 'leaderboard' },
  { href: '/friends',     title: 'Freunde',     sub: 'Lernumfeld & Vergleich', testId: 'menu-tile-friends',    icon: 'friends' },
];

function TileIcon({ kind }: { kind: TileDef['icon'] }) {
  const common = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (kind) {
    case 'courses':
      return <svg {...common}><path d="M4 5h11a3 3 0 0 1 3 3v11"/><path d="M4 5v13a2 2 0 0 0 2 2h12"/><path d="M8 9h6"/></svg>;
    case 'path':
      return <svg {...common}><path d="M5 19c4 0 4-6 7-6s3 6 7 6"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/><path d="M12 4v6"/><path d="m9 7 3-3 3 3"/></svg>;
    case 'battle':
      return <svg {...common}><path d="m14.5 6.5 3 3"/><path d="M4 20l4-1 9-9-3-3-9 9-1 4z"/><path d="m15 4 5 5"/></svg>;
    case 'leaderboard':
      return <svg {...common}><path d="M6 21V11"/><path d="M12 21V5"/><path d="M18 21v-7"/><path d="M3 21h18"/></svg>;
    case 'profile':
      return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case 'friends':
      return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3 3 0 0 1 0 6"/><path d="M17.5 14.5A5.5 5.5 0 0 1 22 20"/></svg>;
  }
}

export default async function DashboardPage() {
  const { profile, lessons, progress, activeCourseKey } = await getDashboardData();
  const completed = progress.filter((item: any) => item.passed).length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const greetingName = profile?.username ?? profile?.display_name ?? 'Lehrling';
  const activeCourse = activeCourseKey;
  const streakCurrent = displayStreak(profile);
  const streakLongest = Number((profile as any)?.longest_streak) || 0;

  return (
    <AppShell showHomeButton={false}>
      <section className="stack dash-stack" data-testid="dashboard">
        <div className="card hero">
          <div>
            <span className="pill"><span className="pill-dot" aria-hidden="true" />Live</span>
            <h1>
              <span className="hide-mobile">Willkommen zurück, {greetingName}.</span>
              <span className="show-mobile">Hallo {greetingName}</span>
            </h1>
            <p className="muted">
              <span className="hide-mobile">Aktiver Kurs: </span>
              <strong data-testid="dashboard-active-course">{courseLabel(activeCourse)}</strong>
            </p>
            <div className="learn-hero-meta" data-testid="dashboard-hero-meta">
              <StreakBadge current={streakCurrent} longest={streakLongest} />
            </div>
          </div>
          <Avatar avatarKey={profile?.avatar_key} size="lg" testId="dashboard-avatar" fallbackLabel={greetingName} />
        </div>
        <div className="grid stats-grid" data-testid="dashboard-stats">
          <div className="card stat-card"><div className="muted">XP</div><div className="kpi" data-testid="dashboard-xp">{profile?.xp ?? 0}</div></div>
          <div className="card stat-card"><div className="muted">BP</div><div className="kpi" data-testid="dashboard-bp">{profile?.battle_points ?? 0}</div></div>
          <div className="card stat-card"><div className="muted"><span className="hide-mobile">Lernfortschritt</span><span className="show-mobile">Fortschritt</span></div><div className="kpi" data-testid="dashboard-percent">{percent}%</div></div>
          <div className="card stat-card"><div className="muted">Lektionen</div><div className="kpi" data-testid="dashboard-lessons">{completed}/{lessons.length}</div></div>
        </div>
        <nav className="home-menu" aria-label="Hauptmenü" data-testid="home-menu">
          {TILES.map((t) => (
            <Link key={t.href} href={t.href} className="home-tile" data-testid={t.testId}>
              <span className="home-tile-icon"><TileIcon kind={t.icon} /></span>
              <span className="home-tile-title">{t.title}</span>
              <span className="home-tile-sub muted">{t.sub}</span>
            </Link>
          ))}
        </nav>
        {profile?.role === 'admin' && (
          <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 8 }} data-testid="dashboard-admin-link">
            <Link href="/admin">Admin</Link>
            {' · '}
            <Link href="/admin/analytics">Analytics</Link>
          </p>
        )}
      </section>
    </AppShell>
  );
}
