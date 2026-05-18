'use client';
import { useEffect, useMemo, useState } from 'react';
import { Lumio } from '@/components/AppShell';

type Lesson = { id: string; title: string; position: number; pass_score: number };
type Question = {
  id: string;
  lesson_id: string;
  prompt: string;
  explanation: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
};
type Progress = {
  lesson_id: string;
  best_score: number;
  passed: boolean;
  last_question_index: number;
};

function pickInitialLessonIndex(lessons: Lesson[], progress: Progress[]): number {
  if (lessons.length === 0) return 0;
  const byId = new Map(progress.map((p) => [p.lesson_id, p]));
  const firstUnfinished = lessons.findIndex((l) => {
    const p = byId.get(l.id);
    return !p || !p.passed;
  });
  return firstUnfinished === -1 ? 0 : firstUnfinished;
}

export function LearnClient({
  lessons,
  questions,
  progress,
  courseName = 'Kurs',
}: {
  lessons: Lesson[];
  questions: Question[];
  progress: Progress[];
  courseName?: string;
}) {
  const progressMap = useMemo(() => {
    const m = new Map<string, Progress>();
    for (const p of progress) m.set(p.lesson_id, p);
    return m;
  }, [progress]);

  const initialLessonIndex = useMemo(
    () => pickInitialLessonIndex(lessons, progress),
    [lessons, progress],
  );

  const [lessonIndex, setLessonIndex] = useState(initialLessonIndex);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [message, setMessage] = useState('');
  const [xpFeedback, setXpFeedback] = useState<{ awarded: number; alreadyAwarded: boolean } | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    () => new Set(progress.filter((p) => p.passed).map((p) => p.lesson_id)),
  );
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);

  const lesson = lessons[lessonIndex];
  const lessonQuestions = useMemo(
    () => questions.filter((q) => q.lesson_id === lesson?.id),
    [questions, lesson],
  );

  useEffect(() => {
    if (!lesson) return;
    const saved = progressMap.get(lesson.id);
    const total = questions.filter((q) => q.lesson_id === lesson.id).length;
    const savedIndex = saved?.last_question_index ?? 0;
    const resumeIndex = saved && !saved.passed && savedIndex > 0 && savedIndex < total ? savedIndex : 0;
    setQuestionIndex(resumeIndex);
    setSelected(null);
    setCorrectCount(0);
    setXpFeedback(null);
    setResumedFrom(resumeIndex > 0 ? resumeIndex : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  const question = lessonQuestions[questionIndex];
  const options = question
    ? [
        { key: 'A', value: question.option_a },
        { key: 'B', value: question.option_b },
        { key: 'C', value: question.option_c },
        { key: 'D', value: question.option_d },
      ]
    : [];

  function resetLessonState() {
    setQuestionIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setXpFeedback(null);
    setResumedFrom(null);
  }

  async function saveProgress(lessonId: string, lastQuestionIndex: number) {
    try {
      await fetch('/api/lesson-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, lastQuestionIndex }),
      });
    } catch {}
  }

  async function choose(key: string) {
    if (selected || !question) return;
    setSelected(key);
    const isCorrect = key === question.correct_option;
    if (isCorrect) setCorrectCount((v) => v + 1);
    try {
      const response = await fetch('/api/lesson-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, correct: isCorrect }),
      });
      const result = await response.json();
      setXpFeedback({
        awarded: result.awarded ?? 0,
        alreadyAwarded: Boolean(result.alreadyAwarded),
      });
    } catch {
      setXpFeedback({ awarded: 0, alreadyAwarded: false });
    }
    if (lesson) {
      void saveProgress(lesson.id, questionIndex + 1);
    }
  }

  async function next() {
    if (questionIndex < lessonQuestions.length - 1) {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      setSelected(null);
      setXpFeedback(null);
      setResumedFrom(null);
      if (lesson) void saveProgress(lesson.id, nextIndex);
      return;
    }
    const totalCorrect = Math.min(correctCount, lessonQuestions.length);
    const score = Math.min(
      100,
      lessonQuestions.length > 0 ? Math.round((totalCorrect / lessonQuestions.length) * 100) : 0,
    );
    const passed = score >= lesson.pass_score;
    const response = await fetch('/api/lesson-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: lesson.id,
        correctAnswers: totalCorrect,
        totalQuestions: lessonQuestions.length,
        lastQuestionIndex: lessonQuestions.length,
      }),
    });
    const result = await response.json();
    const bonus = result.bonusXp ? ` (+${result.bonusXp} XP Bonus)` : '';
    setMessage(
      result.message
        ? `${result.message} ${passed ? `Bestanden mit ${score}%${bonus}` : `Nicht bestanden mit ${score}%`}`
        : '',
    );
    if (passed) {
      setCompletedLessons((prev) => {
        const next = new Set(prev);
        next.add(lesson.id);
        return next;
      });
    }
    resetLessonState();
  }

  function restartLesson() {
    if (!lesson) return;
    setMessage('');
    resetLessonState();
    void saveProgress(lesson.id, 0);
  }

  function xpLabel(correct: boolean) {
    if (!xpFeedback) return correct ? 'RICHTIG!' : 'Leider Nein!';
    if (correct) {
      if (xpFeedback.awarded > 0) return `RICHTIG! +${xpFeedback.awarded} XP`;
      if (xpFeedback.alreadyAwarded) return 'RICHTIG! (bereits gewertet — keine weiteren XP)';
      return 'RICHTIG!';
    }
    return 'Leider Nein!';
  }

  const lessonCompleted = lesson ? completedLessons.has(lesson.id) : false;

  return (
    <div className="grid grid-2">
      <div className="card stack">
        <div className="hero">
          <div>
            <h2>Lektionen</h2>
            <p className="muted">{courseName} · linearer Pfad wie im Pflichtenheft.</p>
          </div>
          <Lumio />
        </div>
        {lessons.map((item, index) => {
          const p = progressMap.get(item.id);
          const done = completedLessons.has(item.id) || Boolean(p?.passed);
          const inProgress = !done && (p?.last_question_index ?? 0) > 0;
          const label = done ? '✓ ' : inProgress ? '… ' : '';
          return (
            <button
              className="btn"
              key={item.id}
              data-testid={`learn-lesson-button-${item.position}`}
              data-lesson-status={done ? 'done' : inProgress ? 'in-progress' : 'new'}
              onClick={() => {
                setLessonIndex(index);
                setMessage('');
              }}
            >
              {label}
              {item.position}. {item.title}
            </button>
          );
        })}
      </div>
      <div className="card stack">
        {question ? (
          <>
            <div className="hero">
              <div>
                <div className="pill" data-testid="learn-question-counter">
                  Frage {questionIndex + 1} / {lessonQuestions.length}
                </div>
                {lessonCompleted ? (
                  <div className="pill" data-testid="learn-lesson-completed-badge">
                    ✓ Bestanden — Wiederholung möglich (keine zusätzlichen XP)
                  </div>
                ) : null}
                {resumedFrom !== null ? (
                  <div className="pill" data-testid="learn-resume-indicator">
                    Fortgesetzt bei Frage {resumedFrom + 1}
                  </div>
                ) : null}
                <h2>{question.prompt}</h2>
                <p className="muted">Lumio gibt direktes Feedback mit Erklärung.</p>
              </div>
              <Lumio />
            </div>
            {options.map((option) => {
              const cls = selected
                ? option.key === question.correct_option
                  ? 'option correct'
                  : option.key === selected
                    ? 'option wrong'
                    : 'option'
                : 'option';
              return (
                <button key={option.key} className={cls} onClick={() => choose(option.key)}>
                  {option.value}
                </button>
              );
            })}
            {selected ? (
              <div className="card" data-testid="learn-question-feedback">
                <span data-testid="learn-xp-feedback">
                  {xpLabel(selected === question.correct_option)}
                </span>{' '}
                — {question.explanation}
              </div>
            ) : null}
            <button className="btn btn-primary" onClick={next} disabled={!selected}>
              {questionIndex < lessonQuestions.length - 1 ? 'Nächste Frage' : 'Lektion abschliessen'}
            </button>
            {lessonCompleted ? (
              <button
                className="btn"
                onClick={restartLesson}
                data-testid="learn-lesson-restart"
              >
                Lektion neu starten
              </button>
            ) : null}
            {message ? <div data-testid="learn-lesson-summary">{message}</div> : null}
          </>
        ) : (
          <p className="muted">Keine Fragen vorhanden.</p>
        )}
      </div>
    </div>
  );
}
