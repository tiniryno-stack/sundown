/**
 * Point economy (§7.5).
 *
 * Everything in the game runs on POINTS. One point =
 *   - +4% to the town bar       (when completed by a townsperson), OR
 *   - +1 toward a killer's meter (when completed by a killer).
 *
 * The two effects are mutually exclusive and routed by team in the engine —
 * this is where the "separate progress" invariant (§8) begins.
 */

export type TaskTier = "light" | "standard" | "heavy" | "group";

/** Canonical point value per tier (§7.5 table). */
export const TIER_POINTS: Record<TaskTier, number> = {
  light: 1,
  standard: 2,
  heavy: 3,
  group: 4,
};

/**
 * Deck-mix flavor targets (§7.5). These describe how the *deck* should be
 * composed so the average task lands near ~2 points. Balance only cares about
 * total points/hour, not the exact mix — this lives here for the deck generator
 * (Phase 5) and the sim's task model to reference.
 */
export const DECK_MIX_TARGET: Record<TaskTier, number> = {
  light: 0.35,
  standard: 0.4,
  heavy: 0.2,
  group: 0.05, // "always available"; small explicit share for averaging
};

/** Average points per task implied by a deck mix (used by sim + deck QA). */
export function averagePoints(mix: Record<TaskTier, number> = DECK_MIX_TARGET): number {
  let total = 0;
  let weight = 0;
  for (const tier of Object.keys(TIER_POINTS) as TaskTier[]) {
    const w = mix[tier] ?? 0;
    total += w * TIER_POINTS[tier];
    weight += w;
  }
  return weight === 0 ? 0 : total / weight;
}

/** Whether a tier counts as a "group" task (group bonus + investigation credit). */
export function isGroupTier(tier: TaskTier): boolean {
  return tier === "group";
}
