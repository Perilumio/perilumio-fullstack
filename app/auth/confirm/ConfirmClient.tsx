'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const RESEND_COOLDOWN_SECONDS = 60;

type Status = 'idle' | 'busy' | 'sent' | 'error';

export default function ConfirmClient({
  initialEmail,
  hasSession,
}: {
  initialEmail: string;
  hasSession: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const lastSentRef = useRef(0);

  // Poll auth state — when the user clicks the link in another tab and a session
  // is established, redirect them into the app. Also signOut if signed in but
  // not confirmed should be avoided here; we just watch for confirmation.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user as any;
      if (!cancelled && u && (u.email_confirmed_at || u.confirmed_at)) {
        router.replace('/dashboard');
        router.refresh();
      }
    };
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user as any;
      if (u && (u.email_confirmed_at || u.confirmed_at)) {
        router.replace('/dashboard');
        router.refresh();
      }
    });
    check();
    const interval = window.setInterval(check, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      sub.data.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0 || status === 'busy') return;
    const now = Date.now();
    if (now - lastSentRef.current < RESEND_COOLDOWN_SECONDS * 1000) return;
    setError(null);
    setMessage(null);
    setStatus('busy');
    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        code?: string;
      };
      if (res.status === 429 || payload.code === 'rate_limited') {
        setStatus('error');
        setError(payload.message ?? 'Bitte einen Moment warten und dann erneut versuchen.');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        return;
      }
      if (!res.ok || !payload.ok) {
        setStatus('error');
        setError(payload.message ?? 'Senden fehlgeschlagen.');
        return;
      }
      setStatus('sent');
      setMessage(payload.message ?? 'Aktivierungslink wurde erneut gesendet.');
      lastSentRef.current = Date.now();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Unbekannter Fehler');
    }
  }

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const busy = status === 'busy';
  const buttonLabel = busy
    ? 'Sende…'
    : cooldown > 0
      ? `Erneut senden in ${cooldown}s`
      : 'Aktivierungslink erneut senden';

  return (
    <div className="stack">
      <p className="muted">
        Wir haben dir einen Aktivierungslink an{' '}
        <strong>{email || 'deine E-Mail-Adresse'}</strong> gesendet.
        Bitte klicke den Link in der E-Mail, um dein Konto zu aktivieren.
        Solange dein Konto nicht bestätigt ist, kannst du Lernpfad, Battle und Profil noch nicht nutzen.
      </p>
      <p className="muted" style={{ fontSize: 12 }}>
        Hinweis: Bitte auch den Spam-Ordner prüfen. Manche Provider brauchen 1-2 Minuten.
      </p>
      <form className="stack" onSubmit={onResend}>
        <input
          type="email"
          placeholder="E-Mail"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || cooldown > 0 || !email}
        >
          {buttonLabel}
        </button>
      </form>
      {status === 'sent' && message && <p className="muted">{message}</p>}
      {status === 'error' && error && <p style={{ color: 'crimson' }}>Fehler: {error}</p>}
      {hasSession && (
        <button type="button" className="btn" onClick={onSignOut}>
          Abmelden
        </button>
      )}
    </div>
  );
}
