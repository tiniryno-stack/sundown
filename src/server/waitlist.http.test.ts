import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { InMemoryStore } from "../persistence/store.js";
import { GameService } from "../service/gameService.js";
import type { ServiceGameRecord } from "../service/types.js";
import { Waitlist, type WaitlistEntry } from "../waitlist/waitlist.js";
import { createServer } from "./http.js";

const waitlist = new Waitlist(new InMemoryStore<WaitlistEntry>());
const server = createServer(new GameService(new InMemoryStore<ServiceGameRecord>()), { waitlist });
let base = "";
const originalKey = process.env.ADMIN_KEY;

beforeAll(() => new Promise<void>((resolve) => {
  server.listen(0, () => { base = `http://localhost:${(server.address() as AddressInfo).port}`; resolve(); });
}));
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => { process.env.ADMIN_KEY = originalKey; });

/* eslint-disable @typescript-eslint/no-explicit-any */
async function post(path: string, body: unknown, ip = "1.1.1.1"): Promise<{ status: number; json: any }> {
  const r = await fetch(`${base}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
}
async function get(path: string): Promise<{ status: number; json: any }> {
  const r = await fetch(`${base}${path}`);
  return { status: r.status, json: await r.json() };
}

describe("waitlist over HTTP", () => {
  it("accepts a signup, dedupes, and rejects junk", async () => {
    expect((await post("/waitlist", { email: "pal@example.com", source: "hero" })).json).toEqual({ ok: true, already: false });
    expect((await post("/waitlist", { email: "PAL@example.com" })).json).toEqual({ ok: true, already: true });
    const bad = await post("/waitlist", { email: "nope" });
    expect(bad.status).toBe(400);
    expect(await waitlist.count()).toBe(1);
  });

  it("silently drops honeypot submissions", async () => {
    const r = await post("/waitlist", { email: "bot@example.com", company: "Acme" }, "2.2.2.2");
    expect(r.json.ok).toBe(true);
    expect((await waitlist.entries()).some((e) => e.email === "bot@example.com")).toBe(false);
  });

  it("rate-limits a single visitor", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await post("/waitlist", { email: `x${i}@example.com` }, "3.3.3.3")).status);
    expect(statuses.slice(0, 8).every((s) => s === 200)).toBe(true);
    expect(statuses[8]).toBe(429);
  });

  it("admin view needs the key and only shows emails with a long key", async () => {
    process.env.ADMIN_KEY = "shortkey";
    expect((await get("/admin/waitlist?adminKey=wrong")).status).toBe(403);
    const locked = await get("/admin/waitlist?adminKey=shortkey");
    expect(locked.json.count).toBeGreaterThan(0);
    expect(locked.json.entries).toBeNull();

    process.env.ADMIN_KEY = "a-long-private-key";
    const open = await get("/admin/waitlist?adminKey=a-long-private-key");
    expect(open.json.entries[0].email).toMatch(/@example\.com$/);
  });
});
