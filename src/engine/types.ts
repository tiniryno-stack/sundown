/**
 * Core domain types for the game engine.
 *
 * Two visibility tiers matter and are kept strictly apart:
 *   - INTERNAL state (this file's `GameState`): the host's omniscient view —
 *     roles, true bar value, attribution. NEVER exposed to players.
 *   - PUBLIC events / projections (see `PublicEvent`, and `service` layer): the
 *     vague, riddly, delayed view players actually receive (§14).
 */

import type { TaskTier } from "./economy.js";

export type Team = "town" | "killer";

export type RoleName = "townsperson" | "killer" | "cop" | "medic";

export interface Player {
  id: string;
  name: string;
  /** Current alignment. Can change: town→killer on silent flip / resurrection. */
  team: Team;
  role: RoleName;
  /** Living participant (eligible to act, counts toward parity). */
  alive: boolean;
  /** Eliminated-but-present: resurrection pool + accuracy ballot (§12). */
  isGhost: boolean;

  // --- killer economy (internal; §9–§10). Meter is per-killer. ---
  /** Accrued points toward kills/moves from this killer's own completions. */
  meterPoints: number;

  // --- powered-role resources (internal; §11) ---
  /** Cop: available investigation charges. */
  investigations: number;
  /** Medic: available shield charges. */
  shields: number;
  /** Points the medic has banked toward the next shield charge. */
  shieldProgress: number;
  /**
   * Killer counter-role flag (§11 asymmetry check). Scaffold only — its effect
   * (e.g. blocking an investigation) is a §17.1 open question.
   */
  counterRole: boolean;
}

/** A scheduled, not-yet-applied state change (§14: everything is delayed). */
export interface ScheduledEffect {
  id: string;
  kind: EffectKind;
  /** Engine-minutes at which this effect applies. */
  applyAt: number;
  /** Opaque payload; shape depends on kind. Internal only. */
  payload: Record<string, unknown>;
}

export type EffectKind =
  | "applyTownBar" // town completion lands on the bar
  | "applyKillerMeter" // killer completion lands on a killer's meter
  | "applyKill" // a kill resolves (death or switch)
  | "applyBankMove" // a move charge is banked
  | "applyVoteResolution" // a vote elimination resolves
  | "applyDirectorAdjustment"; // a Director nudge takes effect (§14/§15)

/** Public, vague event emitted to players (§14). Carries NO attribution. */
export interface PublicEvent {
  /** Engine-minute the event became public. */
  at: number;
  kind: PublicEventKind;
  /** A vague, riddly human string ("something's afoot"). */
  message: string;
}

export type PublicEventKind =
  | "taskCompleted" // "a task was done somewhere"
  | "deathOrSwitch" // "a death... or a switch" (never names victim, §9)
  | "moveMade" // "a move was made"
  | "voteResolved" // a scheduled vote concluded
  | "directorNudge" // "something shifted" — never says what
  | "collapseWarning" // the bar is dangerously low (vague)
  | "gameOver";

export type WinReason = "parity" | "collapse" | "allKillersEliminated" | "finaleSurvival";

export interface GameResult {
  winner: Team;
  reason: WinReason;
  /** Engine-minute the game resolved. */
  at: number;
}

export type RoundPhase = "lobby" | "active" | "resolved";

export interface GameState {
  config: import("./config.js").GameConfig;
  seed: number;
  /** Engine-minutes since round start (start = 0 ≈ 9 AM). */
  now: number;
  phase: RoundPhase;

  players: Player[];

  /** True town bar value (internal; §8). Players see a delayed/vague view. */
  townBar: number;

  /** Team-level banked move charges (§10). */
  moveCharges: number;
  /** Move charges consumed so far this game (caps at config.maxMoves). */
  movesUsed: number;

  /** Group-task points banked toward the next investigation (§7.5/§11). */
  investigationBank: number;

  /** Player ids currently shielded from the next kill (Medic, §11). */
  shieldedPlayerIds: string[];

  /** Live decay rate (%/min) — Director may nudge within bounds (§15.3). */
  decayPerMin: number;
  /** Live multiplier on task point value — Director may nudge (§15.3). */
  taskValueMultiplier: number;

  /** Pending, not-yet-applied effects (§14). */
  effects: ScheduledEffect[];

  /** Internal, attributed log — NEVER exposed (§7.3, §15.1). */
  internalLog: InternalLogEntry[];

  /** Public, vague event stream (§14). */
  publicEvents: PublicEvent[];

  /** Accuracy ballots per phase (§12). suspects keyed by voter id. */
  ballots: AccuracyBallot[];

  result: GameResult | null;
}

export interface InternalLogEntry {
  at: number;
  type: string;
  /** Attributed detail — who, role, target, points, etc. Host-only. */
  detail: Record<string, unknown>;
}

export interface AccuracyBallot {
  /** Vote index / phase this ballot belongs to. */
  phase: number;
  /** voterId → list of suspected killer ids. */
  picks: Record<string, string[]>;
}

/** Receipt returned to the caller of a command (mostly for the service layer). */
export interface CommandReceipt {
  ok: boolean;
  /** If scheduled, when the effect will apply (internal; not surfaced raw). */
  scheduledAt?: number;
  /** Reason on failure (e.g. "insufficient points"). */
  error?: string;
}

export interface CompleteTaskInput {
  playerId: string;
  tier: TaskTier;
  /** Optional explicit points override (defaults to TIER_POINTS[tier]). */
  points?: number;
  /** Was this completed as part of a coordinated group task (§11)? */
  group?: boolean;
}
