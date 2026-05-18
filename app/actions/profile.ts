'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AVATAR_KEY, isValidAvatarKey, validateUsername } from '@/lib/avatars';

export type SaveProfileResult = { ok: boolean; message: string };

export async function saveProfile(_prev: SaveProfileResult | null, formData: FormData): Promise<SaveProfileResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Bitte einloggen.' };

  const rawUsername = String(formData.get('username') ?? '');
  const rawAvatar = String(formData.get('avatar_key') ?? '');

  const validated = validateUsername(rawUsername);
  if (!validated.ok) return { ok: false, message: validated.error };

  const avatar_key = isValidAvatarKey(rawAvatar) ? rawAvatar : DEFAULT_AVATAR_KEY;

  const update = {
    username: validated.value,
    display_name: validated.value,
    avatar_key,
  };

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) {
    const dup = error.code === '23505' || /unique|duplicate/i.test(error.message);
    return {
      ok: false,
      message: dup ? 'Dieser Benutzername ist bereits vergeben.' : `Speichern fehlgeschlagen: ${error.message}`,
    };
  }

  revalidatePath('/profile');
  revalidatePath('/leaderboard');
  revalidatePath('/dashboard');
  revalidatePath('/friends');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profil gespeichert.' };
}
