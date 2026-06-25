/**
 * Dev/host server entry point.  Run: `npm run serve`.
 *
 * Env:
 *   PORT                  default 3000
 *   TIME_SCALE            game-minutes per real-minute (default 1; try 60 to test
 *                         a full day in ~13 min)
 *   STORE                 "file" (default, durable under data/games) | "memory"
 *   DIRECTOR_INTERVAL_SEC if set, auto-runs a Director tick for every active game
 *                         on that interval (the host-side cadence, §15.6)
 *   ANTHROPIC_API_KEY     if set, the Director + deck generator use real Claude;
 *                         otherwise deterministic mocks (no key needed)
 */

import path from "node:path";
import { GameService } from "../service/gameService.js";
import { FileStore } from "../persistence/fileStore.js";
import { RedisStore } from "../persistence/redisStore.js";
import { InMemoryStore } from "../persistence/store.js";
import type { ServiceGameRecord } from "../service/types.js";
import { createServer } from "./http.js";

const port = Number(process.env.PORT ?? 3000);
const timeScale = Number(process.env.TIME_SCALE ?? 1);

// Store selection (highest priority first):
//   1. Upstash Redis — durable across container restarts (Railway-safe), if both
//      UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
//   2. FileStore (STORE != "memory") — durable JSON files under data/games.
//   3. InMemoryStore (STORE == "memory") — ephemeral.
const useRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const useFile = (process.env.STORE ?? "file") !== "memory";
const storeKind = useRedis ? "redis" : useFile ? "file" : "memory";

const store = useRedis
  ? new RedisStore<ServiceGameRecord>()
  : useFile
    ? new FileStore<ServiceGameRecord>(path.join("data", "games"))
    : new InMemoryStore<ServiceGameRecord>();

const service = new GameService(store, { timeScale });
const server = createServer(service);

server.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  console.log(`[server] store=${storeKind} timeScale=${timeScale} ai=${process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock"}`);
});

// Optional host-side Director loop (§15.6) — opt in via DIRECTOR_INTERVAL_SEC.
const dirSec = Number(process.env.DIRECTOR_INTERVAL_SEC ?? 0);
if (dirSec > 0) {
  setInterval(() => {
    void (async () => {
      for (const gameId of await service.listGames()) {
        // Host id is internal here; the loop is server-authoritative.
        const rec = (await store.load(gameId)) as ServiceGameRecord | null;
        if (rec && rec.phase === "active") {
          await service.runDirectorTick(gameId, rec.hostId);
        }
      }
    })().catch((e) => console.error("[director-loop]", e));
  }, dirSec * 1000);
  console.log(`[server] Director loop every ${dirSec}s`);
}
