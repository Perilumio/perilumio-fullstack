import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

type Body = { user_id?: unknown; confirm?: unknown };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) return bad('Nicht autorisiert.', 403);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad('Ungültige Anfrage.');
  }
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  const confirm = typeof body.confirm === 'string' ? body.confirm.trim() : '';
  if (!userId) return bad('user_id fehlt.');
  if (confirm !== 'DELETE') return bad('Bitte "DELETE" tippen, um zu bestätigen.');
  if (userId === access.user!.id) return bad('Eigenen Admin-Account kann nicht gelöscht werden.');

  // Adresse + Profilinfo vor Löschung laden (Auth-API hat die Mail, profiles nicht).
  const { data: authUserData, error: authGetErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authGetErr || !authUserData?.user) {
    return bad('Benutzer nicht gefunden.', 404);
  }
  const targetEmail = authUserData.user.email ?? '';
  if (!targetEmail) return bad('Benutzer hat keine E-Mail-Adresse hinterlegt.', 422);

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('display_name, username')
    .eq('id', userId)
    .maybeSingle();
  const greetingName =
    targetProfile?.display_name?.trim() ||
    targetProfile?.username?.trim() ||
    targetEmail;

  const subject = 'Ihr Perilumio-Konto wurde gelöscht';
  const text = [
    `Hallo ${greetingName},`,
    '',
    'Ihr Perilumio-Konto wurde soeben von einem Administrator endgültig gelöscht.',
    'Sämtliche zugehörigen Lernfortschritte, Battle-Punkte und Profilinformationen wurden entfernt.',
    'Diese Aktion ist unwiderruflich.',
    '',
    'Falls Sie der Meinung sind, dass dies versehentlich geschah, antworten Sie bitte auf diese E-Mail.',
    '',
    'Mit freundlichen Grüssen',
    'Perilumio',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0b1020;line-height:1.5">
    <p>Hallo ${escapeHtml(greetingName)},</p>
    <p>Ihr <strong>Perilumio</strong>-Konto wurde soeben von einem Administrator endgültig gelöscht.
       Sämtliche zugehörigen Lernfortschritte, Battle-Punkte und Profilinformationen wurden entfernt.
       Diese Aktion ist <strong>unwiderruflich</strong>.</p>
    <p>Falls Sie der Meinung sind, dass dies versehentlich geschah, antworten Sie bitte auf diese E-Mail.</p>
    <p>Mit freundlichen Grüssen<br/>Perilumio</p>
  </body></html>`;

  // Erst Mail versenden, dann Auth-User löschen – so erhält der Empfänger die
  // Benachrichtigung garantiert, bevor sein Postfach-Zugang ggf. verschwindet.
  const mail = await sendMail({ to: targetEmail, subject, text, html });
  if (!mail.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: mail.code,
        message:
          mail.code === 'not_configured'
            ? 'Löschung abgebrochen: Mailversand ist nicht konfiguriert (RESEND_API_KEY und EMAIL_FROM erforderlich).'
            : `Löschung abgebrochen: ${mail.message}`,
      },
      { status: 502 }
    );
  }

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (delErr) {
    // Auth-Löschung schlug fehl, Empfänger hat aber bereits die Mail erhalten.
    return NextResponse.json(
      {
        ok: false,
        code: 'delete_failed',
        message: `Mail wurde versendet, aber Löschung schlug fehl: ${delErr.message}. Bitte erneut versuchen.`,
      },
      { status: 500 }
    );
  }

  // public.profiles cascadiert über FK auf auth.users (on delete cascade);
  // wir räumen defensiv trotzdem nach, falls die Cascade fehlt.
  await supabaseAdmin.from('profiles').delete().eq('id', userId);

  return NextResponse.json({
    ok: true,
    deleted_user_id: userId,
    notified_email: targetEmail,
    mail_id: mail.id,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
