import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { levelFromXp } from '@/lib/levels';

const PASS_BONUS_XP = 50;

// Computes the user's XP-leaderboard rank from a given XP value. We count
// profiles with strictly higher XP and add 1, which mirrors how the
// /leaderboard page orders by xp descending.
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
  const body = await request.json();
  const { lessonId, lastQuestionIndex } = body;
  if (!lessonId) {
    return NextResponse.json({ message: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  // Anti-Cheat: Client-Werte für correctAnswers/totalQuestions werden ignoriert.
  // Stattdessen ziehen wir die "Wahrheit" direkt aus der DB:
  //   total = Anzahl Fragen in dieser Lektion
  //   correct = Anzahl Fragen dieser Lektion, für die der User bereits eine
  //             XP-Award-Zeile hat (= mindestens einmal richtig beantwortet)
  // Damit zählen nur tatsächlich richtige Antworten dieser Session-Historie.
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, pass_score')
    .eq('id', lessonId)
    .maybeSingle();
  if (!lesson) {
    return NextResponse.json({ message: 'Lektion nicht gefunden.' }, { status: 404 });
  }
  const passScore = lesson.pass_score ?? 70;

  const { data: lessonQuestions } = await supabase
    .from('questions')
    .select('id')
    .eq('lesson_id', lessonId);
  const questionIds = (lessonQuestions ?? []).map((q: any) => q.id as string);
  const totalQuestions = questionIds.length;

  let correctAnswers = 0;
  if (totalQuestions > 0) {
    const { count } = await supabase
      .from('question_xp_awards')
      .select('question_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('question_id', questionIds);
    correctAnswers = Math.min(totalQuestions, count ?? 0);
  }

  const score = totalQuestions > 0
    ? Math.min(100, Math.round((correctAnswers / totalQuestions) * 100))
    : 0;
  const passed = score >= passScore;

  const { error: attemptError } = await supabase.from('lesson_attempts').insert({
    user_id: user.id,
    lesson_id: lessonId,
    score,
    correct_answers: correctAnswers,
    total_questions: totalQuestions,
  });
  if (attemptError) return NextResponse.json({ message: attemptError.message }, { status: 500 });

  const { data: existing } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  const bestScore = Math.min(100, Math.max(existing?.best_score ?? 0, score));
  const alreadyPassed = Boolean(existing?.passed);
  const newlyPassed = passed && !alreadyPassed;

  const progressPayload = {
    user_id: user.id,
    lesson_id: lessonId,
    best_score: bestScore,
    passed: alreadyPassed || passed,
    last_question_index: Math.max(0, Math.floor(Number(lastQuestionIndex) || 0)),
  };
  const { error: progressError } = await supabase
    .from('lesson_progress')
    .upsert(progressPayload, { onConflict: 'user_id,lesson_id' });
  if (progressError) return NextResponse.json({ message: progressError.message }, { status: 500 });

  let bonus = 0;
  let nextXp: number | undefined;
  let nextLevel: number | undefined;
  let oldRank: number | null = null;
  let newRank: number | null = null;
  if (newlyPassed) {
    bonus = PASS_BONUS_XP;
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, level')
      .eq('id', user.id)
      .single();
    const currentXp = profile?.xp ?? 0;
    oldRank = await computeXpRank(supabase, currentXp);
    const computedXp = currentXp + bonus;
    nextXp = computedXp;
    nextLevel = levelFromXp(computedXp);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ xp: computedXp, level: nextLevel })
      .eq('id', user.id);
    if (profileError) return NextResponse.json({ message: profileError.message }, { status: 500 });
    newRank = await computeXpRank(supabase, computedXp);
  }

  return NextResponse.json({
    message: 'Lektion gespeichert.',
    score,
    correctAnswers,
    totalQuestions,
    passed,
    newlyPassed,
    bonusXp: bonus,
    xp: nextXp,
    level: nextLevel,
    oldRank,
    newRank,
  });
}
