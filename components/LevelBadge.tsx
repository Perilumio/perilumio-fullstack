import { tierForLevel, levelProgress } from '@/lib/levels';

// Level-Badge: zeigt die aktuelle Stufe (kursneutraler Name aus LEVEL_TIERS)
// samt Stufenfarbe. Wird optional XP übergeben, rendert die Komponente
// zusätzlich einen XP-bis-naechstes-Level-Balken. Reines Server-Markup,
// keine Interaktivitaet noetig.
export function LevelBadge({
  level,
  xp,
  testId,
}: {
  level: number;
  xp?: number;
  testId?: string;
}) {
  const tier = tierForLevel(level);
  const progress = typeof xp === 'number' ? levelProgress(xp) : null;

  return (
    <div className="level-badge" data-testid={testId} data-level-tier={tier.key}>
      <div className="level-badge-head">
        <span
          className="level-badge-chip"
          style={{ color: tier.color, borderColor: tier.color }}
          data-testid="level-badge-tier"
        >
          <span
            aria-hidden="true"
            className="level-badge-dot"
            style={{ background: tier.color }}
          />
          {tier.label}
        </span>
        <span className="level-badge-level muted" data-testid="level-badge-level">
          Level {Math.max(1, Math.floor(level))}
        </span>
      </div>
      {progress && (
        <div className="level-badge-progress" data-testid="level-badge-progress">
          <div
            className="level-badge-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-label="Fortschritt bis zum naechsten Level"
          >
            <div
              className="level-badge-bar-fill"
              style={{
                width: `${progress.percent}%`,
                background: `linear-gradient(90deg, ${tier.color}, ${progress.nextLevelTier.color})`,
              }}
              data-testid="level-badge-bar-fill"
            />
          </div>
          <span className="muted level-badge-hint" data-testid="level-badge-hint">
            {progress.xpInLevel} / {progress.xpForNext} XP bis Level {progress.level + 1}
          </span>
        </div>
      )}
    </div>
  );
}
