'use client';
import { useState } from 'react';
import { Lumio } from '@/components/AppShell';

type BattleQuestion = { prompt: string; options: string[]; correct: string };

export function BattleClient({ questions, courseName }: { questions: BattleQuestion[]; courseName: string }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [enemy, setEnemy] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('');

  const q = questions[index];

  function pick(option: string) {
    if (selected || finished) return;
    setSelected(option);
    if (option === q.correct) setScore((v) => v + 1);
    else setEnemy((v) => v + 1);
  }

  async function next() {
    if (index < questions.length - 1) {
      setIndex((v) => v + 1);
      setSelected(null);
      return;
    }
    setFinished(true);
    const response = await fetch('/api/battle-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, enemyScore: enemy }),
    });
    const result = await response.json();
    setMessage(result.message ? `${result.message} ${result.reward ? `+${result.reward} XP` : ''}` : '');
  }

  return (
    <div className="card stack">
      <div className="scorebox">
        <div><div className="muted">Du</div><div className="kpi" data-testid="battle-score-self">{score}</div></div>
        <div style={{ fontSize: 22 }}>👑</div>
        <div><div className="muted">Gegner</div><div className="kpi" data-testid="battle-score-enemy">{enemy}</div></div>
      </div>
      {!finished ? (
        <>
          <div className="pill">{index + 1}. Frage · {courseName}</div>
          <h2>{q.prompt}</h2>
          {q.options.map((option) => {
            const cls = selected
              ? option === q.correct
                ? 'option correct'
                : option === selected
                  ? 'option wrong'
                  : 'option'
              : 'option';
            return <button key={option} className={cls} onClick={() => pick(option)}>{option}</button>;
          })}
          {selected ? (
            <div className="card">{selected === q.correct ? 'RICHTIG! +1' : 'Leider Nein!'}</div>
          ) : null}
          <button className="btn btn-primary" disabled={!selected} onClick={next}>
            {index < questions.length - 1 ? 'Nächste Frage' : 'Battle beenden'}
          </button>
        </>
      ) : (
        <div className="card stack">
          <h2>{score} : {enemy}</h2>
          <div className="muted">{score > enemy ? 'Du hast gewonnen' : score === enemy ? 'Unentschieden' : 'Du hast verloren'}</div>
          {message ? <div>{message}</div> : null}
        </div>
      )}
    </div>
  );
}
