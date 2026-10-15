import { describe, expect, it } from "vitest";
import { InMemoryStore } from "../persistence/store.js";
import { RateLimiter, Waitlist, normalizeEmail, type WaitlistEntry } from "./waitlist.js";

describe("normalizeEmail", () => {
  it("trims and lowercases valid addresses", () => {
    expect(normalizeEmail("  Andrew@Example.COM ")).toBe("andrew@example.com");
  });
  it("rejects things that aren't emails", () => {
    for (const bad of ["", "nope", "a@b", "a@b.c", "has space@x.com", 42, null, "x".repeat(250) + "@a.com"]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });
});

describe("Waitlist", () => {
  it("stores a signup once and counts it", async () => {
    const wl = new Waitlist(new InMemoryStore<WaitlistEntry>(), () => Date.parse("2026-10-15T12:00:00Z"));
    expect(await wl.join("Friend@Example.com", "hero")).toEqual({ ok: true, already: false });
    expect(await wl.join("friend@example.com", "topbar")).toEqual({ ok: true, already: true });
    expect(await wl.count()).toBe(1);
    const [entry] = await wl.entries();
    expect(entry).toEqual({ email: "friend@example.com", at: "2026-10-15T12:00:00.000Z", source: "hero" });
  });

  it("rejects invalid addresses without storing anything", async () => {
    const wl = new Waitlist(new InMemoryStore<WaitlistEntry>());
    const res = await wl.join("not-an-email");
    expect(res.ok).toBe(false);
    expect(await wl.count()).toBe(0);
  });

  it("lists newest first and sanitizes the source tag", async () => {
    let t = Date.parse("2026-10-15T12:00:00Z");
    const wl = new Waitlist(new InMemoryStore<WaitlistEntry>(), () => t);
    await wl.join("a@example.com", "<script>");
    t += 60_000;
    await wl.join("b@example.com", "topbar");
    const rows = await wl.entries();
    expect(rows.map((r) => r.email)).toEqual(["b@example.com", "a@example.com"]);
    expect(rows[1]!.source).toBe("site");
  });
});

describe("RateLimiter", () => {
  it("allows up to max hits per window, then resets", () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect([rl.allow("ip"), rl.allow("ip"), rl.allow("ip")]).toEqual([true, true, false]);
    t = 1500;
    expect(rl.allow("ip")).toBe(true);
  });
});
