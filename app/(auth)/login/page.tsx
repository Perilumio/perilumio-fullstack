import Link from 'next/link';
export default function LoginPage(){
  return <main className="auth-shell"><section className="card stack" style={{maxWidth:480, margin:'10vh auto'}}><span className="pill">Login</span><h1>Perilumio Zugang</h1><p className="muted">Skeleton für E-Mail-/Magic-Link-Login via Supabase Auth.</p><div className="stack"><input type="email" placeholder="E-Mail" /><button className="btn btn-primary">Magic Link senden</button></div><p className="muted">Nach dem Login entscheidet die Rolle im Profil über den Admin-Zugriff.</p><Link href="/">Zur Startseite</Link></section></main>;
}
