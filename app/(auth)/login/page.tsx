'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import PasswordField from '@/components/PasswordField';

type Mode = 'login' | 'register' | 'forgot';
type Status = 'idle' | 'busy' | 'sent' | 'awaiting_confirmation' | 'error';

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_HINT = `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
const RESEND_COOLDOWN_SECONDS = 60;

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
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const submittingRef = useRef(false);

  useEffect(() => {
    const qErr = searchParams.get('error');
    if (qErr) {
      setStatus('error');
      setError(qErr);
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatus('idle');
    setPassword('');
    setPasswordConfirm('');
    setPendingEmail('');
    resetFeedback();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    resetFeedback();
    setStatus('busy');
    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          const lower = (error.message || '').toLowerCase();
          if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
            setPendingEmail(email.trim());
            setStatus('awaiting_confirmation');
            setMessage(
              'Dein Konto ist noch nicht aktiviert. Bitte den Aktivierungslink in der E-Mail öffnen oder hier erneut senden.'
            );
            return;
          }
          setStatus('error');
          setError(translateError(error.message));
          return;
        }
        const u = data.user as any;
        const confirmed = !!(u?.email_confirmed_at || u?.confirmed_at);
        if (!confirmed) {
          setPendingEmail(email.trim());
          setStatus('awaiting_confirmation');
          setMessage(
            'Dein Konto ist noch nicht aktiviert. Bitte den Aktivierungslink in der E-Mail öffnen oder hier erneut senden.'
          );
          return;
        }
        setStatus('idle');
        router.push('/dashboard');
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
          body: JSON.stringify({ email: email.trim(), password, origin }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          code?: string;
          email?: string;
        };
        if (res.status === 429 || payload.code === 'rate_limited') {
          setStatus('error');
          setError(
            payload.message ??
              'Aktuell wurde zu oft eine E-Mail angefordert. Bitte 1-2 Minuten warten.'
          );
          return;
        }
        if (!res.ok || !payload.ok) {
          setStatus('error');
          setError(payload.message ?? 'Registrierung fehlgeschlagen.');
          return;
        }
        setPendingEmail(payload.email ?? email.trim());
        setStatus('awaiting_confirmation');
        setMessage(
          payload.message ??
            'Aktivierungslink wurde an die angegebene E-Mail gesendet. Bitte Postfach und Spam-Ordner prüfen.'
        );
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
    } finally {
      submittingRef.current = false;
    }
  }

  async function onOAuth(provider: 'google' | 'apple') {
    if (busy) return;
    resetFeedback();
    setStatus('busy');
    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback?next=/learn` },
    });
    if (error) {
      setStatus('error');
      setError(translateError(error.message));
    }
  }

  async function onResend() {
    if (resendCooldown > 0 || status === 'busy') return;
    const target = (pendingEmail || email).trim();
    if (!target) return;
    setError(null);
    setMessage(null);
    setStatus('busy');
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target, origin }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        code?: string;
      };
      if (res.status === 429 || payload.code === 'rate_limited') {
        setStatus('error');
        setError(payload.message ?? 'Bitte einen Moment warten und dann erneut versuchen.');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        return;
      }
      if (!res.ok || !payload.ok) {
        setStatus('error');
        setError(payload.message ?? 'Senden fehlgeschlagen.');
        return;
      }
      setStatus('awaiting_confirmation');
      setMessage(payload.message ?? 'Aktivierungslink wurde erneut gesendet.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Unbekannter Fehler');
    }
  }

  const busy = status === 'busy';
  const sent = status === 'sent';
  const awaiting = status === 'awaiting_confirmation';

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
          {awaiting
            ? 'E-Mail bestätigen'
            : mode === 'login'
              ? 'Login'
              : mode === 'register'
                ? 'Registrierung'
                : 'Passwort zurücksetzen'}
        </span>
        <h1>{awaiting ? 'Bitte E-Mail bestätigen' : 'Perilumio Zugang'}</h1>
        {!awaiting && (
          <p className="muted">
            {mode === 'login' && 'Mit E-Mail und Passwort anmelden.'}
            {mode === 'register' && 'Neues Konto erstellen und Passwort festlegen.'}
            {mode === 'forgot' && 'Wir senden dir einen Link zum Zurücksetzen des Passworts.'}
          </p>
        )}

        {awaiting ? (
          <div className="stack">
            <p className="muted">
              Wir haben dir einen Aktivierungslink an{' '}
              <strong>{pendingEmail || 'deine E-Mail-Adresse'}</strong> gesendet. Bitte klicke den
              Link in der E-Mail, um dein Konto zu aktivieren. Solange dein Konto nicht bestätigt
              ist, kannst du Lernpfad, Battle und Profil noch nicht nutzen.
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              Hinweis: Bitte auch den Spam-Ordner prüfen. Manche Provider brauchen 1-2 Minuten.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onResend}
              disabled={busy || resendCooldown > 0 || !pendingEmail}
            >
              {busy
                ? 'Sende…'
                : resendCooldown > 0
                  ? `Erneut senden in ${resendCooldown}s`
                  : 'Aktivierungslink erneut senden'}
            </button>
            <button type="button" className="btn" onClick={() => switchMode('login')}>
              Zurück zur Anmeldung
            </button>
            {message && <p className="muted">{message}</p>}
            {error && <p style={{ color: 'crimson' }}>Fehler: {error}</p>}
          </div>
        ) : (
          <>
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
            {status === 'error' && error && (
              <p style={{ color: 'crimson' }}>Fehler: {error}</p>
            )}

            {mode === 'login' && (
              <div className="stack" style={{ gap: 8 }}>
                <p className="muted" style={{ textAlign: 'center' }}>oder</p>
                <button
                  type="button"
                  className="btn"
                  data-testid="oauth-google"
                  onClick={() => onOAuth('google')}
                  disabled={busy}
                >
                  Mit Google fortfahren
                </button>
                <button
                  type="button"
                  className="btn"
                  data-testid="oauth-apple"
                  onClick={() => onOAuth('apple')}
                  disabled={busy}
                >
                  Mit Apple fortfahren
                </button>
              </div>
            )}

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
          </>
        )}

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
