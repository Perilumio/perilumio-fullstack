import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { lessonId, lastQuestionIndex } = await request.json();
  if (!lessonId || typeof lastQuestionIndex !== 'number') {
    return NextResponse.json({ message: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const safeIndex = Math.max(0, Math.floor(lastQuestionIndex));

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const { data: existing } = await supabase
    .from('lesson_progress')
    .select('best_score, passed, last_question_index')
    .eq('user_id', user.id)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    lesson_id: lessonId,
    best_score: existing?.best_score ?? 0,
    passed: existing?.passed ?? false,
    last_question_index: safeIndex,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('lesson_progress')
    .upsert(payload, { onConflict: 'user_id,lesson_id' });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, lastQuestionIndex: safeIndex });
}
