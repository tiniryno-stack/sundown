/**
 * Deck generation CLI. Run: `npm run deck:generate` (offline mock by default;
 * uses the real Anthropic API automatically if ANTHROPIC_API_KEY is set).
 */

import { createLLMClient } from "../ai/client.js";
import { DeckGenerator } from "./generator.js";
import { makeMockDeckClient } from "./mockDeck.js";

async function main() {
  const real = createLLMClient();
  const client = real ?? makeMockDeckClient();
  const gen = new DeckGenerator(client);

  const result = await gen.generate({
    count: 30,
    availableProps: [], // portable-only by default
    personalTasks: [
      { playerId: "p0", prompt: "Do the secret handshake from the 2019 trip" },
      { playerId: "p1", prompt: "Take a shot with someone" }, // dup of a deck task → rejected
    ],
    targetTotalPoints: 50,
  });

  console.log(`Source: ${client.name}`);
  console.log(`Deck: ${result.deck.tasks.length} tasks, total ${result.deck.totalPoints} pts, avg ${result.deck.avgPoints.toFixed(2)} pts`);
  console.log(`Mix:`, result.deck.mix);
  console.log(`QA meetsTarget: ${result.qa.meetsTarget}${result.qa.notes.length ? ` (${result.qa.notes.join("; ")})` : ""}`);
  console.log(`Dropped: ${result.dropped.length}`, result.dropped.slice(0, 3));
  console.log(`Personal accepted: ${result.personal.accepted.length}, rejected: ${result.personal.rejected.length}`);
  console.log("\nSample tasks:");
  for (const t of result.deck.tasks.slice(0, 8)) {
    console.log(`  [${t.tier} ${t.points}pt${t.kind === "covert" ? " covert" : ""}] ${t.prompt}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
