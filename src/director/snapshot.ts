/**
 * Director state snapshot (§15.6).
 *
 * This is the omniscient, Director-ONLY view the host sends to the model. It is
 * never surfaced to players. The Director may reason over it but, per Hard
 * Constraint 1 (§15.1), may only ever ACT (return bounded levers) — it can never
 * echo any of this back into a player-facing channel. The `DirectorPatch` type
 * (guardrails.ts) structurally cannot carry any of these identities/values.
 */

import type { GameEngine } from "../engine/engine.js";

export interface DirectorSnapshot {
  now: number;
  finaleMin: number;
  /** Fraction of the round elapsed [0,1]. */
  timeProgress: number;

  livingTown: number;
  livingKillers: number;

  /** True town-bar value (internal). */
  townBar: number;
  barCap: number;

  moveChargesBanked: number;
  movesUsed: number;
  maxMoves: number;

  /** Kills resolved so far (pace signal). */
  killsResolved: number;
  /** Town vote catches (killer removed or moved) so far. */
  voteCatches: number;
  votesHeld: number;

  /** Recent engagement: task completions per minute over the last window. */
  recentTasksPerMin: number;

  /** Live levers' current values (so the Director sees its own prior nudges). */
  decayPerMin: number;
  taskValueMultiplier: number;
  decayBaseline: number;
}

const RECENT_WINDOW_MIN = 30;

export function buildSnapshot(engine: GameEngine): DirectorSnapshot {
  const s = engine.state;
  const log = s.internalLog;

  let killsResolved = 0;
  let voteCatches = 0;
  let votesHeld = 0;
  let recentTasks = 0;
  for (const e of log) {
    if (e.type === "eliminated" && e.detail.cause === "kill") killsResolved++;
    if (e.type === "killerRemoved" || e.type === "killerMoved") voteCatches++;
    if (e.type === "voteTallied") votesHeld++;
    if (e.type === "taskCompleted" && e.at >= s.now - RECENT_WINDOW_MIN) recentTasks++;
  }

  return {
    now: s.now,
    finaleMin: s.config.finaleMin,
    timeProgress: s.config.finaleMin === 0 ? 0 : s.now / s.config.finaleMin,
    livingTown: engine.livingTown().length,
    livingKillers: engine.livingKillers().length,
    townBar: s.townBar,
    barCap: s.config.barCap,
    moveChargesBanked: s.moveCharges,
    movesUsed: s.movesUsed,
    maxMoves: s.config.maxMoves,
    killsResolved,
    voteCatches,
    votesHeld,
    recentTasksPerMin: recentTasks / RECENT_WINDOW_MIN,
    decayPerMin: s.decayPerMin,
    taskValueMultiplier: s.taskValueMultiplier,
    decayBaseline: s.config.decayPerMin,
  };
}
