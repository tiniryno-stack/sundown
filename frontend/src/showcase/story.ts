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
export type Cmd = { at: number; scene?: Scene; tap?: string; push?: string };
export type Caption = { at: number; minute: number; text: string; focus?: Who };
export type Script = {
  length: number;
  captions: Caption[];
  tracks: Record<string, Cmd[]>;
};

const shell = (view: PlayerView, fresh = false): Scene => ({ mode: "shell", view, fresh });

/* ───────────────────────── HERO: one phone, one day (Alice) ───────────────────────── */
export const HERO_SCRIPT: Script = {
  length: 32000,
  captions: [
    { at: 0, minute: 0, text: "Everyone joins on their own phone with one game code." },
    { at: 3000, minute: 12, text: "Roles arrive in secret. Alice is town. Two people at this table are killers." },
    { at: 5400, minute: 80, text: "All day, the app hands out small dares. Everyone does them, killers too." },
    { at: 11400, minute: 298, text: "Someone is out. The app never says who did it, or exactly when." },
    { at: 15200, minute: 510, text: "At meals and gathering points, the group votes someone out." },
    { at: 21800, minute: 517, text: "The result lands vaguely. Who went, and what they were, stays hidden." },
    { at: 26800, minute: 785, text: "At sundown, every role is revealed." },
  ],
  tracks: {
    alice: [
      { at: 0, scene: { mode: "lobby", view: lobbyView(), fresh: true } },
      { at: 3000, scene: shell(viewFor("alice", M.morning), true) },
      { at: 5400, scene: shell(viewFor("alice", M.midmorning)) },
      { at: 5700, tap: "Today's tasks" },
      { at: 7600, tap: "Get a cheers going with at least two people" },
      { at: 9200, tap: "Yes, I did this" },
      { at: 11400, scene: shell(viewFor("alice", M.death)), push: "One of you is out of the game — but no one knows who's behind it." },
      { at: 11900, tap: "Home" },
      { at: 15200, scene: shell(viewFor("alice", M.vote)), push: "A vote is open. Everyone votes on who to eliminate." },
      { at: 16300, tap: "A vote is open" },
      { at: 17900, tap: "Dave" },
      { at: 19300, tap: "Cast against Dave" },
      { at: 21800, scene: shell(viewFor("alice", M.voted)) },
      { at: 22000, tap: "Home" },
      { at: 23000, tap: "The vote has landed" },
      { at: 26800, scene: shell(viewFor("alice", M.over)) },
    ],
  },
};

/* ───────────────────── TRIO: same moment, three phones ───────────────────── */
export const TRIO_SCRIPT: Script = {
  length: 32000,
  captions: [
    { at: 0, minute: 12, text: "Alice and Eve are town. Dave is a killer, and only his phone knows it." },
    { at: 4000, minute: 125, focus: "alice", text: "Everyone does tasks. Finishing one proves nothing, because killers do them too." },
    { at: 9500, minute: 280, focus: "dave", text: "Dave's tasks have charged his strike. He picks a target. Nothing changes on anyone else's phone." },
    { at: 15500, minute: 298, focus: "eve", text: "Minutes later the town gets one vague line. Eve is out, and now secretly playing for the killers." },
    { at: 20500, minute: 510, focus: "alice", text: "A vote opens. Alice names Dave. Dave names someone else." },
    { at: 26500, minute: 785, text: "At sundown, the truth comes out." },
  ],
  tracks: {
    alice: [
      { at: 0, scene: shell(viewFor("alice", M.morning), true) },
      { at: 4000, scene: shell(viewFor("alice", M.late)) },
      { at: 4300, tap: "Today's tasks" },
      { at: 6000, tap: "Toast to the host and take a sip" },
      { at: 7500, tap: "Yes, I did this" },
      { at: 9500, scene: shell(viewFor("alice", M.afternoon)) },
      { at: 9800, tap: "Home" },
      { at: 15500, scene: shell(viewFor("alice", M.death)), push: "One of you is out of the game — but no one knows who's behind it." },
      { at: 20500, scene: shell(viewFor("alice", M.vote)) },
      { at: 21100, tap: "A vote is open" },
      { at: 22700, tap: "Dave" },
      { at: 24100, tap: "Cast against Dave" },
      { at: 26500, scene: shell(viewFor("alice", M.over)) },
    ],
    dave: [
      { at: 0, scene: shell(viewFor("dave", M.morning, { meter: 2 }), true) },
      { at: 4000, scene: shell(viewFor("dave", M.late, { meter: 6 })) },
      { at: 4500, tap: "Today's tasks" },
      { at: 6200, tap: "Covertly get someone to refill your drink for you" },
      { at: 7700, tap: "Yes, I did this" },
      { at: 9500, scene: shell(viewFor("dave", M.afternoon, { meter: 10 })) },
      { at: 9700, tap: "Home" },
      { at: 10700, tap: "Open your tools" },
      { at: 11900, tap: "Make a move" },
      { at: 13000, tap: "Eve" },
      { at: 14100, tap: "Move on Eve" },
      { at: 15500, scene: shell(viewFor("dave", M.death, { meter: 0 })) },
      { at: 17300, tap: "Home" },
      { at: 20500, scene: shell(viewFor("dave", M.vote, { meter: 3 })) },
      { at: 21300, tap: "A vote is open" },
      { at: 22900, tap: "Cara" },
      { at: 24300, tap: "Cast against Cara" },
      { at: 26500, scene: shell(viewFor("dave", M.over, { meter: 0 })) },
    ],
    eve: [
      { at: 0, scene: shell(viewFor("eve", M.morning), true) },
      { at: 4000, scene: shell(viewFor("eve", M.late)) },
      { at: 4700, tap: "Today's tasks" },
      { at: 6400, tap: "Give an honest compliment to someone" },
      { at: 7900, tap: "Yes, I did this" },
      { at: 9500, scene: shell(viewFor("eve", M.afternoon)) },
      { at: 10000, tap: "Home" },
      { at: 15500, scene: shell(viewFor("eve", M.death, { ghost: true })), push: "You're out — but not gone. Quietly, you've crossed over." },
      { at: 20500, scene: shell(viewFor("eve", M.vote, { ghost: true })) },
      { at: 26500, scene: shell(viewFor("eve", M.over, { ghost: true })) },
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
