/**
 * GameEngine — the pure, seedable, framework-agnostic core (§18 build item 1).
 *
 * Design rules enforced here:
 *  - Determinism: all randomness comes from a seeded RNG; `now` is integer minutes.
 *  - Separate progress (§8): town completions feed the bar ONLY; killer completions
 *    feed that killer's meter ONLY. `completeTask` routes by team and the two
 *    paths never touch each other's accumulator.
 *  - Delayed application (§14): every externally-visible state change is scheduled
 *    as a `ScheduledEffect` at `now + delay` and applied later — never instantly.
 *  - Attribution is internal-only (§7.3/§15.1): `internalLog` is attributed and
 *    omniscient; `publicEvents` are vague and carry no identities.
 *
 * The engine exposes COMMANDS (mutating intents that schedule delayed effects) and
 * a CLOCK (`advanceTo`) that applies due effects + decay and checks win conditions.
 */

import type { GameConfig } from "./config.js";
import { TIER_POINTS, type TaskTier } from "./economy.js";
import { RNG } from "./rng.js";
import type {
  AccuracyBallot,
  CommandReceipt,
  CompleteTaskInput,
  GameResult,
  GameState,
  InternalLogEntry,
  Player,
  PublicEvent,
  PublicEventKind,
  ScheduledEffect,
  Team,
} from "./types.js";

export interface PlayerSeed {
  id: string;
  name: string;
}

export interface CreateGameInput {
  config: GameConfig;
  seed: number | string;
  roster: PlayerSeed[];
}

/** Serialized engine: plain state + RNG position (for persistence). */
export interface EngineSnapshot {
  state: GameState;
  rngState: number;
}

let effectCounter = 0;

export class GameEngine {
  readonly state: GameState;
  private readonly rng: RNG;

  constructor(input: CreateGameInput) {
    const { config, roster } = input;
    if (roster.length !== config.players) {
      throw new Error(
        `roster size (${roster.length}) must equal config.players (${config.players})`,
      );
    }
    this.rng = new RNG(input.seed);
    this.state = {
      config,
      seed: this.rng.seed,
      now: 0,
      phase: "lobby",
      players: [],
      townBar: config.barStart,
      moveCharges: 0,
      movesUsed: 0,
      investigationBank: 0,
      shieldedPlayerIds: [],
      decayPerMin: config.decayPerMin,
      taskValueMultiplier: 1,
      effects: [],
      internalLog: [],
      publicEvents: [],
      ballots: [],
      result: null,
    };
    this.assignRoles(roster);
  }

  /**
   * Serialize the full engine (state + RNG position) to a plain JSON-safe blob
   * for persistence. `hydrate` reconstructs an identical, deterministic engine.
   */
  serialize(): EngineSnapshot {
    return { state: this.state, rngState: this.rng.getState() };
  }

  /** Reconstruct an engine from a serialized snapshot (no role re-assignment). */
  static hydrate(snapshot: EngineSnapshot): GameEngine {
    const e: GameEngine = Object.create(GameEngine.prototype);
    (e as { state: GameState }).state = snapshot.state;
    const rng = new RNG(snapshot.state.seed);
    rng.setState(snapshot.rngState);
    (e as unknown as { rng: RNG }).rng = rng;
    return e;
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  private assignRoles(roster: PlayerSeed[]): void {
    const cfg = this.state.config;
    // Seeded shuffle picks which seats are killers.
    const order = this.rng.shuffle(roster);
    const killerIds = new Set(order.slice(0, cfg.killers).map((p) => p.id));

    // Choose powered town roles (cop/medic) from the town pool, if enabled.
    const townOrder = order.filter((p) => !killerIds.has(p.id));
    let copId: string | null = null;
    let medicId: string | null = null;
    let ti = 0;
    if (cfg.roles.cop && ti < townOrder.length) copId = townOrder[ti++]!.id;
    if (cfg.roles.medic && ti < townOrder.length) medicId = townOrder[ti++]!.id;

    // Optional killer counter-role: tag one killer (scaffold; §17.1 open).
    let counterId: string | null = null;
    if (cfg.roles.killerCounterRole) {
      const killerOrder = order.filter((p) => killerIds.has(p.id));
      if (killerOrder.length > 0) counterId = killerOrder[0]!.id;
    }

    this.state.players = roster.map((p): Player => {
      const isKiller = killerIds.has(p.id);
      const team: Team = isKiller ? "killer" : "town";
      let role: Player["role"] = isKiller ? "killer" : "townsperson";
      if (p.id === copId) role = "cop";
      if (p.id === medicId) role = "medic";
      return {
        id: p.id,
        name: p.name,
        team,
        role,
        alive: true,
        isGhost: false,
        meterPoints: 0,
        investigations: 0,
        shields: 0,
        shieldProgress: 0,
        counterRole: p.id === counterId,
      };
    });

    this.log("rolesAssigned", {
      killers: [...killerIds],
      cop: copId,
      medic: medicId,
      counterRole: counterId,
    });
  }

  /** Move the round from lobby → active. Idempotent-safe guard. */
  start(): void {
    if (this.state.phase !== "lobby") return;
    this.state.phase = "active";
    this.log("roundStarted", { players: this.state.players.length });
  }

  // ---------------------------------------------------------------------------
  // Read helpers (internal — service layer projects a safe subset)
  // ---------------------------------------------------------------------------

  getPlayer(id: string): Player | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  livingKillers(): Player[] {
    return this.state.players.filter((p) => p.alive && p.team === "killer");
  }

  livingTown(): Player[] {
    return this.state.players.filter((p) => p.alive && p.team === "town");
  }

  ghosts(): Player[] {
    return this.state.players.filter((p) => p.isGhost);
  }

  // ---------------------------------------------------------------------------
  // Commands (schedule delayed effects; never mutate visible state inline)
  // ---------------------------------------------------------------------------

  /**
   * A player taps "done" on a task (§7.3 honor system). Routed by team:
   *  - town  → delayed town-bar gain (+ group/investigation credit)
   *  - killer→ delayed killer-meter gain
   * Faking is allowed by design; the engine simply records who tapped what.
   */
  completeTask(input: CompleteTaskInput): CommandReceipt {
    const p = this.getPlayer(input.playerId);
    if (!p) return fail("unknown player");
    if (!p.alive) return fail("player not alive");
    if (this.state.phase !== "active") return fail("round not active");

    const tier: TaskTier = input.tier;
    const basePoints = input.points ?? TIER_POINTS[tier];
    const points = basePoints * this.state.taskValueMultiplier;
    const applyAt = this.scheduleDelay();

    if (p.team === "town") {
      this.schedule("applyTownBar", applyAt, {
        playerId: p.id,
        points,
        tier,
        group: !!input.group,
        role: p.role,
      });
    } else {
      // Killer meter applies immediately so the killer sees their own progress.
      // applyAt is reserved for the future town-facing ominous notification.
      p.meterPoints += points;
    }
    this.log("taskCompleted", {
      playerId: p.id,
      role: p.role,
      team: p.team,
      tier,
      points,
      group: !!input.group,
    });
    return { ok: true, scheduledAt: applyAt };
  }

  /**
   * A killer activates a kill on a target (§9). Requires meter ≥ kill_cost.
   * Spends kill_cost from the killer's meter and schedules a delayed, unnamed
   * resolution. Models "unlock + use-it-or-lose-it" as one atomic action so
   * there is no observable floating "just got the power" tell.
   */
  activateKill(killerId: string, targetId: string): CommandReceipt {
    const k = this.getPlayer(killerId);
    if (!k || !k.alive || k.team !== "killer") return fail("not an active killer");
    if (this.state.phase !== "active") return fail("round not active");
    if (k.meterPoints < this.state.config.killCost) return fail("insufficient points");
    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return fail("invalid target");
    if (target.id === k.id) return fail("cannot target self");

    k.meterPoints -= this.state.config.killCost;
    const applyAt = this.scheduleDelay();
    this.schedule("applyKill", applyAt, { killerId, targetId });
    this.log("killActivated", { killerId, targetId, resolveAt: applyAt });
    return { ok: true, scheduledAt: applyAt };
  }

  /**
   * The killer team banks a move charge (§10) by spending move_cost from one
   * killer's meter. Capped at max_moves. This is a kill the team chose NOT to
   * take — the offense-vs-resilience tension, in code.
   */
  bankMove(killerId: string): CommandReceipt {
    const k = this.getPlayer(killerId);
    if (!k || !k.alive || k.team !== "killer") return fail("not an active killer");
    if (this.state.phase !== "active") return fail("round not active");
    const cfg = this.state.config;
    if (this.state.moveCharges + this.state.movesUsed >= cfg.maxMoves) {
      return fail("move charges exhausted");
    }
    if (k.meterPoints < cfg.moveCost) return fail("insufficient points");

    k.meterPoints -= cfg.moveCost;
    const applyAt = this.scheduleDelay();
    this.schedule("applyBankMove", applyAt, { killerId });
    this.log("moveBankRequested", { killerId, resolveAt: applyAt });
    return { ok: true, scheduledAt: applyAt };
  }

  /**
   * Ephemeral, anonymous target suggestion shown to a currently-activating
   * killer (§9). Stateless by design — NO running history is kept, so killers
   * cannot build a paper trail of who suggested what. Returns the current
   * anonymous suggestion set (excluding the requester's own + self-targets).
   */
  currentSuggestions(forKillerId: string, rawSuggestions: { from: string; targetId: string }[]): string[] {
    const me = this.getPlayer(forKillerId);
    if (!me) return [];
    const set = new Set<string>();
    for (const s of rawSuggestions) {
      if (s.from === forKillerId) continue; // can't see your own
      if (s.targetId === forKillerId) continue; // can't suggest the activator
      const t = this.getPlayer(s.targetId);
      if (t && t.alive) set.add(s.targetId);
    }
    return [...set]; // anonymous — identities of suggesters are dropped
  }

  /** Cop spends an investigation charge to read one player's alignment (§11). */
  investigate(copId: string, targetId: string): { ok: boolean; alignment?: Team; error?: string } {
    const cop = this.getPlayer(copId);
    if (!cop || cop.role !== "cop" || !cop.alive) return { ok: false, error: "not an active cop" };
    if (cop.investigations <= 0) return { ok: false, error: "no investigation charges" };
    const target = this.getPlayer(targetId);
    if (!target) return { ok: false, error: "invalid target" };

    // §17.1 asymmetry scaffold: a killer counter-role may block an investigation.
    // TODO(open-question: §17.1 — counter-role effect & block mechanics unspecified)
    if (this.state.config.roles.killerCounterRole && target.counterRole) {
      cop.investigations -= 1;
      this.log("investigationBlocked", { copId, targetId });
      return { ok: false, error: "investigation blocked" };
    }

    cop.investigations -= 1;
    // TODO(open-question: §17.2 — exact investigation effect; default = alignment read)
    const alignment = target.team;
    this.log("investigation", { copId, targetId, alignment });
    return { ok: true, alignment };
  }

  /** Medic spends a shield charge to protect a player from the next kill (§11). */
  shield(medicId: string, targetId: string): CommandReceipt {
    const medic = this.getPlayer(medicId);
    if (!medic || medic.role !== "medic" || !medic.alive) return fail("not an active medic");
    if (medic.shields <= 0) return fail("no shield charges");
    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return fail("invalid target");

    medic.shields -= 1;
    if (!this.state.shieldedPlayerIds.includes(targetId)) {
      this.state.shieldedPlayerIds.push(targetId);
    }
    this.log("shieldApplied", { medicId, targetId });
    return { ok: true };
  }

  /** Record an accuracy ballot for the current phase (§12). */
  castBallot(phase: number, voterId: string, suspects: string[]): void {
    let ballot = this.state.ballots.find((b) => b.phase === phase);
    if (!ballot) {
      ballot = { phase, picks: {} };
      this.state.ballots.push(ballot);
    }
    ballot.picks[voterId] = suspects.slice();
  }

  /**
   * Run a scheduled vote (§6). `votes` maps voterId → targetId. The tally is
   * computed now (deterministic), but the elimination RESOLVES ON A DELAY and
   * is announced unnamed (§6/§9). Returns the eliminated id for the harness's
   * internal bookkeeping only (never surfaced to players).
   */
  runVote(votes: Record<string, string>): { eliminatedId: string | null; scheduledAt: number } {
    if (this.state.phase !== "active") return { eliminatedId: null, scheduledAt: this.state.now };
    const tally = new Map<string, number>();
    for (const targetId of Object.values(votes)) {
      const t = this.getPlayer(targetId);
      if (!t || !t.alive) continue;
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    const eliminatedId = this.resolveTally(tally);
    const applyAt = this.scheduleDelay();
    this.schedule("applyVoteResolution", applyAt, { eliminatedId });
    this.log("voteTallied", { votes, eliminatedId, resolveAt: applyAt });
    return { eliminatedId, scheduledAt: applyAt };
  }

  private resolveTally(tally: Map<string, number>): string | null {
    if (tally.size === 0) return null;
    let max = -1;
    for (const v of tally.values()) if (v > max) max = v;
    const top = [...tally.entries()].filter(([, v]) => v === max).map(([id]) => id);
    if (top.length === 1) return top[0]!;
    // Tie.
    if (this.state.config.tieResolution === "noElimination") return null;
    return this.rng.pick(top); // seeded random among the tied
  }

  // ---------------------------------------------------------------------------
  // Clock — apply due effects + decay, then check win (§5/§8/§14)
  // ---------------------------------------------------------------------------

  /**
   * Advance the engine clock to `targetMin` (integer minutes), applying decay
   * and any due delayed effects minute-by-minute, checking win conditions after
   * each step. Returns the public events emitted during this span.
   */
  advanceTo(targetMin: number): PublicEvent[] {
    const start = this.state.publicEvents.length;
    const target = Math.floor(targetMin);
    while (this.state.now < target && this.state.phase === "active") {
      this.state.now += 1;
      this.applyDecay();
      this.applyDueEffects(this.state.now);
      if (this.checkWin()) break;
      if (this.state.now >= this.state.config.finaleMin) {
        this.resolveFinale();
        break;
      }
    }
    return this.state.publicEvents.slice(start);
  }

  private applyDecay(): void {
    if (this.state.townBar <= 0) return;
    this.state.townBar = clamp(this.state.townBar - this.state.decayPerMin, 0, this.state.config.barCap);
  }

  private applyDueEffects(minute: number): void {
    const due = this.state.effects.filter((e) => e.applyAt <= minute);
    if (due.length === 0) return;
    // Keep a stable, deterministic order: by applyAt then insertion id.
    due.sort((a, b) => a.applyAt - b.applyAt || a.id.localeCompare(b.id));
    this.state.effects = this.state.effects.filter((e) => e.applyAt > minute);
    for (const e of due) this.applyEffect(e);
  }

  private applyEffect(e: ScheduledEffect): void {
    switch (e.kind) {
      case "applyTownBar":
        return this.effTownBar(e);
      case "applyKillerMeter":
        return this.effKillerMeter(e);
      case "applyKill":
        return this.effKill(e);
      case "applyBankMove":
        return this.effBankMove(e);
      case "applyVoteResolution":
        return this.effVoteResolution(e);
      case "applyDirectorAdjustment":
        return this.effDirectorAdjustment(e);
    }
  }

  private effTownBar(e: ScheduledEffect): void {
    const points = e.payload.points as number;
    const group = e.payload.group as boolean;
    const role = e.payload.role as Player["role"];
    const cfg = this.state.config;

    this.state.townBar = clamp(
      this.state.townBar + points * cfg.barPercentPerPoint,
      0,
      cfg.barCap,
    );

    // Group tasks bank investigation credit (Cop fuel, §7.5/§11).
    if (group) {
      this.state.investigationBank += points;
      this.maybeGrantInvestigation();
    }
    // Medic accrues shield progress from their own completions (§11; §17.1 open).
    if (role === "medic") {
      const medic = this.getPlayer(e.payload.playerId as string);
      if (medic) {
        medic.shieldProgress += points;
        this.maybeGrantShield(medic);
      }
    }
    this.emitPublic("taskCompleted", "Someone, somewhere, did something.");
  }

  private maybeGrantInvestigation(): void {
    const cfg = this.state.config;
    if (!cfg.roles.cop) return;
    const cop = this.state.players.find((p) => p.role === "cop");
    if (!cop) return;
    while (
      this.state.investigationBank >= cfg.investigationCost &&
      cop.investigations < cfg.maxInvestigations
    ) {
      this.state.investigationBank -= cfg.investigationCost;
      cop.investigations += 1;
      this.log("investigationGranted", { copId: cop.id, total: cop.investigations });
    }
  }

  private maybeGrantShield(medic: Player): void {
    const cfg = this.state.config;
    if (!cfg.roles.medic) return;
    while (medic.shieldProgress >= cfg.medicShieldCost && medic.shields < cfg.maxShields) {
      medic.shieldProgress -= cfg.medicShieldCost;
      medic.shields += 1;
      this.log("shieldGranted", { medicId: medic.id, total: medic.shields });
    }
  }

  private effKillerMeter(e: ScheduledEffect): void {
    const p = this.getPlayer(e.payload.playerId as string);
    if (!p || !p.alive || p.team !== "killer") return;
    p.meterPoints += e.payload.points as number;
    // No public event tied to meter — killer progress is invisible (§8/§14).
  }

  private effKill(e: ScheduledEffect): void {
    const killer = this.getPlayer(e.payload.killerId as string);
    const target = this.getPlayer(e.payload.targetId as string);
    if (!killer || !killer.alive || killer.team !== "killer") return;
    if (!target || !target.alive) return; // target already gone

    // Medic shield absorbs the kill (§11).
    const shieldIdx = this.state.shieldedPlayerIds.indexOf(target.id);
    if (shieldIdx >= 0) {
      this.state.shieldedPlayerIds.splice(shieldIdx, 1);
      this.log("killBlockedByShield", { killerId: killer.id, targetId: target.id });
      this.emitPublic("deathOrSwitch", this.deathFlavor());
      return;
    }

    this.eliminate(target, "kill", killer.id);
    this.emitPublic("deathOrSwitch", this.deathFlavor());
  }

  private effBankMove(e: ScheduledEffect): void {
    const cfg = this.state.config;
    if (this.state.moveCharges + this.state.movesUsed >= cfg.maxMoves) return;
    this.state.moveCharges += 1;
    this.log("moveBanked", { killerId: e.payload.killerId, charges: this.state.moveCharges });
    this.emitPublic("moveMade", "A move was made.");
  }

  private effVoteResolution(e: ScheduledEffect): void {
    const eliminatedId = e.payload.eliminatedId as string | null;
    if (!eliminatedId) {
      this.emitPublic("voteResolved", "The vote was inconclusive.");
      return;
    }
    const target = this.getPlayer(eliminatedId);
    if (!target || !target.alive) {
      this.emitPublic("voteResolved", "The vote settled, somehow.");
      return;
    }
    this.eliminate(target, "vote", null);
    this.emitPublic("voteResolved", this.deathFlavor());
  }

  private effDirectorAdjustment(e: ScheduledEffect): void {
    // Applied by the Director module via `applyDirectorPatch`; the effect just
    // carries the already-validated, bounded patch (Phase 4).
    const patch = e.payload.patch as Partial<Pick<GameState, "decayPerMin" | "taskValueMultiplier">>;
    if (typeof patch.decayPerMin === "number") this.state.decayPerMin = patch.decayPerMin;
    if (typeof patch.taskValueMultiplier === "number") {
      this.state.taskValueMultiplier = patch.taskValueMultiplier;
    }
    this.log("directorAdjustmentApplied", { patch });
    this.emitPublic("directorNudge", "Something in the air shifted.");
  }

  // ---------------------------------------------------------------------------
  // Elimination + the moving-killer / resurrection system (§10, §12)
  // ---------------------------------------------------------------------------

  /**
   * Eliminate a player. Branches on whether the eliminated player is a killer
   * caught by town (the moving-killer system, §10) vs. a townsperson (silent
   * flip to the killer side, §12).
   */
  private eliminate(target: Player, cause: "kill" | "vote", killerId: string | null): void {
    if (target.team === "killer" && cause === "vote") {
      this.handleCaughtKiller(target);
      return;
    }
    // Townsperson eliminated (by kill or by a misfired vote): silent flip (§12).
    target.alive = false;
    target.isGhost = true;
    const previousTeam = target.team;
    target.team = "killer"; // flips to the killers' side; never announced
    target.role = target.role === "cop" || target.role === "medic" ? target.role : "townsperson";
    this.log("eliminated", {
      targetId: target.id,
      cause,
      killerId,
      previousTeam,
      flippedToKiller: true,
    });
  }

  /**
   * Town correctly votes out a killer (§10). If the team has a banked charge AND
   * a ghost exists → consume the charge and resurrect a ghost as a fresh killer
   * (count-neutral). Otherwise the killer is permanently removed (K drops).
   */
  private handleCaughtKiller(caught: Player): void {
    const ghostPool = this.ghosts(); // ghosts that already exist (before this catch)
    if (this.state.moveCharges > 0 && ghostPool.length > 0) {
      // Caught killer becomes a ghost...
      caught.alive = false;
      caught.isGhost = true;
      // ...consume a charge and resurrect a ghost as a fresh killer.
      this.state.moveCharges -= 1;
      this.state.movesUsed += 1;
      const resurrected = this.pickResurrectionTarget(ghostPool);
      resurrected.alive = true;
      resurrected.isGhost = false;
      resurrected.team = "killer";
      resurrected.role = "killer";
      resurrected.meterPoints = 0; // fresh meter, doesn't know teammates (§10)
      this.log("killerMoved", {
        caughtId: caught.id,
        resurrectedId: resurrected.id,
        chargesLeft: this.state.moveCharges,
      });
      return;
    }
    // No charge or no ghost: permanent removal, town progresses (§10).
    caught.alive = false;
    caught.isGhost = true;
    this.log("killerRemoved", { caughtId: caught.id });
  }

  private pickResurrectionTarget(ghostPool: Player[]): Player {
    // Prefer already-flipped townspeople (rooting for killers) for thematic
    // consistency; fall back to any ghost. Deterministic via seeded pick.
    const flipped = ghostPool.filter((g) => g.team === "killer");
    const pool = flipped.length > 0 ? flipped : ghostPool;
    return this.rng.pick(pool);
  }

  // ---------------------------------------------------------------------------
  // Win conditions (§5)
  // ---------------------------------------------------------------------------

  /** Evaluate win conditions; sets state.result and resolves the round if met. */
  checkWin(): GameResult | null {
    if (this.state.result) return this.state.result;
    const at = this.state.now;
    const killers = this.livingKillers().length;
    const town = this.livingTown().length;

    // Collapse (§5 alternate killer win): bar hit 0%.
    if (this.state.townBar <= 0) return this.finish("killer", "collapse", at);
    // Town win: all killers eliminated (checked BEFORE parity so 0v0 ≠ parity).
    if (killers === 0) return this.finish("town", "allKillersEliminated", at);
    // Parity (§5): living killers ≥ living town.
    if (killers >= town) return this.finish("killer", "parity", at);
    return null;
  }

  /** Force-resolve at the evening finale (§5): killers alive & below parity win. */
  private resolveFinale(): void {
    if (this.state.result) return;
    const existing = this.checkWin();
    if (existing) return;
    // Killers still alive and below parity → they survived undetected (§5).
    this.finish("killer", "finaleSurvival", this.state.now);
  }

  private finish(winner: Team, reason: GameResult["reason"], at: number): GameResult {
    const result: GameResult = { winner, reason, at };
    this.state.result = result;
    this.state.phase = "resolved";
    this.log("gameOver", { winner, reason, at });
    this.emitPublic("gameOver", `It is over. (${reason})`);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Director hook (Phase 4 validates/bounds; engine just schedules on delay)
  // ---------------------------------------------------------------------------

  /** Schedule an already-validated Director patch to apply on the standard delay (§14). */
  scheduleDirectorPatch(patch: Partial<Pick<GameState, "decayPerMin" | "taskValueMultiplier">>): number {
    const applyAt = this.scheduleDelay();
    this.schedule("applyDirectorAdjustment", applyAt, { patch });
    this.log("directorAdjustmentScheduled", { patch, applyAt });
    return applyAt;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private scheduleDelay(): number {
    const { delayMeanMin, delayJitterMin } = this.state.config;
    const lo = Math.max(0, delayMeanMin - delayJitterMin);
    const hi = delayMeanMin + delayJitterMin;
    const offset = Math.max(1, Math.round(this.rng.range(lo, hi)));
    return this.state.now + offset;
  }

  private schedule(kind: ScheduledEffect["kind"], applyAt: number, payload: Record<string, unknown>): void {
    this.state.effects.push({ id: `e${(effectCounter++).toString(36)}`, kind, applyAt, payload });
  }

  private log(type: string, detail: Record<string, unknown>): void {
    const entry: InternalLogEntry = { at: this.state.now, type, detail };
    this.state.internalLog.push(entry);
  }

  private emitPublic(kind: PublicEventKind, message: string): void {
    const ev: PublicEvent = { at: this.state.now, kind, message };
    this.state.publicEvents.push(ev);
  }

  private deathFlavor(): string {
    return this.rng.bool() ? "A death... or was it a switch?" : "Something's afoot. A switch, perhaps.";
  }
}

function fail(error: string): CommandReceipt {
  return { ok: false, error };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type { GameState, AccuracyBallot };
