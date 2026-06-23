CLAUDE DESIGN — KICKOFF PROMPT
==============================

(Paste everything below the line into Claude Design after linking this folder.)

────────────────────────────────────────────────────────────────────────

You are building the **player-facing frontend** for an all-day social-deduction
party game. The backend is already built, tested, and running in this repo — treat
all existing code as **READ-ONLY reference**. Do NOT modify anything outside the new
`frontend/` folder you will create.

READ FIRST (your full spec):
1. `FRONTEND_BRIEF.md` — the design brief: every screen, the vibe/feel, the hard
   rules, and which fixture backs each screen. This is your primary source.
2. `API.md` — the exact wire contract (endpoints + payloads).
3. `fixtures/` — real `PlayerView` JSON, one file per UI state. BUILD AGAINST THESE
   first (static), then wire the live API. They match the running backend exactly.
4. `game-spec.md` — the underlying game design, if you need deeper context.

SCOPE THIS PASS:
- ✅ Build the **player app only** (Join/Lobby, Home/Dashboard, Tasks, Vote, Killer
  tools, Cop/Medic, Ghost, Game-over). Mobile-first.
- ⛔ Do NOT build the admin/spectator view (that's a later, separate surface).
- ⛔ Do NOT touch the backend (`src/`, tests, configs). Build everything in `frontend/`.

SETUP:
1. Create a new app in `frontend/` (suggested: Vite + React + TypeScript +
   Tailwind — but use your best judgment for a polished mobile-first PWA-style app).
   It must be its own project with its own package.json; don't add deps to the root.
2. Create a small API client that targets a configurable base URL
   (env var, default `http://localhost:3000`). For development, load the JSON in
   `fixtures/` directly so every screen renders with no backend running.
3. Auth: `join` returns `{ playerId, token }`; persist them on-device and send on
   every call (see API.md). Poll `GET /games/:id/state` ~every 5s for live state;
   fetch `GET /games/:id/tasks` on load and after completing a task.

HARD RULES (these are load-bearing game mechanics — see FRONTEND_BRIEF.md §"Hard rules"):
- Never show another player's role/team. Never show the exact bar value (band only).
- No in-app messaging of any kind. Doing a task never marks anyone innocent.
- Killer/Cop/Medic tools render only when the relevant `you.*` object is present.

THE FEEL (matters more than features): slow-burn, ambient, paranoid; vague and
riddly (never forensic); cozy party energy hiding a cold undercurrent; one-handed,
tipsy-in-the-sun usability. See FRONTEND_BRIEF.md §"The feel".

DELIVERABLE: a runnable `frontend/` app where each screen is reachable and renders
correctly from the fixtures, then wired to the live endpoints. Add a short
`frontend/README.md` with run instructions.
