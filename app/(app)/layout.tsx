import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const confirmed = !!(
    (user as any).email_confirmed_at ||
    (user as any).confirmed_at
  );
  if (!confirmed) {
    const emailParam = user.email ? `?email=${encodeURIComponent(user.email)}` : '';
    redirect(`/auth/confirm${emailParam}`);
  }
  return <>{children}</>;
}
