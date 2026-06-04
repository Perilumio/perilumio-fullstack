'use client';
import { useEffect, useState } from 'react';

// Streak-Pill: zeigt aktuelle Tagesfolge mit Flammen-Icon. Wenn der Wert
// während einer Session (über LearnClient → onStreakUpdate) steigt, wird die
// Pill kurz hervorgehoben, damit der User den Anstieg sieht. Wir akzeptieren
// die initialen Werte vom Server (SSR), erlauben aber Live-Updates über die
// optionale onMount-Callback-Variante.

export function StreakBadge({
  current,
  longest,
  pulse = false,
}: {
  current: number;
  longest: number;
  pulse?: boolean;
}) {
  const [highlight, setHighlight] = useState(false);
  useEffect(() => {
    if (!pulse) return;
    setHighlight(true);
    const t = setTimeout(() => setHighlight(false), 1500);
    return () => clearTimeout(t);
  }, [pulse, current]);

  const label = current === 0
    ? 'Heute starten'
    : current === 1
      ? '1 Tag'
      : `${current} Tage`;

  return (
    <span
      className={`pill streak-pill${highlight ? ' streak-pill-pulse' : ''}`}
      data-testid="learn-streak-pill"
      data-streak-current={current}
      data-streak-longest={longest}
      title={longest > current ? `Längste Serie: ${longest} Tage` : undefined}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.5c1.6 2.7 1.2 4.6-.3 6.1-1.3 1.3-2.7 2.6-2.7 4.7a3 3 0 1 0 5.7 1.3c.8.9 1.3 2 1.3 3.2A6 6 0 1 1 7.5 13c0-3.1 2-5 3.2-6.6 1-1.4 1.5-2.7 1.3-3.9Z"
          fill="currentColor"
        />
      </svg>
      {label}
    </span>
  );
}
