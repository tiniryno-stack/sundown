import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "../engine/engine.js";
import { InMemoryStore } from "../persistence/store.js";
import { GameService } from "./gameService.js";
import type { PlayerView, ServiceGameRecord } from "./types.js";

/** Controllable clock so tests drive game time deterministically. */
function setup() {
  let clockMs = 1_000_000;
  const store = new InMemoryStore<ServiceGameRecord>();
  const svc = new GameService(store, { now: () => clockMs });
  return {
    store,
    svc,
    setMinute: (mins: number, startedAtMs: number) => {
      clockMs = startedAtMs + mins * 60000;
    },
    nowMs: () => clockMs,
    advance: (mins: number) => {
      clockMs += mins * 60000;
    },
  };
}

async function lobbyOf(svc: GameService, n: number) {
  const { gameId } = await svc.createGame({ hostId: "host", players: n, roles: { cop: true, medic: true } });
  const players: { playerId: string; token: string }[] = [];
  for (let i = 0; i < n; i++) {
    const j = (await svc.join(gameId, `P${i}`)) as { playerId: string; token: string };
    players.push(j);
  }
  return { gameId, players };
}

describe("GameService — lobby & lifecycle", () => {
  it("creates a game, joins players, and starts a round", async () => {
    const { svc } = setup();
    const { gameId, players } = await lobbyOf(svc, 7);
    expect(players).toHaveLength(7);
    const started = await svc.startRound(gameId, "host");
    expect(started.ok).toBe(true);
  });

  it("rejects start from a non-host and with too few players", async () => {
    const { svc } = setup();
    const { gameId } = await lobbyOf(svc, 3);
    expect((await svc.startRound(gameId, "host")).error).toMatch(/at least 4/);
    const big = await lobbyOf(svc, 7);
    expect((await svc.startRound(big.gameId, "intruder")).error).toMatch(/not the host/);
  });
});

describe("GameService — privacy projection (spec invariants)", () => {
  let env: ReturnType<typeof setup>;
  let gameId: string;
  let players: { playerId: string; token: string }[];
  let startedAtMs: number;

  beforeEach(async () => {
    env = setup();
    const lobby = await lobbyOf(env.svc, 7);
    gameId = lobby.gameId;
    players = lobby.players;
    await env.svc.startRound(gameId, "host");
    const rec = (await env.store.load(gameId))!;
    startedAtMs = rec.startedAtMs;
  });

  it("never leaks other players' roles or teams", async () => {
    const me = players[0]!;
    const view = (await env.svc.getState(gameId, me.playerId, me.token)) as PlayerView;
    // The public roster carries names + alive ONLY — no role/team fields.
    for (const p of view.players) {
      expect(Object.keys(p).sort()).toEqual(["alive", "id", "name"]);
    }
    // You only ever see your OWN role/team.
    expect(view.you.id).toBe(me.playerId);
    expect(["town", "killer"]).toContain(view.you.team);
  });

  it("exposes a banded bar, never the exact value (§14/§15.1)", async () => {
    const me = players[0]!;
    const view = (await env.svc.getState(gameId, me.playerId, me.token)) as PlayerView;
    expect(["healthy", "strained", "critical", "unknown"]).toContain(view.bar);
    expect(typeof (view as unknown as { townBar?: number }).townBar).toBe("undefined");
  });

  it("shows total living count but not the killers/town breakdown (§9)", async () => {
    const me = players[0]!;
    const view = (await env.svc.getState(gameId, me.playerId, me.token)) as PlayerView;
    expect(view.livingCount).toBe(7);
    expect(view).not.toHaveProperty("livingKillers");
    expect(view).not.toHaveProperty("livingTown");
  });

  it("gives killers their own meter + team charges; town players get neither", async () => {
    const rec = (await env.store.load(gameId))!;
    const engine = GameEngine.hydrate(rec.engine!);
    const killerId = engine.state.players.find((p) => p.team === "killer")!.id;
    const townId = engine.state.players.find((p) => p.team === "town")!.id;
    const cred = (id: string) => players.find((p) => p.playerId === id)!.token;

    const kView = (await env.svc.getState(gameId, killerId, cred(killerId))) as PlayerView;
    const tView = (await env.svc.getState(gameId, townId, cred(townId))) as PlayerView;
    expect(kView.you.killer).toBeDefined();
    expect(tView.you.killer).toBeUndefined();
  });

  it("rejects bad credentials", async () => {
    const me = players[0]!;
    const res = await env.svc.getState(gameId, me.playerId, "wrong-token");
    expect((res as { error?: string }).error).toMatch(/credentials/);
  });
});

describe("GameService — lobby state & task deck", () => {
  it("returns a lobby PlayerView before the round starts (no crash)", async () => {
    const env = setup();
    const { gameId, players } = await lobbyOf(env.svc, 7);
    const view = (await env.svc.getState(gameId, players[0]!.playerId, players[0]!.token)) as PlayerView;
    expect(view.phase).toBe("lobby");
    expect(view.players).toHaveLength(7);
    expect(view.bar).toBe("unknown");
  });

  it("serves the task deck with per-player cooldowns", async () => {
    const env = setup();
    const { gameId, players } = await lobbyOf(env.svc, 7);
    await env.svc.startRound(gameId, "host");
    const res = (await env.svc.getTasks(gameId, players[0]!.playerId, players[0]!.token)) as {
      tasks: { id: string; availableAtMinute: number }[];
      nowMinute: number;
    };
    expect(res.tasks.length).toBeGreaterThan(10);
    expect(res.tasks.every((t) => t.availableAtMinute === 0)).toBe(true);

    // After completing a task, its cooldown shows up.
    const rec = (await env.store.load(gameId))!;
    env.setMinute(10, rec.startedAtMs);
    const taskId = rec.deck![0]!.id;
    await env.svc.completeTask(gameId, players[0]!.playerId, players[0]!.token, taskId);
    const after = (await env.svc.getTasks(gameId, players[0]!.playerId, players[0]!.token)) as {
      tasks: { id: string; availableAtMinute: number }[];
    };
    expect(after.tasks.find((t) => t.id === taskId)!.availableAtMinute).toBeGreaterThan(10);
  });
});

describe("GameService — task completion + cooldown (§7.3)", () => {
  it("accepts a task, then blocks repeats until the cooldown elapses", async () => {
    const env = setup();
    const { gameId, players } = await lobbyOf(env.svc, 7);
    await env.svc.startRound(gameId, "host");
    const rec = (await env.store.load(gameId))!;
    const taskId = rec.deck![0]!.id;
    const me = players[0]!;

    env.setMinute(10, rec.startedAtMs);
    const first = await env.svc.completeTask(gameId, me.playerId, me.token, taskId);
    expect(first.ok).toBe(true);

    const second = await env.svc.completeTask(gameId, me.playerId, me.token, taskId);
    expect(second.ok).toBe(false);
    expect(second.cooldownUntilMinute).toBe(10 + rec.config.taskCooldownMin);

    // After the cooldown, it's available again.
    env.setMinute(10 + rec.config.taskCooldownMin + 1, rec.startedAtMs);
    const third = await env.svc.completeTask(gameId, me.playerId, me.token, taskId);
    expect(third.ok).toBe(true);
  });
});

describe("GameService — votes (§6)", () => {
  it("opens a vote in its window, records ballots, and resolves at the scheduled time", async () => {
    const env = setup();
    const { gameId, players } = await lobbyOf(env.svc, 7);
    await env.svc.startRound(gameId, "host");
    const rec = (await env.store.load(gameId))!;
    const vt = rec.config.voteTimesMin[0]!; // first scheduled vote

    // Before the window: no vote open.
    env.setMinute(vt - 30, rec.startedAtMs);
    const early = (await env.svc.getState(gameId, players[0]!.playerId, players[0]!.token)) as PlayerView;
    expect(early.vote.open).toBe(false);

    // In the window: vote open; everyone targets player 1.
    env.setMinute(vt - 5, rec.startedAtMs);
    const target = players[1]!.playerId;
    for (const p of players) {
      await env.svc.castVote(gameId, p.playerId, p.token, target);
    }
    const view = (await env.svc.getState(gameId, players[0]!.playerId, players[0]!.token)) as PlayerView;
    expect(view.vote.open).toBe(true);
    expect(view.vote.youVoted).toBe(true);

    // Past the scheduled time + the resolution delay: someone has been eliminated.
    env.setMinute(vt + 15, rec.startedAtMs);
    const after = (await env.svc.getState(gameId, players[0]!.playerId, players[0]!.token)) as PlayerView;
    expect(after.livingCount).toBeLessThan(7);
  });
});

describe("GameService — killer actions & anonymous suggestions (§9)", () => {
  it("anonymizes current suggestions and hides your own/self", async () => {
    const env = setup();
    const { gameId, players } = await lobbyOf(env.svc, 11); // 3 killers
    await env.svc.startRound(gameId, "host");
    const rec = (await env.store.load(gameId))!;
    const engine = GameEngine.hydrate(rec.engine!);
    const killers = engine.state.players.filter((p) => p.team === "killer").map((p) => p.id);
    const town = engine.state.players.find((p) => p.team === "town")!.id;
    const tok = (id: string) => players.find((p) => p.playerId === id)!.token;
    env.setMinute(5, rec.startedAtMs);

    // Killer A and B each suggest the same townsperson.
    await env.svc.killerSuggest(gameId, killers[0]!, tok(killers[0]!), town);
    await env.svc.killerSuggest(gameId, killers[1]!, tok(killers[1]!), town);

    // Killer C sees the suggestion; identities of suggesters are not present.
    const ctx = (await env.svc.getKillContext(gameId, killers[2]!, tok(killers[2]!))) as {
      canKillNow: boolean;
      suggestions: string[];
    };
    expect(ctx.suggestions).toContain(town);
    expect(ctx.suggestions).not.toContain(killers[2]); // can't be the activator
    expect(ctx.canKillNow).toBe(false); // unfunded meter
  });

  it("rejects a kill from an unfunded killer", async () => {
    const env = setup();
    const { gameId, players } = await lobbyOf(env.svc, 7);
    await env.svc.startRound(gameId, "host");
    const rec = (await env.store.load(gameId))!;
    const engine = GameEngine.hydrate(rec.engine!);
    const killer = engine.state.players.find((p) => p.team === "killer")!.id;
    const victim = engine.state.players.find((p) => p.team === "town")!.id;
    const tok = players.find((p) => p.playerId === killer)!.token;
    env.setMinute(5, rec.startedAtMs);
    const res = await env.svc.killerKill(gameId, killer, tok, victim);
    expect(res.ok).toBe(false);
  });
});

describe("GameService — persistence round-trip & Director", () => {
  it("survives a fresh service instance over the same store", async () => {
    const env = setup();
    const { gameId, players } = await lobbyOf(env.svc, 7);
    await env.svc.startRound(gameId, "host");

    // A second service sharing the store can read the live state.
    const svc2 = new GameService(env.store, { now: env.nowMs });
    const view = (await svc2.getState(gameId, players[0]!.playerId, players[0]!.token)) as PlayerView;
    expect(view.phase).toBe("active");
    expect(view.players).toHaveLength(7);
  });

  it("runs a Director tick that stays within guardrails (host-only)", async () => {
    const env = setup();
    const { gameId } = await lobbyOf(env.svc, 7);
    await env.svc.startRound(gameId, "host");
    const rec = (await env.store.load(gameId))!;
    env.setMinute(30, rec.startedAtMs);
    const res = await env.svc.runDirectorTick(gameId, "host");
    expect(res).toHaveProperty("patch");
    // A non-host cannot run the Director.
    const denied = await env.svc.runDirectorTick(gameId, "intruder");
    expect((denied as { error?: string }).error).toMatch(/not the host/);
  });

  it("resolves at the finale and can start a Seasons next round", async () => {
    const env = setup();
    const { gameId } = await lobbyOf(env.svc, 7);
    await env.svc.startRound(gameId, "host");
    const rec = (await env.store.load(gameId))!;
    env.setMinute(rec.config.finaleMin + 5, rec.startedAtMs);
    const result = await env.svc.getResult(gameId);
    expect(result).not.toBeNull();

    const next = await env.svc.nextRound(gameId, "host");
    expect(next.ok).toBe(true);
    const rec2 = (await env.store.load(gameId))!;
    expect(rec2.roundIndex).toBe(1);
    expect(rec2.phase).toBe("active");
  });
});
