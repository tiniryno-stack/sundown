import { describe, expect, it } from "vitest";
import { MockLLMClient } from "../ai/client.js";
import { DeckGenerator } from "./generator.js";
import { makeMockDeckClient } from "./mockDeck.js";

describe("DeckGenerator (§7.2/§7.5)", () => {
  it("produces a deck that hits the ~2-point average target", async () => {
    const gen = new DeckGenerator(makeMockDeckClient());
    const res = await gen.generate({ count: 30 });
    expect(res.deck.tasks.length).toBeGreaterThan(20);
    expect(res.deck.avgPoints).toBeGreaterThan(1.7);
    expect(res.deck.avgPoints).toBeLessThan(2.4);
    expect(res.qa.avgInBand).toBe(true);
  });

  it("derives points from tier, never trusting model-supplied values (§7.5)", async () => {
    const client = new MockLLMClient(() =>
      JSON.stringify([{ prompt: "Take a big shot", tier: "standard", points: 999, kind: "social" }]),
    );
    const gen = new DeckGenerator(client);
    const res = await gen.generate({ count: 5 });
    expect(res.deck.tasks[0]!.points).toBe(2); // standard = 2, not 999
  });

  it("feasibility-checks: drops tasks needing an unavailable prop, keeps them when available", async () => {
    const gen = new DeckGenerator(makeMockDeckClient());
    const without = await gen.generate({ count: 40, availableProps: [] });
    expect(without.dropped.some((d) => /prop/.test(d.reason))).toBe(true);
    expect(without.deck.tasks.some((t) => t.requiresProp)).toBe(false);

    const withProp = await gen.generate({ count: 40, availableProps: ["pool table"] });
    expect(withProp.deck.tasks.some((t) => /pool/i.test(t.prompt))).toBe(true);
  });

  it("de-dupes near-identical prompts", async () => {
    const client = new MockLLMClient(() =>
      JSON.stringify([
        { prompt: "Take a shot with someone", tier: "standard", kind: "social" },
        { prompt: "Take a shot with someone!", tier: "standard", kind: "social" },
        { prompt: "Organize a group photo with everyone", tier: "group", kind: "social" },
      ]),
    );
    const gen = new DeckGenerator(client);
    const res = await gen.generate({ count: 10 });
    const prompts = res.deck.tasks.map((t) => t.prompt);
    expect(prompts.filter((p) => /take a shot/i.test(p)).length).toBe(1);
    expect(res.dropped.some((d) => d.reason === "near-duplicate")).toBe(true);
  });

  it("validates personal tasks and rejects dups with a VAGUE reason (no deck leak, §7.2)", async () => {
    const gen = new DeckGenerator(makeMockDeckClient());
    const res = await gen.generate({
      count: 30,
      personalTasks: [
        { playerId: "p0", prompt: "Reenact the 2019 karaoke disaster" },
        { playerId: "p1", prompt: "Take a shot with someone" }, // matches a deck task
        { playerId: "p2", prompt: "x" }, // too short
      ],
    });
    expect(res.personal.accepted.some((t) => /karaoke/i.test(t.prompt))).toBe(true);
    expect(res.personal.rejected.length).toBe(2);
    // The reason must be vague — it must NOT reveal the matching deck task.
    for (const r of res.personal.rejected) {
      expect(r.reason).not.toMatch(/shot|duplicate|deck|match/i);
    }
  });

  it("is deterministic offline (same input → same deck)", async () => {
    const a = await new DeckGenerator(makeMockDeckClient()).generate({ count: 25 });
    const b = await new DeckGenerator(makeMockDeckClient()).generate({ count: 25 });
    expect(a.deck.tasks.map((t) => t.prompt)).toEqual(b.deck.tasks.map((t) => t.prompt));
  });

  it("every task carries an intensity / non-alcoholic swap (§7.5)", async () => {
    const res = await new DeckGenerator(makeMockDeckClient()).generate({ count: 30 });
    expect(res.deck.tasks.every((t) => t.intensitySwap.length > 0)).toBe(true);
  });
});
