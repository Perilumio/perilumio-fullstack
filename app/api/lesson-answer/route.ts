import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const XP_PER_QUESTION = 20;

// Mirrors the leaderboard ordering (profiles.xp desc): the rank is "1 + the
// number of profiles strictly above this XP value". Returns null on error so
// callers can drop the rank-up signal instead of guessing.
async function computeXpRank(
  supabase: Awaited<ReturnType<typeof createClient>>,
  xp: number,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gt('xp', xp);
  if (error) return null;
  return (count ?? 0) + 1;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { questionId, correct } = await request.json();
  if (!questionId || typeof correct !== 'boolean') {
    return NextResponse.json({ message: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  if (!correct) {
    return NextResponse.json({ awarded: 0, alreadyAwarded: false });
  }

  const { data: insertResult, error: insertError } = await supabase
    .from('question_xp_awards')
    .insert({ user_id: user.id, question_id: questionId, xp_awarded: XP_PER_QUESTION })
    .select('question_id')
    .maybeSingle();

  const alreadyAwarded = !insertResult;
  if (insertError && !/duplicate key|unique/i.test(insertError.message)) {
    return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  if (alreadyAwarded) {
    return NextResponse.json({ awarded: 0, alreadyAwarded: true });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', user.id)
    .single();
  const currentXp = profile?.xp ?? 0;
  // Snapshot rank before the XP update so the client can detect a rank-up
  // caused by this single question. Per-question XP is what actually moves
  // users up the leaderboard (10×20 = 200 XP per sequence dwarfs the 50 XP
  // pass bonus), so the celebration trigger has to live here.
  const oldRank = await computeXpRank(supabase, currentXp);
  const nextXp = currentXp + XP_PER_QUESTION;
  const nextLevel = Math.max(1, Math.floor(nextXp / 100) + 1);
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ xp: nextXp, level: nextLevel })
    .eq('id', user.id);
  if (profileError) return NextResponse.json({ message: profileError.message }, { status: 500 });
  const newRank = await computeXpRank(supabase, nextXp);

  return NextResponse.json({
    awarded: XP_PER_QUESTION,
    alreadyAwarded: false,
    xp: nextXp,
    level: nextLevel,
    oldRank,
    newRank,
  });
}
