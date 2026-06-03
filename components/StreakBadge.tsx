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
      data-testid="streak-badge"
      data-streak-current={current}
      data-streak-longest={longest}
      title={longest > current ? `Längste Serie: ${longest} Tage` : undefined}
    >
      <span aria-hidden="true" style={{ marginRight: 4 }}>🔥</span>
      {label}
    </span>
  );
}
