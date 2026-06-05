import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">Admin</span>
            <h1>Adminbereich</h1>
            <p className="muted">Zugriff nur mit Admin-Rolle.</p>
          </div>
        </div>
        <div className="grid grid-2">
          <Link href="/admin/accounts" className="card stack" data-testid="admin-card-accounts">
            <span className="pill">Benutzer</span>
            <h2 style={{ margin: 0 }}>Benutzerverwaltung</h2>
            <p className="muted" style={{ margin: 0 }}>
              Konten durchsuchen, Rollen anpassen und Konten loeschen.
            </p>
          </Link>
          <Link href="/admin/analytics" className="card stack" data-testid="admin-card-analytics">
            <span className="pill">Statistiken</span>
            <h2 style={{ margin: 0 }}>Statistiken</h2>
            <p className="muted" style={{ margin: 0 }}>
              Kennzahlen pro Kurs sowie Export der Auswertung als CSV.
            </p>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
