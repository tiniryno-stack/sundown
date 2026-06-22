import { describe, expect, it } from "vitest";
import { averagePoints, DECK_MIX_TARGET, TIER_POINTS } from "./economy.js";

describe("economy (§7.5)", () => {
  it("uses the canonical tier point values", () => {
    expect(TIER_POINTS).toEqual({ light: 1, standard: 2, heavy: 3, group: 4 });
  });

  it("the deck-mix target keeps the average task near ~2 points", () => {
    const avg = averagePoints(DECK_MIX_TARGET);
    expect(avg).toBeGreaterThan(1.7);
    expect(avg).toBeLessThan(2.4);
  });

  it("averagePoints handles an all-standard deck", () => {
    expect(averagePoints({ light: 0, standard: 1, heavy: 0, group: 0 })).toBe(2);
  });
});
