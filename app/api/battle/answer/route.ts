import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildState, recordAnswer, OPTION_KEYS, type OptionKey } from '@/lib/battle';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const matchId = typeof body.match_id === 'string' ? body.match_id : null;
  const questionIndex = Number.isInteger(body.question_index) ? body.question_index : null;
  const selected = body.selected_option;
  if (!matchId || questionIndex === null) {
    return NextResponse.json({ message: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const selectedOption: OptionKey | null =
    typeof selected === 'string' && (OPTION_KEYS as readonly string[]).includes(selected)
      ? (selected as OptionKey)
      : null;

  const result = await recordAnswer({
    matchId,
    userId: user.id,
    questionIndex,
    selectedOption,
  });
  if ('error' in result) {
    const status = result.error === 'forbidden' ? 403
      : result.error === 'not_found' || result.error === 'no_question' ? 404
      : 409;
    return NextResponse.json({ message: result.error }, { status });
  }

  const state = await buildState(matchId, user.id);
  return NextResponse.json({ state });
}
