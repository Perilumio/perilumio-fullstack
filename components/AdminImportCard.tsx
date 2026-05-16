'use client';
import { useState, useTransition } from 'react';
import { importAbuCourseCsv, previewAbuCourseCsv } from '@/app/actions/import-course';
export function AdminImportCard(){
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [sample, setSample] = useState<any[]>([]);
  const [pending, startTransition] = useTransition();
  const run = (mode: 'preview'|'import') => (formData: FormData) => startTransition(async()=>{
    const result = mode === 'preview' ? await previewAbuCourseCsv(formData) : await importAbuCourseCsv(formData);
    setMessage(result.message || '');
    setErrors((result as any).errors || []);
    setSample((result as any).sample || []);
  });
  return <div className="card stack"><span className="pill">ABU Import</span><h2>CSV prüfen und importieren</h2><p className="muted">Zuerst Vorschau prüfen, danach Daten in Supabase importieren.</p><form action={run('preview')} className="stack"><input type="file" name="file" accept=".csv" /><div className="cluster"><button className="btn" type="submit" disabled={pending}>Vorschau prüfen</button><button className="btn btn-primary" formAction={run('import')} type="submit" disabled={pending}>{pending ? 'Läuft…' : 'Importieren'}</button></div></form>{message ? <p className="muted">{message}</p> : null}{sample.length ? <div className="stack"><h3>Preview</h3><div className="stack">{sample.map((row, i)=><div key={i} className="card"><strong>{row.lesson_id}</strong><p>{row.prompt}</p><p className="muted">Lösung: {row.correct_option}</p></div>)}</div></div> : null}{errors.length ? <div className="stack"><h3>Fehler</h3><ul className="muted">{errors.map((e, i)=><li key={i}>{e}</li>)}</ul></div> : null}</div>;
}
