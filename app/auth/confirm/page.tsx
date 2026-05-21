import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import ConfirmClient from './ConfirmClient';

export const dynamic = 'force-dynamic';

type SearchParams = { email?: string };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const sessionEmail = user?.email ?? null;
  const confirmed = !!(
    (user as any)?.email_confirmed_at ||
    (user as any)?.confirmed_at
  );
  const initialEmail = (params.email ?? sessionEmail ?? '').trim();

  return (
    <main className="auth-shell">
      <section className="card stack" style={{ maxWidth: 480, margin: '10vh auto' }}>
        <span className="pill">E-Mail bestätigen</span>
        <h1>Bitte E-Mail bestätigen</h1>
        {confirmed ? (
          <>
            <p className="muted">
              Dein Konto ist bereits bestätigt. Du kannst direkt zum Dashboard wechseln.
            </p>
            <Link href="/dashboard" className="btn btn-primary">Zum Dashboard</Link>
          </>
        ) : (
          <Suspense fallback={null}>
            <ConfirmClient initialEmail={initialEmail} hasSession={!!user} />
          </Suspense>
        )}
        <Link href="/login">Zurück zur Anmeldung</Link>
      </section>
    </main>
  );
}
