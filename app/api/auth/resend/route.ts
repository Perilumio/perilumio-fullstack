import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_EMAIL_LENGTH = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = { email?: unknown; origin?: unknown };

function pickOrigin(request: Request, bodyOrigin: string): string {
  const envSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (envSite) return envSite;
  if (bodyOrigin && /^https?:\/\//i.test(bodyOrigin)) return bodyOrigin.replace(/\/$/, '');
  const fromHeader = request.headers.get('origin');
  if (fromHeader) return fromHeader.replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const bodyOrigin = typeof body.origin === 'string' ? body.origin : '';

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, message: 'Bitte eine gültige E-Mail-Adresse eingeben.' },
      { status: 400 }
    );
  }

  const origin = pickOrigin(request, bodyOrigin);
  const emailRedirectTo = `${origin}/auth/callback?next=/dashboard`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo },
  });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const status = (error as any).status as number | undefined;
    if (
      msg.includes('rate') ||
      msg.includes('too many') ||
      msg.includes('seconds') ||
      status === 429
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: 'rate_limited',
          message:
            'Es wurden zu viele Versuche in kurzer Zeit gemacht. Bitte 1-2 Minuten warten und erneut versuchen.',
        },
        { status: 429 }
      );
    }
    // Don't leak whether the address belongs to a (already confirmed) user.
    // Return a neutral success message so we cannot be used for enumeration.
  }

  return NextResponse.json({
    ok: true,
    message:
      'Falls ein nicht bestätigtes Konto mit dieser E-Mail existiert, wurde der Aktivierungslink erneut gesendet. Bitte Postfach und Spam-Ordner prüfen.',
  });
}
