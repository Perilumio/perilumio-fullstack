-- Battle-Modus stabilisieren: Per-Frage-Timeout, Cleanup-RPC, Audit-Log.
-- Idempotent und sicher mehrfach ausfuehrbar.

-- ── 1. Zeitstempel pro Frage (fuer Server-seitiges 60s-Timeout) ──────────────
-- Wird gesetzt, wenn ein Match aktiv wird und bei jedem Fragenwechsel. lib/battle.ts
-- markiert nach BATTLE_QUESTION_TIMEOUT_MS nicht-beantwortende Spieler als falsch.
alter table public.battle_matches
  add column if not exists current_question_started_at timestamptz;

-- Bestehende aktive Matches: Fallback auf last_activity_at, damit das Timeout
-- nicht sofort mit NULL feuert.
update public.battle_matches
  set current_question_started_at = coalesce(current_question_started_at, last_activity_at, now())
  where status = 'active' and current_question_started_at is null;

-- ── 2. battle_logs: schlankes Audit-Log fuer spaeteres Debugging ─────────────
create table if not exists public.battle_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null
    check (event_type in ('match_start','answer','timeout','match_end','cancel')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists battle_logs_match_idx on public.battle_logs (match_id);
create index if not exists battle_logs_created_idx on public.battle_logs (created_at);

alter table public.battle_logs enable row level security;
-- Nur Insert ueber service-role (API-Layer). Keine Policies fuer authenticated:
-- die Logs sind ein internes Debug-Artefakt, keine Spielerdaten.

-- ── 3. cleanup_stale_battles(): manuell aufrufbarer Cleanup ──────────────────
-- Schliesst Matches, die seit mehr als 5 Minuten keine Aktivitaet hatten:
--   - waiting  -> cancelled (nie ein Gegner beigetreten)
--   - active   -> finished als Unentschieden ohne BP (haengengeblieben)
-- Gibt die Anzahl betroffener Zeilen zurueck. Idempotent: nur stale Matches.
create or replace function public.cleanup_stale_battles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - interval '5 minutes';
  v_count integer := 0;
  v_n integer;
begin
  update public.battle_matches
    set status = 'cancelled', finished_at = now()
    where status = 'waiting' and last_activity_at < v_cutoff;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  update public.battle_matches
    set status = 'finished',
        result = 'draw',
        finished_at = now(),
        bp_awarded = true
    where status = 'active' and last_activity_at < v_cutoff;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  return v_count;
end;
$$;

revoke all on function public.cleanup_stale_battles() from public;
