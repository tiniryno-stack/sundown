# All-Day Social Deduction — Backend

The backend for an all-day, background-of-your-day social-deduction party game
(Mafia / *Traitors* lineage) where a companion app is the automated host. This
repo is **backend only** — engine, simulation harness, AI Director, task-deck
generator, service layer, and persistence. **No frontend** (that's built
separately in Claude Design); the contract it consumes is [`API.md`](API.md).

The single source of truth for the design is [`game-spec.md`](game-spec.md).
The build handoff lives in its §18.

## Highlights

- **Pure, seedable, deterministic engine** — point economy, town bar + decay,
  per-killer kill-meter, team move charges, votes, the moving-killer/resurrection
  system, ghost flips, and all win conditions. Every state change applies on a
  **delay** (§14); attribution is **internal-only** (§7.3); town and killer
  progress **never cross-feed** (§8).
- **Headless simulation harness** that runs the real engine thousands of times to
  re-validate the §16 balance numbers (kept as a regression test).
- **AI Director** with its four hard constraints enforced **in code** (§15).
- **Anthropic-backed task-deck generator** (weighted, portable, deduped, §7.2).
- **Everything builds, runs, and tests with NO API key.** All Anthropic usage is
  behind an interface with a deterministic mock; a real key is picked up
  automatically from `ANTHROPIC_API_KEY` if present.

## Requirements

- Node ≥ 20 (developed on Node 24)

## Setup

```bash
npm install
```

## Commands

```bash
npm test            # run the full Vitest suite (80 tests)
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/

npm run sim                       # balance report (default 500 games/cell)
npm run sim -- --games 4000       # more samples
npm run sim -- --players 22       # the marathon format

npm run deck:generate             # generate a sample task deck (offline mock)

npm run serve                     # start the HTTP server (API.md) on :3000
```

### Running the server for a real/Claude-Design-frontend test

```bash
npm run serve
# env knobs:
#   PORT=3000                  port
#   TIME_SCALE=60              compress the all-day timeline (60 => a full ~13h
#                              day resolves in ~13 real minutes) — great for testing
#   STORE=file|memory          file (default, durable under data/games) or memory
#   DIRECTOR_INTERVAL_SEC=600  auto-run the AI Director on a cadence (§15.6)
```

The server is **stateful and authoritative** — phones are thin clients that poll
`GET /games/:id/state`; closing/reopening the app loses nothing. For a quick test
with real phones, run locally and expose it with a tunnel (e.g. `ngrok http 3000`),
or deploy the Node process to any small host (Railway / Render / Fly.io / a $5 VPS).
Example flow:

```bash
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/games -H 'Content-Type: application/json' \
  -d '{"hostId":"host","players":7}'
# → {"gameId":"g_xxxx"}  then POST /games/:id/join, /start, GET /state?playerId=&token=
```

### Using a real Anthropic key (optional)

Nothing requires it, but to exercise the real Director / deck generator:

```bash
# PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm run deck:generate
```

The factory `createLLMClient()` returns a real client when the key is set and
`null` otherwise, so callers transparently fall back to their mock.

## Layout

```
src/
  engine/        pure deterministic game engine (+ unit tests)
  sim/           headless harness + balance regression test + report CLI
  ai/            LLMClient interface, Anthropic adapter, deterministic mock
  director/      AI Director: snapshot -> bounded JSON -> delayed apply (§15)
  deck/          Anthropic-backed task-deck generator (§7.2) + mock
  service/       GameService application layer (maps to API.md)
  persistence/   Store interface + InMemory + File adapters
game-spec.md       design source of truth
API.md             frontend-facing wire contract
FRONTEND_BRIEF.md  design handoff for Claude Design (screens, vibe, rules)
fixtures/          real sample PlayerView payloads, one per UI state
PROGRESS.md        build status, results, decisions, and what's left
```

## Frontend handoff

The frontend (player app) is built separately. Everything a designer needs is in
**`FRONTEND_BRIEF.md`** (screens, flows, the vibe, hard rules) + **`API.md`** (the
wire contract) + **`fixtures/`** (real sample payloads to build against, no backend
required). Regenerate fixtures any time with `npm run fixtures`.

## Notes

- `npm audit` reports advisories in **dev-only** transitive deps (vitest/esbuild);
  they don't ship in the backend. Left as-is to avoid forced breaking upgrades.
- The compiled `dist/` and any `data/*.json` (FileStore output) are git-ignored.
