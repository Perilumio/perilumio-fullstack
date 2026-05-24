import { createClient } from '@/lib/supabase/server';
import { DEFAULT_COURSE_KEY, isValidCourseKey, type CourseKey } from '@/lib/courses-constants';

// Supabase's hosted PostgREST caps a single response at 1000 rows. The ABU
// course holds 80 sublessons × 20 questions = 1600 rows, so a single
// .in('lesson_id', …) select returns a truncated slice (≈12 rows per lesson)
// and individual sequences appeared as "Frage y/11" instead of "Frage y/20".
// Paginate explicitly so every question for the requested lesson set is loaded.
async function fetchAllQuestionsForLessons(supabase: any, lessonIds: string[]) {
  if (lessonIds.length === 0) return [] as any[];
  const PAGE_SIZE = 1000;
  const all: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .in('lesson_id', lessonIds)
      .order('position')
      .range(from, to);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export async function getDashboardData(){
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    : { data: null };
  const activeCourseKey: CourseKey = isValidCourseKey((profile as any)?.active_course_key)
    ? ((profile as any).active_course_key as CourseKey)
    : DEFAULT_COURSE_KEY;
  const { data: courseModules } = await supabase
    .from('modules')
    .select('id,title,description')
    .eq('course_key', activeCourseKey);
  const moduleList = (courseModules ?? []) as { id: string }[];
  const moduleIds = moduleList.map((m) => m.id);
  const lessons = moduleIds.length
    ? (await supabase.from('lessons').select('*').in('module_id', moduleIds).order('position')).data ?? []
    : [];
  const lessonIds = (lessons as { id: string }[]).map((l) => l.id);
  const progress = user && lessonIds.length
    ? (await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds)).data ?? []
    : [];
  const attempts = user && lessonIds.length
    ? (await supabase
        .from('lesson_attempts')
        .select('*')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds)).data ?? []
    : [];
  return { profile, modules: moduleList, lessons, progress, attempts, activeCourseKey };
}
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
  const questions = await fetchAllQuestionsForLessons(supabase, lessonIds);
  return { modules: modules ?? [], lessons: orderedLessons, questions };
}

export async function getCourseQuestions(courseKey: CourseKey){
  const supabase = await createClient();
  const { data: modules } = await supabase.from('modules').select('id').eq('course_key', courseKey);
  const moduleIds = (modules ?? []).map((m: any) => m.id);
  if(moduleIds.length === 0) return [];
  const { data: lessons } = await supabase.from('lessons').select('id').in('module_id', moduleIds);
  const lessonIds = (lessons ?? []).map((l: any) => l.id);
  if(lessonIds.length === 0) return [];
  return fetchAllQuestionsForLessons(supabase, lessonIds);
}
