/**
 * Deterministic Director "brain" used by the MockLLMClient offline and in tests.
 *
 * It encodes the §15.5 objective as a simple bounded heuristic so the whole
 * Director loop runs without an API key: ease decay if the town bar is collapsing
 * early, tighten it if the bar is trivially safe, and nudge task value to keep the
 * bar a live concern. Output is strict JSON containing ONLY allowed levers — the
 * same contract a real Claude Director must honor (guardrails clamp regardless).
 */

import { MockLLMClient, extractJsonObject, type LLMRequest } from "../ai/client.js";
import type { DirectorSnapshot } from "./snapshot.js";

export function heuristicDirectorResponse(snapshot: DirectorSnapshot): string {
  const out: Record<string, number> = {};
  const base = snapshot.decayBaseline;
  const barFrac = snapshot.barCap === 0 ? 0 : snapshot.townBar / snapshot.barCap;

  // Bar collapsing early in the day → ease decay (within bounds the guardrail clamps).
  if (barFrac < 0.35 && snapshot.timeProgress < 0.6) {
    out.decayPerMin = base * 0.75;
    out.taskValueMultiplier = 1.2;
  } else if (barFrac > 0.85) {
    // Bar trivially safe → tighten decay so it stays a live concern.
    out.decayPerMin = base * 1.25;
    out.taskValueMultiplier = 0.85;
  }
  return JSON.stringify(out);
}

/** A MockLLMClient that drives the Director from the heuristic above. */
export function makeMockDirectorClient(): MockLLMClient {
  return new MockLLMClient((req: LLMRequest) => {
    const userMsg = req.messages.find((m) => m.role === "user")?.content ?? "{}";
    const snapshot = extractJsonObject(userMsg) as DirectorSnapshot | null;
    if (!snapshot) return "{}";
    return heuristicDirectorResponse(snapshot);
  });
}
