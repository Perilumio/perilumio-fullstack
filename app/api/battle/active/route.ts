import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildState, findActiveMatchForUser } from '@/lib/battle';

export const dynamic = 'force-dynamic';

// Reconnect-Endpunkt: liefert das laufende Match des Users (falls vorhanden),
// ohne ein neues zu erstellen. Wird beim Laden der Battle-Seite aufgerufen.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const matchId = await findActiveMatchForUser(user.id);
  if (!matchId) return NextResponse.json({ state: null });

  const state = await buildState(matchId, user.id);
  return NextResponse.json({ state: state ?? null });
}
