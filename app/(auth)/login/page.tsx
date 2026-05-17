'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Mode = 'login' | 'register' | 'forgot';
type Status = 'idle' | 'busy' | 'sent' | 'error';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qErr = searchParams.get('error');
    if (qErr) {
      setStatus('error');
      setError(qErr);
    }
  }, [searchParams]);

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatus('idle');
    setPassword('');
    setPasswordConfirm('');
    resetFeedback();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setStatus('busy');
    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setStatus('error');
          setError(translateError(error.message));
          return;
        }
        setStatus('idle');
        router.push('/profile');
        router.refresh();
        return;
      }

      if (mode === 'register') {
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${origin}/auth/callback` },
        });
        if (error) {
          setStatus('error');
          setError(translateError(error.message));
          return;
        }
        if (data.session) {
          setStatus('idle');
          router.push('/profile');
          router.refresh();
          return;
        }
        setStatus('sent');
        setMessage(
          'Konto erstellt. Bitte E-Mail-Postfach (auch Spam) prüfen und den Bestätigungslink öffnen.'
        );
        return;
      }

      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
        });
        if (error) {
          setStatus('error');
          setError(translateError(error.message));
          return;
        }
        setStatus('sent');
        setMessage(
          'Wenn ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet. Bitte Postfach (auch Spam) prüfen.'
        );
        return;
      }
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Unbekannter Fehler');
    }
  }

  const busy = status === 'busy';
  const sent = status === 'sent';

  return (
    <main className="auth-shell">
      <section className="card stack" style={{ maxWidth: 480, margin: '10vh auto' }}>
        <span className="pill">
          {mode === 'login' ? 'Login' : mode === 'register' ? 'Registrierung' : 'Passwort zurücksetzen'}
        </span>
        <h1>Perilumio Zugang</h1>
        <p className="muted">
          {mode === 'login' && 'Mit E-Mail und Passwort anmelden.'}
          {mode === 'register' && 'Neues Konto erstellen und Passwort festlegen.'}
          {mode === 'forgot' && 'Wir senden dir einen Link zum Zurücksetzen des Passworts.'}
        </p>

        <form className="stack" onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="E-Mail"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy || sent}
          />

          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="Passwort"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy || sent}
            />
          )}

          {mode === 'register' && (
            <input
              type="password"
              placeholder="Passwort bestätigen"
              required
              autoComplete="new-password"
              minLength={8}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              disabled={busy || sent}
            />
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || sent || !email || (mode !== 'forgot' && !password)}
          >
            {busy
              ? mode === 'login'
                ? 'Anmeldung…'
                : mode === 'register'
                  ? 'Registrierung…'
                  : 'Sende…'
              : mode === 'login'
                ? 'Anmelden'
                : mode === 'register'
                  ? 'Konto erstellen'
                  : 'Link senden'}
          </button>
        </form>

        {sent && message && <p className="muted">{message}</p>}
        {status === 'error' && error && <p style={{ color: 'crimson' }}>Fehler: {error}</p>}

        <div className="stack" style={{ gap: 8 }}>
          {mode === 'login' && (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => switchMode('register')}
                disabled={busy}
              >
                Neues Konto erstellen
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => switchMode('forgot')}
                disabled={busy}
                style={{ background: 'transparent', borderColor: 'transparent' }}
              >
                Passwort vergessen?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button
              type="button"
              className="btn"
              onClick={() => switchMode('login')}
              disabled={busy}
            >
              Zurück zur Anmeldung
            </button>
          )}
        </div>

        <p className="muted">Nach dem Login entscheidet die Rolle im Profil über den Admin-Zugriff.</p>
        <Link href="/">Zur Startseite</Link>
      </section>
    </main>
  );
}

function translateError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (lower.includes('email not confirmed')) return 'E-Mail-Adresse wurde noch nicht bestätigt.';
  if (lower.includes('user already registered')) return 'Konto mit dieser E-Mail existiert bereits.';
  if (lower.includes('password should be at least'))
    return 'Passwort ist zu kurz (mindestens 8 Zeichen).';
  if (lower.includes('rate limit')) return 'Zu viele Versuche. Bitte später erneut probieren.';
  return msg;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
