'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnswerFeedback, type AnswerFeedbackKind } from '@/components/AnswerFeedback';
import { RankUpModal } from '@/components/RankUpModal';
import { SequenceResultModal } from '@/components/SequenceResultModal';
import { lessonIconForTitle } from '@/lib/lessonIcons';

type Lesson = {
  id: string;
  title: string;
  position: number;
  pass_score: number;
  sublesson_index?: number | null;
  sublesson_total?: number | null;
};
// Anti-Cheat: correct_option und explanation werden NICHT mehr vom Server in
// das initial gerenderte Question-Objekt aufgenommen. Die richtige Antwort
// kommt erst nach dem POST /api/lesson-answer zurück. Das verhindert, dass
// jemand im DevTools/Network-Tab die Lösungen vorab auslesen kann.
type Question = {
  id: string;
  lesson_id: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};
type Progress = {
  lesson_id: string;
  best_score: number;
  passed: boolean;
  last_question_index: number;
};

type View = 'overview' | 'question';

function pickInitialLessonIndex(lessons: Lesson[], progress: Progress[]): number {
  if (lessons.length === 0) return 0;
  const byId = new Map(progress.map((p) => [p.lesson_id, p]));
  const firstUnfinished = lessons.findIndex((l) => {
    const p = byId.get(l.id);
    return !p || !p.passed;
  });
  return firstUnfinished === -1 ? 0 : firstUnfinished;
}

// Trailing " · N/M" marker that the ABU sublesson data carries in lessons.title.
// We strip it for display so the overview can group sublessons under their base
// lesson and present a single row with a progress badge instead of five rows.
const SUBLESSON_TITLE_SUFFIX = /\s·\s\d+\/\d+\s*$/;

function baseLessonTitle(lesson: Lesson): string {
  if (lesson.sublesson_index && lesson.sublesson_total) {
    return lesson.title.replace(SUBLESSON_TITLE_SUFFIX, '').trim();
  }
  return lesson.title;
}

type LessonGroup = {
  key: string;
  baseTitle: string;
  // Sublesson rows ordered by sublesson_index (1..N). For non-sublesson lessons
  // the group holds a single entry and behaves like the legacy flat list.
  items: { lesson: Lesson; index: number }[];
  isSublesson: boolean;
};

function groupLessons(lessons: Lesson[]): LessonGroup[] {
  const groups: LessonGroup[] = [];
  const byKey = new Map<string, LessonGroup>();
  lessons.forEach((lesson, index) => {
    const isSub = Boolean(lesson.sublesson_index && lesson.sublesson_total);
    const base = baseLessonTitle(lesson);
    // Sublesson rows in the same base lesson share a module via the seed
    // migration, but we key purely on the cleaned title so that sibling
    // sublessons collapse into one card regardless of their UUIDs.
    const key = isSub ? `sub::${base}` : `solo::${lesson.id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, baseTitle: base, items: [], isSublesson: isSub };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push({ lesson, index });
  });
  for (const group of groups) {
    if (group.isSublesson) {
      group.items.sort(
        (a, b) => (a.lesson.sublesson_index ?? 0) - (b.lesson.sublesson_index ?? 0),
      );
    }
  }
  return groups;
}

// 32-bit FNV-1a hash of an arbitrary string. Deterministic, cheap, and good
// enough as a seed source for the question shuffle.
function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: small, fast, deterministic PRNG. Same seed yields the same
// sequence in every browser, so the question order stays stable across
// renders, refreshes and devices for a given (user, lesson) pair.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleQuestionsForLesson<T extends { id: string }>(
  questionsForLesson: T[],
  userKey: string,
  lessonId: string,
): T[] {
  if (questionsForLesson.length < 2) return questionsForLesson.slice();
  const rand = mulberry32(hashStringToSeed(`${userKey}::${lessonId}`));
  const arr = questionsForLesson.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function LearnClient({
  lessons,
  questions,
  progress,
  courseName = 'Kurs',
  userId = null,
  onStreakUpdate,
}: {
  lessons: Lesson[];
  questions: Question[];
  progress: Progress[];
  courseName?: string;
  userId?: string | null;
  onStreakUpdate?: (s: { current: number; longest: number; increased: boolean }) => void;
}) {
  // Use the auth user id as seed material so each user gets their own stable
  // order. Fallback "anon" still produces a stable order for unauthenticated
  // previews. The shuffle is deterministic per (user, lesson), so resume via
  // last_question_index keeps pointing at the same question after refresh.
  const userKey = userId ?? 'anon';
  const progressMap = useMemo(() => {
    const m = new Map<string, Progress>();
    for (const p of progress) m.set(p.lesson_id, p);
    return m;
  }, [progress]);

  const initialLessonIndex = useMemo(
    () => pickInitialLessonIndex(lessons, progress),
    [lessons, progress],
  );

  const [view, setView] = useState<View>('overview');
  const [lessonIndex, setLessonIndex] = useState(initialLessonIndex);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // Nach dem POST kennen wir die richtige Option und die Erklärung. Vorher
  // bleiben beide leer, damit das UI keine vorzeitige Lösungsanzeige hat.
  const [revealed, setRevealed] = useState<{
    correctOption: 'A' | 'B' | 'C' | 'D';
    explanation: string;
    correct: boolean;
  } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [message, setMessage] = useState('');
  const [xpFeedback, setXpFeedback] = useState<{ awarded: number; alreadyAwarded: boolean } | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    () => new Set(progress.filter((p) => p.passed).map((p) => p.lesson_id)),
  );
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const [feedbackFx, setFeedbackFx] = useState<{ id: number; kind: AnswerFeedbackKind } | null>(null);
  const [rankUp, setRankUp] = useState<{ oldRank: number; newRank: number; bonusXp: number } | null>(null);
  // Sequence-end result modal: shown after the last question is answered and
  // before any rank-up celebration. Holds the data needed to render the modal
  // plus a deferred rank-up payload so we can chain into RankUpModal on
  // "Weiter" when the user passed and actually climbed a rank.
  const [sequenceResult, setSequenceResult] = useState<
    | {
        passed: boolean;
        percent: number;
        correct: number;
        total: number;
        pendingRankUp: { oldRank: number; newRank: number; bonusXp: number } | null;
        advanceSublessonIndex: number | null;
      }
    | null
  >(null);
  // Tracks the best (highest oldRank, lowest newRank) the user has reached
  // through per-question XP awards within the current sequence. We celebrate
  // at sequence end based on the cumulative climb so the modal lands once per
  // sequence rather than mid-question. Reset on lesson change / restart.
  const [pendingRankUp, setPendingRankUp] = useState<{ oldRank: number; newRank: number } | null>(null);

  const lesson = lessons[lessonIndex];
  const lessonQuestions = useMemo(
    () => {
      if (!lesson) return [] as Question[];
      const filtered = questions.filter((q) => q.lesson_id === lesson.id);
      return shuffleQuestionsForLesson(filtered, userKey, lesson.id);
    },
    [questions, lesson, userKey],
  );

  useEffect(() => {
    if (!lesson) return;
    const saved = progressMap.get(lesson.id);
    const total = questions.filter((q) => q.lesson_id === lesson.id).length;
    const savedIndex = saved?.last_question_index ?? 0;
    const resumeIndex = saved && !saved.passed && savedIndex > 0 && savedIndex < total ? savedIndex : 0;
    setQuestionIndex(resumeIndex);
    setSelected(null);
    setRevealed(null);
    setCorrectCount(0);
    setXpFeedback(null);
    setResumedFrom(resumeIndex > 0 ? resumeIndex : null);
    setPendingRankUp(null);
    // Clear leftover answer-feedback fx so the buzzer/success cue from the
    // previous lesson's last answer doesn't replay when the question view
    // remounts for the new lesson.
    setFeedbackFx(null);
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
    setRevealed(null);
    setCorrectCount(0);
    setXpFeedback(null);
    setResumedFrom(null);
    setPendingRankUp(null);
    setFeedbackFx(null);
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
    // Optimistisches Feedback gibt es erst, wenn der Server geantwortet hat —
    // sonst könnte der Client falsches Feedback zeigen, wenn der Server eine
    // andere correct_option kennt. Wir warten kurz.
    try {
      const response = await fetch('/api/lesson-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, selectedOption: key }),
      });
      const result = await response.json();
      const isCorrect = Boolean(result.correct);
      if (isCorrect) setCorrectCount((v) => v + 1);
      setFeedbackFx({ id: Date.now(), kind: isCorrect ? 'correct' : 'wrong' });
      setRevealed({
        correctOption: result.correctOption,
        explanation: result.explanation ?? '',
        correct: isCorrect,
      });
      setXpFeedback({
        awarded: result.awarded ?? 0,
        alreadyAwarded: Boolean(result.alreadyAwarded),
      });
      // Streak-Update an Parent weitergeben, damit der Streak-Pill oben in der
      // Übersicht live mitläuft.
      if (result.streak && onStreakUpdate) {
        onStreakUpdate({
          current: Number(result.streak.current) || 0,
          longest: Number(result.streak.longest) || 0,
          increased: Boolean(result.streak.increased),
        });
      }
      // Aggregate the climb across the sequence: oldest oldRank seen vs the
      // most recent newRank, so a sequence that moves 12 → 9 → 7 reports
      // "12 → 7" once at the end rather than firing three separate modals.
      if (
        typeof result.oldRank === 'number' &&
        typeof result.newRank === 'number' &&
        result.newRank < result.oldRank
      ) {
        setPendingRankUp((prev) => {
          const oldRank = prev ? Math.max(prev.oldRank, result.oldRank) : result.oldRank;
          const newRank = prev ? Math.min(prev.newRank, result.newRank) : result.newRank;
          return { oldRank, newRank };
        });
      }
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
      setRevealed(null);
      setXpFeedback(null);
      setResumedFrom(null);
      if (lesson) void saveProgress(lesson.id, nextIndex);
      return;
    }
    // Anti-Cheat: Wir schicken nur lessonId. Score, correct, total werden
    // serverseitig aus question_xp_awards berechnet und kommen zurück.
    const response = await fetch('/api/lesson-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: lesson.id,
        lastQuestionIndex: lessonQuestions.length,
      }),
    });
    const result = await response.json();
    const totalCorrect = Number(result.correctAnswers) || 0;
    const score = Math.min(100, Math.max(0, Number(result.score) || 0));
    const passed = Boolean(result.passed);
    const bonus = result.bonusXp ? ` (+${result.bonusXp} XP Bonus)` : '';
    setMessage(
      result.message
        ? `${result.message} ${passed ? `Bestanden mit ${score}%${bonus}` : `Nicht bestanden mit ${score}%`}`
        : '',
    );
    // Combine the rank climb from per-question XP (tracked across the
    // sequence in pendingRankUp) with any additional climb from the pass
    // bonus. Per-question XP usually accounts for the entire move (10×20 XP
    // ≫ the 50 XP bonus), but bonus-only rank-ups still need to surface.
    const bonusOld = typeof result.oldRank === 'number' ? result.oldRank : null;
    const bonusNew = typeof result.newRank === 'number' ? result.newRank : null;
    const candidates = [pendingRankUp, bonusOld !== null && bonusNew !== null ? { oldRank: bonusOld, newRank: bonusNew } : null]
      .filter((c): c is { oldRank: number; newRank: number } => c !== null);
    let pendingClimb: { oldRank: number; newRank: number; bonusXp: number } | null = null;
    if (candidates.length > 0) {
      const oldRank = Math.max(...candidates.map((c) => c.oldRank));
      const newRank = Math.min(...candidates.map((c) => c.newRank));
      if (newRank < oldRank) {
        pendingClimb = { oldRank, newRank, bonusXp: Number(result.bonusXp) || 0 };
      }
    }
    // Pre-compute the next sublesson pointer (if any) so we can advance the
    // overview after the user dismisses the sequence result modal, not before.
    // Doing this now avoids racing against `lesson` updates inside the modal
    // handler.
    let advanceSublessonIndex: number | null = null;
    if (passed && lesson.sublesson_index && lesson.sublesson_total) {
      const nextSublessonIdx = lessons.findIndex(
        (l, i) =>
          i > lessonIndex &&
          baseLessonTitle(l) === baseLessonTitle(lesson) &&
          l.id !== lesson.id,
      );
      if (nextSublessonIdx !== -1) advanceSublessonIndex = nextSublessonIdx;
    }
    setSequenceResult({
      passed,
      percent: score,
      correct: totalCorrect,
      total: lessonQuestions.length,
      // Only celebrate rank-up when the user passed the sequence — failing
      // shouldn't open the rank-up modal even if per-question XP nudged the
      // rank upward.
      pendingRankUp: passed ? pendingClimb : null,
      advanceSublessonIndex,
    });
  }

  function finishSequenceResult() {
    const result = sequenceResult;
    setSequenceResult(null);
    if (!result || !lesson) return;
    if (result.passed) {
      setCompletedLessons((prev) => {
        const nextSet = new Set(prev);
        nextSet.add(lesson.id);
        return nextSet;
      });
      if (result.advanceSublessonIndex !== null) {
        setLessonIndex(result.advanceSublessonIndex);
      }
    }
    if (result.pendingRankUp) {
      setRankUp(result.pendingRankUp);
    }
    resetLessonState();
    setView('overview');
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

  const lessonGroups = useMemo(() => groupLessons(lessons), [lessons]);

  function isLessonPassed(id: string): boolean {
    return completedLessons.has(id) || Boolean(progressMap.get(id)?.passed);
  }

  // For sublesson groups, the "active" item is the first non-passed sublesson
  // (i.e. what x/N should point at, where N is sublesson_total from the DB).
  // When every sublesson is passed we keep the
  // last entry around so the card can still be repeated, but the group is
  // flagged as completed and the badge collapses to a ✓.
  function activeGroupItem(group: LessonGroup): { lesson: Lesson; index: number; allDone: boolean } {
    const firstOpen = group.items.find((it) => !isLessonPassed(it.lesson.id));
    if (firstOpen) return { ...firstOpen, allDone: false };
    const last = group.items[group.items.length - 1];
    return { ...last, allDone: true };
  }

  const totalLessons = lessonGroups.length;
  const doneCount = lessonGroups.filter((g) => g.items.every((it) => isLessonPassed(it.lesson.id))).length;
  // Feinerer Sequenzen-Zähler: jede Sublesson (oder bei Nicht-Sublesson die
  // Lektion selbst) zählt als eine Sequenz. Das gibt einen Balken, der sich
  // schon nach jeder bestandenen Sequenz bewegt — nicht erst, wenn eine ganze
  // Gruppe (10 Sequenzen) durch ist.
  const totalSequences = lessons.length;
  const doneSequences = lessons.filter((l) => isLessonPassed(l.id)).length;
  const lessonPercent = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;
  const sequencePercent = totalSequences > 0 ? Math.round((doneSequences / totalSequences) * 100) : 0;

  function openLesson(index: number) {
    setLessonIndex(index);
    setMessage('');
    setView('question');
  }

  function backToOverview() {
    setView('overview');
  }

  const rankUpModal = rankUp ? (
    <RankUpModal
      oldRank={rankUp.oldRank}
      newRank={rankUp.newRank}
      bonusXp={rankUp.bonusXp}
      onClose={() => setRankUp(null)}
    />
  ) : null;

  // Render order matters: the sequence result modal must sit above the
  // question view but render before the rank-up modal mounts, so we only
  // attach it when no rank-up is already open.
  const sequenceResultModal = sequenceResult && !rankUp ? (
    <SequenceResultModal
      passed={sequenceResult.passed}
      percent={sequenceResult.percent}
      correct={sequenceResult.correct}
      total={sequenceResult.total}
      onContinue={finishSequenceResult}
    />
  ) : null;

  if (view === 'overview') {
    return (
      <>
      <div className="card stack" data-testid="learn-overview">
        <div className="hero">
          <div>
            <h2>Übersicht</h2>
            <p className="muted">{courseName}</p>
          </div>
        </div>
        <div className="learn-progress" data-testid="learn-progress-section">
          <div className="learn-progress-row">
            <div className="learn-progress-label">
              <span>Lektionen</span>
              <span
                className="learn-progress-value"
                data-testid="learn-progress-lessons-value"
              >
                {doneCount}/{totalLessons} · {lessonPercent}%
              </span>
            </div>
            <div
              className="learn-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={lessonPercent}
              aria-label="Fortschritt Lektionen"
              data-testid="learn-progress-lessons-bar"
            >
              <div
                className="learn-progress-fill"
                style={{ width: `${lessonPercent}%` }}
              />
            </div>
          </div>
          {totalSequences !== totalLessons ? (
            <div className="learn-progress-row">
              <div className="learn-progress-label">
                <span>Sequenzen</span>
                <span
                  className="learn-progress-value"
                  data-testid="learn-progress-sequences-value"
                >
                  {doneSequences}/{totalSequences} · {sequencePercent}%
                </span>
              </div>
              <div
                className="learn-progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={sequencePercent}
                aria-label="Fortschritt Sequenzen"
                data-testid="learn-progress-sequences-bar"
              >
                <div
                  className="learn-progress-fill learn-progress-fill-secondary"
                  style={{ width: `${sequencePercent}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Alle Lektionen</h3>
          <div className="learn-overview-lessons" data-testid="learn-lessons-list">
            {lessonGroups.map((group) => {
              const active = activeGroupItem(group);
              const activeLesson = active.lesson;
              const p = progressMap.get(activeLesson.id);
              const groupDone = active.allDone;
              const inProgress =
                !groupDone &&
                ((p?.last_question_index ?? 0) > 0 ||
                  (group.isSublesson && group.items.some((it) => isLessonPassed(it.lesson.id))));
              const statusLabel = groupDone
                ? '✓ bestanden'
                : group.isSublesson
                  ? `${activeLesson.sublesson_index}/${activeLesson.sublesson_total}`
                  : inProgress
                    ? '… läuft'
                    : 'Neu';
              return (
                <button
                  key={group.key}
                  className="lesson-row"
                  data-testid={`learn-lesson-button-${activeLesson.position}`}
                  data-lesson-status={groupDone ? 'done' : inProgress ? 'in-progress' : 'new'}
                  data-current={active.index === lessonIndex ? 'true' : 'false'}
                  onClick={() => openLesson(active.index)}
                >
                  <span className="lesson-icon" aria-hidden="true">{lessonIconForTitle(group.baseTitle)}</span>
                  <span className="lesson-title">{group.baseTitle}</span>
                  <span
                    className="lesson-status"
                    data-testid={
                      group.isSublesson
                        ? `learn-sublesson-progress-${activeLesson.position}`
                        : undefined
                    }
                  >
                    {statusLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {message ? <div className="card" data-testid="learn-lesson-summary">{message}</div> : null}
      </div>
      {sequenceResultModal}
      {rankUpModal}
      </>
    );
  }

  return (
    <>
    <div className="card compact-question" data-testid="learn-question-view">
      <AnswerFeedback trigger={feedbackFx} />
      {question ? (
        <>
          <div className="cq-header">
            <div className="cq-pills">
              {lesson.sublesson_index && lesson.sublesson_total ? (
                <span className="pill" data-testid="learn-sublesson-badge">
                  Sequenz {lesson.sublesson_index}/{lesson.sublesson_total}
                </span>
              ) : null}
              <span className="pill" data-testid="learn-question-counter">
                Frage {questionIndex + 1}/{lessonQuestions.length}
              </span>
              <span className="pill" style={{ background: 'rgba(255,255,255,.04)', color: 'var(--muted)', borderColor: 'rgba(76,123,255,.18)' }}>
                {baseLessonTitle(lesson)}
              </span>
              {lessonCompleted ? (
                <span className="pill" data-testid="learn-lesson-completed-badge">✓ bestanden</span>
              ) : null}
              {resumedFrom !== null ? (
                <span className="pill" data-testid="learn-resume-indicator">Fortgesetzt</span>
              ) : null}
            </div>
            <button
              className="btn"
              data-testid="learn-back-to-overview"
              onClick={backToOverview}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 12 }}
            >
              ← Übersicht
            </button>
          </div>
          <h2 className="cq-prompt">{question.prompt}</h2>
          <div className="cq-options">
            {options.map((option) => {
              // Server-revealed correct/wrong styling: erst nach POST gibt es
              // eine sichtbare Markierung, vorher ist alles neutral. Dadurch
              // verrät das DOM die richtige Antwort nicht vorab.
              const cls = revealed
                ? option.key === revealed.correctOption
                  ? 'option correct'
                  : option.key === selected
                    ? 'option wrong'
                    : 'option'
                : selected === option.key
                  ? 'option option-pending'
                  : 'option';
              return (
                <button
                  key={option.key}
                  className={cls}
                  onClick={() => choose(option.key)}
                  disabled={Boolean(selected)}
                >
                  <strong style={{ marginRight: 6 }}>{option.key}</strong>
                  {option.value}
                </button>
              );
            })}
          </div>
          {revealed ? (
            <div className="cq-feedback" data-testid="learn-question-feedback">
              <strong data-testid="learn-xp-feedback">
                {xpLabel(revealed.correct)}
              </strong>
              {revealed.explanation ? <> — {revealed.explanation}</> : null}
            </div>
          ) : selected ? (
            <div className="cq-feedback muted" data-testid="learn-question-feedback-pending">
              <em>Auswertung…</em>
            </div>
          ) : null}
          <div className="cq-actions">
            <button
              className="btn btn-primary"
              onClick={next}
              disabled={!selected || !revealed}
            >
              {questionIndex < lessonQuestions.length - 1 ? 'Nächste' : 'Abschliessen'}
            </button>
            {lessonCompleted ? (
              <button
                className="btn"
                onClick={restartLesson}
                data-testid="learn-lesson-restart"
              >
                Neu starten
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="muted">Keine Fragen vorhanden.</p>
          <button className="btn" data-testid="learn-back-to-overview" onClick={backToOverview}>
            ← Zurück zur Übersicht
          </button>
        </>
      )}
    </div>
    {sequenceResultModal}
    {rankUpModal}
    </>
  );
}
