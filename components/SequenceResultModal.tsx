'use client';
import { useEffect, useMemo, useRef } from 'react';

type Props = {
  passed: boolean;
  percent: number;
  correct: number;
  total: number;
  onContinue: () => void;
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function getAudioContext(): AudioContext | null {
  try {
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Triumphant fanfare: layered triad with a sparkle tail. Mirrors the
// "celebrate" feel of the per-question success cue but longer and richer so it
// reads as a sequence-level win.
function playVictory() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.34, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
    master.connect(ctx.destination);

    const notes: Array<[number, number, number]> = [
      [523.25, 0.0, 0.35],
      [659.25, 0.1, 0.35],
      [783.99, 0.2, 0.35],
      [1046.5, 0.32, 0.55],
      [1318.51, 0.55, 0.6],
      [1567.98, 0.78, 0.7],
    ];
    for (const [freq, delay, dur] of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.exponentialRampToValueAtTime(0.45, now + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.05);
    }

    // Shimmer sparkle that rises a fifth across ~600ms.
    const shimmer = ctx.createOscillator();
    const sg = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1760, now + 0.85);
    shimmer.frequency.exponentialRampToValueAtTime(2637, now + 1.45);
    sg.gain.setValueAtTime(0.0001, now + 0.85);
    sg.gain.exponentialRampToValueAtTime(0.18, now + 0.9);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
    shimmer.connect(sg);
    sg.connect(master);
    shimmer.start(now + 0.85);
    shimmer.stop(now + 1.6);

    setTimeout(() => {
      try { if (ctx.state !== 'closed') ctx.close(); } catch {}
    }, 2000);
  } catch {}
}

// Descending sad trombone: two-step minor fall with a soft tail.
function playSad() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    master.connect(ctx.destination);

    const steps: Array<[number, number, number, number]> = [
      [392.0, 311.13, 0.0, 0.35],
      [349.23, 261.63, 0.4, 0.4],
      [293.66, 196.0, 0.85, 0.55],
    ];
    for (const [fromFreq, toFreq, delay, dur] of steps) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(fromFreq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(toFreq, now + delay + dur);
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.exponentialRampToValueAtTime(0.32, now + delay + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur + 0.05);
      osc.connect(g);
      g.connect(master);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.1);
    }

    setTimeout(() => {
      try { if (ctx.state !== 'closed') ctx.close(); } catch {}
    }, 1700);
  } catch {}
}

const CONFETTI_COUNT = 80;
const CONFETTI_COLORS = ['#ffd84d', '#7ef4b4', '#55c6ff', '#ff7ad9', '#b08bff', '#ff9b5b'];

type ConfettiPiece = {
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  rotate: number;
  color: string;
};

function buildConfetti(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i += 1) {
    pieces.push({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 1.6,
      size: 6 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 60,
      rotate: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    });
  }
  return pieces;
}

export function SequenceResultModal({ passed, percent, correct, total, onContinue }: Props) {
  const continueBtnRef = useRef<HTMLButtonElement>(null);
  const playedRef = useRef(false);

  const confetti = useMemo(
    () => (passed && !prefersReducedMotion() ? buildConfetti(CONFETTI_COUNT) : []),
    [passed],
  );

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    if (passed) playVictory();
    else playSad();
  }, [passed]);

  useEffect(() => {
    continueBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onContinue();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onContinue]);

  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div
      className={`seqresult-overlay ${passed ? 'seqresult-pass' : 'seqresult-fail'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seqresult-title"
      data-testid="sequence-result-modal"
      data-result={passed ? 'pass' : 'fail'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onContinue();
      }}
    >
      {passed && confetti.length > 0 ? (
        <div className="seqresult-confetti" aria-hidden="true">
          {confetti.map((p, i) => (
            <span
              key={i}
              className="seqresult-confetti-piece"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size * 0.4}px`,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                ['--drift' as any]: `${p.drift}px`,
                ['--rot' as any]: `${p.rotate}deg`,
              }}
            />
          ))}
        </div>
      ) : null}
      <div className="seqresult-card">
        <h2 id="seqresult-title" className="seqresult-title" data-testid="sequence-result-title">
          {passed ? 'BESTANDEN!!!' : `${safePercent}% richtig!`}
        </h2>
        {passed ? (
          <>
            <p className="seqresult-line" data-testid="sequence-result-percent">
              Du hast {safePercent}% richtig!
            </p>
            <p className="seqresult-line">Gratulation.</p>
          </>
        ) : (
          <>
            <p className="seqresult-line">Das hat leider nicht gereicht.</p>
            <p className="seqresult-line">Versuch es nochmal.</p>
          </>
        )}
        <p className="seqresult-detail muted">
          {correct} von {total} richtig
        </p>
        <div className="seqresult-actions">
          <button
            type="button"
            className="btn btn-primary seqresult-continue"
            onClick={onContinue}
            ref={continueBtnRef}
            data-testid="sequence-result-continue"
          >
            Weiter
          </button>
        </div>
      </div>
    </div>
  );
}
