import { avatarSrc, avatarLabel } from '@/lib/avatars';

type Size = 'sm' | 'md' | 'lg';
// Source images are 240x216 (10:9) and already include their own card frame,
// dark gradient background, and a baked-in name pill. Render them as-is with
// object-fit:contain so the full illustration plus name pill stay visible — no
// extra border, background, or border-radius that would clip the image's own
// rounded corners or pill.
const SIZES: Record<Size, number> = { sm: 56, md: 96, lg: 160 };
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
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}
