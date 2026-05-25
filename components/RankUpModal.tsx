'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Props = {
  oldRank: number;
  newRank: number;
  bonusXp?: number;
  onClose: () => void;
};

// Eases a count-up from the old rank toward the new (lower number = better).
// Honours prefers-reduced-motion by snapping to the final value.
function useRankCountdown(from: number, to: number, durationMs = 1100): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (from === to) {
      setValue(to);
      return;
    }
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, durationMs]);
  return value;
}

export function RankUpModal({ oldRank, newRank, bonusXp, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const animated = useRankCountdown(oldRank, newRank);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const delta = oldRank - newRank;

  return (
    <div
      className="rankup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rankup-title"
      data-testid="rankup-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rankup-card" ref={dialogRef}>
        <span className="pill rankup-pill">Aufstieg in der Rangliste</span>
        <h2 id="rankup-title" className="rankup-title">Glückwunsch!</h2>
        <p className="muted rankup-sub">
          {delta === 1
            ? 'Du bist einen Platz nach oben geklettert.'
            : `Du bist ${delta} Plätze nach oben geklettert.`}
        </p>
        <div className="rankup-ranks" aria-live="polite">
          <div className="rankup-rank rankup-rank-old" data-testid="rankup-old-rank">
            <span className="muted rankup-rank-label">Vorher</span>
            <span className="rankup-rank-value">#{oldRank}</span>
          </div>
          <div className="rankup-arrow" aria-hidden="true">→</div>
          <div className="rankup-rank rankup-rank-new" data-testid="rankup-new-rank">
            <span className="muted rankup-rank-label">Jetzt</span>
            <span className="rankup-rank-value">#{animated}</span>
          </div>
        </div>
        {bonusXp ? (
          <p className="rankup-xp" data-testid="rankup-xp">+{bonusXp} XP gutgeschrieben</p>
        ) : null}
        <div className="rankup-actions">
          <Link
            href="/leaderboard"
            className="btn"
            data-testid="rankup-leaderboard-link"
          >
            Rangliste
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            ref={closeBtnRef}
            data-testid="rankup-next-button"
          >
            Nächste Sequenz
          </button>
        </div>
      </div>
    </div>
  );
}
