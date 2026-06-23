/**
 * Watchable narrated game — a throwaway dev tool to FEEL the pacing/flow before
 * the real frontend exists. Runs one real-engine game with bot players and prints
 * a live, host's-eye play-by-play across the day.
 *
 *   npm run watch                       # ~20s, default 7-player Seasons round
 *   npm run watch -- --players 11
 *   npm run watch -- --skill 0.7 --mps 80   # faster
 *   npm run watch -- --instant          # no pauses (dump the whole timeline)
 *   npm run watch -- --seed myseed
 *
 * This view is OMNISCIENT (it shows true roles + the real bar) so you can follow
 * what's happening. Players never see any of this — they get the vague feed (§14).
 */

import { deriveConfig } from "../engine/config.js";
import { GameEngine } from "../engine/engine.js";
import { RNG } from "../engine/rng.js";
import { drawTier } from "./strategy.js";
import { minuteToClock } from "./simulate.js";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function argStr(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? String(process.argv[i + 1]) : fallback;
}

const players = arg("players", 7);
const skill = arg("skill", 0.6);
const insuranceBias = arg("insuranceBias", 0.85);
const engagement = arg("engagement", 1.0);
const minutesPerSecond = arg("mps", 40);
const instant = flag("instant");
const seed = argStr("seed", `watch-${Date.now()}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const config = deriveConfig({ players });
  const engine = new GameEngine({
    config,
    seed,
    roster: Array.from({ length: players }, (_, i) => ({ id: `p${i}`, name: NAMES[i] ?? `P${i}` })),
  });
  engine.start();
  const rng = new RNG(`${seed}:bots`);
  const name = (id: string) => engine.getPlayer(id)?.name ?? id;

  // --- Opening panel (omniscient/debug) ---
  const killers = engine.livingKillers();
  line("");
  line(`================ ALL-DAY SOCIAL DEDUCTION — LIVE WATCH ================`);
  line(`Seed: ${seed}   Players: ${players}   Killers: ${config.killers}   Votes: ${config.voteTimesMin.length}`);
  line(`Scheduled votes at: ${config.voteTimesMin.map((m) => minuteToClock(m)).join(", ")}`);
  line(`\n  [DEBUG — host's-eye view; players never see this]`);
  line(`  KILLERS:  ${killers.map((k) => k.name).join(", ")}`);
  line(`  TOWN:     ${engine.livingTown().map((t) => t.name).join(", ")}`);
  line(`\n  9:00 AM — the day begins. Suspicion simmers...\n`);
  if (!instant) await sleep(1500);

  const voteTimes = new Set(config.voteTimesMin);
  const perMinTaskProb = engagement / 60;
  let logIdx = engine.state.internalLog.length;
  let lastHourPrinted = -1;
  let taskCountThisHour = 0;

  while (engine.state.now < config.finaleMin && !engine.state.result) {
    const now = engine.state.now;

    // bot task completions
    for (const p of engine.state.players) {
      if (!p.alive) continue;
      if (rng.next() < perMinTaskProb) {
        const tier = drawTier(rng);
        engine.completeTask({ playerId: p.id, tier, group: tier === "group" });
        taskCountThisHour++;
      }
    }
    // killer actions
    for (const k of engine.livingKillers()) {
      if (k.meterPoints < config.killCost) continue;
      const movesLeft = config.maxMoves - (engine.state.moveCharges + engine.state.movesUsed);
      const canBank = movesLeft > 0 && engine.state.moveCharges === 0 && k.meterPoints >= config.moveCost;
      if (canBank && rng.bool(insuranceBias)) engine.bankMove(k.id);
      else {
        const town = engine.livingTown();
        if (town.length > 0) engine.activateKill(k.id, rng.pick(town).id);
      }
    }
    // scheduled vote
    if (voteTimes.has(now)) runVote(engine, rng, skill);

    engine.advanceTo(now + 1);

    // narrate any newly-logged beats
    for (; logIdx < engine.state.internalLog.length; logIdx++) {
      const printed = await narrate(engine.state.internalLog[logIdx]!, engine, name, instant, minutesPerSecond);
      if (printed && !instant) await sleep(250);
    }

    // hourly status line
    const hour = Math.floor(engine.state.now / 60);
    if (hour !== lastHourPrinted && engine.state.now % 60 === 0 && engine.state.now > 0) {
      lastHourPrinted = hour;
      const bar = Math.round(engine.state.townBar);
      line(
        `   · ${minuteToClock(engine.state.now)}  bar ${bandStr(bar)} (${bar}%)  ·  living ${engine.state.players.filter((p) => p.alive).length}  ·  charges ${engine.state.moveCharges}  ·  ${taskCountThisHour} tasks done this hour`,
      );
      taskCountThisHour = 0;
      if (!instant) await sleep(Math.max(0, 1000 - minutesPerSecond * 0));
    }

    if (!instant) await sleep(1000 / minutesPerSecond);
  }

  // final recap
  const r = engine.state.result;
  line("");
  if (r) {
    const verdict = r.winner === "killer" ? "🔪 KILLERS WIN" : "🛡️ TOWN WINS";
    line(`========================  ${verdict}  ========================`);
    line(`Reason: ${REASON[r.reason]}   ·   Time: ${minuteToClock(r.at)}`);
  }
  line(`\nFinal roles (host view):`);
  for (const p of engine.state.players) {
    const status = p.alive ? "alive" : p.isGhost ? "ghost" : "out";
    line(`  ${p.name.padEnd(8)} ${p.team.toUpperCase().padEnd(7)} ${p.role.padEnd(11)} ${status}`);
  }
  line("");
}

const NAMES = ["Alice", "Bob", "Cara", "Dave", "Eve", "Finn", "Gwen", "Hank", "Iris", "Jack", "Kira", "Liam", "Mara", "Nico", "Omar", "Priya", "Quinn", "Ruth", "Sam", "Tess", "Umar", "Vera"];
const REASON: Record<string, string> = {
  parity: "killers reached parity (living killers ≥ living town)",
  collapse: "the town bar collapsed to 0%",
  allKillersEliminated: "town eliminated every killer",
  finaleSurvival: "killers survived undetected to the finale",
};

function bandStr(bar: number): string {
  if (bar >= 66) return "healthy";
  if (bar >= 33) return "strained";
  return "CRITICAL";
}

function line(s: string): void {
  console.log(s);
}

function runVote(engine: GameEngine, rng: RNG, skill: number): void {
  const livingKillers = engine.livingKillers();
  const living = [...livingKillers, ...engine.livingTown()];
  if (living.length === 0) return;
  let target: string;
  if (livingKillers.length > 0 && rng.bool(skill)) target = rng.pick(livingKillers).id;
  else target = rng.pick(living).id;
  const votes: Record<string, string> = {};
  for (const p of living) votes[p.id] = target;
  engine.runVote(votes);
}

async function narrate(
  e: { type: string; detail: Record<string, unknown>; at: number },
  engine: GameEngine,
  name: (id: string) => string,
  _instant: boolean,
  _mps: number,
): Promise<boolean> {
  const t = minuteToClock(e.at);
  switch (e.type) {
    case "eliminated":
      if (e.detail.cause === "kill") {
        line(`[${t}] 💀 ${name(e.detail.targetId as string)} was killed — announced only as "a death... or a switch." (secretly flips to the killers)`);
      } else {
        line(`[${t}] 🗳️ Town voted out ${name(e.detail.targetId as string)} — who was TOWN. Oof. (now a killer-side ghost)`);
      }
      return true;
    case "killerRemoved":
      line(`[${t}] 🗳️ Town CAUGHT a killer: ${name(e.detail.caughtId as string)} — no insurance banked, gone for good. Town gains ground!`);
      return true;
    case "killerMoved":
      line(`[${t}] 🗳️ Town caught killer ${name(e.detail.caughtId as string)} — but the team had a charge. ${name(e.detail.resurrectedId as string)} rises as a NEW killer (count unchanged).`);
      return true;
    case "moveBanked":
      line(`[${t}] 🛡️ The killers banked a move charge (insurance instead of a kill).`);
      return true;
    case "killBlockedByShield":
      line(`[${t}] ✨ A kill was BLOCKED by the Medic's shield!`);
      return true;
    case "directorAdjustmentApplied":
      line(`[${t}] 🎛️ The Director quietly nudged the pacing. (players just feel "something shifted")`);
      return true;
    default:
      return false;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
