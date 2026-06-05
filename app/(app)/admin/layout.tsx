import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await requireAdmin();
  if (!access.ok) redirect('/learn');
  return <>{children}</>;
}
