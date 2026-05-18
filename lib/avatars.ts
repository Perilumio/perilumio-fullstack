export type AvatarChoice = { key: string; label: string };

export const AVATARS: ReadonlyArray<AvatarChoice> = [
  { key: 'lumio',  label: 'Lumio' },
  { key: 'sparky', label: 'Sparky' },
  { key: 'nova',   label: 'Nova' },
  { key: 'breeze', label: 'Breeze' },
  { key: 'glint',  label: 'Glint' },
  { key: 'pixel',  label: 'Pixel' },
  { key: 'orbix',  label: 'Orbix' },
  { key: 'wisp',   label: 'Wisp' },
  { key: 'zippy',  label: 'Zippy' },
  { key: 'flare',  label: 'Flare' },
  { key: 'echo',   label: 'Echo' },
  { key: 'luma',   label: 'Luma' },
  { key: 'drift',  label: 'Drift' },
  { key: 'globi',  label: 'Globi' },
  { key: 'twirl',  label: 'Twirl' },
  { key: 'blink',  label: 'Blink' },
  { key: 'cosmo',  label: 'Cosmo' },
  { key: 'ray',    label: 'Ray' },
  { key: 'nebel',  label: 'Nebel' },
  { key: 'bolt',   label: 'Bolt' },
  { key: 'pebble', label: 'Pebble' },
  { key: 'aurora', label: 'Aurora' },
  { key: 'comet',  label: 'Comet' },
  { key: 'byte',   label: 'Byte' },
];

export const DEFAULT_AVATAR_KEY = 'lumio';
const KEYS = new Set(AVATARS.map((a) => a.key));

export function isValidAvatarKey(key: unknown): key is string {
  return typeof key === 'string' && KEYS.has(key);
}

export function avatarSrc(key: string | null | undefined): string {
  const safe = key && KEYS.has(key) ? key : DEFAULT_AVATAR_KEY;
  return `/avatars/${safe}.webp`;
}

export function avatarLabel(key: string | null | undefined): string {
  const found = AVATARS.find((a) => a.key === key);
  return found ? found.label : 'Lumio';
}

export const USERNAME_REGEX = /^[A-Za-z0-9_\-\.]+$/;
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length < USERNAME_MIN) return { ok: false, error: `Mindestens ${USERNAME_MIN} Zeichen.` };
  if (trimmed.length > USERNAME_MAX) return { ok: false, error: `Höchstens ${USERNAME_MAX} Zeichen.` };
  if (!USERNAME_REGEX.test(trimmed)) return { ok: false, error: 'Nur Buchstaben, Zahlen, _ - .' };
  return { ok: true, value: trimmed };
}
