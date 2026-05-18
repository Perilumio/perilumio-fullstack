import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const friendId = body?.friendId;
  if (!isUuid(friendId)) return NextResponse.json({ message: 'Ungültige Anfrage.' }, { status: 400 });
  if (friendId === user.id) return NextResponse.json({ message: 'Du kannst dich nicht selbst hinzufügen.' }, { status: 400 });

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', friendId)
    .maybeSingle();
  if (targetError) return NextResponse.json({ message: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ message: 'Profil nicht gefunden.' }, { status: 404 });

  const { error } = await supabase
    .from('friendships')
    .upsert({ user_id: user.id, friend_id: friendId }, { onConflict: 'user_id,friend_id' });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Freund hinzugefügt.' });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let friendId: unknown = searchParams.get('friendId');
  if (!friendId) {
    const body = await request.json().catch(() => ({}));
    friendId = body?.friendId;
  }
  if (!isUuid(friendId)) return NextResponse.json({ message: 'Ungültige Anfrage.' }, { status: 400 });

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_id', user.id)
    .eq('friend_id', friendId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Freund entfernt.' });
}
