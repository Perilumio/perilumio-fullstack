import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCourseKey } from '@/lib/courses';
import { buildState, findOrCreateMatch } from '@/lib/battle';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const courseKey = await getActiveCourseKey();
  const match = await findOrCreateMatch(user.id, courseKey);
  if (!match) {
    return NextResponse.json(
      { message: 'Für diesen Kurs gibt es noch keine Fragen.' },
      { status: 409 },
    );
  }
  const state = await buildState(match.id, user.id);
  return NextResponse.json({ state });
}
