'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_key: string | null;
  xp: number | null;
  battle_points: number | null;
};

type SearchRow = ProfileRow & { is_friend: boolean };

type Props = {
  friends: ProfileRow[];
};

function formatScore(n: number | null | undefined) {
  return new Intl.NumberFormat('de-CH').format(n ?? 0);
}

function nameOf(row: ProfileRow) {
  return row.username || row.display_name || 'Lehrling';
}

export default function FriendsClient({ friends }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    setSearchError(null);
    if (trimmed.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(trimmed)}`, {
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Suche fehlgeschlagen.');
      setResults(data.results ?? []);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setSearchError(err instanceof Error ? err.message : 'Suche fehlgeschlagen.');
      setResults([]);
    } finally {
      if (abortRef.current === ctrl) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void runSearch(query); }, 250);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const setPending = (id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const addFriend = async (friendId: string) => {
    setActionError(null);
    setPending(friendId, true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Hinzufügen fehlgeschlagen.');
      setResults((prev) =>
        prev ? prev.map((r) => (r.id === friendId ? { ...r, is_friend: true } : r)) : prev,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Hinzufügen fehlgeschlagen.');
    } finally {
      setPending(friendId, false);
    }
  };

  const removeFriend = async (friendId: string) => {
    setActionError(null);
    setPending(friendId, true);
    try {
      const res = await fetch(`/api/friends?friendId=${encodeURIComponent(friendId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Entfernen fehlgeschlagen.');
      setResults((prev) =>
        prev ? prev.map((r) => (r.id === friendId ? { ...r, is_friend: false } : r)) : prev,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.');
    } finally {
      setPending(friendId, false);
    }
  };

  const showResults = query.trim().length >= 2;
  const noResults = showResults && !searching && results !== null && results.length === 0 && !searchError;

  return (
    <section className="stack">
      <div className="card stack">
        <label htmlFor="friends-search" className="muted" style={{ fontSize: 13 }}>
          Nutzer suchen
        </label>
        <input
          id="friends-search"
          type="search"
          className="input"
          placeholder="Username oder Anzeigename…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          data-testid="friends-search-input"
        />
        {actionError && (
          <p className="field-error" data-testid="friends-action-error">{actionError}</p>
        )}
        {showResults && (
          <div className="stack" data-testid="friends-search-results">
            {searching && (
              <p className="muted" data-testid="friends-search-loading">Suche läuft…</p>
            )}
            {searchError && (
              <p className="field-error" data-testid="friends-search-error">{searchError}</p>
            )}
            {noResults && (
              <p className="muted" data-testid="friends-search-empty">Keine Nutzer gefunden.</p>
            )}
            {results && results.map((row) => {
              const pending = pendingIds.has(row.id);
              return (
                <div className="card lb-row" key={row.id} data-testid="friends-search-row">
                  <Avatar avatarKey={row.avatar_key} size="sm" testId="friends-search-avatar" />
                  <div className="lb-meta" style={{ flex: 1, minWidth: 0 }}>
                    <strong>{nameOf(row)}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>
                      XP {formatScore(row.xp)} · BP {formatScore(row.battle_points)}
                    </span>
                  </div>
                  {row.is_friend ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => removeFriend(row.id)}
                      disabled={pending || isPending}
                      data-testid="friends-remove-button"
                    >
                      {pending ? '…' : 'Entfernen'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => addFriend(row.id)}
                      disabled={pending || isPending}
                      data-testid="friends-add-button"
                    >
                      {pending ? '…' : '+ Freund'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card stack" data-testid="friends-ranking">
        <div className="hero">
          <div>
            <span className="pill">Freunde-Rangliste</span>
            <h1 style={{ margin: '8px 0 6px', fontSize: 22 }}>Deine Freunde</h1>
            <p className="muted" style={{ margin: 0 }}>
              Sortiert nach XP, dann nach Battlepunkten.
            </p>
          </div>
        </div>
        {friends.length === 0 ? (
          <p className="muted" data-testid="friends-ranking-empty">
            Noch keine Freunde. Suche oben nach Nutzern, um sie hinzuzufügen.
          </p>
        ) : (
          friends.map((row, index) => {
            const pending = pendingIds.has(row.id);
            return (
              <div className="card lb-row" key={row.id} data-testid="friends-ranking-row">
                <span className="lb-rank">#{index + 1}</span>
                <Avatar avatarKey={row.avatar_key} size="sm" testId="friends-ranking-avatar" />
                <div className="lb-meta" style={{ flex: 1, minWidth: 0 }}>
                  <strong>{nameOf(row)}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    XP {formatScore(row.xp)} · BP {formatScore(row.battle_points)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => removeFriend(row.id)}
                  disabled={pending || isPending}
                  data-testid="friends-remove-button"
                >
                  {pending ? '…' : 'Entfernen'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
