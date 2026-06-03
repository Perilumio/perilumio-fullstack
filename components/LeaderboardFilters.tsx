'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export type PeriodKey = 'all' | '30d' | '7d' | 'today';
export type TabKey = 'xp' | 'bp' | 'streak';

export type CourseOption = { key: string; label: string };

const PERIODS: ReadonlyArray<{ key: PeriodKey; label: string }> = [
  { key: 'all', label: 'All-Time' },
  { key: '30d', label: '30 Tage' },
  { key: '7d', label: '7 Tage' },
  { key: 'today', label: 'Heute' },
];

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'xp', label: 'XP' },
  { key: 'bp', label: 'BP' },
  { key: 'streak', label: 'Streak' },
];

// Filter- und Tab-Leiste fuer das Leaderboard. State liegt in der URL-Query
// (?tab=&course=&period=), damit Ansichten teilbar und refresh-stabil sind.
// Bei den Tabs BP und Streak sind Kurs- und Zeitfilter fachlich nicht sinnvoll
// und werden deshalb deaktiviert dargestellt.
export function LeaderboardFilters({
  courses,
  tab,
  course,
  period,
}: {
  courses: ReadonlyArray<CourseOption>;
  tab: TabKey;
  course: string;
  period: PeriodKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filtersDisabled = tab !== 'xp';

  const pushQuery = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || v === 'all') params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="lb-controls stack" data-testid="leaderboard-filters">
      <div className="lb-tabs" role="tablist" aria-label="Rangliste-Ansicht">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`lb-tab${active ? ' lb-tab-active' : ''}`}
              data-testid={`lb-tab-${t.key}`}
              onClick={() => pushQuery({ tab: t.key })}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="lb-filter-row">
        <label className="lb-filter-field">
          <span className="muted lb-filter-label">Kurs</span>
          <select
            className="input lb-filter-select"
            data-testid="lb-filter-course"
            value={course}
            disabled={filtersDisabled}
            onChange={(e) => pushQuery({ course: e.target.value })}
          >
            <option value="all">Alle Kurse</option>
            {courses.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="lb-period" data-testid="lb-filter-period" role="group" aria-label="Zeitraum">
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <button
                key={p.key}
                type="button"
                className={`lb-period-pill${active ? ' lb-period-pill-active' : ''}`}
                data-testid={`lb-period-${p.key}`}
                aria-pressed={active}
                disabled={filtersDisabled}
                onClick={() => pushQuery({ period: p.key })}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtersDisabled && (
        <p className="muted lb-filter-note" data-testid="lb-filter-note">
          Kurs- und Zeitfilter gelten nur fuer die XP-Rangliste.
        </p>
      )}
    </div>
  );
}
