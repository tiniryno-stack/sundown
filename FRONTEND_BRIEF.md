# Frontend Brief — for Claude Design

Build the **player-facing app** for an all-day social-deduction party game. This
brief is everything you need; the backend is built and documented.

- **Wire contract:** [`API.md`](API.md) — every endpoint + payload.
- **Sample data:** [`fixtures/`](fixtures/) — real `PlayerView` JSON for each
  screen/state. **Build against these**; they match the live backend exactly.
- **Design source of truth:** [`game-spec.md`](game-spec.md) (the game's full design).
- You do **not** need the backend running to design — wire to the fixtures, then
  later point at a live server (`npm run serve`, base URL becomes the API host).

---

## What this is (the one-paragraph version)

7–22 friends spend a whole day together (a bachelor-party trip). Hidden among them
are **killers** (~28%); everyone else is **town**. The app is the silent automated
host — it tracks a shared progress bar, doles out fun drinking/social **tasks**,
runs ~5 **votes** at mealtimes, and resolves kills. Suspicion simmers in the
background of a real day. **Crucially: all the actual talking, scheming, and
accusing happens out loud / over group text — NOT in the app.** The app is a
quiet instrument panel, not a chat app.

## The feel (this matters more than features)

- **Slow burn, ambient, paranoid.** Most of the day the screen is calm. Moments
  punctuate it — a vague notification, a vote opening, a death.
- **Vague and riddly, never forensic.** The app never says "Bob killed Alice at
  2:14pm." It says *"a death… or was it a switch?"* Everything is delayed ~5 min
  and deliberately imprecise so the app can't be used as a lie detector.
- **Cozy party energy** on the surface (drinks, group photos, toasts), with a
  cold undercurrent of suspicion. Think: warm social app hiding a knife.
- **Mobile-first.** People glance at it one-handed, tipsy, in the sun. Big touch
  targets, high contrast, minimal reading.

## Hard rules (do NOT break — these are load-bearing game mechanics)

1. **Never show another player's role or team.** The roster is names + alive/dead
   only. Only `you.role` / `you.team` are ever known.
2. **Never show the exact bar value** — only the band (`healthy/strained/critical`).
3. **No in-app messaging, ever.** No chat, no DMs, no comments. (By design, §1.)
4. **Doing a task never "clears" anyone.** Tasks are camouflage — killers do them
   too. Don't add any "verified innocent" UI.
5. **Killer tools appear only for killers** (`you.killer` present). Cop/Medic tools
   only for those roles (`you.cop` / `you.medic`).
6. **Honor system.** Completing a task is just a "Done" tap — no scanning, no proof.

---

## Screens

Each screen lists its **data source** (a fixture / endpoint). Poll
`GET /games/:id/state` every ~5s for live state; fetch `GET /games/:id/tasks`
on load and after completing a task.

### 1. Join / Lobby — `playerview.lobby.json`
- Enter a name, join a game (host shares a code/link → `gameId`).
- Show the gathering roster (`players[]`, all alive), a "waiting for host to
  start" state, and player count.
- On `phase` flipping to `active`, transition to Home.

### 2. Home / Dashboard (the main screen) — `playerview.town_active.json`
The hub players glance at all day. Show:
- **Bar status** as a mood/indicator (not a number): `bar` → healthy / strained /
  critical. Make `critical` feel alarming.
- **Living count** (`livingCount`) — "5 still standing." Never break it down by team.
- **The event feed** (`events[]`) — the riddly notifications, newest first. This is
  the app's heartbeat. Each is a vague one-liner.
- **Your role card** — quiet for plain town; for killers/cop/medic a tasteful badge
  + entry to their tools.
- **Time** — `nowMinute` vs `finaleMinute` as an ambient "how far into the day" arc,
  and the next vote time if one is coming.
- Primary CTA: **Tasks**. Secondary surfaces appear contextually (vote open, etc.).

### 3. Tasks — `playerview.tasks.json` (`GET /games/:id/tasks`)
- A browsable deck of prompts (`tasks[]`): `prompt`, `tier` (light/standard/heavy/
  group — show as effort/points), `kind` (`covert` = a sneaky "gotcha", style it
  differently), `group` (needs 2+ people), and `intensitySwap` (always surface the
  non-alcoholic option — inclusivity is required).
- **"Done" tap** → `POST /tasks/complete`. On success show a subtle confirmation
  (no fanfare — loudness is fine but proves nothing).
- **Cooldowns:** if `availableAtMinute > nowMinute`, show the task as resting with a
  countdown; disable its Done button.

### 4. Vote — `playerview.vote_open.json`
- Appears when `vote.open` is true; closes at `vote.closesAtMinute` (show a countdown).
- List the living `players[]`; tap one to cast → `POST /vote`. Reflect `youVoted`.
- Tone: tense, deliberate. After casting, a calm "your vote is in" — results are
  **not** shown here; they surface later, vaguely, in the event feed.

### 5. Killer tools — `playerview.killer_can_kill.json` + `playerview.killer_context.json`
Visible only when `you.killer` exists.
- **Meter:** `you.killer.meterPoints` / `killCost` as progress to the next kill.
- **Kill** (enabled when `canKillNow`): pick a target → `POST /killer/kill`.
  Before/while choosing, fetch `GET /killer/context` for **anonymous suggestions**
  (`suggestions[]` = target ids from teammates, with NO identities — never reveal
  who suggested). This is how killers infer teammates without proof.
- **Bank move** (`POST /killer/bank-move`): spend points for insurance instead of a
  kill — show `teamMoveCharges` / `maxMoves`. Frame the offense-vs-resilience choice.
- **Suggest** (`POST /killer/suggest`): nudge a target for teammates (anonymous).

### 6. Cop & Medic — `playerview.cop.json` / `playerview.medic.json`
- **Cop:** `you.cop.investigations` charges. (The investigate action's exact UX is a
  design-open item — model a single "investigate a player → result" for now.)
- **Medic:** `you.medic.shields` charges → shield a player from the next kill.
- Keep these understated; powered roles shouldn't scream their identity.

### 7. Eliminated / Ghost — `playerview.ghost_flipped.json`
- When `you.alive` is false / `you.isGhost` true: a distinct "you're out… but not
  gone" state. You're now secretly on the killers' side (`you.team` may read killer).
- Ghosts stay present: keep them seeing the event feed and (later) the accuracy
  ballot side-game. Make it feel like a fun afterlife, not a dead end.

### 8. Game over / recap — `playerview.game_over.json`
- `result` populated: `winner` + `reason` (`parity` / `collapse` /
  `allKillersEliminated` / `finaleSurvival`). Celebrate the outcome.
- This is the natural moment for a **role reveal** of the whole roster (the only
  time roles become public). Big payoff screen.

---

## Phase 2 (later) — Admin / Spectator view

A **separate, omniscient** surface for the host (Andrew) — web or mobile — to watch
the game's true state and learn how the backend behaves. It is NOT a player screen
and must never be reachable by players. The CLI tool `npm run watch` is the working
blueprint for what it shows: true roles, exact bar %, kill/vote/resurrection beats,
move charges, Director nudges, and an end-of-game recap. (The backend already holds
all of this in its internal log; a thin host-only "spectator state" endpoint can be
added when we build this — flag it and we'll expose it.)

---

## What's intentionally NOT in the app

Messaging/chat · any "this player is innocent/guilty" indicators · exact numbers
(bar %, kill meters of others, who-did-what attribution) · real-time confirmation
of actions (everything is delayed). If a design instinct wants one of these, it's
almost certainly breaking a game mechanic — check this list first.

## Tech notes for handoff

- Stateless client: poll `getState`; the server is authoritative, so app
  close/reopen is safe and loses nothing.
- Auth: `join` returns `{ playerId, token }`; send them on every call (query params
  or body — see API.md). Store them on-device.
- Base URL: the deployed server (or `http://localhost:3000` against `npm run serve`).
- Start by rendering each fixture as a static screen, then wire the live calls.
