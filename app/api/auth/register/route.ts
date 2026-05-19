import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
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

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata,
  });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists') ||
      msg.includes('duplicate')
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: 'user_exists',
          message:
            'Für diese E-Mail existiert bereits ein Konto. Bitte einloggen oder Passwort zurücksetzen.',
        },
        { status: 409 }
      );
    }
    if (msg.includes('password')) {
      return bad('Passwort wird nicht akzeptiert. Bitte ein längeres oder stärkeres Passwort wählen.');
    }
    if (msg.includes('email') && msg.includes('valid')) {
      return bad('Bitte eine gültige E-Mail-Adresse eingeben.');
    }
    if (msg.includes('rate') || msg.includes('too many')) {
      return NextResponse.json(
        {
          ok: false,
          code: 'rate_limited',
          message:
            'Der Server ist gerade durch viele Registrierungen ausgelastet. Bitte in wenigen Minuten erneut versuchen oder bei der Lehrperson melden.',
        },
        { status: 429 }
      );
    }
    return bad('Registrierung fehlgeschlagen. Bitte erneut versuchen oder bei der Lehrperson melden.', 500);
  }

  return NextResponse.json({ ok: true, user_id: data.user?.id ?? null });
}
