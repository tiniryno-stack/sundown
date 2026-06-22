/**
 * Task-deck generator (§7.2/§7.5) — Anthropic-backed, behind the LLMClient
 * interface so it runs with a deterministic mock and no API key.
 *
 * Responsibilities (§7.2):
 *  - Ask the AI host for a weighted, PORTABLE, drinking/social-themed deck whose
 *    tier mix hits the §7.5 target (avg ≈ 2 pts), each prompt carrying an
 *    intensity / non-alcoholic swap.
 *  - FEASIBILITY-check (drop tasks needing a prop the party doesn't have).
 *  - DE-DUPE near-identical prompts.
 *  - Validate + de-dupe player PERSONAL tasks, rejecting with a VAGUE reason so
 *    the rejection can't be used to probe the rest of the deck.
 */

import { extractJsonArray, MODELS, type LLMClient } from "../ai/client.js";
import { DECK_MIX_TARGET, TIER_POINTS, type TaskTier } from "../engine/economy.js";
import type {
  DeckRequest,
  DeckResult,
  PersonalTaskResult,
  Task,
  TaskDeck,
  TaskKind,
} from "./types.js";

const TIERS: TaskTier[] = ["light", "standard", "heavy", "group"];
const VAGUE_REJECTION = "That one didn't quite fit the vibe — give us another?";

export interface GeneratorOptions {
  /** Jaccard token-similarity threshold above which prompts are duplicates. */
  dedupThreshold?: number;
  model?: string;
}

export class DeckGenerator {
  private readonly dedupThreshold: number;
  private readonly model: string;

  constructor(private readonly client: LLMClient, opts: GeneratorOptions = {}) {
    this.dedupThreshold = opts.dedupThreshold ?? 0.6;
    this.model = opts.model ?? MODELS.deck;
  }

  async generate(req: DeckRequest): Promise<DeckResult> {
    const availableProps = new Set((req.availableProps ?? []).map((p) => p.toLowerCase()));
    const dropped: { prompt: string; reason: string }[] = [];

    const raw = await this.askModel(req);
    const candidates = (raw ?? [])
      .map((c, i) => this.coerce(c, i, "ai"))
      .filter((t): t is Task => t !== null);

    // Feasibility + dedup pass.
    const accepted: Task[] = [];
    for (const t of candidates) {
      if (t.requiresProp && !availableProps.has(t.requiresProp.toLowerCase())) {
        dropped.push({ prompt: t.prompt, reason: `needs unavailable prop: ${t.requiresProp}` });
        continue;
      }
      if (this.isDuplicate(t.prompt, accepted)) {
        dropped.push({ prompt: t.prompt, reason: "near-duplicate" });
        continue;
      }
      accepted.push(t);
    }

    const selected = selectForMix(accepted, req.count);
    const deck = toDeck(selected);
    const personal = this.validatePersonal(req, selected);
    const qa = computeQa(deck, req.targetTotalPoints);

    return { deck, personal, qa, dropped };
  }

  // --- personal tasks (§7.2) ---
  private validatePersonal(req: DeckRequest, deckTasks: Task[]): PersonalTaskResult {
    const result: PersonalTaskResult = { accepted: [], rejected: [] };
    const against: Task[] = [...deckTasks];
    let i = 0;
    for (const pt of req.personalTasks ?? []) {
      const prompt = pt.prompt.trim();
      // Basic sanity + dedup against the deck and other personal tasks.
      if (prompt.length < 4 || this.isDuplicate(prompt, against)) {
        result.rejected.push({ playerId: pt.playerId, prompt: pt.prompt, reason: VAGUE_REJECTION });
        continue;
      }
      const task: Task = {
        id: `pt${i++}`,
        prompt,
        tier: "standard",
        points: TIER_POINTS.standard,
        kind: "social",
        group: false,
        intensitySwap: "Swap in a non-alcoholic version if you like.",
        source: "personal",
      };
      result.accepted.push(task);
      against.push(task);
    }
    return result;
  }

  private isDuplicate(prompt: string, against: Task[]): boolean {
    const a = tokenize(prompt);
    return against.some((t) => jaccard(a, tokenize(t.prompt)) >= this.dedupThreshold);
  }

  private coerce(raw: unknown, index: number, source: Task["source"]): Task | null {
    if (raw === null || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
    if (!prompt) return null;
    const tier = TIERS.includes(o.tier as TaskTier) ? (o.tier as TaskTier) : "standard";
    const kind: TaskKind = o.kind === "covert" ? "covert" : "social";
    const group = tier === "group" || o.group === true;
    const intensitySwap =
      typeof o.intensitySwap === "string" && o.intensitySwap.trim()
        ? o.intensitySwap.trim()
        : "Non-alcoholic / lower-intensity version available.";
    const task: Task = {
      id: `t${index}`,
      prompt,
      tier,
      points: TIER_POINTS[tier], // §7.5: points are derived from tier, not model-supplied
      kind,
      group,
      intensitySwap,
      source,
    };
    if (typeof o.requiresProp === "string" && o.requiresProp.trim()) {
      task.requiresProp = o.requiresProp.trim();
    }
    return task;
  }

  private async askModel(req: DeckRequest): Promise<unknown[] | null> {
    const theme = req.theme ?? "drinking and bringing people together";
    const res = await this.client.complete({
      model: this.model,
      temperature: 0.7,
      maxTokens: 4096,
      system: deckSystemPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            count: Math.ceil(req.count * 1.5), // over-generate so dedup/feasibility leave enough
            theme,
            availableProps: req.availableProps ?? [],
            mixTarget: DECK_MIX_TARGET,
          }),
        },
      ],
    });
    return extractJsonArray(res.text);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Select `count` tasks approximating the §7.5 tier mix; deterministic. */
function selectForMix(tasks: Task[], count: number): Task[] {
  const byTier = new Map<TaskTier, Task[]>(TIERS.map((t) => [t, []]));
  for (const t of tasks) byTier.get(t.tier)!.push(t);

  const sumW = TIERS.reduce((s, t) => s + DECK_MIX_TARGET[t], 0);
  const picked: Task[] = [];
  const leftovers: Task[] = [];
  for (const tier of TIERS) {
    const want = Math.round((DECK_MIX_TARGET[tier] / sumW) * count);
    const pool = byTier.get(tier)!;
    picked.push(...pool.slice(0, want));
    leftovers.push(...pool.slice(want));
  }
  // Top up (or trim) to exactly `count` where possible.
  for (const t of leftovers) {
    if (picked.length >= count) break;
    picked.push(t);
  }
  return picked.slice(0, count);
}

function toDeck(tasks: Task[]): TaskDeck {
  const mix: Record<TaskTier, number> = { light: 0, standard: 0, heavy: 0, group: 0 };
  let totalPoints = 0;
  for (const t of tasks) {
    mix[t.tier]++;
    totalPoints += t.points;
  }
  return { tasks, totalPoints, mix, avgPoints: tasks.length === 0 ? 0 : totalPoints / tasks.length };
}

function computeQa(deck: TaskDeck, targetTotalPoints?: number): DeckResult["qa"] {
  const notes: string[] = [];
  const avgInBand = deck.avgPoints >= 1.7 && deck.avgPoints <= 2.4;
  if (!avgInBand) notes.push(`avg points ${deck.avgPoints.toFixed(2)} outside [1.7, 2.4]`);
  let budgetOk = true;
  if (typeof targetTotalPoints === "number") {
    budgetOk = deck.totalPoints >= targetTotalPoints * 0.8;
    if (!budgetOk) notes.push(`total points ${deck.totalPoints} below 80% of budget ${targetTotalPoints}`);
  }
  if (deck.tasks.length === 0) notes.push("empty deck");
  return { meetsTarget: avgInBand && budgetOk && deck.tasks.length > 0, avgInBand, notes };
}

function deckSystemPrompt(): string {
  return [
    "You generate a deck of party tasks for an all-day social-deduction drinking game.",
    "Rules:",
    "- PORTABLE only: nothing tied to a specific venue or prop the group may lack.",
    "- Themed around drinking and bringing people together; fun, inclusive.",
    "- Each task tagged with a tier: light(1pt), standard(2pt), heavy(3pt), group(4pt).",
    "- Aim for the provided mix so the average task is ~2 points.",
    "- Every task MUST include an 'intensitySwap' (a non-alcoholic / lower-intensity option).",
    "- Mark covert 'gotcha' tasks with kind:'covert'; the rest kind:'social'.",
    "- If a task needs a prop, set 'requiresProp'; otherwise omit it (prefer no props).",
    "- Avoid near-duplicates.",
    "Respond with a strict JSON ARRAY of objects:",
    '{ "prompt": string, "tier": "light"|"standard"|"heavy"|"group", "kind": "social"|"covert",',
    '  "group": boolean, "intensitySwap": string, "requiresProp"?: string }',
    "JSON array only, no prose.",
  ].join("\n");
}
