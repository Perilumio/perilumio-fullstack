import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: unknown;
  password?: unknown;
  display_name?: unknown;
  username?: unknown;
  origin?: unknown;
};

function bad(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, message, code }, { status });
}

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
    return bad('Ungültige Anfrage.');
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName =
    typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 60) : '';
  const username =
    typeof body.username === 'string' ? body.username.trim().slice(0, 24) : '';
  const bodyOrigin = typeof body.origin === 'string' ? body.origin : '';

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return bad('Bitte eine gültige E-Mail-Adresse eingeben.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return bad(`Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return bad('Passwort ist zu lang.');
  }

  const user_metadata: Record<string, string> = {};
  if (displayName) user_metadata.display_name = displayName;
  if (username) user_metadata.username = username;

  const origin = pickOrigin(request, bodyOrigin);
  const emailRedirectTo = `${origin}/auth/callback?next=/dashboard`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: user_metadata,
      emailRedirectTo,
    },
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
    if (
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists') ||
      msg.includes('duplicate')
    ) {
      return NextResponse.json(
        {
          ok: true,
          code: 'maybe_exists',
          email,
          message:
            'Falls für diese E-Mail bereits ein Konto existiert, wurde kein neuer Aktivierungslink gesendet. Bitte einloggen oder Passwort zurücksetzen.',
        },
        { status: 200 }
      );
    }
    if (msg.includes('password')) {
      return bad('Passwort wird nicht akzeptiert. Bitte ein längeres oder stärkeres Passwort wählen.');
    }
    if (msg.includes('email') && msg.includes('valid')) {
      return bad('Bitte eine gültige E-Mail-Adresse eingeben.');
    }
    return bad('Registrierung fehlgeschlagen. Bitte erneut versuchen oder bei der Lehrperson melden.', 500);
  }

  // Supabase quirk: when the email already exists (and email confirmation is on),
  // signUp returns a user with an empty identities array — no email is sent.
  // We treat this case as "maybe_exists" to avoid email enumeration while still
  // informing the user that an activation link is on its way for new accounts.
  const identities = (data.user?.identities ?? []) as unknown[];
  const looksLikeExisting = !!data.user && identities.length === 0;

  if (looksLikeExisting) {
    return NextResponse.json({
      ok: true,
      code: 'maybe_exists',
      email,
      message:
        'Falls für diese E-Mail bereits ein Konto existiert, wurde kein neuer Aktivierungslink gesendet. Bitte einloggen oder Passwort zurücksetzen.',
    });
  }

  return NextResponse.json({
    ok: true,
    code: 'confirmation_sent',
    email,
    user_id: data.user?.id ?? null,
    message:
      'Aktivierungslink wurde an die angegebene E-Mail gesendet. Bitte Postfach und Spam-Ordner prüfen.',
  });
}
