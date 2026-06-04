'use client';
import { useState } from 'react';
import { LearnClient } from '@/components/LearnClient';
import { StreakBadge } from '@/components/StreakBadge';

// Dünner Client-Wrapper um LearnClient, der den Streak-State auf der Seite
// hält und live aktualisiert, wenn /api/lesson-answer einen neuen Wert
// zurückliefert. Die Streak-Pill wird im Hero in der rechten Spalte
// angezeigt — so sieht der User seine Tagesfolge schon vor dem Start.

export function LearnPageClient({
  initialStreak,
  initialLongest,
  courseLabel,
  ...rest
}: React.ComponentProps<typeof LearnClient> & {
  initialStreak: number;
  initialLongest: number;
  courseLabel: string;
}) {
  const [streak, setStreak] = useState({
    current: initialStreak,
    longest: initialLongest,
    pulse: false,
  });

  return (
    <>
      <div className="card hero" data-testid="learn-hero">
        <div>
          <span className="pill" data-testid="learn-course-indicator">Kurs: {courseLabel}</span>
          <h1>Lernpfad</h1>
          <p className="muted">Schritt für Schritt durch den aktiven Kurs.</p>
          <div className="learn-hero-meta" data-testid="learn-hero-meta">
            <StreakBadge current={streak.current} longest={streak.longest} pulse={streak.pulse} />
          </div>
        </div>
      </div>
      <LearnClient
        {...rest}
        onStreakUpdate={(s) =>
          setStreak((prev) => ({
            current: s.current,
            longest: s.longest,
            // Pulse nur dann, wenn sich der current-Wert geändert hat. So
            // "blinkt" die Pill nur beim echten Anstieg, nicht bei jedem
            // korrekten Treffer am selben Tag.
            pulse: s.increased && s.current !== prev.current,
          }))
        }
      />
    </>
  );
}
