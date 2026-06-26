/* Wire types — mirror of ../API.md (the backend GameService contract).
   Keep these in sync with the backend's PlayerView projection. */

export type Role = "townsperson" | "killer" | "cop" | "medic";
export type Team = "town" | "killer";
export type Band = "healthy" | "strained" | "critical" | "unknown";
export type Phase = "lobby" | "active" | "resolved";

export type GameResult = {
  winner: Team;
  reason: "parity" | "collapse" | "allKillersEliminated" | "finaleSurvival";
  at: number;
};

export type KillerState = {
  meterPoints: number;
  killCost: number;
  canKillNow: boolean;
  teamMoveCharges: number;
  maxMoves: number;
};

export type PublicPlayer = { id: string; name: string; alive: boolean };

export type FeedEvent = { at: number; kind: string; message: string };

export type VoteState = {
  open: boolean;
  index: number | null;
  closesAtMinute: number | null;
  youVoted: boolean;
  /* Not in the live PlayerView yet (§ v2 handoff item 5 / item 3 are backend
     TODOs). The client derives "resolved" from recent events and remembers the
     player's own pick locally — these stay optional so we light up automatically
     if/when the backend starts sending them. */
  resolved?: boolean;
  yourVote?: string | null;
};

export type You = {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  isGhost: boolean;
  killer?: KillerState;
  cop?: { investigations: number };
  medic?: { shields: number };
};

export type PlayerView = {
  gameId: string;
  phase: Phase;
  roundIndex: number;
  nowMinute: number;
  finaleMinute: number;
  /** Unix ms when this round started — use to display real wall-clock times. */
  startedAtMs: number;
  you: You;
  bar: Band;
  livingCount: number;
  players: PublicPlayer[];
  events: FeedEvent[];
  vote: VoteState;
  result: GameResult | null;
};

export type Tier = "light" | "standard" | "heavy" | "group";
export type Task = {
  id: string;
  prompt: string;
  tier: Tier;
  points: number;
  kind: "social" | "covert";
  group: boolean;
  intensitySwap?: string;
  requiresProp?: string;
  availableAtMinute: number;
  /* v2 handoff item 1 — present iff this task asks the player to log proof. */
  proof?: { q: string; placeholder?: string };
};

export type TasksResponse = { tasks: Task[]; nowMinute: number };

export type KillContext = { canKillNow: boolean; suggestions: string[] };

export type ActionResult = { ok: boolean; error?: string; cooldownUntilMinute?: number };

export type HostPlayer = {
  id: string;
  name: string;
  alive: boolean;
  role: string;
  team: string;
  meterPoints?: number;
  canKillNow?: boolean;
};

export type HostView = {
  gameId: string;
  phase: "lobby" | "active" | "resolved";
  players: HostPlayer[];
  bar: number;
  barBand: Band;
  livingCount: number;
  killerCount: number;
  townCount: number;
  nowMinute: number;
  finaleMinute: number;
  startedAtMs: number;
  events: FeedEvent[];
  killCost: number;
  maxMoves: number;
  moveCharges: number;
  voteTimesMin: number[];
  vote: {
    open: boolean;
    index: number | null;
    closesAtMinute: number | null;
    totalVotes: number;
    totalEligible: number;
  };
  result: { winner: string; reason: string; at: number } | null;
};

/* Identity stored on-device after join. */
export type Identity = {
  gameId: string;
  playerId: string;
  token: string;
  name: string;
};
