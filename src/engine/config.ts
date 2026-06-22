/**
 * Game configuration + the ratio model (§16).
 *
 * All structural numbers derive from two inputs — player count (N) and day
 * length (D minutes) — via the scaling formulas in §16.2. Defaults reproduce
 * the tuned 7-player config in §16.1.
 *
 * The Director (§15) may nudge a bounded subset of these IN-ROUND (decay, task
 * value, vote timing, etc.). It may NEVER change the "structural" ones
 * (kill_cost, move_cost, max_moves, killer count, win conditions) mid-round —
 * see §15.4. That distinction is encoded by `STRUCTURAL_PARAMS` below and
 * enforced in the Director module (Phase 4).
 */

/** Roles toggle (§11) — Cop/Medic are OPTIONAL and gated here (§17.1 open). */
export interface RoleFlags {
  /** Enable the Cop / Investigator powered town role (§11). */
  cop: boolean;
  /** Enable the Medic / Protector powered town role (§11). */
  medic: boolean;
  /**
   * Enable a killer counter-role that can block an investigation (§11 asymmetry
   * check). Scaffold only — effect tuning is a §17.1 open question.
   */
  killerCounterRole: boolean;
}

export const DEFAULT_ROLE_FLAGS: RoleFlags = {
  cop: false,
  medic: false,
  killerCounterRole: false,
};

/** Tie-break policy for votes when there is no unique most-voted player. */
export type TieResolution = "random" | "noElimination";

export interface GameConfig {
  // --- population (§16.2) ---
  players: number; // N
  killers: number; // K = round(0.28 × N), rounded down toward ~25% when ambiguous
  dayLengthMin: number; // D

  // --- town bar economy (§7.5, §16.1) ---
  barStart: number; // %
  barCap: number; // %
  barPercentPerPoint: number; // +4% per point at N=7; scales ∝ 1/T
  decayPerMin: number; // d = 100 / (0.25 × D)

  // --- killer economy (§9, §10) ---
  killCost: number; // points → 1 kill
  moveCost: number; // points → 1 banked move charge
  maxMoves: number; // per game (team)
  /** Use-it-or-lose-it window for an unlocked kill, minutes (§9). */
  killExpiryMin: number;

  // --- votes (§6) ---
  voteTimesMin: number[]; // minutes from start for each scheduled vote
  emergencyVote: boolean; // none in v1 (§6)
  tieResolution: TieResolution;

  // --- powered roles (§11) ---
  roles: RoleFlags;
  /** Group-task points banked → 1 investigation (Cop fuel, §7.5/§11). */
  investigationCost: number;
  /** Cop investigations granted per game cap (§17.2 open — default below). */
  maxInvestigations: number;
  /** Points (medic's own completions) → 1 shield charge (§11; §17.1 open). */
  medicShieldCost: number;
  /** Medic shield charges cap per game (§17.1 open). */
  maxShields: number;

  // --- delayed application (§14) ---
  delayMeanMin: number; // ~5 min
  delayJitterMin: number; // ± jitter; uniform [mean-jitter, mean+jitter]

  // --- finale ---
  /** Minute at which the round force-resolves (the evening climax). */
  finaleMin: number;
}

/** Parameters the Director may NOT change mid-round (§15.4). */
export const STRUCTURAL_PARAMS = [
  "killCost",
  "moveCost",
  "maxMoves",
  "killers",
  "players",
  "voteTimesMin", // vote *count* is structural; timing nudges handled separately
] as const;

/**
 * Killer count from the 28% rule (§16.2), rounding DOWN toward ~25% when the
 * 0.28×N rounding would over-favor killers (the §16.2 rounding note).
 */
export function killerCount(players: number): number {
  const raw = 0.28 * players;
  const nearestRounded = Math.round(raw);
  // If standard rounding pushes the killer share meaningfully above ~28% (into
  // killer-favored territory), prefer the floor to keep town competitive — the
  // §16.2 rounding note (e.g. N=9 → 0.28×9=2.52 → round=3=33%; floor=2=22%).
  // The threshold sits above the 7→2 anchor (2/7≈28.6%, kept) but below 9→3
  // (3/9≈33.3%, floored).
  if (nearestRounded / players > 0.3) {
    return Math.max(1, Math.floor(raw));
  }
  return Math.max(1, nearestRounded);
}

/** Default scheduled-vote times (minutes from a 9 AM start) for a long round. */
function defaultVoteTimes(dayLengthMin: number): number[] {
  // §16.1 anchors: ~11:30, 14:30, 17:30, 20:00, 22:00 → 150/330/510/660/780 min.
  // Scale proportionally to the chosen day length (baseline D = 780).
  const baseline = 780;
  const anchors = [150, 330, 510, 660, 780];
  if (dayLengthMin === baseline) return anchors;
  const scale = dayLengthMin / baseline;
  return anchors.map((m) => Math.round(m * scale));
}

export interface DeriveConfigInput {
  players: number;
  /** Minutes from 9 AM start to the evening finale. Default 780 (= ~10 PM). */
  dayLengthMin?: number;
  roles?: Partial<RoleFlags>;
  /** Override any derived field (e.g. for tuning experiments / Director). */
  overrides?: Partial<GameConfig>;
}

/**
 * Build a GameConfig from player count + day length via the ratio model (§16.2).
 * Reproduces the §16.1 7-player config when called with { players: 7 }.
 */
export function deriveConfig(input: DeriveConfigInput): GameConfig {
  const players = input.players;
  const dayLengthMin = input.dayLengthMin ?? 780;
  const killers = killerCount(players);
  const town = players - killers;

  // Bar gain scales ∝ 1/T to hold ~1 task/person/hr at any size (§16.2).
  // Anchored so that at N=7 (T=5) it equals +4% per point.
  const barPercentPerPoint = 4 * (5 / town);

  // Decay ties pacing to day length: d = 100 / (0.25 × D) (§16.2).
  const decayPerMin = 100 / (0.25 * dayLengthMin);

  const roles: RoleFlags = { ...DEFAULT_ROLE_FLAGS, ...(input.roles ?? {}) };

  const base: GameConfig = {
    players,
    killers,
    dayLengthMin,

    barStart: 100,
    barCap: 100,
    barPercentPerPoint,
    decayPerMin,

    killCost: 10,
    moveCost: 10,
    maxMoves: 2,
    killExpiryMin: 25,

    voteTimesMin: defaultVoteTimes(dayLengthMin),
    emergencyVote: false,
    tieResolution: "random",

    roles,
    investigationCost: 12,
    maxInvestigations: 2, // TODO(open-question: §17.2 uses-per-game) — default scaffold
    medicShieldCost: 12, // TODO(open-question: §17.1 medic earn rate) — default scaffold
    maxShields: 2, // TODO(open-question: §17.1) — default scaffold

    delayMeanMin: 5,
    delayJitterMin: 2,

    finaleMin: dayLengthMin,
  };

  return { ...base, ...(input.overrides ?? {}) };
}
