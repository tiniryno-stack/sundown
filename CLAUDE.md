# Sundown — Claude Context

All-day social deduction party game (7–22 players). Hidden killers vs town.
The app is a silent automated host — tasks, votes, kills, a shared bar.
All scheming happens out loud; the app is an ambient instrument panel, not a chat.

## Project state

**Backend** — complete and deployed on Railway. 80 tests pass. See `PROGRESS.md` for full detail.
**Frontend** — complete and deployed on Vercel. All screens built and wired to the live backend.
**Persistence** — Upstash Redis (already configured in Railway env vars). Game state survives container restarts.

## Key files

| What | Where |
|---|---|
| Game design spec | `game-spec.md` |
| Backend API contract | `API.md` |
| Backend build status + decisions | `PROGRESS.md` |
| Pending design/UI requests | `DESIGN_REQUESTS.md` |
| Player app | `frontend/src/` |
| Host dashboard | `frontend/src/screens/host.tsx` |
| Player screens (warm) | `frontend/src/screens/cozy.tsx` |
| Player screens (cold/private) | `frontend/src/screens/cold.tsx` |
| Backend service | `src/service/gameService.ts` |
| HTTP server entry | `src/server/index.ts` |

## Architecture in one paragraph

React frontend (Vite, TypeScript, no UI library — all inline styles matching `theme.css` tokens) polls `GET /games/:id/state` every 5 s. Backend is a Node/Express service (`GameService`) backed by Upstash Redis. No websockets. Auth is `playerId + token` returned at join, stored in localStorage, sent on every call. The host surface (`?host` URL param) polls a separate omniscient endpoint. Demo mode (`?demo`) runs every screen offline from fixtures — no backend needed.

## Deployment

- **Frontend:** Vercel — auto-deploys from `main`
- **Backend:** Railway — auto-deploys from `main`, `npm run serve`
- **Database:** Upstash Redis (env vars `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Railway)
- **AI:** `ANTHROPIC_API_KEY` in Railway — Director + deck generator use real Claude when set

## Design rules (load-bearing — don't break)

1. Never show another player's role or team
2. Never show the exact bar value — only the band (healthy / strained / critical)
3. No in-app messaging ever
4. Tasks never clear anyone — killers do them too, no "verified innocent" UI
5. Killer tools only appear when `you.killer` is present
6. Everything is deliberately vague and delayed — not forensic

## Pending work

See `DESIGN_REQUESTS.md` for the full list. Currently pending:

- **Killer task feedback + countdown** (`frontend/src/screens/cold.tsx`) — after a killer completes a task, show a brief "logged" confirmation on the task row and a "town notified in ~X min" countdown. Should feel tense, not clinical.

## Known bugs fixed recently

- **Players kicked on refresh** — root cause was `?join=SUN4D6` staying in the URL. On refresh, the app saw the `join` param, cleared the stored identity, and showed the join screen. Fixed: after a successful join, the `?join=` param is stripped from the URL via `window.history.replaceState`.
- **Rejoin flow** — if a player does get disconnected, the join screen now shows a "You were disconnected from SUN-XXX" notice with their code and name pre-filled.

## Commands

```bash
# Frontend
cd frontend && npm run dev        # dev server
cd frontend && npm run typecheck  # type check
cd frontend && npm run build      # production build

# Backend
npm run serve      # local server (port 3000)
npm test           # run all 80 tests
npm run sim        # balance simulation
npm run typecheck  # type check
```

## How to pick up next session

1. Read this file
2. Check `DESIGN_REQUESTS.md` for pending UI work
3. Check `git log --oneline -10` to see what was done recently
4. Ask the user what they want to work on — they often switch context fast
