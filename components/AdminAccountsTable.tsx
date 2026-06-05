'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type AccountRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  role: string;
  active_course_label: string;
  xp: number;
  battle_points: number;
  current_streak: number;
  lessons_passed: number;
  created_at: string;
  last_sign_in_at: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminAccountsTable({
  rows,
  currentUserId,
}: {
  rows: AccountRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<AccountRow | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.email, r.username, r.display_name, r.role, r.active_course_label, r.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  async function toggleRole(row: AccountRow) {
    const nextRole = row.role === 'admin' ? 'student' : 'admin';
    setRoleBusyId(row.id);
    setRoleError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/accounts/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: row.id, role: nextRole }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setRoleError(data.message || `Fehler (${res.status}).`);
        setRoleBusyId(null);
        return;
      }
      setNotice(`Rolle auf ${nextRole} gesetzt.`);
      setRoleBusyId(null);
      router.refresh();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
      setRoleBusyId(null);
    }
  }

  function openDialog(row: AccountRow) {
    setTarget(row);
    setConfirmText('');
    setError(null);
    setNotice(null);
  }

  function closeDialog() {
    if (busy) return;
    setTarget(null);
    setConfirmText('');
    setError(null);
  }

  async function submitDelete() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/accounts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: target.id, confirm: confirmText.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        deleted_email?: string | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.message || `Fehler (${res.status}).`);
        setBusy(false);
        return;
      }
      setNotice(
        data.deleted_email
          ? `Konto ${data.deleted_email} gelöscht.`
          : 'Konto gelöscht.'
      );
      setTarget(null);
      setConfirmText('');
      setBusy(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
      setBusy(false);
    }
  }

  return (
    <div className="card stack" data-testid="admin-accounts">
      <div className="topbar">
        <h2 style={{ margin: 0 }}>Konten</h2>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Suchen (E-Mail, Name, Rolle…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="admin-accounts-search"
        />
      </div>
      {notice && (
        <div className="pill" style={{ background: 'rgba(37,208,127,.16)', color: '#7ef4b4', borderColor: 'rgba(37,208,127,.45)' }}>
          {notice}
        </div>
      )}
      {roleError && (
        <p className="field-error" data-testid="admin-accounts-role-error">{roleError}</p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="table" data-testid="admin-accounts-table">
          <thead>
            <tr>
              <th>E-Mail</th>
              <th>Benutzername</th>
              <th>Rolle</th>
              <th>Aktiver Kurs</th>
              <th>XP / BP</th>
              <th>Streak</th>
              <th>Lektionen</th>
              <th>Erstellt</th>
              <th>Letzter Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                  Keine Konten gefunden.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const self = r.id === currentUserId;
              return (
                <tr key={r.id} data-testid={`account-row-${r.id}`}>
                  <td>{r.email ?? '—'}</td>
                  <td>{r.username ?? r.display_name ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="pill"
                      onClick={() => toggleRole(r)}
                      disabled={self || roleBusyId === r.id}
                      title={self ? 'Eigene Rolle nicht aenderbar' : `Rolle wechseln zu ${r.role === 'admin' ? 'student' : 'admin'}`}
                      data-testid={`account-role-${r.id}`}
                      style={{
                        cursor: self ? 'not-allowed' : 'pointer',
                        opacity: self ? 0.6 : 1,
                        ...(r.role === 'admin'
                          ? { background: 'rgba(255,216,77,.16)', color: '#ffd84d', borderColor: 'rgba(255,216,77,.45)' }
                          : {}),
                      }}
                    >
                      {roleBusyId === r.id ? '...' : r.role}
                    </button>
                  </td>
                  <td>{r.active_course_label}</td>
                  <td>{r.xp} / {r.battle_points}</td>
                  <td>{r.current_streak}</td>
                  <td>{r.lessons_passed}</td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>{fmtDate(r.last_sign_in_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openDialog(r)}
                      disabled={self}
                      title={self ? 'Eigener Admin-Account – nicht löschbar' : 'Konto löschen'}
                      data-testid={`account-delete-${r.id}`}
                      style={
                        self
                          ? { opacity: 0.5, cursor: 'not-allowed' }
                          : { borderColor: 'rgba(255,92,122,.45)', color: '#ff8fa5' }
                      }
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {target && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="account-delete-dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3,5,10,.78)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={closeDialog}
        >
          <div
            className="card stack"
            style={{ maxWidth: 520, width: '100%', borderColor: 'rgba(255,92,122,.45)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="pill" style={{ background: 'rgba(255,92,122,.16)', color: '#ff8fa5', borderColor: 'rgba(255,92,122,.45)' }}>
              Unwiderruflich
            </span>
            <h2 style={{ margin: 0 }}>Konto endgültig löschen?</h2>
            <p className="muted" style={{ margin: 0 }}>
              <strong>{target.email ?? target.id}</strong>
              {target.username ? ` (${target.username})` : ''} wird aus Supabase Auth entfernt.
              Profil, Lernfortschritt, Battle-Punkte und Battle-Antworten werden über die Datenbank-Kaskade gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <label className="stack" style={{ gap: 6 }}>
              <span className="muted">Tippe <code>DELETE</code> zur Bestätigung:</span>
              <input
                className="input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
                data-testid="account-delete-confirm-input"
              />
            </label>
            {error && (
              <p className="field-error" data-testid="account-delete-error">
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeDialog} disabled={busy}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn"
                onClick={submitDelete}
                disabled={busy || confirmText.trim() !== 'DELETE'}
                data-testid="account-delete-submit"
                style={{
                  background: 'linear-gradient(180deg,#ff5c7a,#c8324f)',
                  borderColor: 'transparent',
                  color: '#fff',
                  opacity: busy || confirmText.trim() !== 'DELETE' ? 0.6 : 1,
                }}
              >
                {busy ? 'Lösche…' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
