/**
 * Fixture generator — produces real PlayerView payloads for every UI state by
 * driving the actual GameService, then writes them to `fixtures/` for the
 * frontend handoff. Run: `npm run fixtures`.
 *
 * Because these come from the live service, the shapes are guaranteed to match
 * what the running backend returns — Claude Design can build screens against
 * them with no backend running, and they regenerate if the contract changes.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { GameEngine } from "../engine/engine.js";
import { InMemoryStore } from "../persistence/store.js";
import { GameService } from "../service/gameService.js";
import type { ServiceGameRecord } from "../service/types.js";

const OUT = "fixtures";

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const store = new InMemoryStore<ServiceGameRecord>();
  let clock = 1_000_000;
  const svc = new GameService(store, { now: () => clock });

  const written: { file: string; desc: string }[] = [];
  const write = async (name: string, desc: string, payload: unknown) => {
    const file = `playerview.${name}.json`;
    await fs.writeFile(path.join(OUT, file), JSON.stringify(payload, null, 2) + "\n", "utf8");
    written.push({ file, desc });
  };

  // --- create + join a 7-player game with Cop + Medic enabled ---
  const { gameId } = await svc.createGame({ hostId: "host", players: 7, roles: { cop: true, medic: true }, seed: "fixtures" });
  const creds = new Map<string, string>(); // playerId -> token
  const ids: string[] = [];
  for (let i = 0; i < 7; i++) {
    const j = (await svc.join(gameId, ["Alice", "Bob", "Cara", "Dave", "Eve", "Finn", "Gwen"][i]!)) as {
      playerId: string;
      token: string;
    };
    creds.set(j.playerId, j.token);
    ids.push(j.playerId);
  }
  const tok = (id: string) => creds.get(id)!;

  // 1) LOBBY — first screen, before the round starts.
  await write("lobby", "Lobby / waiting room (phase=lobby, roles not yet assigned)", await svc.getState(gameId, ids[0]!, tok(ids[0]!)));

  // --- start the round; discover who got which role (host-side only) ---
  await svc.startRound(gameId, "host");
  const rec0 = (await store.load(gameId))!;
  const startedAt = rec0.startedAtMs;
  const engine = GameEngine.hydrate(rec0.engine!);
  const byRole = (pred: (p: { team: string; role: string; id: string }) => boolean) =>
    engine.state.players.find(pred)!.id;
  const townId = byRole((p) => p.role === "townsperson");
  const victimId = engine.state.players.find((p) => p.role === "townsperson" && p.id !== townId)!.id;
  const killerId = byRole((p) => p.team === "killer");
  const copId = byRole((p) => p.role === "cop");
  const medicId = byRole((p) => p.role === "medic");

  // 2) Mid-morning snapshots for each role.
  clock = startedAt + 30 * 60000;
  await write("town_active", "Plain townsperson, active round, bar healthy, no vote open", await svc.getState(gameId, townId, tok(townId)));
  await write("tasks", "Task deck + this player's cooldowns (GET /games/:id/tasks)", await svc.getTasks(gameId, townId, tok(townId)));
  await write("cop", "Cop / Investigator view (note you.cop.investigations)", await svc.getState(gameId, copId, tok(copId)));
  await write("medic", "Medic / Protector view (note you.medic.shields)", await svc.getState(gameId, medicId, tok(medicId)));

  // 3) Killer with a kill available — fund the meter to kill_cost.
  {
    const r = (await store.load(gameId))!;
    const e = GameEngine.hydrate(r.engine!);
    e.getPlayer(killerId)!.meterPoints = r.config.killCost;
    r.engine = e.serialize();
    await store.save(gameId, r);
  }
  await write("killer_can_kill", "Killer with a kill unlocked (you.killer.canKillNow=true, team charges)", await svc.getState(gameId, killerId, tok(killerId)));

  // 4) Killer kill-context: anonymous current suggestions (a teammate suggested a target).
  await svc.killerSuggest(gameId, killerId, tok(killerId), townId);
  const otherKillerId = engine.state.players.find((p) => p.team === "killer" && p.id !== killerId)?.id ?? killerId;
  await write("killer_context", "getKillContext payload (anonymized current suggestions, §9)", await svc.getKillContext(gameId, otherKillerId, tok(otherKillerId)));

  // 5) Vote open — move into the first scheduled vote's window.
  const vt0 = rec0.config.voteTimesMin[0]!;
  clock = startedAt + (vt0 - 5) * 60000;
  await write("vote_open", "An open scheduled vote (vote.open=true, closesAtMinute set)", await svc.getState(gameId, townId, tok(townId)));

  // 6) Resolve a misfire vote so we can show a flipped ghost's own view.
  for (const id of ids) await svc.castVote(gameId, id, tok(id), victimId);
  clock = startedAt + (vt0 + 15) * 60000;
  await write("ghost_flipped", "A voted-out townsperson's own view (alive=false, isGhost=true, secretly flipped)", await svc.getState(gameId, victimId, tok(victimId)));

  // 7) Game over — advance past the finale.
  clock = startedAt + (rec0.config.finaleMin + 5) * 60000;
  await write("game_over", "End-of-round view (result populated)", await svc.getState(gameId, townId, tok(townId)));

  // --- manifest ---
  const manifest =
    "# Fixtures — sample PlayerView payloads\n\n" +
    "Real responses from the live `GameService` (seed `fixtures`), one per UI state.\n" +
    "Build screens against these; they match exactly what `GET /games/:id/state` returns.\n" +
    "Regenerate with `npm run fixtures`.\n\n" +
    written.map((w) => `- \`${w.file}\` — ${w.desc}`).join("\n") +
    "\n";
  await fs.writeFile(path.join(OUT, "README.md"), manifest, "utf8");

  console.log(`Wrote ${written.length} fixtures to ${OUT}/`);
  for (const w of written) console.log(`  ${w.file}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
