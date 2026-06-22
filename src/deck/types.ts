/** Task-deck types (§7.2/§7.4/§7.5). */

import type { TaskTier } from "../engine/economy.js";

export type TaskKind = "social" | "covert"; // §7.4 open social/drinking vs covert "gotcha"
export type TaskSource = "ai" | "personal";

export interface Task {
  id: string;
  prompt: string;
  tier: TaskTier;
  /** Point value (§7.5) — derived from tier; validated by the generator. */
  points: number;
  kind: TaskKind;
  /** Coordinated 2+ person task (group bonus + investigation credit, §11). */
  group: boolean;
  /** Lower-intensity / non-alcoholic alternative built into every prompt (§7.5). */
  intensitySwap: string;
  source: TaskSource;
  /**
   * A physical prop this task needs, if any. Portable tasks need none (§7.2).
   * Used for the feasibility check against the party's available props.
   */
  requiresProp?: string;
}

export interface TaskDeck {
  tasks: Task[];
  totalPoints: number;
  /** Count of tasks per tier. */
  mix: Record<TaskTier, number>;
  avgPoints: number;
}

export interface DeckRequest {
  /** Desired number of AI tasks in the deck. */
  count: number;
  /** Theme hint (defaults to drinking + bringing people together, §7.2). */
  theme?: string;
  /** Props actually available at the party; tasks needing others are infeasible. */
  availableProps?: string[];
  /** Player-submitted personal tasks to validate + de-dupe (§7.2). */
  personalTasks?: { playerId: string; prompt: string }[];
  /** Optional explicit total-point budget for QA (§7.5). */
  targetTotalPoints?: number;
}

export interface PersonalTaskResult {
  accepted: Task[];
  /** Rejected personal tasks with a VAGUE reason (must not leak the deck, §7.2). */
  rejected: { playerId: string; prompt: string; reason: string }[];
}

export interface DeckResult {
  deck: TaskDeck;
  personal: PersonalTaskResult;
  /** QA: does the deck hit the §7.5 mix/avg targets and any point budget? */
  qa: {
    meetsTarget: boolean;
    avgInBand: boolean;
    notes: string[];
  };
  /** Candidates dropped during validation (feasibility/dedup), for transparency. */
  dropped: { prompt: string; reason: string }[];
}
