/**
 * Thin HTTP layer over GameService (the "missing piece" noted in PROGRESS.md).
 *
 * Zero new runtime dependencies — Node's built-in http with a tiny router — so
 * the backend stays portable. Each route maps 1:1 to an API.md endpoint. A
 * per-game async mutex serializes requests touching the same game so concurrent
 * read-modify-write (load → mutate → save) can't clobber state.
 *
 * CORS is wide-open (*) for easy local/frontend testing; lock it down for prod.
 */

import http from "node:http";
import type { GameService } from "../service/gameService.js";

/** Serialize async work per key (one in-flight op per game id). */
class KeyedMutex {
  private chains = new Map<string, Promise<unknown>>();
  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.chains.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }
}

interface Ctx {
  method: string;
  seg: string[];
  query: URLSearchParams;
  body: Record<string, unknown>;
}

function cred(ctx: Ctx, key: string): string {
  return String(ctx.body[key] ?? ctx.query.get(key) ?? "");
}

export function createServer(service: GameService): http.Server {
  const mutex = new KeyedMutex();

  return http.createServer(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const seg = url.pathname.split("/").filter(Boolean);
      const body = req.method === "POST" ? await readJson(req) : {};
      const ctx: Ctx = { method: req.method ?? "GET", seg, query: url.searchParams, body };

      // /health
      if (seg.length === 1 && seg[0] === "health") return send(res, 200, { ok: true });

      // POST /games  (create — not game-scoped)
      if (seg.length === 1 && seg[0] === "games" && ctx.method === "POST") {
        return send(res, 200, await service.createGame(body as never));
      }

      // /games/:id/...
      if (seg[0] === "games" && seg.length >= 2) {
        const gameId = seg[1]!;
        const sub = seg.slice(2).join("/");
        // Serialize all mutating + state reads per game.
        const result = await mutex.run(gameId, () => dispatch(service, gameId, sub, ctx));
        if (result === undefined) return send(res, 404, { ok: false, error: "not found" });
        const status = isErr(result) ? 400 : 200;
        return send(res, status, result);
      }

      send(res, 404, { ok: false, error: "not found" });
    } catch (err) {
      send(res, 500, { ok: false, error: (err as Error).message });
    }
  });
}

async function dispatch(service: GameService, gameId: string, sub: string, ctx: Ctx): Promise<unknown> {
  const { method } = ctx;
  const pid = () => cred(ctx, "playerId");
  const tok = () => cred(ctx, "token");
  const host = () => cred(ctx, "hostId");

  switch (`${method} ${sub}`) {
    case "POST join":
      return service.join(gameId, String(ctx.body.name ?? "Player"));
    case "POST start":
      return service.startRound(gameId, host());
    case "POST next-round":
      return service.nextRound(gameId, host());
    case "GET result":
      return service.getResult(gameId);
    case "GET state":
      return service.getState(gameId, pid(), tok());
    case "GET tasks":
      return service.getTasks(gameId, pid(), tok());
    case "POST tasks/complete":
      return service.completeTask(gameId, pid(), tok(), String(ctx.body.taskId ?? ""));
    case "POST vote":
      return service.castVote(gameId, pid(), tok(), String(ctx.body.targetId ?? ""));
    case "POST killer/kill":
      return service.killerKill(gameId, pid(), tok(), String(ctx.body.targetId ?? ""));
    case "POST killer/bank-move":
      return service.killerBankMove(gameId, pid(), tok());
    case "POST killer/suggest":
      return service.killerSuggest(gameId, pid(), tok(), String(ctx.body.targetId ?? ""));
    case "GET killer/context":
      return service.getKillContext(gameId, pid(), tok());
    case "POST director/tick":
      return service.runDirectorTick(gameId, host());
    case "GET host-state":
      return service.getHostState(gameId, host());
    case "POST delete":
      return service.deleteGame(gameId, host());
    default:
      return undefined;
  }
}

function isErr(result: unknown): boolean {
  return typeof result === "object" && result !== null && "ok" in result && (result as { ok: unknown }).ok === false;
}

function setCors(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}
