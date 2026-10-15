/* The scripted day the landing-page phones play through.

   Everything here drives the REAL app screens (ActiveShell + friends) with
   sample PlayerViews built on top of demo.ts. Nothing is a mockup: a "tap"
   finds the on-screen element by its text and clicks it, so navigation,
   sheets, toasts, the vote flow and the killer flow are the app's own code.

   Times are milliseconds from the start of a loop. Edit freely — the
   director just fires each command once per loop when its time comes. */

import { buildDemoView } from "../demo";
import type { FeedEvent, PlayerView, Role, You } from "../types";

/* ── cast ── */
export const ID = {
  alice: "p_abcaecbe",
  bob: "p_54fb4b29",
  cara: "p_0882b207",
  dave: "p_ee7e4561",
  eve: "p_fe908fdd",
  finn: "p_a4998377",
  gwen: "p_a2291120",
} as const;

/** End-of-game reveal for this story: Dave and Finn were the killers. */
export const REVEAL: Record<string, Role> = {
  [ID.alice]: "townsperson",
  [ID.bob]: "cop",
  [ID.cara]: "medic",
  [ID.dave]: "killer",
  [ID.eve]: "townsperson",
  [ID.finn]: "killer",
  [ID.gwen]: "townsperson",
};

export type Who = "alice" | "dave" | "eve";

/* ── moments in the day (shared by every phone) ── */
type Moment = {
  minute: number;
  bar: "healthy" | "strained" | "critical";
  dead?: string[];
  vote?: "open" | "resolved";
  over?: boolean;
  events: FeedEvent[];
};

const E = {
  start: { at: 2, kind: "start", message: "The day has begun. Do tasks, mingle, and start working out who the killers are." },
  tasks: { at: 60, kind: "task", message: "People around the room are completing tasks — good cover for everyone, guilty or not." },
  calm: { at: 118, kind: "calm", message: "No one has been eliminated yet. The day is calm… for now." },
  mood: { at: 250, kind: "mood", message: "Tension is rising across the group. Something feels off." },
  death: { at: 296, kind: "death", message: "One of you is out of the game — but no one knows who's behind it." },
  vote: { at: 508, kind: "vote", message: "A vote is open. Everyone votes on who to eliminate." },
  voted: { at: 516, kind: "voteResolved", message: "The vote has landed. Someone is out." },
} satisfies Record<string, FeedEvent>;

export const M = {
  morning: { minute: 12, bar: "healthy", events: [E.start] },
  midmorning: { minute: 80, bar: "healthy", events: [E.start, E.tasks] },
  late: { minute: 125, bar: "healthy", events: [E.start, E.tasks, E.calm] },
  afternoon: { minute: 280, bar: "strained", events: [E.start, E.tasks, E.calm, E.mood] },
  death: { minute: 298, bar: "strained", dead: [ID.eve], events: [E.start, E.tasks, E.calm, E.mood, E.death] },
  vote: { minute: 510, bar: "strained", dead: [ID.eve], vote: "open", events: [E.start, E.tasks, E.calm, E.mood, E.death, E.vote] },
  voted: { minute: 517, bar: "strained", dead: [ID.eve, ID.dave], vote: "resolved", events: [E.start, E.tasks, E.calm, E.mood, E.death, E.vote, E.voted] },
  over: { minute: 785, bar: "healthy", dead: [ID.eve, ID.dave, ID.finn], over: true, events: [] },
} satisfies Record<string, Moment>;

const EVE: You = { id: ID.eve, name: "Eve", role: "townsperson", team: "town", alive: true, isGhost: false };
const EVE_GHOST: You = {
  id: ID.eve, name: "Eve", role: "townsperson", team: "killer", alive: false, isGhost: true,
  killer: { meterPoints: 0, killCost: 10, canKillNow: false, teamMoveCharges: 0, maxMoves: 2 },
};

/** Build the PlayerView one player's phone would receive at a given moment. */
export function viewFor(who: Who, m: Moment, opts: { ghost?: boolean; meter?: number } = {}): PlayerView {
  const v = buildDemoView(who === "dave" ? "killer" : "town", m.bar, "active");
  v.nowMinute = m.minute;
  v.bar = m.bar;
  v.events = m.events.slice();
  v.players = v.players.map((p) => ({ ...p, alive: !(m.dead ?? []).includes(p.id) }));
  v.livingCount = v.players.filter((p) => p.alive).length;
  if (who === "eve") v.you = { ...(opts.ghost ? EVE_GHOST : EVE) };
  if (who === "dave" && v.you.killer) {
    const meter = opts.meter ?? 4;
    v.you = { ...v.you, killer: { ...v.you.killer, meterPoints: meter, canKillNow: meter >= v.you.killer.killCost } };
  }
  if (m.vote === "open") v.vote = { open: true, index: 0, closesAtMinute: m.minute + 6, youVoted: false };
  if (m.vote === "resolved") v.vote = { open: false, index: 0, closesAtMinute: m.minute - 2, youVoted: true, resolved: true };
  if (m.over) {
    v.phase = "resolved";
    v.bar = "unknown";
    v.result = { winner: "town", reason: "allKillersEliminated", at: m.minute };
  }
  return v;
}

export function lobbyView(): PlayerView {
  return buildDemoView("town", "healthy", "lobby");
}

/* ── script types ── */
export type Scene = {
  mode: "lobby" | "shell";
  view: PlayerView;
  /** remount the app (reset tabs, finished tasks, cast votes) */
  fresh?: boolean;
};
/** `dwell`: how long the finger rests on a control before pressing it (ms). */
export type Cmd = { at: number; scene?: Scene; tap?: string; dwell?: number; push?: string };
export type Caption = { at: number; minute: number; text: string; focus?: Who };
export type Script = {
  length: number;
  captions: Caption[];
  tracks: Record<string, Cmd[]>;
};

const shell = (view: PlayerView, fresh = false): Scene => ({ mode: "shell", view, fresh });

/* ───────────────────────── HERO: one phone, one day (Alice) ─────────────────────────
   Paced to be read: the finger rests on each control, sheets stay open long
   enough to read the dare, and each beat gets a few seconds of air. */
export const HERO_SCRIPT: Script = {
  length: 44000,
  captions: [
    { at: 0, minute: 0, text: "Everyone joins on their own phone with one game code." },
    { at: 3500, minute: 12, text: "Roles arrive in secret. Alice is town. Two people at this table are killers." },
    { at: 6500, minute: 80, text: "All day, the app hands out small dares. Everyone does them, killers too." },
    { at: 9600, minute: 82, text: "Alice's dare: get a cheers going with at least two people. She does it and taps done." },
    { at: 16200, minute: 298, text: "Someone is out. The app never says who did it, or exactly when." },
    { at: 21000, minute: 510, text: "At meals and gathering points, the group votes someone out." },
    { at: 29600, minute: 517, text: "The result lands vaguely. Who went, and what they were, stays hidden." },
    { at: 36000, minute: 785, text: "At sundown, every role is revealed." },
  ],
  tracks: {
    alice: [
      { at: 0, scene: { mode: "lobby", view: lobbyView(), fresh: true } },
      { at: 3500, scene: shell(viewFor("alice", M.morning), true) },
      { at: 6500, scene: shell(viewFor("alice", M.midmorning)) },
      { at: 7000, tap: "Today's tasks" },
      { at: 8900, tap: "Get a cheers going with at least two people", dwell: 1000 },
      { at: 12900, tap: "Yes, I did this", dwell: 750 },
      { at: 16200, scene: shell(viewFor("alice", M.death)), push: "One of you is out of the game — but no one knows who's behind it." },
      { at: 17000, tap: "Home", dwell: 500 },
      { at: 21000, scene: shell(viewFor("alice", M.vote)), push: "A vote is open. Everyone votes on who to eliminate." },
      { at: 22300, tap: "A vote is open" },
      { at: 24300, tap: "Dave", dwell: 850 },
      { at: 26200, tap: "Cast against Dave", dwell: 700 },
      { at: 29600, scene: shell(viewFor("alice", M.voted)) },
      { at: 30000, tap: "Home", dwell: 500 },
      { at: 31400, tap: "The vote has landed" },
      { at: 36000, scene: shell(viewFor("alice", M.over)) },
    ],
  },
};

/* ───────────────────── TRIO: same moment, three phones ───────────────────── */
export const TRIO_SCRIPT: Script = {
  length: 46000,
  captions: [
    { at: 0, minute: 12, text: "Alice and Eve are town. Dave is a killer, and only his phone knows it." },
    { at: 4500, minute: 125, text: "Everyone does tasks: Alice toasts the host, Dave gets his drink refilled, Eve gives a compliment. Finishing one proves nothing." },
    { at: 14500, minute: 280, focus: "dave", text: "Dave's tasks have charged his strike. He picks a target. Nothing changes on anyone else's phone." },
    { at: 22500, minute: 298, focus: "eve", text: "Minutes later the town gets one vague line. Eve is out, and now secretly playing for the killers." },
    { at: 28500, minute: 510, focus: "alice", text: "A vote opens. Alice names Dave. Dave names someone else." },
    { at: 36500, minute: 785, text: "At sundown, the truth comes out." },
  ],
  tracks: {
    alice: [
      { at: 0, scene: shell(viewFor("alice", M.morning), true) },
      { at: 4500, scene: shell(viewFor("alice", M.late)) },
      { at: 5000, tap: "Today's tasks" },
      { at: 7200, tap: "Toast to the host and take a sip", dwell: 1000 },
      { at: 10600, tap: "Yes, I did this", dwell: 750 },
      { at: 14500, scene: shell(viewFor("alice", M.afternoon)) },
      { at: 14800, tap: "Home", dwell: 500 },
      { at: 22500, scene: shell(viewFor("alice", M.death)), push: "One of you is out of the game — but no one knows who's behind it." },
      { at: 28500, scene: shell(viewFor("alice", M.vote)) },
      { at: 29200, tap: "A vote is open" },
      { at: 31200, tap: "Dave", dwell: 850 },
      { at: 33000, tap: "Cast against Dave", dwell: 700 },
      { at: 36500, scene: shell(viewFor("alice", M.over)) },
    ],
    dave: [
      { at: 0, scene: shell(viewFor("dave", M.morning, { meter: 2 }), true) },
      { at: 4500, scene: shell(viewFor("dave", M.late, { meter: 6 })) },
      { at: 5300, tap: "Today's tasks" },
      { at: 7600, tap: "Covertly get someone to refill your drink for you", dwell: 1000 },
      { at: 11000, tap: "Yes, I did this", dwell: 750 },
      { at: 14500, scene: shell(viewFor("dave", M.afternoon, { meter: 10 })) },
      { at: 14700, tap: "Home", dwell: 500 },
      { at: 15900, tap: "Open your tools" },
      { at: 17600, tap: "Make a move", dwell: 800 },
      { at: 19200, tap: "Eve", dwell: 850 },
      { at: 20800, tap: "Move on Eve", dwell: 700 },
      { at: 22500, scene: shell(viewFor("dave", M.death, { meter: 0 })) },
      { at: 25300, tap: "Home", dwell: 500 },
      { at: 28500, scene: shell(viewFor("dave", M.vote, { meter: 3 })) },
      { at: 29500, tap: "A vote is open" },
      { at: 31500, tap: "Cara", dwell: 850 },
      { at: 33300, tap: "Cast against Cara", dwell: 700 },
      { at: 36500, scene: shell(viewFor("dave", M.over, { meter: 0 })) },
    ],
    eve: [
      { at: 0, scene: shell(viewFor("eve", M.morning), true) },
      { at: 4500, scene: shell(viewFor("eve", M.late)) },
      { at: 5600, tap: "Today's tasks" },
      { at: 8000, tap: "Give an honest compliment to someone", dwell: 1000 },
      { at: 11400, tap: "Yes, I did this", dwell: 750 },
      { at: 14500, scene: shell(viewFor("eve", M.afternoon)) },
      { at: 15000, tap: "Home", dwell: 500 },
      { at: 22500, scene: shell(viewFor("eve", M.death, { ghost: true })), push: "You're out — but not gone. Quietly, you've crossed over." },
      { at: 28500, scene: shell(viewFor("eve", M.vote, { ghost: true })) },
      { at: 36500, scene: shell(viewFor("eve", M.over, { ghost: true })) },
    ],
  },
};

/** Labels under each trio phone, per caption index. */
export const TRIO_LABELS: Record<Who, { name: string; role: string; tone: "town" | "killer" | "ghost" }[]> = {
  alice: Array(6).fill({ name: "Alice", role: "Town", tone: "town" }),
  dave: Array(6).fill({ name: "Dave", role: "Killer", tone: "killer" }),
  eve: [
    ...Array(3).fill({ name: "Eve", role: "Town", tone: "town" }),
    ...Array(3).fill({ name: "Eve", role: "Ghost · killers' side", tone: "ghost" }),
  ],
};

/** Starting views for "Take control" mode. */
export function controlView(kind: "town" | "killer" | "vote"): PlayerView {
  if (kind === "killer") return viewFor("dave", M.afternoon, { meter: 10 });
  if (kind === "vote") return viewFor("alice", M.vote);
  return viewFor("alice", M.afternoon);
}
