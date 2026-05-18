import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PASS_BONUS_XP = 50;

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { lessonId, lastQuestionIndex } = body;
  const totalQuestions = Math.max(0, Number(body.totalQuestions) || 0);
  const correctAnswers = Math.min(totalQuestions, Math.max(0, Number(body.correctAnswers) || 0));
  const computedScore = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const score = Math.min(100, Math.max(0, computedScore));

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const { data: lesson } = await supabase
    .from('lessons')
    .select('pass_score')
    .eq('id', lessonId)
    .maybeSingle();
  const passScore = lesson?.pass_score ?? 70;
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
    last_question_index: lastQuestionIndex ?? 0,
  };
  const { error: progressError } = await supabase
    .from('lesson_progress')
    .upsert(progressPayload, { onConflict: 'user_id,lesson_id' });
  if (progressError) return NextResponse.json({ message: progressError.message }, { status: 500 });

  let bonus = 0;
  let nextXp: number | undefined;
  let nextLevel: number | undefined;
  if (newlyPassed) {
    bonus = PASS_BONUS_XP;
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, level')
      .eq('id', user.id)
      .single();
    const computedXp = (profile?.xp ?? 0) + bonus;
    nextXp = computedXp;
    nextLevel = Math.max(1, Math.floor(computedXp / 100) + 1);
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ xp: computedXp, level: nextLevel })
      .eq('id', user.id);
    if (profileError) return NextResponse.json({ message: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Lektion gespeichert.',
    score,
    passed,
    newlyPassed,
    bonusXp: bonus,
    xp: nextXp,
    level: nextLevel,
  });
}
