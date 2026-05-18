import { createClient } from '@/lib/supabase/server';
import type { CourseKey } from '@/lib/courses';

export async function getDashboardData(){ const supabase = await createClient(); const { data: profile } = await supabase.from('profiles').select('*').single(); const { data: modules } = await supabase.from('modules').select('id,title,description'); const { data: lessons } = await supabase.from('lessons').select('*').order('position'); const { data: progress } = await supabase.from('lesson_progress').select('*'); const { data: attempts } = await supabase.from('lesson_attempts').select('*'); return { profile, modules: modules ?? [], lessons: lessons ?? [], progress: progress ?? [], attempts: attempts ?? [] }; }
export async function getLessonBundle(){ const supabase = await createClient(); const { data: lessons } = await supabase.from('lessons').select('*').order('position'); const { data: questions } = await supabase.from('questions').select('*').order('position'); const { data: progress } = await supabase.from('lesson_progress').select('*'); return { lessons: lessons ?? [], questions: questions ?? [], progress: progress ?? [] }; }
export async function getStatsSummary(){ const supabase = await createClient(); const [{ count: users }, { count: progressCount }, { count: attemptsCount }] = await Promise.all([supabase.from('profiles').select('*', { count:'exact', head:true }), supabase.from('lesson_progress').select('*', { count:'exact', head:true }), supabase.from('lesson_attempts').select('*', { count:'exact', head:true })]); return { users: users ?? 0, progressCount: progressCount ?? 0, attemptsCount: attemptsCount ?? 0 }; }
export async function getCourseBundle(moduleId: string){ const supabase = await createClient(); const { data: module } = await supabase.from('modules').select('*').eq('id', moduleId).maybeSingle(); const { data: lessons } = await supabase.from('lessons').select('*').eq('module_id', moduleId).order('position'); const lessonIds = (lessons ?? []).map((l: any) => l.id); const qr = lessonIds.length ? await supabase.from('questions').select('*').in('lesson_id', lessonIds).order('position') : { data: [] as any }; return { module, lessons: lessons ?? [], questions: qr.data ?? [] }; }

export async function getCourseLessons(courseKey: CourseKey){
  const supabase = await createClient();
  const { data: modules } = await supabase.from('modules').select('id,title,description').eq('course_key', courseKey);
  const moduleIds = (modules ?? []).map((m: any) => m.id);
  if(moduleIds.length === 0) return { modules: [], lessons: [], questions: [] };
  const { data: lessons } = await supabase.from('lessons').select('*').in('module_id', moduleIds).order('position');
  const lessonIds = (lessons ?? []).map((l: any) => l.id);
  const qr = lessonIds.length ? await supabase.from('questions').select('*').in('lesson_id', lessonIds).order('position') : { data: [] as any };
  return { modules: modules ?? [], lessons: lessons ?? [], questions: qr.data ?? [] };
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
