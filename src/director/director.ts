/**
 * AI Game Director (§15) — the snapshot → bounded-JSON-adjustment loop.
 *
 * The four Hard Constraints (§15.1) are enforced HERE, in code, not left to the
 * model's goodwill:
 *   1. Never leak — output is a typed DirectorPatch (only numeric soft levers);
 *      it structurally cannot carry identities/roles/true bar value, and the only
 *      player-visible signal is a vague "something shifted" event (§14).
 *   2. Delayed application — patches are scheduled via engine.scheduleDirectorPatch,
 *      so they land on the standard delay; never instant (§14).
 *   3. Guardrail bounds — validatePatch clamps every lever into the ratio-model bounds.
 *   4. Never touch the deduction — validatePatch discards any non-lever key, so votes,
 *      kill targets, roles, and structural params (§15.4) can't be changed.
 */

import type { GameEngine } from "../engine/engine.js";
import { extractJsonObject, MODELS, type LLMClient } from "../ai/client.js";
import {
  computeBounds,
  directorSystemPrompt,
  validatePatch,
  type DirectorPatch,
  type LeverBounds,
} from "./guardrails.js";
import { buildSnapshot, type DirectorSnapshot } from "./snapshot.js";

export interface DirectorTickResult {
  /** The clamped, validated patch that was scheduled (empty if no change). */
  patch: DirectorPatch;
  rejectedKeys: string[];
  clampedKeys: string[];
  /** When the patch will actually apply (internal; on the standard delay). */
  scheduledAt: number | null;
  /** The omniscient snapshot used (internal/host-only — NEVER surface). */
  snapshot: DirectorSnapshot;
}

export interface DirectorOptions {
  /** Use the cheap fast-poll model for high-frequency ticks (§15.6). */
  fastPoll?: boolean;
  model?: string;
}

export class Director {
  constructor(
    private readonly engine: GameEngine,
    private readonly client: LLMClient,
    private readonly options: DirectorOptions = {},
  ) {}

  /** Run one Director cycle: snapshot → model → validate → delayed apply. */
  async tick(): Promise<DirectorTickResult> {
    const snapshot = buildSnapshot(this.engine);
    const bounds = computeBounds(this.engine.state.config, this.engine.state);

    const raw = await this.askModel(snapshot, bounds);
    const { patch, rejectedKeys, clampedKeys } = validatePatch(raw, bounds);

    let scheduledAt: number | null = null;
    if (Object.keys(patch).length > 0) {
      // Constraint 2: never instant — always on the standard delay (§14).
      scheduledAt = this.engine.scheduleDirectorPatch(patch);
    }
    this.engine.state.internalLog.push({
      at: this.engine.state.now,
      type: "directorTick",
      detail: { patch, rejectedKeys, clampedKeys, model: this.modelId() },
    });

    return { patch, rejectedKeys, clampedKeys, scheduledAt, snapshot };
  }

  private modelId(): string {
    return this.options.model ?? (this.options.fastPoll ? MODELS.directorFastPoll : MODELS.director);
  }

  private async askModel(snapshot: DirectorSnapshot, bounds: LeverBounds): Promise<unknown> {
    const res = await this.client.complete({
      model: this.modelId(),
      system: directorSystemPrompt(bounds),
      temperature: 0.2,
      maxTokens: 256,
      messages: [
        {
          role: "user",
          content:
            "Current state snapshot (Director-only, never reveal):\n" +
            JSON.stringify(snapshot) +
            "\n\nReturn the strict-JSON lever adjustments now.",
        },
      ],
    });
    return extractJsonObject(res.text);
  }
}
