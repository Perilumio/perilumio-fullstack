'use client';
import { useMemo, useState } from 'react';
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

export function LearnClient({
  lessons,
  questions,
  courseName = 'Kurs',
}: {
  lessons: Lesson[];
  questions: Question[];
  courseName?: string;
}) {
  const [lessonIndex, setLessonIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [message, setMessage] = useState('');
  const [xpFeedback, setXpFeedback] = useState<{ awarded: number; alreadyAwarded: boolean } | null>(null);

  const lesson = lessons[lessonIndex];
  const lessonQuestions = useMemo(
    () => questions.filter((q) => q.lesson_id === lesson?.id),
    [questions, lesson],
  );
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
  }

  async function next() {
    if (questionIndex < lessonQuestions.length - 1) {
      setQuestionIndex((v) => v + 1);
      setSelected(null);
      setXpFeedback(null);
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
    resetLessonState();
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
        {lessons.map((item, index) => (
          <button
            className="btn"
            key={item.id}
            onClick={() => {
              setLessonIndex(index);
              resetLessonState();
              setMessage('');
            }}
          >
            {item.position}. {item.title}
          </button>
        ))}
      </div>
      <div className="card stack">
        {question ? (
          <>
            <div className="hero">
              <div>
                <div className="pill">
                  Frage {questionIndex + 1} / {lessonQuestions.length}
                </div>
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
            {message ? <div data-testid="learn-lesson-summary">{message}</div> : null}
          </>
        ) : (
          <p className="muted">Keine Fragen vorhanden.</p>
        )}
      </div>
    </div>
  );
}
