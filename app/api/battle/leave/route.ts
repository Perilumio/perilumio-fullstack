import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { leaveMatch } from '@/lib/battle';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const matchId = typeof body.match_id === 'string' ? body.match_id : null;
  if (!matchId) return NextResponse.json({ message: 'match_id fehlt.' }, { status: 400 });
  await leaveMatch(matchId, user.id);
  return NextResponse.json({ ok: true });
}
