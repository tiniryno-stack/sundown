import { describe, expect, it } from "vitest";
import { RNG } from "./rng.js";

describe("RNG", () => {
  it("is deterministic for a given seed", () => {
    const a = new RNG(123);
    const b = new RNG(123);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = new RNG(1);
    const b = new RNG(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("hashes string seeds deterministically", () => {
    const a = new RNG("hello");
    const b = new RNG("hello");
    expect(a.seed).toEqual(b.seed);
    expect(a.next()).toEqual(b.next());
  });

  it("int() stays within inclusive bounds", () => {
    const r = new RNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it("shuffle preserves elements and does not mutate input", () => {
    const r = new RNG(7);
    const input = [1, 2, 3, 4, 5];
    const out = r.shuffle(input);
    expect(out.slice().sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("pick throws on empty array", () => {
    expect(() => new RNG(1).pick([])).toThrow();
  });
});
