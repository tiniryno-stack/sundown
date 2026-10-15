# Sundown — Claude Context

All-day social deduction party game (7–22 players). Hidden killers vs town.
The app is a silent automated host — tasks, votes, kills, a shared bar.
All scheming happens out loud; the app is an ambient instrument panel, not a chat.

## Project state

**Backend** — complete and deployed on Railway. 95 tests pass. See `PROGRESS.md` for full detail.
**Frontend** — complete and deployed on Vercel. All screens built and wired to the live backend.
**Persistence** — Upstash Redis (already configured in Railway env vars). Game state survives container restarts.

## Key files

| What | Where |
|---|---|
| Game design spec | `game-spec.md` |
| Backend API contract | `API.md` |
| Backend build status + decisions | `PROGRESS.md` |
| Pending design/UI requests | `DESIGN_REQUESTS.md` |
| Product notes, ideas, landing page plan | `docs/` (start with `docs/README.md`) |
| Landing page | `frontend/src/screens/landing.tsx` + `frontend/src/showcase/` |
| Player app | `frontend/src/` |
| Host dashboard | `frontend/src/screens/host.tsx` |
| Player screens (warm) | `frontend/src/screens/cozy.tsx` |
| Player screens (cold/private) | `frontend/src/screens/cold.tsx` |
| Backend service | `src/service/gameService.ts` |
| HTTP server entry | `src/server/index.ts` |

## Architecture in one paragraph

React frontend (Vite, TypeScript, no UI library — all inline styles matching `theme.css` tokens) polls `GET /games/:id/state` every 5 s. Backend is a Node/Express service (`GameService`) backed by Upstash Redis. No websockets. Auth is `playerId + token` returned at join, stored in localStorage, sent on every call. The host surface (`?host` URL param) polls a separate omniscient endpoint. Demo mode (`?demo`) runs every screen offline from fixtures — no backend needed.

## Deployment

- **Frontend:** Vercel — auto-deploys from `master`; every PR gets a preview deploy
- **Backend:** Railway — auto-deploys from `master`, `npm run serve`
- **Workflow:** branch → PR → merge to `master` (Andrew merges). Small fixes can go straight to `master` if he says so.
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

Product / landing page (see `docs/showcase-plan.md` for detail):
- **Contact link** — closing CTA on the landing page still points at GitHub; swap in Andrew's contact/resume link when he has it
- **Domain** — buy one, make the landing page the site root, move the player app to `/play` (keep `?demo`, `?host`, `?admin`, `?join=` working)
- **Open Graph image + meta tags** so the link previews well in texts/LinkedIn
- **Product analytics** (e.g. PostHog) on the landing page + app; event list in `docs/showcase-plan.md` §7
- **Root `README.md`** — still describes a backend-only repo; rewrite as a showcase README
- **Admin setup** — `ADMIN_KEY` in Railway should be 12+ characters for the admin page to list waitlist emails

App (from `DESIGN_REQUESTS.md`):
- **Killer task feedback + countdown** (`frontend/src/screens/cold.tsx`) — after a killer completes a task, show a brief "logged" confirmation on the task row and a "town notified in ~X min" countdown. Should feel tense, not clinical.
- **Unified host-as-player flow** — host should be able to create a game and join as a real player in one flow (no separate `?host` tab). After creating, enter name → auto-join → player view. A discreet lock icon on the home screen → password → host dashboard overlay. Not yet built.

Ideas backlog: `docs/brain-dump.md` (App Store path, monetization, cost estimates).

## Known bugs fixed recently

- **Players kicked on refresh** — root cause was `?join=SUN4D6` staying in the URL. On refresh, the app saw the `join` param, cleared the stored identity, and showed the join screen. Fixed: after a successful join, the `?join=` param is stripped from the URL via `window.history.replaceState`.
- **Rejoin flow** — if a player does get disconnected, the join screen now shows a "You were disconnected from SUN-XXX" notice with their code and name pre-filled.

## Admin page

- URL: `yourvercelurl/?admin`. The password is the `ADMIN_KEY` env var in Railway; the server checks it.
- Shows the landing-page waitlist (count, plus the email list when `ADMIN_KEY` is 12+ characters) and all games in Redis grouped by phase (active / lobby / finished)
- Per-game delete + bulk "delete all dead games" button
- Frontend: `frontend/src/screens/admin.tsx`
- Backend: `GET /admin/games`, `POST /admin/games/:id/delete`, `GET /admin/waitlist` in `src/server/http.ts`

## Landing page (`?landing`)

- `frontend/src/screens/landing.tsx` + `frontend/src/showcase/*`
- Hero and "three phones" demos drive the REAL app screens from a script (`showcase/story.ts`); no screenshots or video
- "How to play" reuses the in-app tutorial (`TUTORIAL_SLIDES` in `screens/cozy.tsx`) and `BAR_COPY`, so page and app can't disagree
- Waitlist: `POST /waitlist` stores emails in Redis under `sundown:waitlist:*` (no emails are ever sent). Rate-limited, honeypot field, deduped.
- `cd frontend && node scripts/build-showcase.mjs` builds the landing page alone into one HTML file for previews

## Commands

```bash
# Frontend
cd frontend && npm run dev        # dev server
cd frontend && npm run typecheck  # type check
cd frontend && npm run build      # production build

# Backend
npm run serve      # local server (port 3000)
npm test           # run all tests (95)
npm run sim        # balance simulation
npm run typecheck  # type check
```

## How to pick up next session

1. Read this file
2. Skim `docs/README.md`, then `DESIGN_REQUESTS.md` for pending UI work
3. Check `git log --oneline -10` and recent merged PRs to see what was done recently
4. Ask the user what they want to work on — they often switch context fast
