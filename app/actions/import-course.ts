'use server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
const required = ['lesson_id','lesson_title','lesson_position','question_position','prompt','option_a','option_b','option_c','option_d','correct_option','explanation','pass_score'];
function parseCsv(text: string){
  const lines = text.split(/
?
/).filter(Boolean);
  if(lines.length < 2) return { header: [], rows: [] as string[][] };
  const parseLine = (line: string) => line.split(',').map(v => v.trim());
  return { header: parseLine(lines[0]), rows: lines.slice(1).map(parseLine) };
}
export async function previewAbuCourseCsv(formData: FormData){
  const file = formData.get('file');
  if(!(file instanceof File)) return { ok:false, message:'Bitte CSV-Datei wählen.' };
  const text = await file.text();
  const { header, rows } = parseCsv(text);
  const missing = required.filter(k => !header.includes(k));
  if(missing.length) return { ok:false, message:`Fehlende Spalten: ${missing.join(', ')}` };
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const invalid = rows.filter(r => !['A','B','C','D'].includes(r[idx.correct_option]));
  return { ok:true, message:`${rows.length} Zeilen erkannt. ${invalid.length} Zeilen mit ungültiger correct_option.`, sample: rows.slice(0,5).map(r => ({ lesson_id:r[idx.lesson_id], prompt:r[idx.prompt], correct_option:r[idx.correct_option] })), invalidCount: invalid.length };
}
export async function importAbuCourseCsv(formData: FormData){
  const file = formData.get('file');
  if(!(file instanceof File)) return { ok:false, message:'Bitte CSV-Datei wählen.' };
  const text = await file.text();
  const { header, rows } = parseCsv(text);
  const missing = required.filter(k => !header.includes(k));
  if(missing.length) return { ok:false, message:`Fehlende Spalten: ${missing.join(', ')}` };
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const lessons = new Map<string, any>();
  const questions = [] as any[];
  const errors:string[] = [];
  rows.forEach((cols, n) => {
    const rowNo = n + 2;
    const lessonId = cols[idx.lesson_id];
    const correct = cols[idx.correct_option];
    const prompt = cols[idx.prompt];
    if(!lessonId) errors.push(`Zeile ${rowNo}: lesson_id fehlt`);
    if(!prompt) errors.push(`Zeile ${rowNo}: prompt fehlt`);
    if(!['A','B','C','D'].includes(correct)) errors.push(`Zeile ${rowNo}: correct_option ungültig`);
    lessons.set(lessonId, { id: lessonId, module_id:'abu-qv', title: cols[idx.lesson_title], position: Number(cols[idx.lesson_position] || 0), pass_score: Number(cols[idx.pass_score] || 70) });
    questions.push({ lesson_id: lessonId, prompt, option_a: cols[idx.option_a], option_b: cols[idx.option_b], option_c: cols[idx.option_c], option_d: cols[idx.option_d], correct_option: correct, explanation: cols[idx.explanation], position: Number(cols[idx.question_position] || 0) });
  });
  if(errors.length) return { ok:false, message:`Import abgebrochen. ${errors.length} Fehler gefunden.`, errors: errors.slice(0,20) };
  const access = await requireAdmin();
  if(!access.ok) return { ok:false, message:'Nicht berechtigt.' };
  const supabase = await createClient();
  const moduleResult = await supabase.from('modules').upsert({ id:'abu-qv', title:'Allgemeinbildung QV', description:'QV-naher ABU-Kurs für Sprache, Gesellschaft und Alltag.' });
  if(moduleResult.error) return { ok:false, message:moduleResult.error.message };
  const lessonsResult = await supabase.from('lessons').upsert(Array.from(lessons.values()));
  if(lessonsResult.error) return { ok:false, message:lessonsResult.error.message };
  const questionResult = await supabase.from('questions').insert(questions);
  if(questionResult.error) return { ok:false, message:questionResult.error.message };
  await supabase.from('import_logs').insert({ source: file.name || 'upload.csv', status: 'success', row_count: questions.length }); return { ok:true, message:`${questions.length} Fragen importiert.`, importedLessons: lessons.size };
}
