'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const HEARTBEAT_MS = 25_000;

type State = {
  sessionId: string | null;
  starting: boolean;
  pendingPageViews: number;
  lastPath: string | null;
};

async function startSession(): Promise<string | null> {
  try {
    const res = await fetch('/api/analytics/session-start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.sessionId === 'string' ? data.sessionId : null;
  } catch {
    return null;
  }
}

async function heartbeat(sessionId: string, pageViewsDelta: number, ended: boolean) {
  const body = JSON.stringify({ sessionId, pageViewsDelta, ended });
  try {
    if (ended && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/session-heartbeat', blob);
      return;
    }
    await fetch('/api/analytics/session-heartbeat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
      keepalive: ended,
    });
  } catch {}
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const stateRef = useRef<State>({
    sessionId: null,
    starting: false,
    pendingPageViews: 0,
    lastPath: null,
  });

  useEffect(() => {
    let cancelled = false;
    const state = stateRef.current;

    const ensureSession = async () => {
      if (state.sessionId || state.starting) return;
      state.starting = true;
      const id = await startSession();
      state.starting = false;
      if (!cancelled && id) state.sessionId = id;
    };

    const sendHeartbeat = (ended = false) => {
      const id = state.sessionId;
      if (!id) return;
      const delta = state.pendingPageViews;
      state.pendingPageViews = 0;
      heartbeat(id, delta, ended);
    };

    ensureSession();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') sendHeartbeat(false);
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendHeartbeat(false);
      else ensureSession();
    };
    const onPageHide = () => sendHeartbeat(true);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (state.lastPath === pathname) return;
    state.lastPath = pathname;
    state.pendingPageViews += 1;
  }, [pathname]);

  return null;
}
