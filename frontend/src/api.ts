/* API client — wraps the backend GameService HTTP server (../API.md, ../src/server/http.ts).
   POST routes take a JSON body; GET routes take query params. Player creds
   (playerId, token) and host creds (hostId) ride along on every relevant call. */

import type {
  ActionResult, GameResult, KillContext, PlayerView, TasksResponse,
} from "./types";

const BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://sundown-backend-production.up.railway.app";

export function apiBase(): string {
  return BASE;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & Partial<ActionResult>;
  if (!res.ok || json?.ok === false) {
    throw new ApiError(json?.error || `Request failed (${res.status})`, res.status);
  }
  return json as T;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`);
  const json = (await res.json().catch(() => ({}))) as T & Partial<ActionResult>;
  if (!res.ok || (json as Partial<ActionResult>)?.ok === false) {
    throw new ApiError((json as Partial<ActionResult>)?.error || `Request failed (${res.status})`, res.status);
  }
  return json as T;
}

export const api = {
  health: () => get<{ ok: boolean }>("/health"),

  // ── Lobby & lifecycle ───────────────────────────────────────────
  createGame: (input: {
    hostId: string;
    players: number;
    dayLengthMin?: number;
    roles?: { cop?: boolean; medic?: boolean; killerCounterRole?: boolean };
    seed?: string;
  }) => post<{ gameId: string }>("/games", input),

  join: (gameId: string, name: string) =>
    post<{ playerId: string; token: string }>(`/games/${gameId}/join`, { name }),

  startRound: (gameId: string, hostId: string) =>
    post<ActionResult>(`/games/${gameId}/start`, { hostId }),

  nextRound: (gameId: string, hostId: string) =>
    post<ActionResult>(`/games/${gameId}/next-round`, { hostId }),

  getResult: (gameId: string) => get<GameResult | null>(`/games/${gameId}/result`),

  // ── Player state ────────────────────────────────────────────────
  getState: (gameId: string, playerId: string, token: string) =>
    get<PlayerView>(`/games/${gameId}/state`, { playerId, token }),

  getTasks: (gameId: string, playerId: string, token: string) =>
    get<TasksResponse>(`/games/${gameId}/tasks`, { playerId, token }),

  // ── Player actions ──────────────────────────────────────────────
  completeTask: (gameId: string, playerId: string, token: string, taskId: string) =>
    post<ActionResult>(`/games/${gameId}/tasks/complete`, { playerId, token, taskId }),

  castVote: (gameId: string, playerId: string, token: string, targetId: string) =>
    post<ActionResult>(`/games/${gameId}/vote`, { playerId, token, targetId }),

  // ── Killer-only ─────────────────────────────────────────────────
  killerKill: (gameId: string, playerId: string, token: string, targetId: string) =>
    post<ActionResult>(`/games/${gameId}/killer/kill`, { playerId, token, targetId }),

  killerBankMove: (gameId: string, playerId: string, token: string) =>
    post<ActionResult>(`/games/${gameId}/killer/bank-move`, { playerId, token }),

  killerSuggest: (gameId: string, playerId: string, token: string, targetId: string) =>
    post<ActionResult>(`/games/${gameId}/killer/suggest`, { playerId, token, targetId }),

  getKillContext: (gameId: string, playerId: string, token: string) =>
    get<KillContext>(`/games/${gameId}/killer/context`, { playerId, token }),

  // ── Push (added in src/server/http.ts; see backend push module) ──
  pushPublicKey: () => get<{ key: string | null }>("/push/public-key"),

  pushSubscribe: (gameId: string, playerId: string, token: string, subscription: unknown) =>
    post<ActionResult>(`/games/${gameId}/push/subscribe`, { playerId, token, subscription }),
};

export { ApiError };
