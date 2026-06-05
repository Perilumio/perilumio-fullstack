'use client';
import { useActionState, useMemo, useState } from 'react';
import { setActiveCourse, type SetActiveCourseResult } from '@/app/actions/courses';
import { COURSES } from '@/lib/courses-constants';
import type { CourseKey } from '@/lib/courses-constants';

const initial: SetActiveCourseResult = { ok: false, message: '' };

function normalize(value: string): string {
  return value.toLocaleLowerCase('de').normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export function CoursePicker({ activeCourseKey }: { activeCourseKey: CourseKey }) {
  const [state, formAction, pending] = useActionState(setActiveCourse, initial);
  const [query, setQuery] = useState('');
  const current = state.activeCourseKey ?? activeCourseKey;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return COURSES;
    return COURSES.filter((c) => normalize(c.label).includes(q) || normalize(c.description).includes(q));
  }, [query]);

  return (
    <div className="stack" data-testid="course-picker">
      <label className="course-search">
        <span className="visually-hidden">Kurs suchen</span>
        <input
          type="search"
          className="input"
          placeholder="Beruf suchen…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="course-search-input"
          autoComplete="off"
        />
      </label>
      <ul className="course-list" data-testid="course-list">
        {filtered.map((c) => {
          const isActive = c.key === current;
          if (c.comingSoon) {
            return (
              <li key={c.key}>
                <div
                  className="course-row course-row-soon"
                  data-testid={`course-card-${c.key}`}
                  data-active="false"
                  data-coming-soon="true"
                  aria-disabled="true"
                >
                  <div className="course-row-info">
                    <div className="course-row-title" data-testid={`course-title-${c.key}`}>{c.label}</div>
                    <div className="course-row-sub muted">{c.description}</div>
                  </div>
                  <span className="pill course-row-pill" data-testid={`course-soon-badge-${c.key}`}>Coming Soon</span>
                </div>
              </li>
            );
          }
          return (
            <li key={c.key}>
              <form
                action={formAction}
                className="course-row"
                data-testid={`course-card-${c.key}`}
                data-active={isActive ? 'true' : 'false'}
              >
                <input type="hidden" name="course_key" value={c.key} />
                <div className="course-row-info">
                  <div className="course-row-title" data-testid={`course-title-${c.key}`}>{c.label}</div>
                  <div className="course-row-sub muted">{c.description}</div>
                </div>
                {isActive ? (
                  <span className="pill course-row-pill" aria-label="Aktiver Kurs">Aktiv</span>
                ) : (
                  <button
                    className="btn btn-primary course-row-btn"
                    type="submit"
                    disabled={pending}
                    data-testid={`course-activate-${c.key}`}
                  >
                    {pending ? '…' : 'Aktivieren'}
                  </button>
                )}
              </form>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="course-empty muted" data-testid="course-empty">Keine Kurse gefunden.</li>
        ) : null}
      </ul>
      {state.message ? (
        <p className={state.ok ? 'muted' : 'field-error'} data-testid="course-picker-message">{state.message}</p>
      ) : null}
    </div>
  );
}
