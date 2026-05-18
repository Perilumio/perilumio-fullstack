'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';

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

export function BattleClient({ courseName, hasQuestions }: { courseName: string; hasQuestions: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [state, setState] = useState<BattleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);
  const lastQuestionIndexRef = useRef<number>(-1);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchState = useCallback(async (matchId: string) => {
    try {
      const res = await fetch(`/api/battle/state?match_id=${encodeURIComponent(matchId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.state) {
        setState((prev) => {
          const next: BattleState = data.state;
          if (prev && next.current_question_index !== prev.current_question_index) {
            // New question → clear local selection.
            setSelected(null);
          }
          lastQuestionIndexRef.current = next.current_question_index;
          return next;
        });
        if (data.state.status === 'finished' || data.state.status === 'cancelled') {
          stopPolling();
        }
      }
    } catch {}
  }, [stopPolling]);

  const startPolling = useCallback((matchId: string) => {
    stopPolling();
    pollRef.current = window.setInterval(() => { fetchState(matchId); }, POLL_INTERVAL_MS);
  }, [fetchState, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

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
      if (data?.state) setState(data.state);
    } finally {
      setSubmitting(false);
    }
  }, [state, submitting]);

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
    setState(null);
    setSelected(null);
    setPhase('idle');
  }, [state, stopPolling]);

  const playAgain = useCallback(() => {
    stopPolling();
    setState(null);
    setSelected(null);
    setError(null);
    setPhase('idle');
  }, [stopPolling]);

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

  return (
    <div className="card stack">
      <div className="scorebox">
        <PlayerCard
          label="Du"
          player={state.self_profile}
          score={state.you.score}
          testId="battle-self"
          scoreTestId="battle-score-self"
        />
        <div style={{ fontSize: 22 }}>⚔️</div>
        {state.opponent ? (
          <PlayerCard
            label="Gegner"
            player={state.opponent}
            score={state.opponent.score}
            testId="battle-opponent"
            scoreTestId="battle-score-enemy"
          />
        ) : (
          <div className="muted">—</div>
        )}
      </div>

      {!finished && q ? (
        <>
          <div className="pill" data-testid="battle-question-progress">
            {state.current_question_index + 1} / {state.question_count} · {courseName}
          </div>
          <h2 data-testid="battle-current-question">{q.prompt}</h2>
          <div className="stack" data-testid="battle-answer-buttons">
            {q.options.map((option) => {
              const isPicked = selected === option.key || (youAnswered && selected === null && false);
              const showResult = youAnswered && correct !== null;
              let cls = 'option';
              if (showResult) {
                if (option.key === correct) cls = 'option correct';
                else if (option.key === selected) cls = 'option wrong';
              } else if (isPicked) {
                cls = 'option';
              }
              return (
                <button
                  key={option.key}
                  className={cls}
                  disabled={youAnswered || submitting}
                  onClick={() => answer(option.key)}
                  data-testid={`battle-answer-${option.key}`}
                >
                  <strong style={{ marginRight: 8 }}>{option.key}</strong>
                  {option.text}
                </button>
              );
            })}
          </div>

          {youAnswered ? (
            <div className="card" data-testid="battle-waiting-opponent">
              {opponentAnswered
                ? 'Beide Spieler haben geantwortet. Nächste Frage gleich…'
                : 'Du hast geantwortet. Warte auf Gegner…'}
            </div>
          ) : (
            <div className="muted">
              {opponentAnswered ? 'Gegner hat bereits geantwortet. Du bist dran!' : 'Wähle eine Antwort.'}
            </div>
          )}

          <button className="btn" onClick={cancelOrLeave} data-testid="battle-leave-match">
            Match verlassen
          </button>
        </>
      ) : null}

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
}: {
  label: string;
  player: PlayerPublic;
  score?: number;
  testId?: string;
  scoreTestId?: string;
}) {
  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <Avatar avatarKey={player.avatar_key} size="sm" />
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div data-testid={testId ? `${testId}-name` : undefined} style={{ fontWeight: 600 }}>
        {player.username}
      </div>
      {typeof score === 'number' ? (
        <div className="kpi" data-testid={scoreTestId}>{score}</div>
      ) : null}
    </div>
  );
}
