'use client';
import { useEffect, useRef, useState } from 'react';
import { successHaptic, errorHaptic } from '@/lib/haptics';

export type AnswerFeedbackKind = 'correct' | 'wrong';

type Trigger = { id: number; kind: AnswerFeedbackKind } | null;

const SPARK_COUNT = 40;
const RING_SPARK_COUNT = 20;
const TRAIL_SPARK_COUNT = 16;
const EFFECT_MS = 1200;

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function vibrate(pattern: number | number[]) {
  try {
    if (prefersReducedMotion()) return;
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav || typeof nav.vibrate !== 'function') return;
    nav.vibrate(pattern);
  } catch {}
}

function getAudioContext(): AudioContext | null {
  try {
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
}

function playSuccess() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.32, now + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    master.connect(ctx.destination);

    // Bright ascending arpeggio: C5 -> E5 -> G5 -> C6
    const notes: Array<[number, number]> = [
      [523.25, 0.0],
      [659.25, 0.09],
      [783.99, 0.18],
      [1046.5, 0.27],
    ];
    for (const [freq, delay] of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.exponentialRampToValueAtTime(0.5, now + delay + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);
      osc.connect(g);
      g.connect(master);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    }

    // Soft sine sparkle on top
    const shimmer = ctx.createOscillator();
    const sg = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1568, now + 0.25);
    shimmer.frequency.exponentialRampToValueAtTime(2093, now + 0.55);
    sg.gain.setValueAtTime(0.0001, now + 0.25);
    sg.gain.exponentialRampToValueAtTime(0.18, now + 0.28);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    shimmer.connect(sg);
    sg.connect(master);
    shimmer.start(now + 0.25);
    shimmer.stop(now + 0.75);

    const stopAt = now + 1.0;
    shimmer.onended = () => {
      try { ctx.close(); } catch {}
    };
    // Safety close
    setTimeout(() => {
      try { if (ctx.state !== 'closed') ctx.close(); } catch {}
    }, Math.max(1100, (stopAt - now) * 1000 + 200));
  } catch {}
}

function playBuzzer() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.38);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);
    osc.onended = () => {
      try { ctx.close(); } catch {}
    };
  } catch {}
}

export function AnswerFeedback({ trigger }: { trigger: Trigger }) {
  const [active, setActive] = useState<Trigger>(null);
  const timerRef = useRef<number | null>(null);
  // Trigger ids that have already been played. Survives remounts (e.g.
  // overview ↔ question view) so a stale parent state can't replay the
  // buzzer/success cue when the question view re-renders.
  const lastPlayedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) return;
    if (lastPlayedIdRef.current === trigger.id) return;
    lastPlayedIdRef.current = trigger.id;
    setActive(trigger);
    if (trigger.kind === 'wrong') {
      playBuzzer();
      vibrate([35, 60, 90]);
      void errorHaptic();
    } else {
      playSuccess();
      vibrate([20, 40, 25, 40, 60]);
      void successHaptic();
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setActive(null);
      timerRef.current = null;
    }, EFFECT_MS);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [trigger]);

  if (!active) return null;

  if (active.kind === 'correct') {
    return (
      <div className="answer-fx answer-fx-correct" aria-hidden="true" role="presentation">
        <div className="answer-fx-glow" />
        <div className="answer-fx-burst">
          {Array.from({ length: SPARK_COUNT }).map((_, i) => (
            <span
              key={`s-${active.id}-${i}`}
              className="answer-fx-spark"
              style={{ ['--a' as any]: `${(360 / SPARK_COUNT) * i}deg` }}
            />
          ))}
          {Array.from({ length: RING_SPARK_COUNT }).map((_, i) => (
            <span
              key={`r-${active.id}-${i}`}
              className="answer-fx-spark answer-fx-spark-ring"
              style={{ ['--a' as any]: `${(360 / RING_SPARK_COUNT) * i + 9}deg` }}
            />
          ))}
          {Array.from({ length: TRAIL_SPARK_COUNT }).map((_, i) => (
            <span
              key={`t-${active.id}-${i}`}
              className="answer-fx-spark answer-fx-spark-trail"
              style={{ ['--a' as any]: `${(360 / TRAIL_SPARK_COUNT) * i + 4}deg` }}
            />
          ))}
          <span className="answer-fx-core" />
          <span className="answer-fx-ring" />
          <span className="answer-fx-ring answer-fx-ring-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="answer-fx answer-fx-wrong" aria-hidden="true" role="presentation">
      <div className="answer-fx-flash" />
      <div className="answer-fx-vignette" />
    </div>
  );
}
