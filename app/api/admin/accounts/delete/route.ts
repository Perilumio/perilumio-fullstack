import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

  const { data: authUserData, error: authGetErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authGetErr || !authUserData?.user) {
    return bad('Benutzer nicht gefunden.', 404);
  }
  const targetEmail = authUserData.user.email ?? null;

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (delErr) {
    return NextResponse.json(
      {
        ok: false,
        code: 'delete_failed',
        message: `Löschung schlug fehl: ${delErr.message}. Bitte erneut versuchen.`,
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
    deleted_email: targetEmail,
  });
}
