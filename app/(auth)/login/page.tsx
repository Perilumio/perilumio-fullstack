'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      const supabase = createClient();
      const emailRedirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo },
      });
      if (error) {
        setStatus('error');
        setError(error.message);
        return;
      }
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Unbekannter Fehler');
    }
  }

  return (
    <main className="auth-shell">
      <section className="card stack" style={{ maxWidth: 480, margin: '10vh auto' }}>
        <span className="pill">Login</span>
        <h1>Perilumio Zugang</h1>
        <p className="muted">E-Mail-/Magic-Link-Login via Supabase Auth.</p>
        <form className="stack" onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="E-Mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending' || status === 'sent'}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status === 'sending' || status === 'sent' || !email}
          >
            {status === 'sending' ? 'Sende…' : status === 'sent' ? 'Gesendet' : 'Magic Link senden'}
          </button>
        </form>
        {status === 'sent' && (
          <p className="muted">
            Magic Link gesendet. Bitte E-Mail-Postfach (auch Spam) prüfen.
          </p>
        )}
        {status === 'error' && error && (
          <p style={{ color: 'crimson' }}>Fehler: {error}</p>
        )}
        <p className="muted">Nach dem Login entscheidet die Rolle im Profil über den Admin-Zugriff.</p>
        <Link href="/">Zur Startseite</Link>
      </section>
    </main>
  );
}
