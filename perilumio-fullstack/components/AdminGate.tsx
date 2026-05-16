import Link from 'next/link';
export function AdminGate(){
  return <div className="card stack"><span className="pill">Zugriff geschützt</span><h2>Admin-Anmeldung erforderlich</h2><p className="muted">Dieser Bereich ist nur für Benutzer mit Admin-Rolle verfügbar.</p><Link className="btn btn-primary" href="/login">Zum Login</Link></div>;
}
