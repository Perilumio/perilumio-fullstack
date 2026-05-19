export type AvatarChoice = { key: string; label: string; file: string };

// Stable avatar keys (persisted in profiles.avatar_key) mapped to the current
// avatar image set under /public/avatars/. Each image is a 240x216 illustration
// with its own card frame + name pill baked in; the renderer keeps the full
// frame visible via object-fit:contain.
export const AVATARS: ReadonlyArray<AvatarChoice> = [
  { key: 'lumio',  label: 'Lumio',  file: 'Bild1.png'  },
  { key: 'sparky', label: 'Sparky', file: 'Bild2.png'  },
  { key: 'nova',   label: 'Nova',   file: 'Bild3.png'  },
  { key: 'breeze', label: 'Breeze', file: 'Bild4.png'  },
  { key: 'glint',  label: 'Glint',  file: 'Bild5.png'  },
  { key: 'pixel',  label: 'Pixel',  file: 'Bild6.png'  },
  { key: 'orbix',  label: 'Orbix',  file: 'Bild7.png'  },
  { key: 'wisp',   label: 'Wisp',   file: 'Bild8.png'  },
  { key: 'zippy',  label: 'Zippy',  file: 'Bild10.png' },
  { key: 'flare',  label: 'Flare',  file: 'Bild11.png' },
  { key: 'echo',   label: 'Echo',   file: 'Bild13.png' },
  { key: 'luma',   label: 'Luma',   file: 'Bild14.png' },
  { key: 'drift',  label: 'Drift',  file: 'Bild15.png' },
  { key: 'globi',  label: 'Globi',  file: 'Bild16.png' },
  { key: 'twirl',  label: 'Twirl',  file: 'Bild17.png' },
  { key: 'blink',  label: 'Blink',  file: 'Bild18.png' },
  { key: 'cosmo',  label: 'Cosmo',  file: 'Cosmo.png'  },
  { key: 'ray',    label: 'Ray',    file: 'Ray.png'    },
  { key: 'nebel',  label: 'Nebel',  file: 'Nebel.png'  },
  { key: 'bolt',   label: 'Bolt',   file: 'Bolt.png'   },
  { key: 'pebble', label: 'Pebble', file: 'Pebble.png' },
  { key: 'aurora', label: 'Aurora', file: 'Aurora.png' },
  { key: 'comet',  label: 'Comet',  file: 'Comet.png'  },
  { key: 'byte',   label: 'Byte',   file: 'Byte.png'   },
];

export const DEFAULT_AVATAR_KEY = 'lumio';
const BY_KEY = new Map(AVATARS.map((a) => [a.key, a] as const));

export function isValidAvatarKey(key: unknown): key is string {
  return typeof key === 'string' && BY_KEY.has(key);
}

export function avatarSrc(key: string | null | undefined): string {
  const entry = (key && BY_KEY.get(key)) || BY_KEY.get(DEFAULT_AVATAR_KEY)!;
  return `/avatars/${entry.file}`;
}

export function avatarLabel(key: string | null | undefined): string {
  const entry = key ? BY_KEY.get(key) : undefined;
  return entry ? entry.label : 'Lumio';
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
