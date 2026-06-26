/* Demo data — lets every screen render with no backend running.
   This mirrors the real fixtures in ../fixtures (the same PlayerView payloads the
   backend emits for seed "fixtures"); buildDemoView() reconstructs them from three
   knobs (role × bar × phase) so the demo panel can browse the whole state space,
   not just the ten saved files. Live mode ignores all of this and polls the API. */

import type { PlayerView, Role, Task, You } from "./types";

export type DemoRole = "town" | "killer" | "cop" | "medic" | "ghost";
export type DemoBar = "healthy" | "strained" | "critical";
export type DemoPhase = "join" | "lobby" | "tutorial" | "active" | "vote" | "result" | "over";

const PLAYERS = [
  { id: "p_abcaecbe", name: "Alice", alive: true },
  { id: "p_54fb4b29", name: "Bob", alive: true },
  { id: "p_0882b207", name: "Cara", alive: true },
  { id: "p_ee7e4561", name: "Dave", alive: true },
  { id: "p_fe908fdd", name: "Eve", alive: true },
  { id: "p_a4998377", name: "Finn", alive: true },
  { id: "p_a2291120", name: "Gwen", alive: true },
];

export const DEMO_TASKS: Task[] = [
  { id: "t0", prompt: "Take a selfie with someone you haven't talked to yet today", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
  { id: "t1", prompt: "Get a cheers going with at least two people", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
  { id: "t2", prompt: "Give an honest compliment to someone", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
  { id: "t7", prompt: "Covertly mirror someone's posture for two minutes", tier: "light", points: 1, kind: "covert", group: false, availableAtMinute: 0 },
  { id: "t8", prompt: "Get someone to high-five you without asking directly", tier: "light", points: 1, kind: "covert", group: false, availableAtMinute: 0 },
  { id: "t9", prompt: "Toast to the host and take a sip", tier: "light", points: 1, kind: "social", group: false, availableAtMinute: 0 },
  { id: "t12", prompt: "Take a shot with someone", tier: "standard", points: 2, kind: "social", group: false, availableAtMinute: 55 },
  { id: "t14", prompt: "Covertly get someone to refill your drink for you", tier: "standard", points: 2, kind: "covert", group: false, availableAtMinute: 0 },
  { id: "t15", prompt: "Convince someone to swap drinks with you for a round", tier: "standard", points: 2, kind: "covert", group: false, availableAtMinute: 0 },
  { id: "t16", prompt: "Lead a two-truths-and-a-lie round with three people", tier: "standard", points: 2, kind: "social", group: false, availableAtMinute: 0 },
  { id: "t19", prompt: "Covertly plant a silly phrase and get someone to repeat it", tier: "standard", points: 2, kind: "covert", group: false, availableAtMinute: 0, proof: { q: "What phrase did you plant?", placeholder: "the phrase you slipped in" } },
  { id: "t26", prompt: "Shotgun a beer with a buddy", tier: "heavy", points: 3, kind: "social", group: false, availableAtMinute: 0 },
  { id: "t27", prompt: "Invent a fake house rule and get someone to follow it", tier: "heavy", points: 3, kind: "covert", group: false, availableAtMinute: 0, proof: { q: "What was the fake rule?", placeholder: "the rule you made up" } },
  { id: "t28", prompt: "Give a heartfelt 60-second toast to the group", tier: "heavy", points: 3, kind: "social", group: false, availableAtMinute: 0 },
  { id: "t30", prompt: "Covertly get someone to say a secret word you chose", tier: "heavy", points: 3, kind: "covert", group: false, availableAtMinute: 0, proof: { q: "What was your secret word?", placeholder: "e.g. pineapple" } },
  { id: "t34", prompt: "Organize a group round of shots", tier: "group", points: 4, kind: "social", group: true, availableAtMinute: 0 },
];

/** Anonymized current suggestions (GET /killer/context) — target ids only, no identity. */
export const DEMO_KILL_SUGGESTIONS: string[] = ["p_abcaecbe"];

/** Illustrative final roles for the demo game-over reveal. The real recap is a
    host-only surface; roles are NEVER in the live player PlayerView mid-game. */
export const DEMO_REVEAL: Record<string, Role> = {
  p_abcaecbe: "townsperson", p_54fb4b29: "cop", p_0882b207: "medic",
  p_ee7e4561: "killer", p_fe908fdd: "killer", p_a4998377: "townsperson",
  p_a2291120: "townsperson",
};

type Feed = PlayerView["events"];
const FEED_ACTIVE: Feed = [
  { at: 12, kind: "start", message: "The day has begun. Do tasks, mingle, and start working out who the killers are." },
  { at: 34, kind: "task", message: "People around the room are completing tasks — good cover for everyone, guilty or not." },
  { at: 58, kind: "calm", message: "No one has been eliminated yet. The day is calm… for now." },
];
const FEED_STRAINED: Feed = [
  ...FEED_ACTIVE,
  { at: 96, kind: "mood", message: "Tension is rising across the group. Something feels off." },
  { at: 118, kind: "death", message: "One of you is out of the game — but no one knows who's behind it." },
];
const FEED_CRITICAL: Feed = [
  ...FEED_STRAINED,
  { at: 138, kind: "death", message: "The killers are still among you. Don't trust anyone too quickly." },
  { at: 150, kind: "vote", message: "Soon everyone will vote on who to eliminate. Start making your case." },
];

const YOU: Record<DemoRole, You> = {
  town: { id: "p_abcaecbe", name: "Alice", role: "townsperson", team: "town", alive: true, isGhost: false },
  killer: { id: "p_ee7e4561", name: "Dave", role: "killer", team: "killer", alive: true, isGhost: false,
    killer: { meterPoints: 10, killCost: 10, canKillNow: true, teamMoveCharges: 0, maxMoves: 2 } },
  cop: { id: "p_54fb4b29", name: "Bob", role: "cop", team: "town", alive: true, isGhost: false, cop: { investigations: 1 } },
  medic: { id: "p_0882b207", name: "Cara", role: "medic", team: "town", alive: true, isGhost: false, medic: { shields: 1 } },
  ghost: { id: "p_fe908fdd", name: "Eve", role: "townsperson", team: "killer", alive: false, isGhost: true,
    killer: { meterPoints: 0, killCost: 10, canKillNow: false, teamMoveCharges: 0, maxMoves: 2 } },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function buildDemoView(role: DemoRole, bar: DemoBar, phase: DemoPhase): PlayerView {
  const you = clone(YOU[role] ?? YOU.town);
  const base: PlayerView = {
    gameId: "g_6cae1fd9",
    phase: "active",
    roundIndex: 0,
    nowMinute: 30,
    finaleMinute: 780,
    startedAtMs: 0,
    bar: "healthy",
    livingCount: 7,
    players: PLAYERS.map((p) => ({ ...p })),
    events: [],
    vote: { open: false, index: null, closesAtMinute: null, youVoted: false },
    result: null,
    you,
  };

  if (phase === "join" || phase === "lobby" || phase === "tutorial") {
    return {
      ...base,
      phase: "lobby",
      nowMinute: 0,
      bar: "unknown",
      you: { id: you.id, name: you.name, role: "townsperson", team: "town", alive: true, isGhost: false },
    };
  }

  if (phase === "over") {
    return {
      ...base,
      phase: "resolved",
      nowMinute: 785,
      bar: "unknown",
      livingCount: 6,
      you,
      players: PLAYERS.map((p) => ({ ...p, alive: p.id !== "p_fe908fdd" })),
      events: [
        { at: 156, kind: "voteResolved", message: "Something's afoot. A switch, perhaps." },
        { at: 196, kind: "gameOver", message: "It is over. (collapse)" },
      ],
      result: { winner: "killer", reason: "collapse", at: 196 },
    };
  }

  // active / vote / result
  const events = bar === "critical" ? FEED_CRITICAL : bar === "strained" ? FEED_STRAINED : FEED_ACTIVE;
  const nowMinute = bar === "critical" ? 152 : bar === "strained" ? 110 : 42;
  const players = PLAYERS.map((p) => ({ ...p, alive: role === "ghost" ? p.id !== "p_fe908fdd" : true }));
  const view: PlayerView = {
    ...base,
    you,
    bar,
    nowMinute,
    livingCount: role === "ghost" ? 6 : 7,
    players,
    events: events.slice(),
  };

  if (phase === "vote") {
    view.vote = { open: true, index: 0, closesAtMinute: nowMinute + 6, youVoted: false };
  } else if (phase === "result") {
    view.vote = { open: false, index: 0, closesAtMinute: nowMinute - 3, youVoted: true, resolved: true };
  }
  return view;
}
