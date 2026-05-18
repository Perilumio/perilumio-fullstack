import { createClient } from '@/lib/supabase/server';
import type { CourseKey } from '@/lib/courses';

export async function getDashboardData(){ const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = user ? await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle() : { data: null }; const { data: modules } = await supabase.from('modules').select('id,title,description'); const { data: lessons } = await supabase.from('lessons').select('*').order('position'); const { data: progress } = await supabase.from('lesson_progress').select('*'); const { data: attempts } = await supabase.from('lesson_attempts').select('*'); return { profile, modules: modules ?? [], lessons: lessons ?? [], progress: progress ?? [], attempts: attempts ?? [] }; }
export async function getLessonBundle(){ const supabase = await createClient(); const { data: lessons } = await supabase.from('lessons').select('*').order('position'); const { data: questions } = await supabase.from('questions').select('*').order('position'); const { data: progress } = await supabase.from('lesson_progress').select('*'); return { lessons: lessons ?? [], questions: questions ?? [], progress: progress ?? [] }; }
export async function getStatsSummary(){ const supabase = await createClient(); const [{ count: users }, { count: progressCount }, { count: attemptsCount }] = await Promise.all([supabase.from('profiles').select('*', { count:'exact', head:true }), supabase.from('lesson_progress').select('*', { count:'exact', head:true }), supabase.from('lesson_attempts').select('*', { count:'exact', head:true })]); return { users: users ?? 0, progressCount: progressCount ?? 0, attemptsCount: attemptsCount ?? 0 }; }
export async function getCourseBundle(moduleId: string){ const supabase = await createClient(); const { data: module } = await supabase.from('modules').select('*').eq('id', moduleId).maybeSingle(); const { data: lessons } = await supabase.from('lessons').select('*').eq('module_id', moduleId).order('position'); const lessonIds = (lessons ?? []).map((l: any) => l.id); const qr = lessonIds.length ? await supabase.from('questions').select('*').in('lesson_id', lessonIds).order('position') : { data: [] as any }; return { module, lessons: lessons ?? [], questions: qr.data ?? [] }; }

export async function getCourseLessons(courseKey: CourseKey){
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from('modules')
    .select('id,title,description,position')
    .eq('course_key', courseKey)
    .order('position', { ascending: true });
  const moduleList = (modules ?? []) as { id: string; position: number | null }[];
  const moduleIds = moduleList.map((m) => m.id);
  if(moduleIds.length === 0) return { modules: [], lessons: [], questions: [] };
  const modulePosition = new Map<string, number>();
  moduleList.forEach((m, idx) => modulePosition.set(m.id, m.position ?? idx));
  const { data: lessons } = await supabase.from('lessons').select('*').in('module_id', moduleIds).order('position');
  const orderedLessons = (lessons ?? []).slice().sort((a: any, b: any) => {
    const am = modulePosition.get(a.module_id) ?? 0;
    const bm = modulePosition.get(b.module_id) ?? 0;
    if (am !== bm) return am - bm;
    return (a.position ?? 0) - (b.position ?? 0);
  });
  const lessonIds = orderedLessons.map((l: any) => l.id);
  const qr = lessonIds.length ? await supabase.from('questions').select('*').in('lesson_id', lessonIds).order('position') : { data: [] as any };
  return { modules: modules ?? [], lessons: orderedLessons, questions: qr.data ?? [] };
}

export async function getCourseQuestions(courseKey: CourseKey){
  const supabase = await createClient();
  const { data: modules } = await supabase.from('modules').select('id').eq('course_key', courseKey);
  const moduleIds = (modules ?? []).map((m: any) => m.id);
  if(moduleIds.length === 0) return [];
  const { data: lessons } = await supabase.from('lessons').select('id').in('module_id', moduleIds);
  const lessonIds = (lessons ?? []).map((l: any) => l.id);
  if(lessonIds.length === 0) return [];
  const { data: questions } = await supabase.from('questions').select('*').in('lesson_id', lessonIds).order('position');
  return questions ?? [];
}
