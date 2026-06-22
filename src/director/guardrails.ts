/**
 * Director guardrails (§15.1 Hard Constraints 3 & 4) — enforced in code.
 *
 * Constraint 3 (stay within guardrails): every lever is clamped to a bounded
 * range derived from the ratio model. The model can ASK for anything; it only
 * ever GETS a clamped, in-bounds value.
 *
 * Constraint 4 (never touch the deduction): the ONLY fields the Director can
 * affect are the soft in-round levers below. `validatePatch` discards every
 * other key — structurally, votes, kill targets, role assignments, and the
 * structural params (kill_cost/move_cost/max_moves/killers/win-conditions, §15.4)
 * cannot be expressed as a patch at all.
 */

import type { GameConfig } from "../engine/config.js";
import type { GameState } from "../engine/types.js";

/** The bounded patch the engine will actually apply (on a delay). */
export interface DirectorPatch {
  decayPerMin?: number;
  taskValueMultiplier?: number;
}

/** Keys the Director is permitted to emit. Anything else is rejected. */
export const ALLOWED_LEVER_KEYS = ["decayPerMin", "taskValueMultiplier"] as const;

/**
 * Levers recognized by the Director but NOT yet applied — their adjustment
 * ranges + event-deck contents are a §17.3 open question (needs playtest data).
 * Scaffolded here so the menu is complete and the interface is stable.
 */
export const SCAFFOLDED_LEVER_KEYS = [
  "nextVoteTimingShiftMin", // §15.3 pull next vote earlier/later (bounded window)
  "surfaceMoveOpportunity", // §15.3 when to surface the next move-charge chance
  "eventCard", // §15.3 optional event from a pre-approved deck (§17.3)
  "notificationCadence", // §15.3 notification flavor/cadence
] as const;

export interface LeverBounds {
  decayPerMin: { min: number; max: number };
  taskValueMultiplier: { min: number; max: number };
}

/** Compute bounded ranges from the ratio model (§15.3: decay within ~±30%). */
export function computeBounds(config: GameConfig, _state: GameState): LeverBounds {
  const base = config.decayPerMin;
  return {
    decayPerMin: { min: base * 0.7, max: base * 1.3 },
    taskValueMultiplier: { min: 0.75, max: 1.25 },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface ValidationResult {
  patch: DirectorPatch;
  /** Keys the model tried to set that are NOT allowed (logged; never applied). */
  rejectedKeys: string[];
  /** Allowed keys whose values were clamped to the guardrail bounds. */
  clampedKeys: string[];
}

/**
 * Validate + clamp a raw model response into a safe DirectorPatch.
 * - Drops every key not in ALLOWED_LEVER_KEYS (Constraint 4).
 * - Clamps allowed numeric values into bounds (Constraint 3).
 * - Ignores non-finite / non-numeric values.
 */
export function validatePatch(raw: unknown, bounds: LeverBounds): ValidationResult {
  const patch: DirectorPatch = {};
  const rejectedKeys: string[] = [];
  const clampedKeys: string[] = [];

  if (raw === null || typeof raw !== "object") {
    return { patch, rejectedKeys, clampedKeys };
  }
  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!(ALLOWED_LEVER_KEYS as readonly string[]).includes(key)) {
      rejectedKeys.push(key);
      continue;
    }
    const value = obj[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      rejectedKeys.push(key);
      continue;
    }
    const b = bounds[key as keyof LeverBounds];
    const clamped = clamp(value, b.min, b.max);
    if (clamped !== value) clampedKeys.push(key);
    (patch as Record<string, number>)[key] = clamped;
  }

  return { patch, rejectedKeys, clampedKeys };
}

/** The system prompt describing the menu + guardrails sent to the model (§15.6). */
export function directorSystemPrompt(bounds: LeverBounds): string {
  return [
    "You are the AI Game Director for an all-day social-deduction party game.",
    "You keep estimated win probability near 50/50 and pacing on track for the evening finale,",
    "while preserving fairness and secrecy. You ACT ONLY; you never reveal any state.",
    "",
    "HARD CONSTRAINTS (non-negotiable):",
    "1. Never leak role/state information. Output adjustments only — never names, roles, or the bar value.",
    "2. Adjustments apply on a delay; do not try to act as a real-time verifier.",
    "3. Stay within the guardrail bounds below. Out-of-range values will be clamped.",
    "4. Never alter votes, kill targets, role assignments, or structural params",
    "   (kill_cost, move_cost, max_moves, killer count, win conditions).",
    "",
    "You MAY return ONLY these levers as a strict JSON object (no prose):",
    `  - decayPerMin: number in [${bounds.decayPerMin.min.toFixed(4)}, ${bounds.decayPerMin.max.toFixed(4)}]`,
    `  - taskValueMultiplier: number in [${bounds.taskValueMultiplier.min}, ${bounds.taskValueMultiplier.max}]`,
    "Return {} to make no change. Respond with JSON only.",
  ].join("\n");
}
