import { createClient } from '@/lib/supabase/server';
export async function getCurrentProfile(){
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { user, profile };
}
export async function requireAdmin(){
  const { user, profile } = await getCurrentProfile();
  if(!user || profile?.role !== 'admin') return { ok: false, user, profile };
  return { ok: true, user, profile };
}
