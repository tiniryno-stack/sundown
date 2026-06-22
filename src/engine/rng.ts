/**
 * Deterministic, seedable PRNG (mulberry32).
 *
 * The entire engine and simulation harness draw randomness exclusively from an
 * instance of this class so that any game is fully reproducible from its seed.
 * No use of Math.random anywhere in engine/sim code (enforced by review).
 */

function hashStringToSeed(str: string): number {
  // xfnv1a-style hash → 32-bit seed.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export class RNG {
  private state: number;
  readonly seed: number;

  constructor(seed: number | string) {
    this.seed = typeof seed === "string" ? hashStringToSeed(seed) : seed >>> 0;
    this.state = this.seed;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p (default 0.5). */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** Pick a uniformly random element. Throws on empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("RNG.pick: empty array");
    return items[this.int(0, items.length - 1)]!;
  }

  /** Fisher–Yates shuffle returning a new array (does not mutate input). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i]!;
      out[i] = out[j]!;
      out[j] = tmp;
    }
    return out;
  }

  /** Fork a child RNG with a derived seed (for independent sub-streams). */
  fork(label: string): RNG {
    return new RNG(`${this.seed}:${label}:${this.state}`);
  }
}
