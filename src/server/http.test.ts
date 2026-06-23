import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryStore } from "../persistence/store.js";
import { GameService } from "../service/gameService.js";
import type { ServiceGameRecord } from "../service/types.js";
import { createServer } from "./http.js";

let clockMs = 1_000_000;
const store = new InMemoryStore<ServiceGameRecord>();
const service = new GameService(store, { now: () => clockMs });
const server = createServer(service);
let base = "";

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        base = `http://localhost:${port}`;
        resolve();
      });
    }),
);
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/* eslint-disable @typescript-eslint/no-explicit-any */
async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
}
async function get(path: string): Promise<{ status: number; json: any }> {
  const r = await fetch(`${base}${path}`);
  return { status: r.status, json: await r.json() };
}

describe("HTTP server (API.md over the wire)", () => {
  it("health check", async () => {
    const r = await get("/health");
    expect(r.json).toEqual({ ok: true });
  });

  it("runs a full create → join → start → state → task flow", async () => {
    const create = await post("/games", { hostId: "host", players: 7 });
    const gameId = create.json.gameId as string;
    expect(gameId).toBeTruthy();

    const players: { playerId: string; token: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const j = await post(`/games/${gameId}/join`, { name: `P${i}` });
      players.push(j.json);
    }

    const start = await post(`/games/${gameId}/start`, { hostId: "host" });
    expect(start.json.ok).toBe(true);

    const me = players[0]!;
    const state = await get(`/games/${gameId}/state?playerId=${me.playerId}&token=${me.token}`);
    expect(state.status).toBe(200);
    expect(state.json.phase).toBe("active");
    expect(state.json.players).toHaveLength(7);
    // Privacy holds over the wire: public roster has no roles.
    for (const p of state.json.players) {
      expect(Object.keys(p).sort()).toEqual(["alive", "id", "name"]);
    }

    // A bad token is rejected with 400.
    const bad = await get(`/games/${gameId}/state?playerId=${me.playerId}&token=nope`);
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/credentials/);
  });

  it("returns 404 for an unknown route", async () => {
    const r = await get("/nonsense");
    expect(r.status).toBe(404);
  });
});
