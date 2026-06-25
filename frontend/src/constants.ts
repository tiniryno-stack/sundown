/* Static copy + the "endless deck" reserve pool.
   The live task list comes from GET /games/:id/tasks; this pool only powers the
   demo's local refill flourish (a completed dare is replaced by a fresh one of
   the same tier so the list never bottoms out). INTENSITY_SWAP is the global
   non-alcoholic reminder the brief requires us to always surface (§inclusivity). */

import type { Tier } from "./types";

export const INTENSITY_SWAP =
  "Not drinking? Swap in a beer-shaped soda or mime it — counts the same.";

export const TASK_POOL: Record<Tier, string[]> = {
  light: [
    "Learn one new thing about someone you just met",
    "Start a conversation with a question, not a statement",
    "Get the room to agree on a song to play next",
    "Find out everyone's go-to comfort snack",
    "Swap seats with someone and keep the chat going",
    "Pay someone a compliment they won't see coming",
    "Get a group of three laughing within a minute",
  ],
  standard: [
    "Get someone to tell a story they've never told this group",
    "Start a debate about something gloriously trivial",
    "Trade a secret (small one) with someone you trust",
    "Convince two people to do a synchronized toast",
    "Get someone to teach you a useless skill on the spot",
    "Quietly start a rumor that you have a twin",
  ],
  heavy: [
    "Get the whole room to do a ten-second freeze",
    "Make a toast so sincere someone has to look away",
    "Orchestrate a dramatic entrance for someone else",
    "Convince three people you're definitely innocent",
    "Lead a chant that catches on for one full round",
  ],
  group: [
    "Get everyone to vote on the best snack in the room",
    "Run a 30-second group dance break",
    "Organize a circle and pass a single compliment around",
    "Get the whole table to share their first impression of you",
  ],
};

const TIER_POINTS: Record<Tier, number> = { light: 1, standard: 2, heavy: 3, group: 4 };

let uid = 1000;
/** Draw a fresh task of a tier from the reserve pool (demo refill only). */
export function drawTask(tier: Tier): import("./types").Task {
  const pool = TASK_POOL[tier] ?? [];
  const prompt = pool[Math.floor(Math.random() * pool.length)] ?? "Start something with someone new";
  return {
    id: `x${uid++}`,
    prompt,
    tier,
    points: TIER_POINTS[tier],
    kind: Math.random() < 0.4 ? "covert" : "social",
    group: tier === "group",
    availableAtMinute: 0,
  };
}
