# Sundown — Project Overview (for handoff / portfolio use)

> **Purpose of this file:** a single, self-contained explainer of what this project is,
> how it was built, and why it's a good showcase piece — written so either (a) another
> Claude agent can pick up full context in one read, or (b) it can be mined directly for
> resume bullets / portfolio write-ups. It duplicates a little of `CLAUDE.md`/`README.md`
> on purpose so it stands alone.

## What it is

**Sundown** is an all-day, hidden-role social deduction party game (Mafia / *The Traitors*
lineage) for 7–22 players, designed to run in the background of a real event (e.g. a
bachelor party) from morning to night. Instead of one person "running" the game, a
phone app is the silent automated host: it assigns tasks, tracks two independent
progress meters (a shared town bar and a killer kill-meter), resolves kills and votes on
a randomized delay, and sends deliberately vague push notifications. All actual scheming,
accusation, and bluffing happens face-to-face — the app never carries chat.

It shipped as a real, playable product: a Node/TypeScript backend and a React PWA,
both deployed and reachable by phone, backed by a real database, with an optional live
Claude integration for content generation and dynamic pacing.

## Why it's a good portfolio piece

- It's a **full-stack, end-to-end shipped product** (not a demo): live URLs, a real
  database, deploy pipelines from GitHub, and a played/testable game — not just code.
- It's a genuine **AI-agent-built project**: the backend was built by Claude Code from a
  written design spec in a single autonomous pass, and the frontend was built by a
  *second*, independent Claude agent ("Claude Design") working only from a handoff
  document and a wire contract — a real example of spec-driven, multi-agent
  collaboration rather than one long chat session.
- It combines **game-design/balance engineering** (a deterministic simulation harness
  that Monte-Carlo-tests win rates across thousands of simulated games) with **product
  engineering** (privacy-preserving API design, offline-testable mocks, PWA install +
  push) and **applied LLM design** (an "AI Director" pattern with hard, code-enforced
  constraints on what an LLM is and isn't allowed to touch).
- Every LLM-backed subsystem (task-deck generation, the live pacing Director) was built
  **behind an interface with a deterministic mock**, so the entire test suite, build,
  and local dev loop run with zero API key and zero cost — a pattern worth calling out to
  AI-focused employers specifically, since it demonstrates disciplined LLM-in-production
  thinking (testability, cost control, graceful fallback) rather than just "called the
  API."

## Built with Claude Code — the actual workflow

1. **Design spec first.** `game-spec.md` is a versioned, ratio-based game design doc
   (not code) — the "what and why," including open questions explicitly marked `[TBD]`
   rather than guessed at.
2. **Autonomous backend build.** §18 of the spec is a literal build order + handoff
   brief given to Claude Code: build the engine, sim harness, AI Director, deck
   generator, service layer, and persistence, in that order, writing
   `PROGRESS.md` at the end documenting what was built, test/balance results, every
   assumption made (tagged back to the spec section it resolves), and what was
   deliberately left open. This ran with the human away — genuinely autonomous, not
   pair-programmed line by line.
3. **Second agent for the frontend.** `FRONTEND_BRIEF.md` + `API.md` + real sample
   payloads in `fixtures/` were handed to a separate Claude Design agent that built the
   entire player PWA against the contract alone, with **no access to the backend
   source** — a deliberate test of whether the API contract was actually sufficient
   documentation.
4. **Iteration via `CLAUDE.md`.** Ongoing follow-up work (bug fixes, admin tooling,
   pending design requests) is tracked in `CLAUDE.md`/`DESIGN_REQUESTS.md` as the
   living "pick up where we left off" doc for future Claude sessions.
5. **~9 days, first commit to deployed:** repo history runs 2026-06-22 → 2026-07-01,
   56 commits, ending in a live, deployed, phone-playable game.

## Architecture

```
Backend (Node + TypeScript, Express)          Frontend (Vite + React + TypeScript)
─────────────────────────────────             ─────────────────────────────────
src/engine/     pure deterministic engine       No UI framework — hand-rolled
src/sim/        Monte-Carlo balance harness      components + CSS-variable theming
src/director/   AI Director (snapshot→JSON)     Polls GET /state every 5s (no websockets)
src/deck/       Anthropic-backed task decks      Auth: playerId+token in localStorage
src/service/    GameService (API.md contract)   Demo mode (?demo) runs every screen
src/persistence/ Store interface (Redis/File)     offline from fixtures, no backend
```

- **Engine is pure and seedable** — every rule (point economy, bar decay, kill-meter,
  the "moving killer" mechanic, vote resolution, ghost/resurrection) is a deterministic
  function, which is what makes the simulation harness possible at all.
- **Simulation harness** runs the real engine thousands of times per config to validate
  the design spec's target balance (~50/50 win rate at moderate skill, resolution
  landing in the early evening) — treated as a **regression test**, not a one-off
  script. Also used to quantify the balance impact of optional powered roles
  (Cop/Medic) before locking their numbers.
- **AI Director** is an LLM-in-the-loop pacing/host system modeled on Left 4 Dead's "AI
  Director," with four hard constraints **enforced in code, not prompted**: it can
  never leak hidden state, must apply every adjustment on the same randomized delay as
  all other game events (so it can't be reverse-engineered by players), is bounded to a
  fixed menu of levers with numeric ranges, and can never touch votes/kill targets/role
  assignment. Structural knobs (kill cost, killer count, win conditions) are locked at
  round start and are explicitly off-limits mid-round.
- **Privacy is enforced at the projection layer** — `GameService`'s per-player view
  (`PlayerView`) is the single choke point that guarantees no player ever receives
  another player's role/team or the bar's exact value, tested directly rather than
  trusted to the frontend to hide.
- **Everything behind LLM calls has a deterministic mock** (`createLLMClient()` returns
  `null` without a key; callers fall back transparently) — 80 tests, full build, and the
  balance harness all run with **zero** `ANTHROPIC_API_KEY` set.

## Repo & live infrastructure links

- **GitHub:** https://github.com/tiniryno-stack/sundown
- **Backend (Railway):** https://sundown-backend-production.up.railway.app (`/health` for a
  quick liveness check)
- **Frontend (Vercel):** Vercel project name is `frontend` under org
  `team_E8x8ZJDZpLTlxIc28nooalvA` — the exact public domain wasn't in the repo config;
  fill in the real `*.vercel.app` URL (or custom domain) here before using this doc
  externally.

> Note: the GitHub remote URL stored locally in `.git/config` has a personal access
> token embedded in it (`https://tiniryno-stack:ghp_...@github.com/...`). That's a local
> credential-hygiene issue, not something to reproduce in a CV/portfolio doc — always
> link the plain `https://github.com/...` form, and rotate that token / switch to SSH or
> a credential manager when convenient.

## Deployed, live infrastructure

- **Source control:** GitHub (`tiniryno-stack/sundown`), single repo, frontend and
  backend co-located (`frontend/` subdir).
- **Frontend:** Vercel, auto-deploys on push to `main` (`vercel.json` build config).
- **Backend:** Railway, auto-deploys on push to `main`, Nixpacks build, `npm run serve`
  start command, `/health` healthcheck.
- **Database:** Upstash Redis (serverless) — game state survives container restarts;
  swappable behind a `Store<T>` interface (in-memory/file adapters also exist for local
  dev and tests).
- **AI:** live `ANTHROPIC_API_KEY` set in Railway — the Director and deck generator run
  for real in production, not just in mocked tests.
- **PWA:** installable to home screen, Web Push wired, works fully offline in demo mode
  for design/QA walkthroughs without touching the backend at all.
- Includes a password-gated **admin page** (`/?admin`) for ops: list/delete games in
  Redis by phase, bulk-delete stale/dead games.

## Notable engineering details worth naming in an interview

- **Ratio-based design, not magic numbers.** The whole balance model is expressed as
  formulas over player count and day length (`K = round(0.28 × N)`, decay tied to
  target game length, etc.) so it scales from a 7-player game to a 22-player marathon
  without re-tuning by hand — and the spec calls out its own rounding edge cases (e.g.
  N=9 rounding to a killer-favored 33%) rather than papering over them.
- **Honest calibration write-up.** `PROGRESS.md` documents a real divergence between the
  simulated balance and the original spec's hand-estimated numbers, explains the likely
  root cause (the spec's own simulator was never fully specified), and asserts the
  *shape* of the result (coin-flip band, skill-monotonicity, evening median) as the
  regression rather than a brittle exact number — a good example of engineering honesty
  under uncertainty.
- **Two teams' progress never cross-feed**, and that invariant is unit-tested directly
  rather than just true "by construction."
- **Client-honor-system task completion is a deliberate design choice**, not a shortcut:
  faking a task is *in-character* cover for a killer, so there's no scanning/verification
  layer to build at all — a case of using game design to eliminate an entire class of
  engineering problem (anti-cheat) rather than solving it.

## Possible resume / portfolio bullet drafts

Pick and adapt — these are meant as raw material, not a final list:

- *Designed and shipped a full-stack, all-day multiplayer social deduction game
  (Node/TypeScript backend, React PWA frontend, Redis persistence) from a written design
  spec to a live, phone-playable deployment on Vercel + Railway in under two weeks.*
- *Built a deterministic, seedable game engine plus a Monte-Carlo simulation harness that
  validates game balance (win-rate targets, pacing targets) across thousands of
  simulated games, used as an ongoing regression test rather than a one-off analysis.*
- *Designed an LLM-in-the-loop "AI Director" for dynamic game pacing with hard,
  code-enforced safety constraints (no state leakage, bounded adjustment ranges, delayed
  application to prevent reverse-engineering) — a concrete example of guardrail design
  for an LLM given live control over a production system.*
- *Used Claude Code in a genuinely autonomous, spec-driven workflow: authored a detailed
  design/build-handoff document, let the agent build the entire backend unsupervised,
  and handed a second independent agent only the API contract and sample payloads to
  build the frontend — validating that the contract itself was sufficient documentation.*
- *Built every LLM-backed feature behind an interface with a deterministic mock so the
  full test suite, build, and simulation harness run with zero API cost and zero network
  dependency — real-key integration is a drop-in swap.*

## Where things live (for a future Claude session)

| What | Where |
|---|---|
| This file | `PORTFOLIO.md` |
| Living session context (start here for active dev) | `CLAUDE.md` |
| Game design source of truth | `game-spec.md` |
| Backend build status, decisions, balance results | `PROGRESS.md` |
| Backend wire contract | `API.md` |
| Frontend design handoff | `FRONTEND_BRIEF.md` |
| Frontend repo docs | `frontend/README.md` |
| Pending design/UI work | `DESIGN_REQUESTS.md` |
