import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidCourseKey } from '@/lib/courses-constants';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const activeCourseKey = isValidCourseKey(body?.activeCourseKey) ? body.activeCourseKey : null;

  const { data, error } = await supabase
    .from('analytics_sessions')
    .insert({
      user_id: user.id,
      active_course_key: activeCourseKey,
      page_views: 1,
      duration_seconds: 0,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ sessionId: data.id });
}
