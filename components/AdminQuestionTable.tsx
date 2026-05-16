'use client';
import { useMemo, useState, useTransition } from 'react';
import { bulkDeleteQuestions, deleteQuestion, updateQuestion } from '@/app/actions/question-admin';
export function AdminQuestionTable({ questions }: { questions: any[] }){
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => questions.filter(q => {
    const qMatch = !query || q.prompt?.toLowerCase().includes(query.toLowerCase()) || q.explanation?.toLowerCase().includes(query.toLowerCase());
    const fMatch = filter === 'ALL' || q.correct_option === filter;
    return qMatch && fMatch;
  }), [questions, query, filter]);
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  return <div className="card stack"><span className="pill">Fragenpool</span><h2>ABU-Fragen verwalten</h2><div className="cluster"><input placeholder="Suche nach Frage oder Erklärung" value={query} onChange={e=>setQuery(e.target.value)} /><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">Alle Lösungen</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select><form action={(fd)=>startTransition(async()=>{ fd.set('ids', selected.join(',')); const r = await bulkDeleteQuestions(fd); setMessage(r.message); setSelected([]); })}><button className="btn" type="submit" disabled={pending || !selected.length}>Auswahl löschen</button></form></div><p className="muted">{filtered.length} Treffer · {selected.length} ausgewählt</p><div className="stack">{filtered.length ? filtered.map((q)=> <form key={q.id} className="card stack" action={(fd)=>startTransition(async()=>{ const r = await updateQuestion(fd); setMessage(r.message); })}><div className="cluster"><label><input type="checkbox" checked={selected.includes(q.id)} onChange={()=>toggle(q.id)} /> auswählen</label><span className="pill">{q.correct_option}</span></div><input type="hidden" name="id" value={q.id} /><label className="stack"><span>Frage</span><textarea name="prompt" defaultValue={q.prompt} rows={3} /></label><label className="stack"><span>Erklärung</span><textarea name="explanation" defaultValue={q.explanation} rows={2} /></label><label className="stack"><span>Richtige Option</span><select name="correct_option" defaultValue={q.correct_option}><option>A</option><option>B</option><option>C</option><option>D</option></select></label><div className="cluster"><button className="btn btn-primary" type="submit" disabled={pending}>Speichern</button><button className="btn" formAction={(fd)=>startTransition(async()=>{ const r = await deleteQuestion(fd); setMessage(r.message); })} type="submit" disabled={pending}>Löschen</button></div></form>) : <p className="muted">Keine passenden Fragen gefunden.</p>}</div>{message ? <p className="muted">{message}</p> : null}</div>;
}
