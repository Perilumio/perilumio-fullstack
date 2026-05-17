'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Status = 'checking' | 'ready' | 'busy' | 'success' | 'error' | 'no-session';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'ready' : 'no-session');
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setStatus('error');
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== passwordConfirm) {
      setStatus('error');
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setStatus('busy');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus('error');
        setError(error.message);
        return;
      }
      setStatus('success');
      setTimeout(() => {
        router.push('/profile');
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Unbekannter Fehler');
    }
  }

  return (
    <main className="auth-shell">
      <section className="card stack" style={{ maxWidth: 480, margin: '10vh auto' }}>
        <span className="pill">Neues Passwort</span>
        <h1>Passwort festlegen</h1>

        {status === 'checking' && <p className="muted">Sitzung wird geprüft…</p>}

        {status === 'no-session' && (
          <>
            <p className="muted">
              Sitzung ungültig oder abgelaufen. Bitte starte den Vorgang erneut und öffne den
              aktuellsten Link aus der E-Mail.
            </p>
            <Link href="/login" className="btn">
              Zur Anmeldung
            </Link>
          </>
        )}

        {(status === 'ready' || status === 'busy' || status === 'error') && (
          <>
            <p className="muted">Lege ein neues Passwort für dein Konto fest.</p>
            <form className="stack" onSubmit={onSubmit}>
              <input
                type="password"
                placeholder="Neues Passwort"
                required
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === 'busy'}
              />
              <input
                type="password"
                placeholder="Passwort bestätigen"
                required
                autoComplete="new-password"
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={status === 'busy'}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={status === 'busy' || !password || !passwordConfirm}
              >
                {status === 'busy' ? 'Speichere…' : 'Passwort speichern'}
              </button>
            </form>
            {status === 'error' && error && (
              <p style={{ color: 'crimson' }}>Fehler: {error}</p>
            )}
          </>
        )}

        {status === 'success' && (
          <p style={{ color: 'var(--green)' }}>
            Passwort aktualisiert. Du wirst weitergeleitet…
          </p>
        )}

        <Link href="/">Zur Startseite</Link>
      </section>
    </main>
  );
}
