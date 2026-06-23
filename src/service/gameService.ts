/**
 * GameService (§18 item 6) — the framework-agnostic application layer the future
 * frontend consumes. Every method maps to one documented endpoint in API.md.
 *
 * It owns: lobby/join, round lifecycle, the clock→engine sync, vote collection +
 * scheduled resolution (§6), task completion with cooldown (§7.3), killer actions
 * (§9), and — critically — the player-scoped projection that enforces the spec's
 * privacy invariants (separate progress, attribution internal-only, vague/banded
 * public state, delayed changes).
 */

import { createLLMClient, type LLMClient } from "../ai/client.js";
import { DeckGenerator } from "../deck/generator.js";
import { makeMockDeckClient } from "../deck/mockDeck.js";
import type { Task } from "../deck/types.js";
import { Director, type DirectorTickResult } from "../director/director.js";
import { makeMockDirectorClient } from "../director/mockDirector.js";
import { deriveConfig } from "../engine/config.js";
import { GameEngine } from "../engine/engine.js";
import { TIER_POINTS } from "../engine/economy.js";
import type { GameResult } from "../engine/types.js";
import type { Store } from "../persistence/store.js";
import { InMemoryStore } from "../persistence/store.js";
import type {
  ActionResult,
  BarStatus,
  CompleteTaskResult,
  CreateGameInput,
  KillContext,
  PlayerView,
  ServiceGameRecord,
} from "./types.js";

const VOTE_WINDOW_MIN = 20; // voting opens this long before a scheduled vote (§6)

export interface GameServiceOptions {
  /** Epoch-ms clock (injectable for deterministic tests). */
  now?: () => number;
  /** LLM client for deck generation (falls back to a deterministic mock). */
  deckClient?: LLMClient;
  /** LLM client for the Director (falls back to the heuristic mock). */
  directorClient?: LLMClient;
}

export class GameService {
  private readonly now: () => number;
  private readonly deckClient: LLMClient;
  private readonly directorClient: LLMClient;

  constructor(
    private readonly store: Store<ServiceGameRecord> = new InMemoryStore<ServiceGameRecord>(),
    opts: GameServiceOptions = {},
  ) {
    this.now = opts.now ?? (() => Date.now());
    this.deckClient = opts.deckClient ?? createLLMClient() ?? makeMockDeckClient();
    this.directorClient = opts.directorClient ?? createLLMClient() ?? makeMockDirectorClient();
  }

  // ===========================================================================
  // Lobby / lifecycle
  // ===========================================================================

  async createGame(input: CreateGameInput): Promise<{ gameId: string }> {
    const config = deriveConfig({
      players: input.players,
      dayLengthMin: input.dayLengthMin,
      roles: input.roles,
    });
    const record: ServiceGameRecord = {
      id: uid("g"),
      hostId: input.hostId,
      phase: "lobby",
      roundIndex: 0,
      config,
      seedBase: input.seed ?? uid("s"),
      roster: [],
      engine: null,
      deck: null,
      cooldowns: {},
      suggestions: {},
      ballots: {},
      resolvedVotes: [],
      startedAtMs: 0,
      results: [],
    };
    await this.store.save(record.id, record);
    return { gameId: record.id };
  }

  async join(gameId: string, name: string): Promise<{ playerId: string; token: string } | ActionResult> {
    const record = await this.load(gameId);
    if (!record) return fail("unknown game");
    if (record.phase !== "lobby") return fail("game already started");
    const playerId = uid("p");
    const token = uid("t");
    record.roster.push({ id: playerId, name, token });
    await this.store.save(gameId, record);
    return { playerId, token };
  }

  /** Host starts the round: derive config for the actual headcount, assign roles, build the deck, go live. */
  async startRound(gameId: string, hostId: string): Promise<ActionResult> {
    const record = await this.load(gameId);
    if (!record) return fail("unknown game");
    if (record.hostId !== hostId) return fail("not the host");
    if (record.phase !== "lobby") return fail("already started");
    if (record.roster.length < 4) return fail("need at least 4 players");

    // Headcount picks the format (§3): re-derive from the actual roster size.
    record.config = deriveConfig({
      players: record.roster.length,
      dayLengthMin: record.config.dayLengthMin,
      roles: record.config.roles,
    });

    const engine = new GameEngine({
      config: record.config,
      seed: `${record.seedBase}:r${record.roundIndex}`,
      roster: record.roster.map((r) => ({ id: r.id, name: r.name })),
    });
    engine.start();

    record.deck = await this.buildDeck(record.roster.length);
    record.engine = engine.serialize();
    record.phase = "active";
    record.startedAtMs = this.now();
    record.ballots = {};
    record.resolvedVotes = [];
    record.cooldowns = {};
    record.suggestions = {};
    await this.store.save(gameId, record);
    return { ok: true };
  }

  /** Seasons format (§3): start a fresh re-shuffled round after one resolves. */
  async nextRound(gameId: string, hostId: string): Promise<ActionResult> {
    const record = await this.load(gameId);
    if (!record) return fail("unknown game");
    if (record.hostId !== hostId) return fail("not the host");
    if (record.phase !== "resolved") return fail("current round not resolved");

    // Director structural adaptation from the prior round (§15.2) — scaffolded.
    const prev = record.results[record.results.length - 1];
    if (prev) record.config = adaptConfigFromPriorRound(prev, record.config);

    record.roundIndex += 1;
    const engine = new GameEngine({
      config: record.config,
      seed: `${record.seedBase}:r${record.roundIndex}`,
      roster: record.roster.map((r) => ({ id: r.id, name: r.name })),
    });
    engine.start();
    record.engine = engine.serialize();
    record.phase = "active";
    record.startedAtMs = this.now();
    record.ballots = {};
    record.resolvedVotes = [];
    record.cooldowns = {};
    record.suggestions = {};
    await this.store.save(gameId, record);
    return { ok: true };
  }

  // ===========================================================================
  // State (player-scoped projection — the privacy boundary)
  // ===========================================================================

  async getState(gameId: string, playerId: string, token: string): Promise<PlayerView | ActionResult> {
    const record = await this.load(gameId);
    if (!record) return fail("unknown game");
    if (!this.auth(record, playerId, token)) return fail("bad credentials");
    const engine = this.syncedEngine(record);
    await this.store.save(gameId, record);
    return this.projectFor(record, engine, playerId);
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  async completeTask(gameId: string, playerId: string, token: string, taskId: string): Promise<CompleteTaskResult> {
    return this.withActive(gameId, playerId, token, async (record, engine) => {
      const task = (record.deck ?? []).find((t) => t.id === taskId);
      if (!task) return fail("unknown task");
      const m = this.nowMinute(record);
      const until = record.cooldowns[playerId]?.[taskId];
      if (typeof until === "number" && m < until) {
        return { ok: false, error: "task on cooldown", cooldownUntilMinute: until };
      }
      const receipt = engine.completeTask({ playerId, tier: task.tier, group: task.group });
      if (!receipt.ok) return fail(receipt.error ?? "rejected");
      (record.cooldowns[playerId] ??= {})[taskId] = m + record.config.taskCooldownMin;
      return { ok: true };
    });
  }

  async castVote(gameId: string, playerId: string, token: string, targetId: string): Promise<ActionResult> {
    return this.withActive(gameId, playerId, token, async (record, engine) => {
      const m = this.nowMinute(record);
      const active = activeVoteIndex(record, m);
      if (active === null) return fail("no vote open right now");
      const voter = engine.getPlayer(playerId);
      if (!voter || !voter.alive) return fail("only living players vote");
      const target = engine.getPlayer(targetId);
      if (!target || !target.alive) return fail("invalid target");
      (record.ballots[active] ??= {})[playerId] = targetId;
      return { ok: true };
    });
  }

  async killerKill(gameId: string, playerId: string, token: string, targetId: string): Promise<ActionResult> {
    return this.withActive(gameId, playerId, token, async (record, engine) => {
      const receipt = engine.activateKill(playerId, targetId);
      if (receipt.ok) record.suggestions = {}; // fresh each time, no history (§9)
      return receipt.ok ? { ok: true } : fail(receipt.error ?? "rejected");
    });
  }

  async killerBankMove(gameId: string, playerId: string, token: string): Promise<ActionResult> {
    return this.withActive(gameId, playerId, token, async (_record, engine) => {
      const receipt = engine.bankMove(playerId);
      return receipt.ok ? { ok: true } : fail(receipt.error ?? "rejected");
    });
  }

  async killerSuggest(gameId: string, playerId: string, token: string, targetId: string): Promise<ActionResult> {
    return this.withActive(gameId, playerId, token, async (record, engine) => {
      const me = engine.getPlayer(playerId);
      if (!me || me.team !== "killer" || !me.alive) return fail("not an active killer");
      if (targetId === playerId) return fail("cannot suggest yourself");
      record.suggestions[playerId] = targetId;
      return { ok: true };
    });
  }

  async getKillContext(gameId: string, playerId: string, token: string): Promise<KillContext | ActionResult> {
    const record = await this.load(gameId);
    if (!record) return fail("unknown game");
    if (!this.auth(record, playerId, token)) return fail("bad credentials");
    if (record.phase !== "active" || !record.engine) return fail("round not active");
    const engine = this.syncedEngine(record);
    await this.store.save(gameId, record);
    const me = engine.getPlayer(playerId);
    if (!me || me.team !== "killer") return fail("not a killer");
    const raw = Object.entries(record.suggestions).map(([from, t]) => ({ from, targetId: t }));
    return {
      canKillNow: me.alive && me.meterPoints >= record.config.killCost,
      suggestions: engine.currentSuggestions(playerId, raw),
    };
  }

  // ===========================================================================
  // Host: Director tick (§15)
  // ===========================================================================

  async runDirectorTick(gameId: string, hostId: string): Promise<DirectorTickResult | ActionResult> {
    const record = await this.load(gameId);
    if (!record) return fail("unknown game");
    if (record.hostId !== hostId) return fail("not the host");
    if (record.phase !== "active" || !record.engine) return fail("round not active");
    const engine = this.syncedEngine(record);
    const director = new Director(engine, this.directorClient);
    const result = await director.tick();
    record.engine = engine.serialize();
    await this.store.save(gameId, record);
    return result;
  }

  async getResult(gameId: string): Promise<GameResult | null> {
    const record = await this.load(gameId);
    if (!record) return null;
    if (record.phase !== "active") return record.results[record.results.length - 1] ?? null;
    const engine = this.syncedEngine(record);
    await this.store.save(gameId, record);
    return engine.state.result;
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  private async load(gameId: string): Promise<ServiceGameRecord | null> {
    return this.store.load(gameId);
  }

  private auth(record: ServiceGameRecord, playerId: string, token: string): boolean {
    return record.roster.some((r) => r.id === playerId && r.token === token);
  }

  private nowMinute(record: ServiceGameRecord): number {
    if (record.startedAtMs === 0) return 0;
    return Math.max(0, Math.floor((this.now() - record.startedAtMs) / 60000));
  }

  /** Hydrate the engine and sync it to the wall clock: resolve due votes, apply effects. */
  private syncedEngine(record: ServiceGameRecord): GameEngine {
    const engine = GameEngine.hydrate(record.engine!);
    const m = this.nowMinute(record);
    const voteTimes = record.config.voteTimesMin;
    for (let i = 0; i < voteTimes.length; i++) {
      const vt = voteTimes[i]!;
      if (vt <= m && !record.resolvedVotes.includes(i)) {
        engine.advanceTo(vt);
        engine.runVote(record.ballots[i] ?? {});
        record.resolvedVotes.push(i);
      }
    }
    engine.advanceTo(m);
    if (engine.state.result && record.phase === "active") {
      record.phase = "resolved";
      record.results.push(engine.state.result);
    }
    record.engine = engine.serialize();
    return engine;
  }

  private async withActive<T extends ActionResult>(
    gameId: string,
    playerId: string,
    token: string,
    fn: (record: ServiceGameRecord, engine: GameEngine) => Promise<T>,
  ): Promise<T | ActionResult> {
    const record = await this.load(gameId);
    if (!record) return fail("unknown game");
    if (!this.auth(record, playerId, token)) return fail("bad credentials");
    if (record.phase !== "active" || !record.engine) return fail("round not active");
    const engine = this.syncedEngine(record);
    if (record.phase !== "active") {
      await this.store.save(gameId, record);
      return fail("round just ended");
    }
    const result = await fn(record, engine);
    record.engine = engine.serialize();
    await this.store.save(gameId, record);
    return result;
  }

  private async buildDeck(players: number): Promise<Task[]> {
    const gen = new DeckGenerator(this.deckClient);
    const res = await gen.generate({ count: Math.max(24, players * 4) });
    return res.deck.tasks;
  }

  private projectFor(record: ServiceGameRecord, engine: GameEngine, playerId: string): PlayerView {
    const s = engine.state;
    const me = engine.getPlayer(playerId);
    const m = this.nowMinute(record);
    const active = activeVoteIndex(record, m);

    const view: PlayerView = {
      gameId: record.id,
      phase: record.phase,
      roundIndex: record.roundIndex,
      nowMinute: m,
      finaleMinute: record.config.finaleMin,
      you: {
        id: playerId,
        name: record.roster.find((r) => r.id === playerId)?.name ?? "?",
        role: me?.role ?? "townsperson",
        team: me?.team ?? "town",
        alive: me?.alive ?? true,
        isGhost: me?.isGhost ?? false,
      },
      bar: bandBar(record.phase === "active" ? s.townBar : null),
      livingCount: s.players.filter((p) => p.alive).length,
      players: record.roster.map((r) => ({
        id: r.id,
        name: r.name,
        alive: engine.getPlayer(r.id)?.alive ?? true,
      })),
      events: s.publicEvents,
      vote: {
        open: active !== null && (me?.alive ?? false),
        index: active,
        closesAtMinute: active !== null ? record.config.voteTimesMin[active]! : null,
        youVoted: active !== null && !!record.ballots[active]?.[playerId],
      },
      result: s.result,
    };

    // Role-scoped private resources (ONLY your own — never another player's).
    if (me?.team === "killer") {
      view.you.killer = {
        meterPoints: me.meterPoints,
        killCost: record.config.killCost,
        canKillNow: me.alive && me.meterPoints >= record.config.killCost,
        teamMoveCharges: s.moveCharges,
        maxMoves: record.config.maxMoves,
      };
    }
    if (me?.role === "cop") view.you.cop = { investigations: me.investigations };
    if (me?.role === "medic") view.you.medic = { shields: me.shields };

    return view;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function bandBar(bar: number | null): BarStatus {
  if (bar === null) return "unknown";
  if (bar >= 66) return "healthy";
  if (bar >= 33) return "strained";
  return "critical";
}

/** The index of the currently-open scheduled vote, or null (§6 voting window). */
function activeVoteIndex(record: ServiceGameRecord, nowMin: number): number | null {
  const times = record.config.voteTimesMin;
  for (let i = 0; i < times.length; i++) {
    const vt = times[i]!;
    if (record.resolvedVotes.includes(i)) continue;
    if (nowMin >= vt - VOTE_WINDOW_MIN && nowMin < vt) return i;
  }
  return null;
}

/**
 * Director structural between-round adaptation (§15.2). Scaffold: if killers
 * steamrolled, make resilience pricier next round; if town crushed it, ease it.
 * TODO(open-question: §17 — full adaptive tuning needs playtest data)
 */
export function adaptConfigFromPriorRound(prev: GameResult, config: ServiceGameRecord["config"]) {
  const next = { ...config };
  if (prev.winner === "killer") {
    next.moveCost = Math.min(14, config.moveCost + 2); // pricier insurance
    if (prev.reason === "parity") next.maxMoves = Math.max(1, config.maxMoves - 1);
  } else {
    next.moveCost = Math.max(8, config.moveCost - 1); // ease it back
    next.maxMoves = Math.min(3, config.maxMoves + 1);
  }
  return next;
}
