import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';

export default async function Home(){
  const { user, confirmed } = await getCurrentProfile();
  if(user && !confirmed){
    const emailParam = user.email ? `?email=${encodeURIComponent(user.email)}` : '';
    redirect(`/auth/confirm${emailParam}`);
  }
  if(user) redirect('/dashboard');
  return <main className="auth-shell"><section className="card stack" style={{maxWidth:640, margin:'10vh auto'}}><div className="hero"><div><span className="pill">● Perilumio</span><h1>Lernplattform für Lehrlinge im Strassenbau</h1><p className="muted">Lumio begleitet dich durch Kurse, Lernpfade und Quizbattles im schwarz-neonblauen App-Look.</p></div></div><div className="stack"><Link href="/login" className="btn btn-primary">Zum Login</Link></div></section></main>;
}
