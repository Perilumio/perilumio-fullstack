import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { AdminGate } from '@/components/AdminGate';
import { AdminAccountsTable, type AccountRow } from '@/components/AdminAccountsTable';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { courseLabel } from '@/lib/courses-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  role: string | null;
  active_course_key: string | null;
  xp: number | null;
  battle_points: number | null;
  current_streak: number | null;
};

type LessonProgressRow = { user_id: string; passed: boolean };

async function listAllAuthUsers() {
  // Auth-Admin-Listing ist seitenbasiert (max. 1000/Seite). Bis 5000 Konten lesen.
  const all: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null }[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users) {
      all.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (users.length < 1000) break;
  }
  return all;
}

export default async function AdminAccountsPage() {
  const access = await requireAdmin();
  if (!access.ok) {
    return <AppShell><section className="stack"><AdminGate /></section></AppShell>;
  }

  const [authUsers, profilesRes, progressRes] = await Promise.all([
    listAllAuthUsers(),
    supabaseAdmin
      .from('profiles')
      .select('id,username,display_name,role,active_course_key,xp,battle_points,current_streak'),
    supabaseAdmin.from('lesson_progress').select('user_id,passed'),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const progress = (progressRes.data ?? []) as LessonProgressRow[];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const passedByUser = new Map<string, number>();
  for (const p of progress) {
    if (!p.passed) continue;
    passedByUser.set(p.user_id, (passedByUser.get(p.user_id) ?? 0) + 1);
  }

  const rows: AccountRow[] = authUsers
    .map((u) => {
      const prof = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email,
        username: prof?.username ?? null,
        display_name: prof?.display_name ?? null,
        role: prof?.role ?? 'student',
        active_course_label: courseLabel(prof?.active_course_key ?? null),
        xp: prof?.xp ?? 0,
        battle_points: prof?.battle_points ?? 0,
        current_streak: prof?.current_streak ?? 0,
        lessons_passed: passedByUser.get(u.id) ?? 0,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      } satisfies AccountRow;
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  const currentUserId = access.user!.id;

  return (
    <AppShell>
      <section className="stack">
        <div className="card hero">
          <div>
            <span className="pill">Admin</span>
            <h1>Konten-Übersicht</h1>
            <p className="muted">
              {rows.length} Konten · Löschungen sind <strong>unwiderruflich</strong>.
            </p>
          </div>
        </div>
        <div>
          <Link href="/admin" className="btn">← Zurück zum Admin</Link>
        </div>
        <AdminAccountsTable rows={rows} currentUserId={currentUserId} />
      </section>
    </AppShell>
  );
}
