import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidCourseKey } from '@/lib/courses-constants';

const MAX_GAP_SECONDS = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ message: 'Nicht eingeloggt.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ message: 'Fehlende sessionId.' }, { status: 400 });

  const pageViewsDelta = Math.max(0, Math.min(50, Number(body?.pageViewsDelta) || 0));
  const ended = Boolean(body?.ended);
  const activeCourseKey = isValidCourseKey(body?.activeCourseKey) ? body.activeCourseKey : null;

  const { data: existing, error: fetchError } = await supabase
    .from('analytics_sessions')
    .select('id, user_id, started_at, last_seen_at, duration_seconds, page_views')
    .eq('id', sessionId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ message: fetchError.message }, { status: 500 });
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ message: 'Session nicht gefunden.' }, { status: 404 });
  }

  const now = new Date();
  const lastSeen = new Date(existing.last_seen_at);
  const gapSec = Math.max(0, Math.round((now.getTime() - lastSeen.getTime()) / 1000));
  const addSec = Math.min(gapSec, MAX_GAP_SECONDS);

  const update: Record<string, unknown> = {
    last_seen_at: now.toISOString(),
    duration_seconds: (existing.duration_seconds ?? 0) + addSec,
    page_views: (existing.page_views ?? 0) + pageViewsDelta,
  };
  if (ended) update.ended_at = now.toISOString();
  if (activeCourseKey) update.active_course_key = activeCourseKey;

  const { error: updateError } = await supabase
    .from('analytics_sessions')
    .update(update)
    .eq('id', sessionId)
    .eq('user_id', user.id);
  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
