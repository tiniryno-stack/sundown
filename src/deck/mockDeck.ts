/**
 * Deterministic mock deck source (§18: builds/tests without an API key).
 *
 * Returns a fixed, portable, drinking/social-themed pool as a JSON array — the
 * same shape a real Claude deck response must produce. The generator then
 * feasibility-checks, de-dupes, and selects to the §7.5 mix.
 */

import { MockLLMClient } from "../ai/client.js";

interface RawTask {
  prompt: string;
  tier: "light" | "standard" | "heavy" | "group";
  kind: "social" | "covert";
  group: boolean;
  intensitySwap: string;
  requiresProp?: string;
}

const SWAP = "Use a non-alcoholic drink or just mime the sip — totally fine.";

const POOL: RawTask[] = [
  // Light (1 pt)
  { prompt: "Take a selfie with someone you haven't talked to yet today", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Get a cheers going with at least two people", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Give an honest compliment to someone", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Sip your drink every time someone says a name", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Teach someone a one-line joke and make them laugh", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Swap seats with someone and learn one new fact about them", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Start a slow clap that at least one other person joins", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Covertly mirror someone's posture for two minutes", tier: "light", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Get someone to high-five you without asking directly", tier: "light", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Toast to the host and take a sip", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Name three people's drink orders from memory", tier: "light", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Start a wave of fist bumps down the group", tier: "light", kind: "social", group: false, intensitySwap: SWAP },

  // Standard (2 pt) — the workhorse
  { prompt: "Take a shot with someone", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Start a toast that the whole table joins", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Covertly get someone to refill your drink for you", tier: "standard", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Convince someone to swap drinks with you for a round", tier: "standard", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Lead a two-truths-and-a-lie round with three people", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Get the group to do a synchronized cheers", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Start a quick game of rock-paper-scissors, loser sips", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Covertly plant a silly phrase and get someone to repeat it", tier: "standard", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Tell a 30-second story about how you met someone here", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Get someone to teach you their signature dance move", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Run a quick 'never have I ever' with three people", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Sneak a coaster into someone's pocket undetected", tier: "standard", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Get two people to argue playfully about pineapple on pizza", tier: "standard", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Win a round of pool against someone", tier: "standard", kind: "social", group: false, intensitySwap: SWAP, requiresProp: "pool table" },

  // Heavy (3 pt)
  { prompt: "Shotgun a beer (or a sparkling water) with a buddy", tier: "heavy", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Invent a fake house rule and get someone to follow it", tier: "heavy", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Give a heartfelt 60-second toast to the group", tier: "heavy", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Get three different people to do a dare you make up", tier: "heavy", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Covertly get someone to say a secret word you chose", tier: "heavy", kind: "covert", group: false, intensitySwap: SWAP },
  { prompt: "Lead the group in a one-minute chant", tier: "heavy", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Start a conga line that at least three people join", tier: "heavy", kind: "social", group: false, intensitySwap: SWAP },
  { prompt: "Get someone to believe a harmless made-up fact for five minutes", tier: "heavy", kind: "covert", group: false, intensitySwap: SWAP },

  // Group (4 pt) — 2+ people coordinating; investigation credit
  { prompt: "Organize a group round of shots", tier: "group", kind: "social", group: true, intensitySwap: SWAP },
  { prompt: "Stage and take a full group photo with everyone present", tier: "group", kind: "social", group: true, intensitySwap: SWAP },
  { prompt: "Get four people to do a coordinated cheers chant", tier: "group", kind: "social", group: true, intensitySwap: SWAP },
  { prompt: "Run a relay where the group passes a toast around the circle", tier: "group", kind: "social", group: true, intensitySwap: SWAP },
  { prompt: "Lead a group trivia round with at least four players", tier: "group", kind: "social", group: true, intensitySwap: SWAP },
  { prompt: "Coordinate a synchronized group dance for 30 seconds", tier: "group", kind: "social", group: true, intensitySwap: SWAP },
];

/** A MockLLMClient that returns the fixed themed pool as a JSON array. */
export function makeMockDeckClient(): MockLLMClient {
  return new MockLLMClient(() => JSON.stringify(POOL));
}

export const MOCK_DECK_POOL = POOL;
