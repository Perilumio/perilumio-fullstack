import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const XP_PER_QUESTION = 20;

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
  const nextXp = (profile?.xp ?? 0) + XP_PER_QUESTION;
  const nextLevel = Math.max(1, Math.floor(nextXp / 100) + 1);
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ xp: nextXp, level: nextLevel })
    .eq('id', user.id);
  if (profileError) return NextResponse.json({ message: profileError.message }, { status: 500 });

  return NextResponse.json({ awarded: XP_PER_QUESTION, alreadyAwarded: false, xp: nextXp, level: nextLevel });
}
