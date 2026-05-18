import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { getDashboardData } from '@/lib/data';
import { getActiveCourseKey, courseLabel } from '@/lib/courses';

type TileDef = {
  href: string;
  title: string;
  sub: string;
  testId: string;
  icon: 'courses' | 'path' | 'battle' | 'leaderboard' | 'profile';
};

const TILES: ReadonlyArray<TileDef> = [
  { href: '/courses',     title: 'Kurse',       sub: 'Aktiven Kurs wählen',   testId: 'menu-tile-courses',     icon: 'courses' },
  { href: '/learn',       title: 'Lernpfad',    sub: 'Schritt für Schritt',   testId: 'menu-tile-learn',       icon: 'path' },
  { href: '/battle',      title: 'Quizbattle',  sub: 'Im Duell antreten',     testId: 'menu-tile-battle',      icon: 'battle' },
  { href: '/leaderboard', title: 'Rangliste',   sub: 'Bestenliste ansehen',   testId: 'menu-tile-leaderboard', icon: 'leaderboard' },
  { href: '/profile',     title: 'Profil',      sub: 'Fortschritt & Konto',   testId: 'menu-tile-profile',     icon: 'profile' },
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
  }
}

export default async function DashboardPage() {
  const { profile, lessons, progress } = await getDashboardData();
  const completed = progress.filter((item: any) => item.passed).length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const greetingName = profile?.username ?? profile?.display_name ?? 'Lehrling';
  const activeCourse = await getActiveCourseKey();

  return (
    <AppShell showHomeButton={false}>
      <section className="stack dash-stack" data-testid="dashboard">
        <div className="card hero">
          <div>
            <span className="pill">● Live MVP</span>
            <h1>Willkommen zurück, {greetingName}.</h1>
            <p className="muted">
              Aktiver Kurs:{' '}
              <strong data-testid="dashboard-active-course">{courseLabel(activeCourse)}</strong>
            </p>
          </div>
          <Avatar avatarKey={profile?.avatar_key} size="md" testId="dashboard-avatar" />
        </div>
        <div className="grid grid-4">
          <div className="card"><div className="muted">XP</div><div className="kpi">{profile?.xp ?? 0}</div></div>
          <div className="card"><div className="muted">Level</div><div className="kpi">{profile?.level ?? 1}</div></div>
          <div className="card"><div className="muted">Lernfortschritt</div><div className="kpi">{percent}%</div></div>
          <div className="card"><div className="muted">Lektionen</div><div className="kpi">{completed}/{lessons.length}</div></div>
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
      </section>
    </AppShell>
  );
}
