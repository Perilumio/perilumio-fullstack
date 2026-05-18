import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const pattern = `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_key, xp, battle_points')
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .neq('id', user.id)
    .limit(20);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const ids = (data ?? []).map((row) => row.id);
  let friendIds = new Set<string>();
  if (ids.length > 0) {
    const { data: edges, error: edgeError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .in('friend_id', ids);
    if (edgeError) return NextResponse.json({ message: edgeError.message }, { status: 500 });
    friendIds = new Set((edges ?? []).map((e) => e.friend_id as string));
  }

  const results = (data ?? []).map((row) => ({
    ...row,
    is_friend: friendIds.has(row.id),
  }));

  return NextResponse.json({ results });
}
