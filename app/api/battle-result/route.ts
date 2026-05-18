import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { score, enemyScore } = await request.json();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const bpReward = score > enemyScore ? 20 : score === enemyScore ? 5 : 0;

  const { data: profile } = await supabase
    .from('profiles')
    .select('battle_points')
    .eq('id', user.id)
    .single();

  const nextBattlePoints = (profile?.battle_points ?? 0) + bpReward;

  const { error } = await supabase
    .from('profiles')
    .update({ battle_points: nextBattlePoints })
    .eq('id', user.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    message: 'Battle gespeichert.',
    bpReward,
    battlePoints: nextBattlePoints,
  });
}
