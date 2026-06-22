import { describe, expect, it } from "vitest";
import { runBatch, runGame, minuteToClock } from "./simulate.js";
import { DEFAULT_SIM_PARAMS } from "./strategy.js";

/**
 * Balance regression (§16). The harness runs the REAL engine; these assertions
 * lock the §16-shaped behavior so future engine changes that break balance fail
 * loudly. Bands are deliberately wider than Monte-Carlo noise but tight enough
 * to catch real regressions. See PROGRESS.md for the calibration write-up and
 * the (documented) divergence from §16's exact figures.
 */

const N = 1500; // fixed sample, fixed baseSeed → deterministic
const SEED = 1;

function core(skill: number) {
  return runBatch({ ...DEFAULT_SIM_PARAMS, players: 7, skill }, N, SEED);
}

describe("balance regression — core loop (§16.1)", () => {
  const s50 = core(0.5);
  const s60 = core(0.6);
  const s70 = core(0.7);

  it("is deterministic for a fixed seed", () => {
    const again = core(0.6);
    expect(again.killerWinRate).toBe(s60.killerWinRate);
    expect(again.medianEndMinute).toBe(s60.medianEndMinute);
  });

  it("lands near a coin-flip in the skill 0.5–0.6 region (§16: ~50/50 under good play)", () => {
    expect(s50.killerWinRate).toBeGreaterThan(0.45);
    expect(s50.killerWinRate).toBeLessThan(0.6);
    expect(s60.killerWinRate).toBeGreaterThan(0.34);
    expect(s60.killerWinRate).toBeLessThan(0.5);
  });

  it("is skill-sensitive: higher town skill → fewer killer wins (§16)", () => {
    expect(s50.killerWinRate).toBeGreaterThan(s60.killerWinRate);
    expect(s60.killerWinRate).toBeGreaterThan(s70.killerWinRate);
  });

  it("median resolution is early evening — the moving-killer stretch (§3/§16: ~5:30–6:30 PM)", () => {
    // minutes from 9 AM: 5:30 PM = 510, 6:30 PM = 570. Allow a margin.
    expect(s60.medianEndMinute).toBeGreaterThan(420); // after 4 PM (not the unfixable ~4 PM)
    expect(s60.medianEndMinute).toBeLessThan(630); // before ~7:30 PM
  });

  it("exhibits all four win reasons, with collapse the rare alternate (§5: ~few %)", () => {
    const r = s60.reasonCounts;
    expect(r.parity).toBeGreaterThan(0);
    expect(r.allKillersEliminated).toBeGreaterThan(0);
    expect(r.finaleSurvival).toBeGreaterThan(0);
    expect(r.collapse).toBeGreaterThan(0);
    // collapse is the uncommon killer win path, not the dominant one.
    expect(r.collapse / N).toBeLessThan(0.2);
    expect(r.collapse).toBeLessThan(r.parity + r.finaleSurvival);
  });
});

describe("scaling (§16.2)", () => {
  it("the larger marathon format also resolves and stays skill-sensitive", () => {
    const big50 = runBatch({ ...DEFAULT_SIM_PARAMS, players: 22, skill: 0.5 }, 400, SEED);
    const big70 = runBatch({ ...DEFAULT_SIM_PARAMS, players: 22, skill: 0.7 }, 400, SEED);
    expect(big50.killerWinRate).toBeGreaterThan(big70.killerWinRate);
    // Every game terminates with a winner (no infinite/hung games).
    const total =
      big50.reasonCounts.parity +
      big50.reasonCounts.collapse +
      big50.reasonCounts.allKillersEliminated +
      big50.reasonCounts.finaleSurvival;
    expect(total).toBe(400);
  });
});

describe("a single game is reproducible", () => {
  it("returns the same outcome for the same seed", () => {
    const a = runGame("xyz", { ...DEFAULT_SIM_PARAMS, players: 7, skill: 0.6 });
    const b = runGame("xyz", { ...DEFAULT_SIM_PARAMS, players: 7, skill: 0.6 });
    expect(a).toEqual(b);
  });
});

describe("minuteToClock", () => {
  it("maps engine minutes to wall-clock from a 9 AM start", () => {
    expect(minuteToClock(0)).toBe("9:00 AM");
    expect(minuteToClock(180)).toBe("12:00 PM");
    expect(minuteToClock(510)).toBe("5:30 PM");
  });
});
