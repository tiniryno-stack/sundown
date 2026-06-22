import { describe, expect, it } from "vitest";
import { deriveConfig, killerCount } from "./config.js";

describe("killerCount (§16.2 rounding rule)", () => {
  it("matches the spec anchors", () => {
    expect(killerCount(7)).toBe(2); // 0.28*7=1.96 → 2 (28%)
    expect(killerCount(22)).toBe(6); // 0.28*22=6.16 → 6
    expect(killerCount(15)).toBe(4); // 0.28*15=4.2 → 4
    expect(killerCount(11)).toBe(3); // 0.28*11=3.08 → 3
  });

  it("rounds DOWN when standard rounding would over-favor killers (§16.2 note)", () => {
    // 0.28*9 = 2.52 → round=3 = 33% (killer-favored) → prefer floor=2 = 22%.
    expect(killerCount(9)).toBe(2);
  });

  it("never returns fewer than 1 killer", () => {
    expect(killerCount(2)).toBeGreaterThanOrEqual(1);
  });
});

describe("deriveConfig (§16.1 / §16.2)", () => {
  it("reproduces the tuned 7-player config", () => {
    const c = deriveConfig({ players: 7 });
    expect(c.killers).toBe(2);
    expect(c.barPercentPerPoint).toBeCloseTo(4, 6); // T=5 → +4%/pt
    expect(c.decayPerMin).toBeCloseTo(100 / (0.25 * 780), 6); // ~0.51%/min
    expect(c.killCost).toBe(10);
    expect(c.moveCost).toBe(10);
    expect(c.maxMoves).toBe(2);
    expect(c.voteTimesMin).toEqual([150, 330, 510, 660, 780]);
  });

  it("scales bar gain ∝ 1/T to hold cadence at larger N", () => {
    const c = deriveConfig({ players: 22 });
    const town = 22 - 6;
    expect(c.barPercentPerPoint).toBeCloseTo(4 * (5 / town), 6);
  });

  it("ties decay to chosen day length", () => {
    const c = deriveConfig({ players: 7, dayLengthMin: 600 });
    expect(c.decayPerMin).toBeCloseTo(100 / (0.25 * 600), 6);
  });

  it("honors role flags and overrides", () => {
    const c = deriveConfig({ players: 7, roles: { cop: true }, overrides: { killCost: 8 } });
    expect(c.roles.cop).toBe(true);
    expect(c.roles.medic).toBe(false);
    expect(c.killCost).toBe(8);
  });
});
