'use server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
export async function updateQuestion(formData: FormData){
  const access = await requireAdmin();
  if(!access.ok) return { ok:false, message:'Nicht berechtigt.' };
  const supabase = await createClient();
  const id = String(formData.get('id') || '');
  const prompt = String(formData.get('prompt') || '');
  const explanation = String(formData.get('explanation') || '');
  const correct_option = String(formData.get('correct_option') || 'A');
  const { error } = await supabase.from('questions').update({ prompt, explanation, correct_option }).eq('id', id);
  return { ok: !error, message: error?.message || 'Frage gespeichert.' };
}
export async function deleteQuestion(formData: FormData){
  const supabase = await createClient();
  const id = String(formData.get('id') || '');
  const { error } = await supabase.from('questions').delete().eq('id', id);
  return { ok: !error, message: error?.message || 'Frage gelöscht.' };
}

export async function bulkDeleteQuestions(formData: FormData){
  const supabase = await createClient();
  const ids = String(formData.get('ids') || '').split(',').map(v => v.trim()).filter(Boolean);
  if(!ids.length) return { ok:false, message:'Keine Fragen ausgewählt.' };
  const { error } = await supabase.from('questions').delete().in('id', ids);
  return { ok: !error, message: error?.message || `${ids.length} Fragen gelöscht.` };
}
