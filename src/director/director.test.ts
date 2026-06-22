import { describe, expect, it } from "vitest";
import { MockLLMClient } from "../ai/client.js";
import { deriveConfig, type GameConfig } from "../engine/config.js";
import { GameEngine, type PlayerSeed } from "../engine/engine.js";
import { Director } from "./director.js";
import { computeBounds, validatePatch } from "./guardrails.js";
import { makeMockDirectorClient } from "./mockDirector.js";

function roster(n: number): PlayerSeed[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
}
function makeEngine(overrides: Partial<GameConfig> = {}) {
  const config = deriveConfig({ players: 7, overrides: { delayMeanMin: 5, delayJitterMin: 0, finaleMin: 100000, ...overrides } });
  const e = new GameEngine({ config, seed: "dir", roster: roster(7) });
  e.start();
  return e;
}
/** A mock LLM that always returns the same fixed JSON, ignoring input. */
function fixedClient(json: string) {
  return new MockLLMClient(() => json);
}

describe("guardrails.validatePatch", () => {
  const bounds = computeBounds(deriveConfig({ players: 7 }), {} as never);

  it("Constraint 4: drops every non-lever key (votes/targets/roles/structural)", () => {
    const res = validatePatch(
      {
        killCost: 1,
        moveCost: 1,
        maxMoves: 9,
        killers: 5,
        voteTimesMin: [],
        eliminatePlayer: "p3",
        revealRole: "p0",
        decayPerMin: bounds.decayPerMin.min,
      },
      bounds,
    );
    expect(Object.keys(res.patch)).toEqual(["decayPerMin"]);
    expect(res.rejectedKeys).toEqual(
      expect.arrayContaining(["killCost", "moveCost", "maxMoves", "killers", "voteTimesMin", "eliminatePlayer", "revealRole"]),
    );
  });

  it("Constraint 3: clamps allowed levers into the guardrail bounds", () => {
    const tooHigh = validatePatch({ decayPerMin: 9999, taskValueMultiplier: 99 }, bounds);
    expect(tooHigh.patch.decayPerMin).toBeCloseTo(bounds.decayPerMin.max, 6);
    expect(tooHigh.patch.taskValueMultiplier).toBe(bounds.taskValueMultiplier.max);
    expect(tooHigh.clampedKeys).toEqual(expect.arrayContaining(["decayPerMin", "taskValueMultiplier"]));

    const tooLow = validatePatch({ decayPerMin: -50 }, bounds);
    expect(tooLow.patch.decayPerMin).toBeCloseTo(bounds.decayPerMin.min, 6);
  });

  it("ignores non-numeric / non-finite lever values", () => {
    const res = validatePatch({ decayPerMin: "fast", taskValueMultiplier: Infinity }, bounds);
    expect(res.patch).toEqual({});
    expect(res.rejectedKeys).toEqual(expect.arrayContaining(["decayPerMin", "taskValueMultiplier"]));
  });
});

describe("Director — four hard constraints (§15.1)", () => {
  it("Constraint 2: adjustments apply on a delay, never instantly (§14)", async () => {
    const e = makeEngine();
    const base = e.state.config.decayPerMin;
    const target = base * 0.8; // in-bounds
    const director = new Director(e, fixedClient(JSON.stringify({ decayPerMin: target })));

    const res = await director.tick();
    expect(res.patch.decayPerMin).toBeCloseTo(target, 6);
    expect(res.scheduledAt).toBe(e.state.now + 5); // scheduled, not applied
    expect(e.state.decayPerMin).toBeCloseTo(base, 6); // unchanged immediately

    e.advanceTo(e.state.now + 5);
    expect(e.state.decayPerMin).toBeCloseTo(target, 6); // applied after the delay
  });

  it("Constraint 3: a malicious out-of-range proposal is clamped, not obeyed", async () => {
    const e = makeEngine();
    const base = e.state.config.decayPerMin;
    const director = new Director(e, fixedClient(JSON.stringify({ decayPerMin: 9999 })));
    const res = await director.tick();
    expect(res.patch.decayPerMin).toBeCloseTo(base * 1.3, 6); // max bound
    e.advanceTo(e.state.now + 6);
    expect(e.state.decayPerMin).toBeLessThanOrEqual(base * 1.3 + 1e-9);
  });

  it("Constraint 4: attempts to change structural params / votes / roles are ignored", async () => {
    const e = makeEngine();
    const before = {
      killCost: e.state.config.killCost,
      maxMoves: e.state.config.maxMoves,
      killers: e.state.config.killers,
      votes: [...e.state.config.voteTimesMin],
      living: e.livingKillers().length,
    };
    const director = new Director(
      e,
      fixedClient(JSON.stringify({ killCost: 1, maxMoves: 9, killers: 5, voteTimesMin: [1], eliminatePlayer: "p0" })),
    );
    const res = await director.tick();
    expect(res.rejectedKeys).toEqual(
      expect.arrayContaining(["killCost", "maxMoves", "killers", "voteTimesMin", "eliminatePlayer"]),
    );
    expect(res.patch).toEqual({}); // nothing applicable survived
    e.advanceTo(e.state.now + 6);
    expect(e.state.config.killCost).toBe(before.killCost);
    expect(e.state.config.maxMoves).toBe(before.maxMoves);
    expect(e.state.config.killers).toBe(before.killers);
    expect(e.state.config.voteTimesMin).toEqual(before.votes);
    expect(e.livingKillers().length).toBe(before.living); // no one eliminated
  });

  it("Constraint 1: never leaks identities/roles/bar — only a vague public nudge", async () => {
    const e = makeEngine();
    const base = e.state.config.decayPerMin;
    const director = new Director(e, fixedClient(JSON.stringify({ decayPerMin: base * 0.8 })));
    await director.tick();
    e.advanceTo(e.state.now + 6);

    // Only vague directorNudge events reach players; nothing identity-bearing.
    for (const ev of e.state.publicEvents) {
      for (const p of e.state.players) {
        expect(ev.message).not.toContain(p.id);
        expect(ev.message).not.toContain(p.name);
      }
      expect(ev.message).not.toMatch(/killer|town|cop|medic/i);
      expect(ev.message).not.toContain(String(Math.round(e.state.townBar)));
    }
    // The scheduled patch payload carries only numeric levers (no identities).
    const patchEffect = e.state.internalLog.find((l) => l.type === "directorAdjustmentApplied");
    expect(patchEffect).toBeDefined();
    expect(Object.keys(patchEffect!.detail.patch as object)).toEqual(["decayPerMin"]);
  });
});

describe("Director heuristic brain (offline, no API key)", () => {
  it("eases decay when the bar is collapsing early in the day (§15.5)", async () => {
    const e = makeEngine({ barStart: 20, decayPerMin: 0.5 });
    const base = e.state.config.decayPerMin;
    const director = new Director(e, makeMockDirectorClient());
    const res = await director.tick();
    expect(res.patch.decayPerMin).toBeDefined();
    expect(res.patch.decayPerMin!).toBeLessThan(base); // eased
  });

  it("makes no change when the bar is in a healthy mid-range", async () => {
    const e = makeEngine({ barStart: 60 });
    const director = new Director(e, makeMockDirectorClient());
    const res = await director.tick();
    expect(res.patch).toEqual({});
  });
});
