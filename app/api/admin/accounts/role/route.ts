import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type Body = { user_id?: unknown; role?: unknown };

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
    return bad('Ungueltige Anfrage.');
  }
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  if (!userId) return bad('user_id fehlt.');
  if (role !== 'student' && role !== 'admin') return bad('Ungueltige Rolle.');
  if (userId === access.user!.id) return bad('Eigene Rolle kann nicht geaendert werden.');

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) {
    return NextResponse.json(
      { ok: false, message: `Rollenwechsel schlug fehl: ${error.message}.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, user_id: userId, role });
}
