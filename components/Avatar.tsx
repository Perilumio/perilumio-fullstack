import { avatarSrc, avatarLabel } from '@/lib/avatars';

type Size = 'sm' | 'md' | 'lg';
const SIZES: Record<Size, number> = { sm: 32, md: 56, lg: 96 };

export function Avatar({
  avatarKey,
  size = 'md',
  testId,
}: {
  avatarKey: string | null | undefined;
  size?: Size;
  testId?: string;
}) {
  const px = SIZES[size];
  return (
    <img
      src={avatarSrc(avatarKey)}
      alt={avatarLabel(avatarKey)}
      width={px}
      height={px}
      data-testid={testId}
      data-avatar-key={avatarKey ?? 'lumio'}
      style={{
        width: px,
        height: px,
        objectFit: 'cover',
        borderRadius: 16,
        border: '1px solid rgba(76,123,255,.28)',
        background: 'linear-gradient(180deg,rgba(16,25,45,.96),rgba(12,18,34,.96))',
        boxShadow: '0 0 18px rgba(55,184,255,.18)',
      }}
    />
  );
}
