import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildState } from '@/lib/battle';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const url = new URL(request.url);
  const matchId = url.searchParams.get('match_id');
  if (!matchId) return NextResponse.json({ message: 'match_id fehlt.' }, { status: 400 });

  const state = await buildState(matchId, user.id);
  if (!state) return NextResponse.json({ message: 'Match nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ state });
}
