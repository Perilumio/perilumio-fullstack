import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { getDashboardData } from '@/lib/data';
export default async function DashboardPage(){
  const { profile, lessons, progress } = await getDashboardData();
  const completed = progress.filter((item: any) => item.passed).length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const greetingName = profile?.username ?? profile?.display_name ?? 'Lehrling';
  return (
    <AppShell showHomeButton={false}>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">● Live MVP</span>
            <h1>Willkommen zurück, {greetingName}.</h1>
            <p className="muted">Lumio begleitet deinen Lernfortschritt im schwarz-neonblauen App-Look.</p>
          </div>
          <Avatar avatarKey={profile?.avatar_key} size="lg" testId="dashboard-avatar" />
        </div>
        <div className="grid grid-4">
          <div className="card"><div className="muted">XP</div><div className="kpi">{profile?.xp ?? 0}</div></div>
          <div className="card"><div className="muted">Level</div><div className="kpi">{profile?.level ?? 1}</div></div>
          <div className="card"><div className="muted">Lernfortschritt</div><div className="kpi">{percent}%</div></div>
          <div className="card"><div className="muted">Lektionen</div><div className="kpi">{completed}/{lessons.length}</div></div>
        </div>
        <nav className="menu-grid" aria-label="Hauptmenü">
          <Link href="/courses" className="menu-tile"><span className="menu-tile-title">Kurse</span><span className="menu-tile-sub muted">Lerninhalte erkunden</span></Link>
          <Link href="/learn" className="menu-tile"><span className="menu-tile-title">Lernpfad</span><span className="menu-tile-sub muted">Schritt für Schritt lernen</span></Link>
          <Link href="/battle" className="menu-tile"><span className="menu-tile-title">Quizbattle</span><span className="menu-tile-sub muted">Im Duell antreten</span></Link>
          <Link href="/leaderboard" className="menu-tile"><span className="menu-tile-title">Rangliste</span><span className="menu-tile-sub muted">Bestenliste ansehen</span></Link>
          <Link href="/friends" className="menu-tile"><span className="menu-tile-title">Freunde</span><span className="menu-tile-sub muted">Kontakte verwalten</span></Link>
          <Link href="/profile" className="menu-tile"><span className="menu-tile-title">Profil</span><span className="menu-tile-sub muted">Fortschritt & Konto</span></Link>
          <Link href="/admin" className="menu-tile"><span className="menu-tile-title">Admin</span><span className="menu-tile-sub muted">Verwaltung</span></Link>
        </nav>
      </section>
    </AppShell>
  );
}
