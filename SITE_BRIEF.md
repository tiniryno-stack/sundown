# Site Brief — for Claude Design

Build a **public landing page** for Sundown: one page that (a) explains the game and
how to play it to people who might actually play it, and (b) doubles as a portfolio
case-study showcase for AI engineering job applications, explaining how it was built.
This brief is everything you need — the game and its backend/frontend are already
built and documented.

- **Game design source of truth:** [`game-spec.md`](game-spec.md).
- **Build story / case-study source material:** [`PORTFOLIO.md`](PORTFOLIO.md) — use
  this as the primary source for the "Build" track below; don't re-derive it from
  scratch.
- **Real app screens:** the frontend already has an offline demo mode. Run
  `cd frontend && npm run dev`, open `http://localhost:5173/?demo`, and use the
  floating demo panel (bottom-right ✦) to switch phase/role/mood and screenshot real
  screens — Home, Tasks, Vote, Killer tools, Game over. **Use real screenshots from
  this, not mockups.** No separate asset handoff is coming; this is your source for
  visuals.
- **Player-app design reference (for voice/feel, not for rebuilding):**
  [`FRONTEND_BRIEF.md`](FRONTEND_BRIEF.md).
- **Target location:** a new `site/` folder at the repo root, sibling to `frontend/`.
  Its own `package.json`/build — do not touch `frontend/` or backend code. (It will get
  its own Vercel project later; not wired yet, so don't worry about deploy config.)

---

## What this is (one paragraph)

Sundown is an all-day hidden-role social deduction party game (Mafia / *The Traitors*
lineage) for 7–22 players, built to run in the background of a real event like a
bachelor party. A phone app is the silent automated host — it hands out tasks, tracks a
shared progress bar and a hidden killer meter, and resolves votes and kills on a
deliberately vague delay — while all the actual scheming and accusing happens face to
face, never in the app. It's a real, shipped product (Node/TypeScript backend + React
PWA, deployed and phone-playable), and it was built almost entirely by Claude Code
agents working from written specs — which is exactly what the second half of this page
is about.

## The feel

Two different voices on one page, and that's intentional — make the seam between them
obvious rather than blending them:

- **The "Play" half** should feel like the game itself: cozy party energy on the
  surface (drinks, toasts, group photos), a cold undercurrent of suspicion underneath.
  Warm, a little riddly, mobile-first. Borrow this voice from `FRONTEND_BRIEF.md`'s
  "The feel" section.
- **The "Build" half** should feel like a confident, plain-spoken engineering case
  study — the voice of `PORTFOLIO.md`. No riddles, no cuteness. Direct.
- Mark the transition between them clearly (a visual divider, a tonal shift line like
  "That's the game. Here's how it got built." — your call on exact treatment) so it
  reads as one deliberate page, not two mismatched sites stapled together.

---

## Page structure

### Track A — Play (top of page, for friends/players)

1. **Hero** — game name, one-line hook, primary CTA button ("Try the demo" / "See it
   in action"). Link target: leave as a placeholder (`#todo-demo-url`) — the live
   frontend's public URL isn't finalized yet.
2. **What it is** — the elevator pitch above, player-facing framing.
3. **How to play** — a plain-English flow explainer: morning kickoff → tasks all day
   (camouflage, not just chores) → ~5 votes at natural gathering points → the twist that
   a caught killer can sometimes transfer instead of dying → evening climax. Pull from
   `game-spec.md` §1–§6 and §9–§10 for substance, but **no formulas, ratios, or point
   math** — this is a "why it's fun" explainer, not the design spec.
4. **Screenshot / visual gallery** — real shots captured from `?demo` mode as described
   above: Home, Tasks, Vote, Killer tools, Game over. Show it's a real, working app.
5. **Rules that make it work** — reframe `FRONTEND_BRIEF.md`'s "Hard rules" (never see
   others' roles, no in-app chat, tasks never clear you, honor-system "done" tap) as
   *why the game stays tense and fair*, not as developer constraints.

### Divider

An explicit visual/tonal break — this is where the page pivots from "come play this
game" to "here's the engineering behind it."

### Track B — Build (case study, for recruiters/engineers)

1. **Why this is an interesting engineering project** — pull directly from
   `PORTFOLIO.md`'s "Why it's a good portfolio piece" and "Built with Claude Code — the
   actual workflow" sections (the spec-driven, multi-agent build process; autonomous
   backend build from a written spec; a second independent agent building the frontend
   from only the API contract).
2. **Architecture** — summarize from `PORTFOLIO.md`'s architecture section: deterministic
   seedable engine, Monte-Carlo balance simulation harness treated as a regression test,
   the "AI Director" pacing system with hard code-enforced constraints, the
   privacy-preserving API projection layer, LLM calls behind deterministic mocks so
   nothing needs an API key to build/test.
3. **Deployed, live infrastructure** — from `PORTFOLIO.md`: Vercel (frontend) + Railway
   (backend) + Upstash Redis, GitHub-based CI/CD, live Anthropic API in production.
4. **Notable engineering details** — reuse the callouts from `PORTFOLIO.md` (ratio-based
   balance design that scales with player count, the honest calibration write-up in
   `PROGRESS.md`, honor-system task completion as a design choice that eliminates an
   entire anti-cheat problem).
5. **Links** — GitHub repo: use the plain URL `https://github.com/tiniryno-stack/sundown`
   only. **Do not use any git remote URL that contains a token or credentials** — if you
   ever see one in local git config, ignore it and use the plain `https://github.com/...`
   form. Also link the live backend health check
   (`https://sundown-backend-production.up.railway.app/health`) and leave a placeholder
   for the live frontend URL.
6. **Closing CTA for recruiters** — a placeholder for a resume/contact link
   (`#todo-contact-link`) — Andrew will fill this in.

---

## Tech guidance

- New `site/` folder, **Vite + React + TypeScript**, no UI framework — consistent with
  `frontend/`'s existing approach (hand-rolled components, CSS-variable theming). Feel
  free to establish its own visual identity; it doesn't need to reuse `frontend/`'s
  theme file, just its general "no framework" approach.
- **Fully static** — no backend calls, no build-time dependency on a live server or API
  key. This matches the rest of the repo's "everything runs and builds offline"
  philosophy.
- **Mobile-first, responsive** — this will get shared in texts/DMs as much as viewed on
  desktop.
- Should run with `npm install && npm run dev` with zero configuration.

## Explicitly out of scope for this pass (leave as clear placeholders, don't block on them)

- The final public URL for the deployed frontend `?demo` link.
- The recruiter contact/resume link.
- Actual Vercel deployment wiring for `site/` (that's a follow-up step).

## Quality bar

A reader who has never seen this repo should, from this page alone, understand what the
game is, want to try it, and separately come away impressed by the engineering story —
without ever feeling like they're reading two unrelated pages.
