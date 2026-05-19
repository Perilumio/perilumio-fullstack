'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import PasswordField from '@/components/PasswordField';

type Mode = 'login' | 'register' | 'forgot';
type Status = 'idle' | 'busy' | 'sent' | 'error';

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_HINT = `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;

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
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          code?: string;
        };
        if (!res.ok || !payload.ok) {
          setStatus('error');
          setError(payload.message ?? 'Registrierung fehlgeschlagen.');
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setStatus('sent');
          setMessage(
            'Konto erstellt. Bitte jetzt mit E-Mail und Passwort einloggen.'
          );
          return;
        }
        setStatus('idle');
        router.push('/profile');
        router.refresh();
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
          'Wenn ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet. Bitte Postfach (auch Spam) prüfen. Falls keine Mail ankommt, bitte 1-2 Minuten warten, bevor du es erneut versuchst.'
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

  const passwordTooShort =
    mode === 'register' && password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch =
    mode === 'register' &&
    passwordConfirm.length > 0 &&
    password !== passwordConfirm;

  return (
    <main className="auth-shell">
      <section className="card stack" style={{ maxWidth: 480, margin: '10vh auto' }}>
        <div className="brand-logo-login" data-testid="brand-logo-login">
          <Image
            src="/brand/perilumio-wordmark.jpg"
            alt="Perilumio"
            width={1305}
            height={262}
            priority
            sizes="(max-width: 480px) 240px, 320px"
          />
        </div>
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
            <div className="stack" style={{ gap: 6 }}>
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="Passwort"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? MIN_PASSWORD_LENGTH : undefined}
                disabled={busy || sent}
                ariaDescribedBy={mode === 'register' ? 'password-hint' : undefined}
              />
              {mode === 'register' && (
                <p id="password-hint" className="password-hint">
                  {PASSWORD_HINT}
                </p>
              )}
              {passwordTooShort && (
                <p className="field-error">
                  Passwort ist zu kurz (mindestens {MIN_PASSWORD_LENGTH} Zeichen).
                </p>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div className="stack" style={{ gap: 6 }}>
              <PasswordField
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                placeholder="Passwort bestätigen"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                disabled={busy || sent}
                ariaLabel="Passwort bestätigen"
              />
              {passwordsMismatch && (
                <p className="field-error">Passwörter stimmen nicht überein.</p>
              )}
            </div>
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
  if (lower.includes('user already registered'))
    return 'Für diese E-Mail existiert bereits ein Konto. Bitte einloggen oder Passwort zurücksetzen.';
  if (lower.includes('password should be at least'))
    return `Passwort ist zu kurz (mindestens ${MIN_PASSWORD_LENGTH} Zeichen).`;
  if (
    lower.includes('rate limit') ||
    lower.includes('too many') ||
    lower.includes('email rate limit')
  )
    return 'Aktuell wurde zu oft eine E-Mail angefordert. Bitte 1-2 Minuten warten und dann erneut versuchen.';
  return msg;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
