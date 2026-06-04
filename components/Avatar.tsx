'use client';

import { useState } from 'react';
import { avatarSrc, avatarLabel, isValidAvatarKey } from '@/lib/avatars';

type Size = 'sm' | 'md' | 'lg';
// Source images are 240x216 (10:9) and already include their own card frame,
// dark gradient background, and a baked-in name pill. Render them as-is with
// object-fit:contain so the full illustration plus name pill stay visible — no
// extra border, background, or border-radius that would clip the image's own
// rounded corners or pill.
const SIZES: Record<Size, number> = { sm: 56, md: 96, lg: 160 };
const AR = 240 / 216;

// Erstes sichtbares Zeichen fuer das Initial-Badge bestimmen. Bevorzugt den
// Username, faellt sonst auf das Avatar-Label zurueck.
function initialOf(fallbackLabel: string | null | undefined, avatarKey: string | null | undefined): string {
  const source = (fallbackLabel && fallbackLabel.trim()) || avatarLabel(avatarKey);
  const first = source.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

export function Avatar({
  avatarKey,
  size = 'md',
  testId,
  fallbackLabel,
}: {
  avatarKey: string | null | undefined;
  size?: Size;
  testId?: string;
  fallbackLabel?: string | null;
}) {
  const w = SIZES[size];
  const h = Math.round(w / AR);

  // Unbekannte Keys haben kein eigenes Bild. avatarSrc() liefert dann zwar das
  // Lumio-Default, wir zeigen aber lieber sofort das neutrale Initial-Badge, und
  // wechseln auch dann darauf, wenn ein an sich gueltiges Bild nicht laedt
  // (404, CDN-Fehler, defekte Datei).
  const [failed, setFailed] = useState(false);
  const showFallback = failed || !isValidAvatarKey(avatarKey);

  if (showFallback) {
    return (
      <div
        data-testid={testId}
        data-avatar-key={avatarKey ?? 'lumio'}
        data-avatar-fallback="true"
        aria-label={fallbackLabel?.trim() || avatarLabel(avatarKey)}
        style={{
          width: w,
          height: h,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: Math.round(w * 0.22),
          background: 'linear-gradient(180deg,rgba(54,187,255,.28),rgba(31,83,255,.18))',
          border: '1px solid rgba(54,187,255,.4)',
          boxShadow: '0 0 16px rgba(55,184,255,.25)',
          color: '#eef6ff',
          fontWeight: 700,
          fontSize: Math.round(h * 0.42),
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {initialOf(fallbackLabel, avatarKey)}
      </div>
    );
  }

  return (
    <img
      src={avatarSrc(avatarKey)}
      alt={avatarLabel(avatarKey)}
      width={w}
      height={h}
      data-testid={testId}
      data-avatar-key={avatarKey ?? 'lumio'}
      onError={() => setFailed(true)}
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
