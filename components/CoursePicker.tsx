'use client';
import { useActionState } from 'react';
import { setActiveCourse, type SetActiveCourseResult } from '@/app/actions/courses';
import { COURSES } from '@/lib/courses-constants';
import type { CourseKey } from '@/lib/courses-constants';

const initial: SetActiveCourseResult = { ok: false, message: '' };

export function CoursePicker({ activeCourseKey }: { activeCourseKey: CourseKey }) {
  const [state, formAction, pending] = useActionState(setActiveCourse, initial);
  const current = state.activeCourseKey ?? activeCourseKey;

  return (
    <div className="stack" data-testid="course-picker">
      <div className="grid grid-2">
        {COURSES.map((c) => {
          const isActive = c.key === current;
          return (
            <form action={formAction} key={c.key} className="card stack course-card" data-testid={`course-card-${c.key}`} data-active={isActive ? 'true' : 'false'}>
              <input type="hidden" name="course_key" value={c.key} />
              <div className="hero">
                <div>
                  <span className="pill">{isActive ? 'Aktiv' : 'Kurs'}</span>
                  <h2 data-testid={`course-title-${c.key}`}>{c.label}</h2>
                  <p className="muted">{c.description}</p>
                </div>
              </div>
              <button
                className={isActive ? 'btn' : 'btn btn-primary'}
                type="submit"
                disabled={pending || isActive}
                data-testid={`course-activate-${c.key}`}
              >
                {isActive ? 'Aktueller Kurs' : pending ? 'Speichern…' : 'Als aktiv setzen'}
              </button>
            </form>
          );
        })}
      </div>
      {state.message ? (
        <p className={state.ok ? 'muted' : 'field-error'} data-testid="course-picker-message">{state.message}</p>
      ) : null}
    </div>
  );
}
