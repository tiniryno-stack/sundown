/* Polling hook — the heartbeat of the player app. The backend is poll-based
   (no websockets), so we re-fetch GET /games/:id/state on an interval and after
   actions. Time advances lazily server-side per request, so polling also drives
   the in-game clock forward. */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { Identity, PlayerView } from "./types";

const POLL_MS = 5000;

export type PlayerViewState = {
  view: PlayerView | null;
  error: string | null;
  /** true until the first successful fetch */
  loading: boolean;
  /** force an immediate re-fetch (call after a mutating action) */
  refresh: () => void;
};

export function usePlayerView(identity: Identity | null): PlayerViewState {
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tick = useRef(0);

  const fetchOnce = useCallback(async () => {
    if (!identity) return;
    try {
      const v = await api.getState(identity.gameId, identity.playerId, identity.token);
      setView(v);
      setError(null);
    } catch (e) {
      // Bad credentials means this identity is stale (game reset, etc.).
      if (e instanceof ApiError && /credential/i.test(e.message)) {
        setError("bad credentials");
      } else {
        setError(e instanceof Error ? e.message : "network error");
      }
    } finally {
      setLoading(false);
    }
  }, [identity]);

  const refresh = useCallback(() => {
    tick.current++;
    void fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    if (!identity) return;
    let alive = true;
    setLoading(true);
    void fetchOnce();
    const id = setInterval(() => {
      if (alive) void fetchOnce();
    }, POLL_MS);
    // Re-poll promptly when the app returns to the foreground.
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchOnce();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [identity, fetchOnce]);

  return { view, error, loading, refresh };
}
