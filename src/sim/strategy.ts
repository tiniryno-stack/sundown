/**
 * Strategy / behavioral model for the simulation harness.
 *
 * The harness drives the REAL engine; this module only decides *which commands*
 * to issue. Town deduction is abstracted into a single `skill` knob (the §16
 * "deduction skill" lever) rather than simulating the out-of-app social layer —
 * that is exactly the variable §16 sweeps. Everything here is documented as a
 * modeling assumption in PROGRESS.md and is fully parameterized for tuning.
 */

import type { GameConfig } from "../engine/config.js";
import { DECK_MIX_TARGET, type TaskTier } from "../engine/economy.js";
import type { RNG } from "../engine/rng.js";

export interface SimParams {
  players: number;
  dayLengthMin?: number;
  /** Town deduction skill in [0,1]: P(a scheduled vote lands on a real killer). */
  skill: number;
  /**
   * Engagement: tasks per hour per living player (§16 baseline ~1.0). The §17.4
   * open question — lumpy real-world throughput — lives entirely in this dial.
   */
  engagement: number;
  /** Killer P(bank a move charge when able & a ghost exists) — offense vs resilience (§10). */
  insuranceBias: number;
  /** Per-investigation bump to effective vote skill when the Cop is active (§11, Phase 3). */
  copSkillBonus: number;
  roles?: Partial<GameConfig["roles"]>;
  configOverrides?: Partial<GameConfig>;
}

export const DEFAULT_SIM_PARAMS: Omit<SimParams, "players" | "skill"> = {
  engagement: 1.0,
  // "Good play" killers lean on the §10 resilience system; this lands the core
  // loop near the §16 coin-flip around skill ~0.55 (see PROGRESS.md calibration).
  insuranceBias: 0.85,
  copSkillBonus: 0.15,
};

const TIERS = Object.keys(DECK_MIX_TARGET) as TaskTier[];

/** Draw a task tier from the deck-mix distribution (§7.5). */
export function drawTier(rng: RNG): TaskTier {
  const total = TIERS.reduce((s, t) => s + DECK_MIX_TARGET[t], 0);
  let r = rng.next() * total;
  for (const t of TIERS) {
    r -= DECK_MIX_TARGET[t];
    if (r <= 0) return t;
  }
  return "standard";
}
