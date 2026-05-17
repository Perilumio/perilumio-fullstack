'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import PasswordField from '@/components/PasswordField';

type Status = 'checking' | 'ready' | 'busy' | 'success' | 'error' | 'no-session';

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_HINT = `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;

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

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus('error');
      setError(`Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
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

  const busy = status === 'busy';
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm;

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
              <div className="stack" style={{ gap: 6 }}>
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  placeholder="Neues Passwort"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  disabled={busy}
                  ariaDescribedBy="password-hint"
                />
                <p id="password-hint" className="password-hint">
                  {PASSWORD_HINT}
                </p>
                {passwordTooShort && (
                  <p className="field-error">
                    Passwort ist zu kurz (mindestens {MIN_PASSWORD_LENGTH} Zeichen).
                  </p>
                )}
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <PasswordField
                  value={passwordConfirm}
                  onChange={setPasswordConfirm}
                  placeholder="Passwort bestätigen"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  disabled={busy}
                  ariaLabel="Passwort bestätigen"
                />
                {passwordsMismatch && (
                  <p className="field-error">Passwörter stimmen nicht überein.</p>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !password || !passwordConfirm}
              >
                {busy ? 'Speichere…' : 'Passwort speichern'}
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
