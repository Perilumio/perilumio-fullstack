import { createClient } from '@/lib/supabase/server';

export async function getCurrentProfile(){
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return { user: null, profile: null, confirmed: false };
  const confirmed = !!(
    (user as any).email_confirmed_at ||
    (user as any).confirmed_at
  );
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { user, profile, confirmed };
}

export async function requireAdmin(){
  const { user, profile, confirmed } = await getCurrentProfile();
  if(!user || !confirmed || profile?.role !== 'admin') return { ok: false, user, profile };
  return { ok: true, user, profile };
}
