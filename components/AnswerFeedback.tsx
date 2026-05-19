'use client';
import { useEffect, useRef, useState } from 'react';

export type AnswerFeedbackKind = 'correct' | 'wrong';

type Trigger = { id: number; kind: AnswerFeedbackKind } | null;

const SPARK_COUNT = 28;
const RING_SPARK_COUNT = 14;
const EFFECT_MS = 1000;

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

function playBuzzer() {
  try {
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
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

  useEffect(() => {
    if (!trigger) return;
    setActive(trigger);
    if (trigger.kind === 'wrong') {
      playBuzzer();
      vibrate([35, 60, 90]);
    } else {
      vibrate(45);
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
              style={{ ['--a' as any]: `${(360 / RING_SPARK_COUNT) * i + 12}deg` }}
            />
          ))}
          <span className="answer-fx-core" />
          <span className="answer-fx-ring" />
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
