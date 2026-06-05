'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isValidCourseKey, isCourseSelectable, type CourseKey } from '@/lib/courses-constants';

export type SetActiveCourseResult = { ok: boolean; message: string; activeCourseKey?: CourseKey };

export async function setActiveCourse(_prev: SetActiveCourseResult | null, formData: FormData): Promise<SetActiveCourseResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Bitte einloggen.' };

  const raw = String(formData.get('course_key') ?? '');
  if (!isValidCourseKey(raw)) return { ok: false, message: 'Unbekannter Kurs.' };
  if (!isCourseSelectable(raw)) return { ok: false, message: 'Dieser Kurs ist noch nicht verfuegbar.' };

  const { error } = await supabase
    .from('profiles')
    .update({ active_course_key: raw })
    .eq('id', user.id);

  if (error) return { ok: false, message: `Speichern fehlgeschlagen: ${error.message}` };

  revalidatePath('/courses');
  revalidatePath('/dashboard');
  revalidatePath('/learn');
  revalidatePath('/battle');
  return { ok: true, message: 'Aktiver Kurs gespeichert.', activeCourseKey: raw };
}
