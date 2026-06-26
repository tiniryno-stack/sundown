/**
 * Service-layer DTOs (§18 item 6).
 *
 * `PlayerView` is the privacy boundary: it is the ONLY shape players receive. It
 * deliberately omits everything the spec marks internal — other players' roles,
 * the true bar value (banded instead, §14/§15.1), attribution, per-team living
 * counts, killer suggestions (those come only via the kill context), and move
 * charges (killers only). See gameService.ts `projectFor`.
 */

import type { GameConfig, RoleFlags } from "../engine/config.js";
import type { EngineSnapshot } from "../engine/engine.js";
import type { GameResult, PublicEvent, RoleName } from "../engine/types.js";
import type { Task } from "../deck/types.js";

export interface RosterEntry {
  id: string;
  name: string;
  token: string;
}

/** The full persisted record for a game (host/internal — never sent to players). */
export interface ServiceGameRecord {
  id: string;
  hostId: string;
  phase: "lobby" | "active" | "resolved";
  roundIndex: number;
  config: GameConfig;
  seedBase: string;
  roster: RosterEntry[];
  engine: EngineSnapshot | null;
  deck: Task[] | null;
  /** playerId → taskId → minute when the task becomes available again (§7.3). */
  cooldowns: Record<string, Record<string, number>>;
  /** Fresh, history-free kill suggestions (§9): suggesterId → targetId. */
  suggestions: Record<string, string>;
  /** voteIndex → (voterId → targetId). */
  ballots: Record<number, Record<string, string>>;
  /** Scheduled vote indices already resolved. */
  resolvedVotes: number[];
  /** Wall-clock epoch ms when the current round started (0 if not started). */
  startedAtMs: number;
  /** Per-round results (Seasons format may have several). */
  results: GameResult[];
  /** Pending witness notices — delivered to target player on next state poll after deliverAfterMs. */
  witnessNotices?: { id: string; forPlayerId: string; fromName: string; taskPrompt: string; deliverAfterMs: number }[];
  /** Player task ratings — collected for training data. */
  taskRatings?: { taskPrompt: string; rating: "up" | "down"; playerId: string; at: number }[];
}

export type BarStatus = "healthy" | "strained" | "critical" | "unknown";

export interface PublicPlayer {
  id: string;
  name: string;
  alive: boolean;
}

export interface PlayerView {
  gameId: string;
  phase: ServiceGameRecord["phase"];
  roundIndex: number;
  nowMinute: number;
  finaleMinute: number;
  /** Unix ms when this round started — used by clients to display real wall-clock times. */
  startedAtMs: number;

  you: {
    id: string;
    name: string;
    role: RoleName; // YOUR OWN role only
    team: "town" | "killer"; // YOUR OWN team only
    alive: boolean;
    isGhost: boolean;
    /** Killer-only economy view (own meter + team move charges). */
    killer?: {
      meterPoints: number;
      killCost: number;
      canKillNow: boolean;
      teamMoveCharges: number;
      maxMoves: number;
    };
    cop?: { investigations: number };
    medic?: { shields: number };
  };

  /** Coarse, banded bar status — never the exact % (§14/§15.1). */
  bar: BarStatus;
  /** Total living players (public; killers/town breakdown is NOT exposed, §9). */
  livingCount: number;
  /** Public roster (names + alive only — never roles). */
  players: PublicPlayer[];

  /** Vague, delayed public event feed (§14). */
  events: PublicEvent[];

  vote: {
    open: boolean;
    index: number | null;
    closesAtMinute: number | null;
    youVoted: boolean;
  };

  result: GameResult | null;
}

export interface CreateGameRequest {
  hostId: string;
  players: number;
  dayLengthMin?: number;
  roles?: Partial<RoleFlags>;
  seed?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CompleteTaskResult extends ActionResult {
  cooldownUntilMinute?: number;
}

export interface KillContext {
  canKillNow: boolean;
  /** Anonymous, current-only suggestions from other unlocked killers (§9). */
  suggestions: string[];
}

/** Omniscient host-only view — NEVER sent to players. */
export interface HostView {
  gameId: string;
  phase: "lobby" | "active" | "resolved";
  players: {
    id: string;
    name: string;
    alive: boolean;
    role: string;
    team: string;
    meterPoints?: number;
    canKillNow?: boolean;
  }[];
  /** Exact 0–100 bar value (not banded). */
  bar: number;
  barBand: BarStatus;
  livingCount: number;
  killerCount: number;
  townCount: number;
  nowMinute: number;
  finaleMinute: number;
  startedAtMs: number;
  events: Array<{ at: number; kind: string; message: string }>;
  killCost: number;
  maxMoves: number;
  moveCharges: number;
  voteTimesMin: number[];
  vote: {
    open: boolean;
    index: number | null;
    closesAtMinute: number | null;
    totalVotes: number;
    totalEligible: number;
  };
  result: { winner: string; reason: string; at: number } | null;
}
