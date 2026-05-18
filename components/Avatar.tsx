import { avatarSrc, avatarLabel } from '@/lib/avatars';

type Size = 'sm' | 'md' | 'lg';
// Source images are 240x216 (10:9). Container width drives the size; height
// follows the natural aspect so the baked-in name pill stays visible.
const SIZES: Record<Size, number> = { sm: 40, md: 72, lg: 120 };
const AR = 240 / 216;

export function Avatar({
  avatarKey,
  size = 'md',
  testId,
}: {
  avatarKey: string | null | undefined;
  size?: Size;
  testId?: string;
}) {
  const w = SIZES[size];
  const h = Math.round(w / AR);
  return (
    <img
      src={avatarSrc(avatarKey)}
      alt={avatarLabel(avatarKey)}
      width={w}
      height={h}
      data-testid={testId}
      data-avatar-key={avatarKey ?? 'lumio'}
      style={{
        width: w,
        height: h,
        objectFit: 'contain',
        objectPosition: 'center',
        borderRadius: 16,
        border: '1px solid rgba(76,123,255,.28)',
        background: 'linear-gradient(180deg,rgba(16,25,45,.96),rgba(12,18,34,.96))',
        boxShadow: '0 0 18px rgba(55,184,255,.18)',
        display: 'block',
      }}
    />
  );
}
