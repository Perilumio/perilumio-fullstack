import { createClient } from '@/lib/supabase/server';
import { DEFAULT_COURSE_KEY, isValidCourseKey, type CourseKey } from '@/lib/courses-constants';

export { COURSES, DEFAULT_COURSE_KEY, isValidCourseKey, courseLabel } from '@/lib/courses-constants';
export type { CourseKey } from '@/lib/courses-constants';

export async function getActiveCourseKey(): Promise<CourseKey> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_COURSE_KEY;
  const { data } = await supabase
    .from('profiles')
    .select('active_course_key')
    .eq('id', user.id)
    .maybeSingle();
  const key = (data as any)?.active_course_key;
  return isValidCourseKey(key) ? key : DEFAULT_COURSE_KEY;
}
