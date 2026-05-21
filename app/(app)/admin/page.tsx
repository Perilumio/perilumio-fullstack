import Link from 'next/link';
import { AppShell, Lumio } from '@/components/AppShell';
import { AdminImportCard } from '@/components/AdminImportCard';
import { AdminQuestionTable } from '@/components/AdminQuestionTable';
import { AdminImportHistory } from '@/components/AdminImportHistory';
import { AdminGate } from '@/components/AdminGate';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
export default async function AdminPage(){
  const access = await requireAdmin();
  if(!access.ok){ return <AppShell><section className="stack"><AdminGate /></section></AppShell>; }
  const supabase = await createClient();
  const { data: questions } = await supabase.from('questions').select('id,prompt,explanation,correct_option').limit(50);
  const logsResult = await supabase.from('import_logs').select('*').order('created_at', { ascending:false }).limit(10);
  return <AppShell><section className="stack"><div className="card hero"><div><span className="pill">Admin</span><h1>Content- und Kursverwaltung</h1><p className="muted">Zugriff nur mit Admin-Rolle.</p></div><Lumio /></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link href="/admin/analytics" className="btn btn-primary">Analytics öffnen</Link><Link href="/admin/accounts" className="btn">Konten verwalten</Link></div><div className="grid grid-2"><AdminImportCard /><AdminImportHistory logs={logsResult.data ?? []} /></div><AdminQuestionTable questions={questions ?? []} /></section></AppShell>;
}
