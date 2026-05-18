'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AVATARS, DEFAULT_AVATAR_KEY, USERNAME_MAX, USERNAME_MIN, avatarSrc, validateUsername } from '@/lib/avatars';
import { saveProfile, type SaveProfileResult } from '@/app/actions/profile';

type Props = {
  initialUsername: string;
  initialAvatarKey: string;
};

export function ProfileEditor({ initialUsername, initialAvatarKey }: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [avatarKey, setAvatarKey] = useState(
    AVATARS.some((a) => a.key === initialAvatarKey) ? initialAvatarKey : DEFAULT_AVATAR_KEY,
  );
  const [result, setResult] = useState<SaveProfileResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const localCheck = validateUsername(username);
  const localError = !localCheck.ok ? localCheck.error : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveProfile(null, fd);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="stack" noValidate>
      <input type="hidden" name="avatar_key" value={avatarKey} data-testid="profile-avatar-key-input" />

      <label className="stack" style={{ gap: 6 }}>
        <span><strong>Benutzername</strong></span>
        <input
          name="username"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          required
          autoComplete="off"
          spellCheck={false}
          aria-invalid={localError ? 'true' : 'false'}
          data-testid="profile-username-input"
        />
        <small className="muted">
          {USERNAME_MIN}–{USERNAME_MAX} Zeichen. Erlaubt: Buchstaben, Zahlen, Punkt, Bindestrich, Unterstrich.
        </small>
        {localError && (
          <p className="field-error" data-testid="profile-username-error">{localError}</p>
        )}
      </label>

      <div className="stack" style={{ gap: 8 }}>
        <strong>Avatar wählen</strong>
        <p className="muted" style={{ margin: 0 }}>
          Aktuelle Auswahl:{' '}
          <span data-testid="profile-selected-avatar-label">
            {AVATARS.find((a) => a.key === avatarKey)?.label ?? 'Lumio'}
          </span>
        </p>
        <div className="avatar-grid" role="radiogroup" aria-label="Avatar wählen">
          {AVATARS.map((a) => {
            const selected = a.key === avatarKey;
            return (
              <button
                type="button"
                key={a.key}
                role="radio"
                aria-checked={selected}
                aria-label={a.label}
                onClick={() => setAvatarKey(a.key)}
                className={`avatar-option${selected ? ' is-selected' : ''}`}
                data-testid={`avatar-option-${a.key}`}
                data-selected={selected ? 'true' : 'false'}
              >
                <img src={avatarSrc(a.key)} alt="" width={240} height={216} loading="lazy" />
                <span className="avatar-option-label">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending || !!localError}
          data-testid="profile-save-button"
        >
          {isPending ? 'Speichern…' : 'Speichern'}
        </button>
        {result && (
          <span
            className={result.ok ? 'muted' : 'field-error'}
            data-testid={result.ok ? 'profile-save-success' : 'profile-save-error'}
            style={{ color: result.ok ? 'var(--green)' : undefined }}
          >
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
