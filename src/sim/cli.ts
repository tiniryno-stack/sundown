/**
 * Simulation report CLI.  Run: `npm run sim` (or `npm run sim -- --games 1000`).
 *
 * Sweeps town deduction skill and prints win-rate, median resolution time, and
 * the win-reason split — the §16 balance surface. Used to eyeball balance and
 * to measure the Cop/Medic shift (Phase 3).
 */

import { runBatch, type BatchStats } from "./simulate.js";
import { DEFAULT_SIM_PARAMS, type SimParams } from "./strategy.js";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return Number(process.argv[i + 1]);
  return fallback;
}

const games = arg("games", 500);
const players = arg("players", 7);

function row(stats: BatchStats): string {
  const r = stats.reasonCounts;
  const pct = (n: number) => `${((n / stats.games) * 100).toFixed(0)}%`;
  return [
    `skill ${stats.params.skill.toFixed(2)}`,
    `killers ${(stats.killerWinRate * 100).toFixed(1)}%`,
    `median ${stats.endClock}`,
    `parity ${pct(r.parity)}`,
    `collapse ${pct(r.collapse)}`,
    `townElim ${pct(r.allKillersEliminated)}`,
    `finale ${pct(r.finaleSurvival)}`,
  ].join("  |  ");
}

function sweep(label: string, roles: SimParams["roles"]): void {
  console.log(`\n=== ${label} (N=${players}, ${games} games each) ===`);
  for (const skill of [0.5, 0.6, 0.7]) {
    const stats = runBatch({ ...DEFAULT_SIM_PARAMS, players, skill, roles }, games);
    console.log(row(stats));
  }
}

sweep("CORE loop (no powered roles)", {});
sweep("With COP", { cop: true });
sweep("With MEDIC", { medic: true });
sweep("With COP + MEDIC", { cop: true, medic: true });

console.log("\n(killers% = killer-team win rate; target ~50% near skill 0.6 per §16.1)");
