/**
 * Headless simulation harness (§18 build item 2).
 *
 * Runs the REAL engine end-to-end N times and reports win-rate, median
 * resolution time, and the parity/collapse/elimination split — the regression
 * surface for the §16 balance numbers. Adding/removing roles (Phase 3) re-runs
 * this same harness to measure the balance shift.
 */

import { deriveConfig } from "../engine/config.js";
import { GameEngine, type PlayerSeed } from "../engine/engine.js";
import { RNG } from "../engine/rng.js";
import type { GameResult, Team, WinReason } from "../engine/types.js";
import { DEFAULT_SIM_PARAMS, drawTier, type SimParams } from "./strategy.js";

export interface GameOutcome {
  winner: Team;
  reason: WinReason;
  /** Engine-minute the game resolved (0 = 9 AM start). */
  endMinute: number;
}

function roster(n: number): PlayerSeed[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
}

/** Run a single full game deterministically from `seed`. */
export function runGame(seed: number | string, params: SimParams): GameOutcome {
  const cfg = deriveConfig({
    players: params.players,
    dayLengthMin: params.dayLengthMin,
    roles: params.roles,
    overrides: params.configOverrides,
  });
  const engine = new GameEngine({ config: cfg, seed, roster: roster(params.players) });
  engine.start();

  // Separate RNG stream for strategy decisions so engine determinism is intact.
  const rng = new RNG(`${seed}:strategy`);
  const voteTimes = new Set(cfg.voteTimesMin);
  const perMinTaskProb = params.engagement / 60;

  while (engine.state.now < cfg.finaleMin && !engine.state.result) {
    const now = engine.state.now;

    // 1) Task completions (honor-system "done" taps) — feeds bar OR killer meter.
    for (const p of engine.state.players) {
      if (!p.alive) continue;
      if (rng.next() < perMinTaskProb) {
        const tier = drawTier(rng);
        engine.completeTask({ playerId: p.id, tier, group: tier === "group" });
      }
    }

    // 2) Cop investigations (Phase 3): a confirmed-killer read lets town
    //    CONCENTRATE this round's vote on that player (its power is reducing
    //    vote-splitting, the town's core weakness — see the vote model below).
    let confirmedKillerId: string | null = null;
    if (cfg.roles.cop) {
      const cop = engine.state.players.find((pl) => pl.role === "cop" && pl.alive);
      if (cop && cop.investigations > 0) {
        const suspect = rng.pick([...engine.livingKillers(), ...engine.livingTown()]);
        const res = engine.investigate(cop.id, suspect.id);
        if (res.ok && res.alignment === "killer") confirmedKillerId = suspect.id;
      }
    }

    // 3) Medic shields (Phase 3): protect a random living townsperson.
    if (cfg.roles.medic) {
      const medic = engine.state.players.find((pl) => pl.role === "medic" && pl.alive);
      if (medic && medic.shields > 0 && engine.state.shieldedPlayerIds.length === 0) {
        const town = engine.livingTown().filter((t) => t.id !== medic.id);
        if (town.length > 0) engine.shield(medic.id, rng.pick(town).id);
      }
    }

    // 4) Killer actions: spend meter on kills, or bank insurance (§9/§10).
    for (const k of engine.livingKillers()) {
      if (k.meterPoints < cfg.killCost) continue;
      const movesLeft = cfg.maxMoves - (engine.state.moveCharges + engine.state.movesUsed);
      // "Good play" killers bank insurance (§10) up to one charge in hand. We do
      // NOT gate on a ghost existing yet: banking early is the documented gamble
      // (§10 — town wants to catch killers "before any ghost exists").
      const canBank =
        movesLeft > 0 && engine.state.moveCharges === 0 && k.meterPoints >= cfg.moveCost;
      if (canBank && rng.bool(params.insuranceBias)) {
        engine.bankMove(k.id);
      } else {
        const town = engine.livingTown(); // killers steer away from teammates (§9 suggestions)
        if (town.length > 0) engine.activateKill(k.id, rng.pick(town).id);
      }
    }

    // 5) Scheduled vote (§6) — a real per-voter ballot (see runScheduledVote).
    if (voteTimes.has(now)) {
      runScheduledVote(engine, rng, params.skill, params.copSkillBonus, confirmedKillerId);
    }

    // 6) Advance one minute: apply due delayed effects + decay + win checks.
    engine.advanceTo(now + 1);
  }

  const result: GameResult =
    engine.state.result ?? { winner: "killer", reason: "finaleSurvival", at: engine.state.now };
  return { winner: result.winner, reason: result.reason, endMinute: result.at };
}

/**
 * A scheduled vote (§6). Town deduction is abstracted into the `skill` knob (the
 * §16 lever): with prob `effectiveSkill` the town concentrates the plurality on a
 * real living killer (a Cop's confirmed read pins it to that specific killer and
 * adds `copBonus`); otherwise the vote scatters onto a random living player —
 * which, via the silent flip (§12), thins the town and helps killers toward
 * parity. The elimination resolves on a delay, unnamed.
 */
function runScheduledVote(
  engine: GameEngine,
  rng: RNG,
  skill: number,
  copBonus: number,
  confirmedKillerId: string | null,
): void {
  const livingKillers = engine.livingKillers();
  const living = [...livingKillers, ...engine.livingTown()];
  if (living.length === 0) return;

  const confirmedLiving = confirmedKillerId && living.some((p) => p.id === confirmedKillerId);

  let target;
  if (confirmedLiving && rng.bool(Math.min(0.95, skill + copBonus + 0.3))) {
    // Hard evidence (§11): a confirmed read makes town near-certain to remove
    // that specific killer this round — the Cop's real teeth.
    target = confirmedKillerId!;
  } else if (livingKillers.length > 0 && rng.bool(skill)) {
    target = rng.pick(livingKillers).id; // correct deduction → a real killer
  } else {
    target = rng.pick(living).id; // scattered / misled vote → anyone living
  }
  const votes: Record<string, string> = {};
  for (const p of living) votes[p.id] = target;
  engine.runVote(votes);
}

export interface BatchStats {
  games: number;
  params: SimParams;
  killerWinRate: number;
  townWinRate: number;
  medianEndMinute: number;
  endClock: string;
  /** Counts per win reason. */
  reasonCounts: Record<WinReason, number>;
}

const ZERO_REASONS = (): Record<WinReason, number> => ({
  parity: 0,
  collapse: 0,
  allKillersEliminated: 0,
  finaleSurvival: 0,
});

/** Run N games and aggregate. Deterministic from `baseSeed`. */
export function runBatch(params: SimParams, n: number, baseSeed = 1): BatchStats {
  const full: SimParams = { ...DEFAULT_SIM_PARAMS, ...params };
  let killerWins = 0;
  const ends: number[] = [];
  const reasonCounts = ZERO_REASONS();
  for (let i = 0; i < n; i++) {
    const outcome = runGame(`${baseSeed}:${i}`, full);
    if (outcome.winner === "killer") killerWins++;
    ends.push(outcome.endMinute);
    reasonCounts[outcome.reason]++;
  }
  ends.sort((a, b) => a - b);
  const median = ends.length === 0 ? 0 : ends[Math.floor(ends.length / 2)]!;
  return {
    games: n,
    params: full,
    killerWinRate: killerWins / n,
    townWinRate: 1 - killerWins / n,
    medianEndMinute: median,
    endClock: minuteToClock(median),
    reasonCounts,
  };
}

/** Convert an engine-minute (0 = 9 AM) to a wall-clock string. */
export function minuteToClock(minute: number, startHour = 9): string {
  const totalMin = startHour * 60 + minute;
  let h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}
