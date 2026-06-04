'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { AnswerFeedback, type AnswerFeedbackKind } from '@/components/AnswerFeedback';

type OptionKey = 'A' | 'B' | 'C' | 'D';

type PlayerPublic = {
  id: string;
  username: string;
  display_name: string;
  avatar_key: string;
};

type BattleState = {
  match_id: string;
  status: 'waiting' | 'active' | 'finished' | 'cancelled';
  course_key: string;
  question_count: number;
  current_question_index: number;
  you: { id: string; role: 'player1' | 'player2'; score: number; answered_current: boolean };
  opponent: (PlayerPublic & { score: number; answered_current: boolean }) | null;
  self_profile: PlayerPublic;
  question: { id: string; prompt: string; options: { key: OptionKey; text: string }[] } | null;
  last_correct_option: OptionKey | null;
  finished: boolean;
  result: 'win' | 'loss' | 'draw' | null;
  bp_reward: number | null;
};

type Phase = 'idle' | 'joining' | 'in_match' | 'error';

const POLL_INTERVAL_MS = 2500;
const POINT_CREDIT_MS = 1400;
// Hold the current question on screen for a beat after the server advances,
// so feedback/score updates remain visible instead of flashing past.
const NEXT_QUESTION_HOLD_MS = 1100;
// Minimum time the "waiting for opponent" overlay stays visible once shown,
// so it cannot flicker in and out when the opponent answers quickly.
const WAITING_OVERLAY_MIN_MS = 1000;

export function BattleClient({ courseName, hasQuestions }: { courseName: string; hasQuestions: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [state, setState] = useState<BattleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Remember the answer outcome for the question we just answered, so the feedback
  // banner remains visible after the index advances and `last_correct_option` clears.
  const [answerEcho, setAnswerEcho] = useState<{ questionIndex: number; correct: boolean } | null>(null);
  const [feedbackFx, setFeedbackFx] = useState<{ id: number; kind: AnswerFeedbackKind } | null>(null);
  // Track score deltas to animate the +1 credit on the player who scored.
  const [pointCredit, setPointCredit] = useState<{ self: boolean; opponent: boolean }>({ self: false, opponent: false });
  const prevScoresRef = useRef<{ self: number; opponent: number } | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastQuestionIndexRef = useRef<number>(-1);
  const selfCreditTimerRef = useRef<number | null>(null);
  const oppCreditTimerRef = useRef<number | null>(null);
  // Holds a queued BattleState whose `current_question_index` has advanced;
  // we'll apply it after NEXT_QUESTION_HOLD_MS so the previous question's
  // feedback and score updates remain visible long enough to register.
  const pendingNextRef = useRef<BattleState | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  // When we (the local player) most recently answered the current question.
  // Used to enforce a minimum visible window for the waiting overlay.
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const [waitingMinElapsed, setWaitingMinElapsed] = useState(false);
  const waitingMinTimerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const commitState = useCallback((next: BattleState) => {
    setState((prev) => {
      if (prev && next.current_question_index !== prev.current_question_index) {
        setSelected(null);
        setAnsweredAt(null);
        setWaitingMinElapsed(false);
        if (waitingMinTimerRef.current !== null) {
          window.clearTimeout(waitingMinTimerRef.current);
          waitingMinTimerRef.current = null;
        }
      }
      lastQuestionIndexRef.current = next.current_question_index;
      return next;
    });

    const prevScores = prevScoresRef.current;
    const nextSelf = next.you.score;
    const nextOpp = next.opponent?.score ?? 0;
    if (prevScores) {
      if (nextSelf > prevScores.self) {
        setPointCredit((p) => ({ ...p, self: true }));
        if (selfCreditTimerRef.current !== null) window.clearTimeout(selfCreditTimerRef.current);
        selfCreditTimerRef.current = window.setTimeout(() => {
          setPointCredit((p) => ({ ...p, self: false }));
        }, POINT_CREDIT_MS);
      }
      if (nextOpp > prevScores.opponent) {
        setPointCredit((p) => ({ ...p, opponent: true }));
        if (oppCreditTimerRef.current !== null) window.clearTimeout(oppCreditTimerRef.current);
        oppCreditTimerRef.current = window.setTimeout(() => {
          setPointCredit((p) => ({ ...p, opponent: false }));
        }, POINT_CREDIT_MS);
      }
    }
    prevScoresRef.current = { self: nextSelf, opponent: nextOpp };
  }, []);

  const applyState = useCallback((next: BattleState) => {
    const prevIdx = lastQuestionIndexRef.current;
    // When the server advances to a new question, hold the current view briefly
    // so the just-answered question's feedback/score remain visible. Skip the
    // hold when the match is ending (final result should not be delayed) or
    // when this is the first state we've seen.
    const isAdvance =
      prevIdx >= 0 &&
      next.current_question_index > prevIdx &&
      next.status === 'active';

    if (isAdvance) {
      pendingNextRef.current = next;
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = window.setTimeout(() => {
        const queued = pendingNextRef.current;
        pendingNextRef.current = null;
        holdTimerRef.current = null;
        if (queued) commitState(queued);
      }, NEXT_QUESTION_HOLD_MS);
      return;
    }

    // If a newer-still state arrives during the hold (e.g. another advance or
    // a status change), replace the queued one with the latest non-stale data.
    if (pendingNextRef.current && next.current_question_index >= pendingNextRef.current.current_question_index) {
      pendingNextRef.current = next;
      return;
    }

    commitState(next);
  }, [commitState]);

  const fetchState = useCallback(async (matchId: string) => {
    try {
      const res = await fetch(`/api/battle/state?match_id=${encodeURIComponent(matchId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.state) {
        applyState(data.state);
        if (data.state.status === 'finished' || data.state.status === 'cancelled') {
          stopPolling();
        }
      }
    } catch {}
  }, [applyState, stopPolling]);

  const startPolling = useCallback((matchId: string) => {
    stopPolling();
    pollRef.current = window.setInterval(() => { fetchState(matchId); }, POLL_INTERVAL_MS);
  }, [fetchState, stopPolling]);

  useEffect(() => () => {
    stopPolling();
    if (selfCreditTimerRef.current !== null) window.clearTimeout(selfCreditTimerRef.current);
    if (oppCreditTimerRef.current !== null) window.clearTimeout(oppCreditTimerRef.current);
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    if (waitingMinTimerRef.current !== null) window.clearTimeout(waitingMinTimerRef.current);
  }, [stopPolling]);

  const resetMatchLocal = useCallback(() => {
    setState(null);
    setSelected(null);
    setAnswerEcho(null);
    setPointCredit({ self: false, opponent: false });
    setAnsweredAt(null);
    setWaitingMinElapsed(false);
    prevScoresRef.current = null;
    pendingNextRef.current = null;
    lastQuestionIndexRef.current = -1;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (waitingMinTimerRef.current !== null) {
      window.clearTimeout(waitingMinTimerRef.current);
      waitingMinTimerRef.current = null;
    }
  }, []);

  const join = useCallback(async () => {
    setPhase('joining');
    setError(null);
    try {
      const res = await fetch('/api/battle/join', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data?.state) {
        setError(data?.message ?? 'Konnte kein Match starten.');
        setPhase('error');
        return;
      }
      prevScoresRef.current = { self: data.state.you.score, opponent: data.state.opponent?.score ?? 0 };
      setState(data.state);
      lastQuestionIndexRef.current = data.state.current_question_index;
      setPhase('in_match');
      startPolling(data.state.match_id);
    } catch {
      setError('Netzwerkfehler.');
      setPhase('error');
    }
  }, [startPolling]);

  const answer = useCallback(async (option: OptionKey) => {
    if (!state || submitting || state.you.answered_current) return;
    setSelected(option);
    setSubmitting(true);
    // Start the minimum-visibility window for the waiting overlay.
    setAnsweredAt(Date.now());
    setWaitingMinElapsed(false);
    if (waitingMinTimerRef.current !== null) window.clearTimeout(waitingMinTimerRef.current);
    waitingMinTimerRef.current = window.setTimeout(() => {
      setWaitingMinElapsed(true);
    }, WAITING_OVERLAY_MIN_MS);
    try {
      const res = await fetch('/api/battle/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: state.match_id,
          question_index: state.current_question_index,
          selected_option: option,
        }),
      });
      const data = await res.json();
      if (data?.state) {
        const next: BattleState = data.state;
        // Determine correctness from server's last_correct_option (set once we've answered).
        if (next.last_correct_option) {
          const isCorrect = next.last_correct_option === option;
          setAnswerEcho({
            questionIndex: state.current_question_index,
            correct: isCorrect,
          });
          setFeedbackFx({ id: Date.now(), kind: isCorrect ? 'correct' : 'wrong' });
        }
        applyState(next);
      }
    } finally {
      setSubmitting(false);
    }
  }, [state, submitting, applyState]);

  const cancelOrLeave = useCallback(async () => {
    if (!state) {
      setPhase('idle');
      return;
    }
    stopPolling();
    try {
      await fetch('/api/battle/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: state.match_id }),
      });
    } catch {}
    resetMatchLocal();
    setPhase('idle');
  }, [state, stopPolling, resetMatchLocal]);

  const playAgain = useCallback(() => {
    stopPolling();
    resetMatchLocal();
    setError(null);
    setPhase('idle');
  }, [stopPolling, resetMatchLocal]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hasQuestions) {
    return null;
  }

  if (phase === 'idle') {
    return (
      <div className="card stack" data-testid="battle-lobby">
        <h2>Bereit für ein Echtzeit-Duell?</h2>
        <p className="muted">
          Quizbattle funktioniert nur mit zwei eingeloggten Spielern für denselben Kurs ({courseName}).
          Du wirst in eine Warteschlange aufgenommen und automatisch mit dem nächsten Gegner verbunden.
        </p>
        <button className="btn btn-primary" data-testid="battle-join-button" onClick={join}>
          Match suchen
        </button>
      </div>
    );
  }

  if (phase === 'joining') {
    return (
      <div className="card stack" data-testid="battle-joining">
        <h2>Suche nach einem Gegner…</h2>
        <p className="muted">Einen Moment, wir verbinden dich.</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="card stack" data-testid="battle-error">
        <h2>Fehler</h2>
        <p className="muted">{error}</p>
        <button className="btn btn-primary" onClick={playAgain}>Erneut versuchen</button>
      </div>
    );
  }

  if (!state) return null;

  if (state.status === 'cancelled') {
    return (
      <div className="card stack" data-testid="battle-cancelled">
        <h2>Match wurde abgebrochen</h2>
        <p className="muted">Dein Match wurde wegen Inaktivität oder vom Gegner abgebrochen.</p>
        <button className="btn btn-primary" onClick={playAgain}>Neues Match starten</button>
      </div>
    );
  }

  if (state.status === 'waiting') {
    return (
      <div className="card stack" data-testid="battle-waiting">
        <h2>Warte auf einen Gegner…</h2>
        <p className="muted">
          Sobald ein zweiter Spieler {courseName} beitritt, startet euer Match automatisch.
          Halte diese Seite offen.
        </p>
        <div className="scorebox">
          <PlayerCard label="Du" player={state.self_profile} testId="battle-self" />
          <div style={{ fontSize: 22 }}>⏳</div>
          <div className="muted" data-testid="battle-opponent-waiting">Suche Gegner…</div>
        </div>
        <button className="btn" onClick={cancelOrLeave} data-testid="battle-cancel-queue">
          Suche abbrechen
        </button>
      </div>
    );
  }

  const finished = state.status === 'finished';
  const q = state.question;
  const correct = state.last_correct_option;
  const youAnswered = state.you.answered_current;
  const opponentAnswered = state.opponent?.answered_current ?? false;

  // Show the answer echo only for the question we actually answered.
  const echoForThisQuestion = answerEcho && answerEcho.questionIndex === state.current_question_index
    ? answerEcho
    : null;
  // Fallback: if the server still reports answered_current=true and we know `correct`
  // and `selected`, derive correctness (covers refresh / late polling).
  const liveCorrect = echoForThisQuestion?.correct
    ?? (youAnswered && correct !== null && selected !== null ? correct === selected : null);

  if (!finished && q) {
    return (
      <div className="card compact-question" data-testid="battle-compact-question">
        <AnswerFeedback trigger={feedbackFx} />
        <div className="compact-scorebox" data-testid="battle-scoreboard">
          <CompactPlayer
            label="Du"
            player={state.self_profile}
            score={state.you.score}
            testId="battle-self"
            scoreTestId="battle-score-self"
            creditTestId="battle-point-credit-self"
            showCredit={pointCredit.self}
          />
          <div className="compact-vs">⚔️</div>
          {state.opponent ? (
            <CompactPlayer
              label="Gegner"
              player={state.opponent}
              score={state.opponent.score}
              testId="battle-opponent"
              scoreTestId="battle-score-enemy"
              creditTestId="battle-point-credit-opponent"
              showCredit={pointCredit.opponent}
            />
          ) : (
            <div className="muted">—</div>
          )}
        </div>
        <div className="cq-header">
          <div className="cq-pills">
            <span className="pill" data-testid="battle-question-progress">
              {state.current_question_index + 1} / {state.question_count}
            </span>
            <span className="pill" style={{ background: 'rgba(255,255,255,.04)', color: 'var(--muted)', borderColor: 'rgba(76,123,255,.18)' }}>
              {courseName}
            </span>
          </div>
          <button
            className="btn"
            onClick={cancelOrLeave}
            data-testid="battle-leave-match"
            style={{ padding: '6px 10px', fontSize: 12, borderRadius: 12 }}
          >
            Verlassen
          </button>
        </div>
        <h2 className="cq-prompt" data-testid="battle-current-question">{q.prompt}</h2>
        <div className="cq-options-wrap">
          <div className="cq-options" data-testid="battle-answer-buttons">
            {q.options.map((option) => {
              const showResult = youAnswered && correct !== null;
              let cls = 'option';
              if (showResult) {
                if (option.key === correct) cls = 'option correct';
                else if (option.key === selected) cls = 'option wrong';
              }
              return (
                <button
                  key={option.key}
                  className={cls}
                  disabled={youAnswered || submitting}
                  onClick={() => answer(option.key)}
                  data-testid={`battle-answer-${option.key}`}
                >
                  <strong style={{ marginRight: 6 }}>{option.key}</strong>
                  {option.text}
                </button>
              );
            })}
          </div>
          {youAnswered && answeredAt !== null && (!opponentAnswered || !waitingMinElapsed) ? (
            <div
              className="battle-waiting-overlay"
              data-testid="battle-waiting-opponent"
              role="status"
              aria-live="polite"
            >
              <div className="battle-waiting-card">
                <span className="battle-hourglass-big" aria-hidden="true">⏳</span>
                <div className="battle-waiting-text">Warten auf Gegner…</div>
              </div>
            </div>
          ) : null}
        </div>
        {youAnswered ? (
          <>
            {liveCorrect !== null ? (
              <div
                className={`battle-feedback ${liveCorrect ? 'is-correct' : 'is-wrong'}`}
                data-testid="battle-answer-feedback"
                data-correct={liveCorrect ? 'true' : 'false'}
              >
                {liveCorrect ? (
                  <>
                    <span aria-hidden="true">✅</span>
                    <strong>Richtig</strong>
                    <span className="battle-feedback-points">+1</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">❌</span>
                    <strong>Falsch</strong>
                  </>
                )}
              </div>
            ) : null}
            {opponentAnswered && waitingMinElapsed ? (
              <div className="muted" data-testid="battle-next-soon" style={{ fontSize: 12 }}>
                Nächste Frage gleich…
              </div>
            ) : null}
          </>
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>
            {opponentAnswered ? 'Gegner hat geantwortet. Du bist dran!' : 'Wähle eine Antwort.'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card stack">
      <div className="scorebox" data-testid="battle-scoreboard">
        <PlayerCard
          label="Du"
          player={state.self_profile}
          score={state.you.score}
          testId="battle-self"
          scoreTestId="battle-score-self"
          creditTestId="battle-point-credit-self"
          showCredit={pointCredit.self}
        />
        <div style={{ fontSize: 22 }}>⚔️</div>
        {state.opponent ? (
          <PlayerCard
            label="Gegner"
            player={state.opponent}
            score={state.opponent.score}
            testId="battle-opponent"
            scoreTestId="battle-score-enemy"
            creditTestId="battle-point-credit-opponent"
            showCredit={pointCredit.opponent}
          />
        ) : (
          <div className="muted">—</div>
        )}
      </div>

      {finished ? (
        <div className="card stack" data-testid="battle-final-result">
          <h2>
            <span data-testid="battle-final-self">{state.you.score}</span>
            {' : '}
            <span data-testid="battle-final-opponent">{state.opponent?.score ?? 0}</span>
          </h2>
          <div className="muted" data-testid="battle-result-text">
            {state.result === 'win' ? 'Du hast gewonnen!' :
              state.result === 'draw' ? 'Unentschieden' : 'Du hast verloren'}
          </div>
          {state.bp_reward !== null ? (
            <div data-testid="battle-bp-reward">+{state.bp_reward} BP</div>
          ) : null}
          <button className="btn btn-primary" onClick={playAgain} data-testid="battle-play-again">
            Neues Match
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PlayerCard({
  label,
  player,
  score,
  testId,
  scoreTestId,
  creditTestId,
  showCredit,
}: {
  label: string;
  player: PlayerPublic;
  score?: number;
  testId?: string;
  scoreTestId?: string;
  creditTestId?: string;
  showCredit?: boolean;
}) {
  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <Avatar avatarKey={player.avatar_key} size="sm" fallbackLabel={player.username} />
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div data-testid={testId ? `${testId}-name` : undefined} style={{ fontWeight: 600 }}>
        {player.username}
      </div>
      {typeof score === 'number' ? (
        <div className="battle-score-wrap">
          <div className="kpi" data-testid={scoreTestId}>{score}</div>
          {showCredit ? (
            <div className="battle-point-credit" data-testid={creditTestId} aria-live="polite">+1</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CompactPlayer({
  label,
  player,
  score,
  testId,
  scoreTestId,
  creditTestId,
  showCredit,
}: {
  label: string;
  player: PlayerPublic;
  score?: number;
  testId?: string;
  scoreTestId?: string;
  creditTestId?: string;
  showCredit?: boolean;
}) {
  return (
    <div className="compact-player" data-testid={testId}>
      <Avatar avatarKey={player.avatar_key} size="sm" fallbackLabel={player.username} />
      <div className="muted">{label}</div>
      <div data-testid={testId ? `${testId}-name` : undefined} className="compact-name">
        {player.username}
      </div>
      {typeof score === 'number' ? (
        <div className="battle-score-wrap">
          <div className="kpi" data-testid={scoreTestId}>{score}</div>
          {showCredit ? (
            <div className="battle-point-credit" data-testid={creditTestId} aria-live="polite">+1</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
