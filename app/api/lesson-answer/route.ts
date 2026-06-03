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
  // Anti-Cheat: Der Client schickt nur questionId + selectedOption.
  // Die Korrektheit wird ausschliesslich serverseitig gegen questions.correct_option geprüft.
  // Das alte Feld "correct" aus dem Payload wird ignoriert.
  const body = await request.json();
  const questionId = body?.questionId;
  const selectedOption = typeof body?.selectedOption === 'string'
    ? body.selectedOption.toUpperCase()
    : null;
  if (!questionId || !selectedOption || !['A', 'B', 'C', 'D'].includes(selectedOption)) {
    return NextResponse.json({ message: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  // Server prüft die richtige Antwort. Frontend darf correct_option nicht kennen.
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('id, correct_option, explanation, lesson_id')
    .eq('id', questionId)
    .maybeSingle();
  if (questionError || !question) {
    return NextResponse.json({ message: 'Frage nicht gefunden.' }, { status: 404 });
  }
  const correct = selectedOption === String(question.correct_option).toUpperCase();

  if (!correct) {
    // Bei falscher Antwort: korrekte Option + Erklärung zurückgeben, damit der
    // Client das visuelle Feedback (rote + grüne Markierung) zeigen kann. Kein
    // XP, kein Streak.
    return NextResponse.json({
      correct: false,
      correctOption: question.correct_option,
      explanation: question.explanation ?? '',
      awarded: 0,
      alreadyAwarded: false,
    });
  }

  // Richtige Antwort: XP-Vergabe (deduped via unique key user_id+question_id).
  const { data: insertResult, error: insertError } = await supabase
    .from('question_xp_awards')
    .insert({ user_id: user.id, question_id: questionId, xp_awarded: XP_PER_QUESTION })
    .select('question_id')
    .maybeSingle();

  const alreadyAwarded = !insertResult;
  if (insertError && !/duplicate key|unique/i.test(insertError.message)) {
    return NextResponse.json({ message: insertError.message }, { status: 500 });
  }

  // Streak: bei jeder richtigen Antwort hochzählen. RPC ist idempotent pro Tag,
  // d.h. der zweite Treffer am gleichen Tag passiert dem Streak nichts.
  let streak: { current: number; longest: number; increased: boolean } | null = null;
  try {
    const { data: streakRow } = await supabase.rpc('bump_streak', { p_user_id: user.id });
    const row = Array.isArray(streakRow) ? streakRow[0] : streakRow;
    if (row) {
      streak = {
        current: Number(row.current_streak) || 0,
        longest: Number(row.longest_streak) || 0,
        increased: Boolean(row.increased),
      };
    }
  } catch {
    // Streak-Fehler darf den Lernfluss nicht blockieren.
  }

  if (alreadyAwarded) {
    return NextResponse.json({
      correct: true,
      correctOption: question.correct_option,
      explanation: question.explanation ?? '',
      awarded: 0,
      alreadyAwarded: true,
      streak,
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', user.id)
    .single();
  const currentXp = profile?.xp ?? 0;
  // Snapshot rank before the XP update so the client can detect a rank-up
  // caused by this single question.
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
    correct: true,
    correctOption: question.correct_option,
    explanation: question.explanation ?? '',
    awarded: XP_PER_QUESTION,
    alreadyAwarded: false,
    xp: nextXp,
    level: nextLevel,
    oldRank,
    newRank,
    streak,
  });
}
