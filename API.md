# API Contract — All-Day Social Deduction Backend

This is the contract the frontend (built separately in Claude Design) consumes.
The backend is a framework-agnostic [`GameService`](src/service/gameService.ts);
each method below maps 1:1 to a logical endpoint. A thin HTTP layer can wrap these
verbatim — request fields become the body, the return value becomes the JSON
response. All methods are `async`.

> **Source of truth:** `game-spec.md`. This document only describes the wire shape.

## Core privacy guarantees (enforced in code, not by convention)

Every player-facing response is the `PlayerView` projection. The service **never**
exposes:

- **Other players' roles or teams** — the public roster is `{ id, name, alive }` only.
- **The exact town-bar value** — only a coarse band (`healthy | strained | critical`),
  per §14 / §15.1. (Internally the bar is a precise number; it never crosses the boundary.)
- **The killers/town living breakdown** — only the **total** `livingCount` (§9: town sees the count drop, not the composition).
- **Attribution** — who completed which task / who killed whom is internal-only (§7.3).
- **Killer economy** to non-killers — `you.killer` (meter, team move charges) is present only for killer-team players.
- **Killer suggestions** as a log — they are fresh, anonymous, current-only (§9), and only via `getKillContext`.

All state changes (tasks, kills, votes, Director nudges) apply on a **delay** (§14);
responses reflect only already-applied public state.

---

## Identifiers & auth

- `gameId` — returned by `createGame`.
- `playerId` + `token` — returned by `join`. Every player action requires both; a mismatch returns `{ ok: false, error: "bad credentials" }`.
- Host-only endpoints require the `hostId` used in `createGame`.

A failed call returns `{ ok: false, error: string }` (type `ActionResult`); read endpoints return their payload or an `ActionResult` error.

---

## Lobby & lifecycle

### `createGame(input) → { gameId }`  · host
`POST /games`
```ts
input: {
  hostId: string;
  players: number;            // intended headcount (re-derived from actual roster at start)
  dayLengthMin?: number;      // default 780 (9 AM → ~10 PM)
  roles?: { cop?: boolean; medic?: boolean; killerCounterRole?: boolean };
  seed?: string;              // optional, for reproducibility
}
```
Creates a lobby. Killer count, decay, vote schedule, etc. derive from the ratio model (§16.2).

### `join(gameId, name) → { playerId, token }`
`POST /games/:id/join` — Adds a player while in `lobby`. Fails once started.

### `startRound(gameId, hostId) → { ok }`  · host
`POST /games/:id/start` — Requires ≥ 4 players. **Headcount picks the format** (§3): config is re-derived for the actual roster size, roles are assigned (seeded), the task deck is generated (mock offline, real Anthropic if `ANTHROPIC_API_KEY` is set), and the round clock starts.

### `nextRound(gameId, hostId) → { ok }`  · host
`POST /games/:id/next-round` — Seasons format (§3): only when the current round is `resolved`. Re-shuffles roles into a fresh round and applies the Director's **between-round structural adaptation** (§15.2; e.g. pricier move charges if killers steamrolled — scaffolded, §17 open).

### `getResult(gameId) → GameResult | null`
`GET /games/:id/result`
```ts
GameResult: { winner: "town" | "killer"; reason: "parity" | "collapse" | "allKillersEliminated" | "finaleSurvival"; at: number }
```

---

## Player state

### `getState(gameId, playerId, token) → PlayerView`
`GET /games/:id/state` — The single read endpoint a player polls.

```ts
PlayerView: {
  gameId: string;
  phase: "lobby" | "active" | "resolved";
  roundIndex: number;
  nowMinute: number;          // engine-minutes since round start (0 = 9 AM)
  finaleMinute: number;

  you: {
    id; name;
    role: "townsperson" | "killer" | "cop" | "medic";   // YOUR OWN role only
    team: "town" | "killer";                            // YOUR OWN team only
    alive: boolean;
    isGhost: boolean;
    killer?: { meterPoints; killCost; canKillNow; teamMoveCharges; maxMoves };  // killer-team only
    cop?:    { investigations };                         // cop only
    medic?:  { shields };                                // medic only
  };

  bar: "healthy" | "strained" | "critical" | "unknown"; // banded, never the % (§14)
  livingCount: number;                                   // total living only (§9)
  players: { id; name; alive }[];                        // public roster — NO roles
  events: { at; kind; message }[];                       // vague, riddly feed (§14)

  vote: { open: boolean; index: number | null; closesAtMinute: number | null; youVoted: boolean };

  result: GameResult | null;
}
```
> `you.role` / `you.team` are only meaningful when `phase !== "lobby"` (roles are assigned at `startRound`).

---

### `getTasks(gameId, playerId, token) → { tasks, nowMinute }`
`GET /games/:id/tasks` — The shared task deck for this round plus this player's
cooldown state. Fetch once on join and re-fetch after completing a task (or
periodically). The same prompts are doable by everyone — that's the camouflage (§7.1).
```ts
tasks: { id; prompt; tier: "light"|"standard"|"heavy"|"group"; points; kind: "social"|"covert";
         group: boolean; intensitySwap: string; requiresProp?: string;
         availableAtMinute: number /* 0 = available now; else cooldown end */ }[]
```

---

## Actions (player)

### `completeTask(gameId, playerId, token, taskId) → { ok, error?, cooldownUntilMinute? }`
`POST /games/:id/tasks/complete` — Honor-system "done" tap (§7.3). Routed by team: town → town bar, killer → that killer's meter (the **separate-progress** invariant, §8). Per-task per-player cooldown (§7.3, ~35 min); a too-soon repeat returns `cooldownUntilMinute`. Faking is allowed by design — the service just records the tap.

### `castVote(gameId, playerId, token, targetId) → { ok }`
`POST /games/:id/vote` — Valid only while a scheduled vote is **open** (opens 20 min before each scheduled time, §6). Living players only. The plurality is resolved **at** the scheduled time and the elimination lands on a delay, unnamed (§6/§9).

### `killerKill(gameId, playerId, token, targetId) → { ok }`  · killer
`POST /games/:id/killer/kill` — Requires the killer's own meter ≥ `killCost` (§9). Resolves on a delay as a vague "death/switch". Clears the current suggestion set (fresh each time, §9).

### `killerBankMove(gameId, playerId, token) → { ok }`  · killer
`POST /games/:id/killer/bank-move` — Spends `moveCost` from the killer's meter to bank a team move charge, capped at `maxMoves` (§10). The offense-vs-resilience trade-off.

### `killerSuggest(gameId, playerId, token, targetId) → { ok }`  · killer
`POST /games/:id/killer/suggest` — Posts an anonymous target suggestion (no self-targets). Stored without history (§9).

### `getKillContext(gameId, playerId, token) → { canKillNow, suggestions }`  · killer
`GET /games/:id/killer/context` — Returns whether a kill is affordable now and the **anonymized, current-only** suggestions from other unlocked killers (the requester's own and self-targets are excluded — so 3+ killers still can't identify each other, §9).

---

## Host: AI Director

### `runDirectorTick(gameId, hostId) → DirectorTickResult`  · host
`POST /games/:id/director/tick` — Runs one snapshot → bounded-JSON-adjustment cycle (§15). The host backend calls this on a cadence (~10–15 min and on key events, §15.6). The model never sees player-facing channels; its adjustments are **clamped to guardrail bounds** and **applied on the standard delay**. Returns (host-only — never forward to players):
```ts
DirectorTickResult: {
  patch: { decayPerMin?: number; taskValueMultiplier?: number };  // the clamped, applied levers
  rejectedKeys: string[];   // keys the model tried to set that aren't allowed (votes/targets/roles/structural)
  clampedKeys: string[];    // allowed keys whose values were clamped into bounds
  scheduledAt: number | null;
  snapshot: DirectorSnapshot; // omniscient — DO NOT surface
}
```

---

## Notes for the frontend

- Poll `getState` for the player view; render `bar` as a coarse indicator and `events` as the riddly notification feed — do not attempt to derive exact numbers (by design there are none).
- Killer-only UI (kill / bank-move / suggest, meter, charges) should render only when `you.killer` is present.
- Cop/Medic UI render on `you.cop` / `you.medic`. Their exact powers/uses are a §17.1 open question — treat counts as opaque.
- Vote UI opens when `vote.open` is true and closes at `vote.closesAtMinute`.
- All player-to-player communication happens **outside** the app (§1). The backend has no messaging endpoints, by design.
