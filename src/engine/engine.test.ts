import { describe, expect, it } from "vitest";
import { deriveConfig, type GameConfig } from "./config.js";
import { GameEngine, type PlayerSeed } from "./engine.js";

function roster(n: number): PlayerSeed[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
}

/** Engine with near-zero delay (effects apply 1 minute later) for tight tests. */
function makeEngine(opts: { players?: number; seed?: number | string; overrides?: Partial<GameConfig>; roles?: Partial<GameConfig["roles"]> } = {}) {
  const players = opts.players ?? 7;
  const config = deriveConfig({
    players,
    roles: opts.roles,
    overrides: { delayMeanMin: 0, delayJitterMin: 0, decayPerMin: 0, finaleMin: 100000, ...opts.overrides },
  });
  const engine = new GameEngine({ config, seed: opts.seed ?? "test-seed", roster: roster(players) });
  engine.start();
  return engine;
}

function killer(e: GameEngine) {
  return e.livingKillers()[0]!;
}
function townie(e: GameEngine) {
  return e.livingTown()[0]!;
}

describe("setup & role assignment", () => {
  it("assigns exactly K killers and N-K town", () => {
    const e = makeEngine({ players: 7 });
    expect(e.livingKillers().length).toBe(2);
    expect(e.livingTown().length).toBe(5);
  });

  it("is deterministic for the same seed", () => {
    const a = makeEngine({ seed: "abc" });
    const b = makeEngine({ seed: "abc" });
    expect(a.livingKillers().map((p) => p.id)).toEqual(b.livingKillers().map((p) => p.id));
  });

  it("assigns cop/medic from town when flagged", () => {
    const e = makeEngine({ roles: { cop: true, medic: true } });
    expect(e.state.players.filter((p) => p.role === "cop").length).toBe(1);
    expect(e.state.players.filter((p) => p.role === "medic").length).toBe(1);
    // Powered roles are always town.
    expect(e.state.players.find((p) => p.role === "cop")!.team).toBe("town");
  });
});

describe("delayed application (§14)", () => {
  it("a completed task does not move the bar until the delay elapses", () => {
    const e = makeEngine();
    const t = townie(e);
    const before = e.state.townBar;
    e.completeTask({ playerId: t.id, tier: "standard" });
    expect(e.state.townBar).toBe(before); // not applied yet
    e.advanceTo(e.state.now + 1);
    expect(e.state.townBar).toBe(before); // bar already at cap (100), clamped
  });

  it("applies a town completion to the bar after the delay (below cap)", () => {
    const e = makeEngine({ overrides: { barStart: 50 } });
    const t = townie(e);
    e.completeTask({ playerId: t.id, tier: "standard" }); // 2 pts * 4% = +8%
    e.advanceTo(e.state.now + 1);
    expect(e.state.townBar).toBeCloseTo(58, 6);
  });
});

describe("separate progress invariant (§8)", () => {
  it("killer completions never touch the town bar", () => {
    const e = makeEngine({ overrides: { barStart: 50 } });
    const k = killer(e);
    e.completeTask({ playerId: k.id, tier: "heavy" });
    e.advanceTo(e.state.now + 1);
    expect(e.state.townBar).toBe(50); // unchanged
    expect(e.getPlayer(k.id)!.meterPoints).toBe(3); // meter got the points
  });

  it("town completions never touch any killer meter", () => {
    const e = makeEngine({ overrides: { barStart: 50 } });
    const t = townie(e);
    const k = killer(e);
    e.completeTask({ playerId: t.id, tier: "heavy" });
    e.advanceTo(e.state.now + 1);
    expect(e.getPlayer(k.id)!.meterPoints).toBe(0);
    expect(e.state.townBar).toBeCloseTo(62, 6);
  });
});

describe("kills (§9)", () => {
  function fundKiller(e: GameEngine, points: number) {
    const k = killer(e);
    for (let i = 0; i < points; i += 3) e.completeTask({ playerId: k.id, tier: "heavy" });
    e.advanceTo(e.state.now + 1);
    return k;
  }

  it("requires kill_cost points and resolves on a delay, unnamed", () => {
    const e = makeEngine();
    const k = fundKiller(e, 12);
    expect(e.getPlayer(k.id)!.meterPoints).toBeGreaterThanOrEqual(10);
    const target = townie(e);
    const r = e.activateKill(k.id, target.id);
    expect(r.ok).toBe(true);
    expect(e.getPlayer(target.id)!.alive).toBe(true); // not yet resolved
    e.advanceTo(e.state.now + 1);
    expect(e.getPlayer(target.id)!.alive).toBe(false);
    // Public events never name the victim.
    const pub = e.state.publicEvents.map((p) => p.message).join(" ");
    expect(pub).not.toContain(target.id);
  });

  it("rejects a kill without enough points", () => {
    const e = makeEngine();
    const k = killer(e);
    const r = e.activateKill(k.id, townie(e).id);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/insufficient/);
  });

  it("an eliminated townsperson silently flips to the killer side (§12)", () => {
    const e = makeEngine();
    const k = fundKiller(e, 12);
    const target = townie(e);
    e.activateKill(k.id, target.id);
    e.advanceTo(e.state.now + 1);
    const ghost = e.getPlayer(target.id)!;
    expect(ghost.isGhost).toBe(true);
    expect(ghost.alive).toBe(false);
    expect(ghost.team).toBe("killer"); // flipped
  });
});

describe("medic shield (§11)", () => {
  it("absorbs the next kill on the shielded player", () => {
    const e = makeEngine({ roles: { medic: true } });
    const medic = e.state.players.find((p) => p.role === "medic")!;
    medic.shields = 1; // grant directly for the unit test
    const k = killer(e);
    // fund the killer
    for (let i = 0; i < 12; i += 3) e.completeTask({ playerId: k.id, tier: "heavy" });
    e.advanceTo(e.state.now + 1);
    const target = e.livingTown().find((p) => p.id !== medic.id)!;
    e.shield(medic.id, target.id);
    e.activateKill(k.id, target.id);
    e.advanceTo(e.state.now + 1);
    expect(e.getPlayer(target.id)!.alive).toBe(true); // shielded
    expect(e.getPlayer(medic.id)!.shields).toBe(0); // consumed
  });
});

describe("votes (§6)", () => {
  it("eliminates the most-voted player on a delay", () => {
    const e = makeEngine();
    const target = townie(e);
    const votes: Record<string, string> = {};
    for (const p of e.state.players) votes[p.id] = target.id;
    const { eliminatedId } = e.runVote(votes);
    expect(eliminatedId).toBe(target.id);
    expect(e.getPlayer(target.id)!.alive).toBe(true); // delayed
    e.advanceTo(e.state.now + 1);
    expect(e.getPlayer(target.id)!.alive).toBe(false);
  });

  it("breaks ties deterministically by seed (random policy)", () => {
    const e = makeEngine();
    const [a, b] = e.state.players;
    const out = e.runVote({ x1: a!.id, x2: b!.id });
    expect([a!.id, b!.id]).toContain(out.eliminatedId);
  });

  it("noElimination policy yields no elimination on a tie", () => {
    const e = makeEngine({ overrides: { tieResolution: "noElimination" } });
    const [a, b] = e.state.players;
    const out = e.runVote({ x1: a!.id, x2: b!.id });
    expect(out.eliminatedId).toBeNull();
  });
});

describe("moving-killer system (§10)", () => {
  it("permanently removes a caught killer when no charge is banked", () => {
    const e = makeEngine();
    const k = killer(e);
    const votes: Record<string, string> = {};
    for (const p of e.state.players) votes[p.id] = k.id;
    e.runVote(votes);
    e.advanceTo(e.state.now + 1);
    expect(e.getPlayer(k.id)!.alive).toBe(false);
    expect(e.livingKillers().length).toBe(1); // K dropped
  });

  it("resurrects a ghost as a fresh killer when a charge + ghost exist (count-neutral)", () => {
    const e = makeEngine();
    const k = killer(e);
    // Fund killer with 20 pts: one for a kill (make a ghost), one to bank a move.
    for (let i = 0; i < 24; i += 3) e.completeTask({ playerId: k.id, tier: "heavy" });
    e.advanceTo(e.state.now + 1);
    // Create a ghost by killing a townsperson.
    const victim = townie(e);
    e.activateKill(k.id, victim.id);
    e.advanceTo(e.state.now + 1);
    expect(e.ghosts().length).toBe(1);
    // Bank a move charge.
    e.bankMove(k.id);
    e.advanceTo(e.state.now + 1);
    expect(e.state.moveCharges).toBe(1);

    const killersBefore = e.livingKillers().length;
    // Now town catches a killer.
    const caught = killer(e);
    const votes: Record<string, string> = {};
    for (const p of e.state.players) votes[p.id] = caught.id;
    e.runVote(votes);
    e.advanceTo(e.state.now + 1);

    expect(e.getPlayer(caught.id)!.alive).toBe(false); // caught one is gone
    expect(e.livingKillers().length).toBe(killersBefore); // count-neutral
    expect(e.state.moveCharges).toBe(0); // charge consumed
    expect(e.state.movesUsed).toBe(1);
  });

  it("caps banked move charges at max_moves", () => {
    const e = makeEngine({ overrides: { maxMoves: 1 } });
    const k = killer(e);
    for (let i = 0; i < 24; i += 3) e.completeTask({ playerId: k.id, tier: "heavy" });
    e.advanceTo(e.state.now + 1);
    expect(e.bankMove(k.id).ok).toBe(true);
    e.advanceTo(e.state.now + 1);
    const second = e.bankMove(k.id);
    expect(second.ok).toBe(false);
  });
});

describe("win conditions (§5)", () => {
  it("killers win by collapse when the bar hits 0", () => {
    const e = makeEngine({ overrides: { barStart: 2, decayPerMin: 1 } });
    e.advanceTo(e.state.now + 5);
    expect(e.state.result).not.toBeNull();
    expect(e.state.result!.winner).toBe("killer");
    expect(e.state.result!.reason).toBe("collapse");
  });

  it("town wins when all killers are eliminated", () => {
    const e = makeEngine();
    // Vote out both killers across two votes (no charges banked → permanent).
    for (let round = 0; round < 2; round++) {
      const k = e.livingKillers()[0]!;
      const votes: Record<string, string> = {};
      for (const p of e.state.players) votes[p.id] = k.id;
      e.runVote(votes);
      e.advanceTo(e.state.now + 1);
    }
    expect(e.state.result).not.toBeNull();
    expect(e.state.result!.winner).toBe("town");
    expect(e.state.result!.reason).toBe("allKillersEliminated");
  });

  it("killers win by parity", () => {
    const e = makeEngine();
    const k = killer(e);
    // Fund enough for 3 kills (3 town deaths: 5 town → 2 town, 2 killers = parity).
    for (let i = 0; i < 36; i += 3) e.completeTask({ playerId: k.id, tier: "heavy" });
    e.advanceTo(e.state.now + 1);
    for (let i = 0; i < 3; i++) {
      const victim = e.livingTown()[0]!;
      e.activateKill(k.id, victim.id);
      e.advanceTo(e.state.now + 1);
      if (e.state.result) break;
    }
    expect(e.state.result).not.toBeNull();
    expect(e.state.result!.winner).toBe("killer");
    expect(e.state.result!.reason).toBe("parity");
  });

  it("killers win by finale survival if still alive and below parity", () => {
    const e = makeEngine({ overrides: { finaleMin: 3 } });
    e.advanceTo(10);
    expect(e.state.result).not.toBeNull();
    expect(e.state.result!.winner).toBe("killer");
    expect(e.state.result!.reason).toBe("finaleSurvival");
  });
});

describe("attribution stays internal (§7.3/§15.1)", () => {
  it("public events carry no player identities", () => {
    const e = makeEngine();
    const t = townie(e);
    e.completeTask({ playerId: t.id, tier: "standard" });
    e.advanceTo(e.state.now + 1);
    for (const ev of e.state.publicEvents) {
      for (const p of e.state.players) {
        expect(ev.message).not.toContain(p.id);
        expect(ev.message).not.toContain(p.name);
      }
    }
    // But the internal log IS attributed.
    expect(e.state.internalLog.some((l) => l.type === "taskCompleted" && l.detail.playerId === t.id)).toBe(true);
  });
});
