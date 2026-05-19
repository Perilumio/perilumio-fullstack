'use client';
import { useEffect, useRef, useState } from 'react';

export type AnswerFeedbackKind = 'correct' | 'wrong';

type Trigger = { id: number; kind: AnswerFeedbackKind } | null;

const SPARK_COUNT = 18;
const EFFECT_MS = 900;

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
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.32);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
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
    if (trigger.kind === 'wrong') playBuzzer();
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
        <div className="answer-fx-burst">
          {Array.from({ length: SPARK_COUNT }).map((_, i) => (
            <span
              key={`${active.id}-${i}`}
              className="answer-fx-spark"
              style={{ ['--a' as any]: `${(360 / SPARK_COUNT) * i}deg` }}
            />
          ))}
          <span className="answer-fx-core" />
        </div>
      </div>
    );
  }

  return (
    <div className="answer-fx answer-fx-wrong" aria-hidden="true" role="presentation">
      <div className="answer-fx-flash" />
    </div>
  );
}
