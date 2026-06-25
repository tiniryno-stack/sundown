# Handoff: Sundown player app — frontend feature delta (v2)

## Overview
This is a **follow-up handoff** to the original Sundown player-app pass-off. Since
that first hand-off, the frontend prototype gained several features that were
**not in the initial spec**. This document covers **only the delta** — the new and
changed screens and what each needs from the backend to go live. For the base
API mapping (poll `GET /games/:id/state`, fixtures → `PlayerView`, auth, the hard
privacy rules), see the original `README.md` at the project root — it still
applies unchanged.

If you've already wired the v1 client to the API, this is your punch-list for the
new surface area.

## About the design files
The files in this bundle are **design references written in HTML/React-via-Babel** —
a runnable prototype showing intended look and behavior, **not production code to
ship as-is**. The task is to **recreate these behaviors in the real codebase**
using its existing framework, component library, and patterns. Render logic lives
in plain JSX transpiled in-browser; treat it as a precise spec, not a dependency.

Everything renders from a mock data layer (`data.js` → `SD.buildView({role,bar,phase})`).
The prototype fakes server state with tweak knobs and query params
(`?phase=…&role=…&bar=…`). Wherever this doc says "currently mocked / client-only,"
that's the seam you need to replace with a real API call.

## Fidelity
**High-fidelity.** Final colors, type, spacing, motion, and copy. Recreate
pixel-accurately using the codebase's design system. Design tokens are defined in
`theme.css` (light/dark via `data-theme` on `.sd-root`); reuse those values.

---

## What changed since v1 (summary)

| # | Feature | Files / components | Backend work needed |
|---|---|---|---|
| 1 | **Proof tasks + task archive** | `sd-cozy.jsx`: `TaskRow`, `ProofChip`, `ProofSheet`, `ArchiveSheet`, `TasksScreen` · `data.js`: `proof` on tasks | New `proof` field on tasks; `POST /tasks/complete` accepts a typed answer; archive read model |
| 2 | **Tutorial / how-to-play** | `sd-cozy.jsx`: `TutorialScreen`, `TUTORIAL_SLIDES` · `sd-app.jsx`: `phase === "tutorial"` | None server-side; persist a "seen" flag |
| 3 | **Post-vote confirmation (fleshed out)** | `sd-cozy.jsx`: `VoteScreen` (the `cast` branch) | Echo the voter's own cast target back; expose `closesAtMinute` |
| 4 | **Killer strike meter → arc gauge** | `sd-cold.jsx`: `StrikeMeter`, `KillerScreen` | **None** — pure visual rework of existing `you.killer` fields |
| 5 | **Dynamic vote banner + animated result screen** | `sd-cozy.jsx`: `VoteBanner`, `VoteResultScreen` · `sd-app.jsx`: `phase === "result"`, pushed `"result"` · `data.js`: `vote.resolved` | Vote state machine `open → resolved`; deliberately **anonymous** result payload |

---

## 1. Proof tasks + task archive

**What it is.** Some covert tasks ask the player to *log proof* of what they
pulled off (e.g. "Covertly get someone to say a secret word you chose" → type the
secret word). Completing such a task opens a sheet to type the answer; the answer
and every completed task land in a private **task archive**.

**Where it lives.**
- `data.js` — tasks may now carry an optional `proof` object:
  ```js
  { id: "t30", prompt: "Covertly get someone to say a secret word you chose",
    tier: "heavy", kind: "covert", points: 3,
    proof: { q: "What was your secret word?", placeholder: "e.g. pineapple" } }
  ```
  Tasks without `proof` complete with a single tap, as before.
- `sd-cozy.jsx`:
  - `TaskRow` — when `t.proof` is set, the row shows a "logs proof" hint and a
    pill-shaped **Log** chip (`ProofChip`) instead of the plain check circle.
  - `ProofSheet` — bottom sheet: shows `task.prompt`, the `proof.q` label, a text
    input (`placeholder = proof.placeholder`), a privacy note, and a "Log it &
    complete" button. Enter key submits when non-empty.
  - `ArchiveSheet` — opened from the **archive** pill in the Tasks header. Lists
    completed tasks newest-first; for proof tasks it renders the typed answer.
  - `TasksScreen.complete(task, answer)` — marks done, pushes
    `{ prompt, tier, kind, answer|null, at }` onto local `archive` state, shows a
    toast, then refills the deck slot (existing endless-deck behavior).

**Currently mocked.** `archive` is React state only — lost on reload. Completion
is the honor-system `setDone` with no network call carrying the answer.

**Backend wiring needed.**
- **Task shape:** `GET /games/:id/tasks` should include an optional `proof`
  descriptor per task: `{ q: string, placeholder?: string }`. Presence of `proof`
  is what flips the UI into "log an answer" mode — keep it data-driven, don't
  hardcode which tasks need proof.
- **Complete with answer:** extend `POST /tasks/complete` to accept an optional
  free-text answer, e.g. `{ taskId, proof?: string }`. Validate length server-side;
  store it against the player+task.
- **Privacy (important):** the proof answer is **private to the player who logged
  it**. It must never appear in any other player's `PlayerView`, the roster, the
  feed, or a host view that players can see. It does **not** mark anyone innocent
  or guilty — it's a personal record only. This extends the existing "completing a
  task proves nothing" rule.
- **Archive read model:** expose the player's own completed tasks (with their
  logged answers) so the archive survives reload — either a
  `GET /games/:id/me/archive` endpoint or include a `you.archive[]` array in
  `PlayerView`. Each entry: `{ prompt, tier, kind, answer|null, completedAt }`.

---

## 2. Tutorial / how-to-play

**What it is.** A 5-slide paged primer shown **between the lobby and the live
game** (how to play + how to use the app). Slides: the goal → the mood meter →
tasks as cover → your secret role & passing the phone → voting. Dots + Back/Next,
"Skip" on non-final slides, "Enter the day" on the last.

**Where it lives.** `sd-cozy.jsx`: `TutorialScreen`, content array
`TUTORIAL_SLIDES`. Routed in `sd-app.jsx` as `phase === "tutorial"`; the lobby's
"begin the day" now routes `lobby → tutorial → active`.

**Backend wiring needed.** None — content is static client copy. The only
persistence worth adding: a **"has seen tutorial"** flag so returning players skip
it (localStorage, or a boolean on the player profile). The host "begin the day"
action is unchanged; the tutorial is a purely client-side interstitial before the
first `active` poll.

---

## 3. Post-vote confirmation (fleshed out)

**What it is.** The old "your vote is in" state was a bare checkmark. It's now a
full confirmation: a pulsing confirmation emblem, a card showing **who you cast
against** (avatar + name + "no takebacks"), a 3-step "what happens next" timeline
(locked → tallied out of sight → revealed later), a live **closes in mm:ss**
countdown, and the living count.

**Where it lives.** `sd-cozy.jsx`: `VoteScreen`, the `if (cast)` branch. The
countdown ticks from `view.vote.closesAtMinute - view.nowMinute`.

**Currently mocked.** The "you cast against {name}" card reads from local `picked`
state set when the player taps a name this session. On reload, `cast` is seeded
from `view.vote.youVoted` but the **target name is lost** (no `picked`), so the
card hides.

**Backend wiring needed.**
- Echo the voter's **own** cast target back in `PlayerView`, e.g.
  `vote.yourVote: <playerId> | null`. (This is the one vote a player is allowed to
  see — their own. Still never expose anyone else's vote or any running tally.)
  Wire the confirmation card to `vote.yourVote` instead of local `picked` so it
  survives reload.
- Keep `vote.closesAtMinute` (already present) for the countdown.
- `POST /vote` is unchanged; "no takebacks" should be enforced server-side
  (reject a second vote in the same round).

---

## 4. Killer strike meter → arc gauge (visual only)

**What it is.** The killer's "strike meter" was redesigned from a full progress
ring into an **~80% open arc gauge made of discrete notches** — one notch per
charge toward a kill. Filled notches glow; when the arc completes it pulses
**Ready** with the blade icon, otherwise it reads `{filled}/{total} · N to go`.

**Where it lives.** `sd-cold.jsx`: `StrikeMeter` (new component), used in
`KillerScreen`'s hero card (now a compact horizontal layout).

**Backend wiring needed.** **None.** It renders entirely from the existing
killer fields already in `PlayerView`:
- `filled  = you.killer.meterPoints`
- `total   = you.killer.killCost`  ← number of notches drawn
- `ready   = you.killer.canKillNow`

No API change — this is a pure presentation swap. The only thing to confirm:
`killCost` should be a sensible notch count to render (the prototype uses 10).

---

## 5. Dynamic vote banner + animated result screen

**What it is.** Two linked additions:

**(a) Dynamic home banner** (`VoteBanner`, `sd-cozy.jsx`). The home screen's vote
card now tracks the vote lifecycle:
- `vote.open` → red "A vote is open" banner → opens the `VoteScreen`.
- `vote.resolved` → "The vote has landed · someone is out" banner → opens the new
  result screen.
- neither → nothing rendered.

**(b) Animated result screen** (`VoteResultScreen`, `sd-cozy.jsx`). A staged
reveal: an **anonymous** faceless figure pulses while "tallying," takes a red
slash strike (`sd-jolt` + `sd-slash` keyframes in `theme.css`), then fades to a
grayscale dashed-outline "empty chair." Copy: "Someone is out … who it was — and
what they were — stays unspoken, for now." Shows the living count dropping by one.
**By design it never names the eliminated player or reveals a role.**

**Where it lives.** `sd-cozy.jsx`: `VoteBanner`, `VoteResultScreen`.
`sd-app.jsx`: new `phase === "result"` and a pushed `"result"` route (the home
banner pushes `VoteResultScreen` with a "Home" back bar; selecting the `result`
phase auto-opens it). `theme.css`: `@keyframes sd-slash`, `@keyframes sd-jolt`.
`sd-ui.jsx`: new `Icon.person`.

**Currently mocked.** `data.js` `buildView` adds a `result` phase that sets:
```js
vote = { open:false, resolved:true, index:0,
         closesAtMinute: now-3, youVoted:true, result:{ at: now-3 } }
```
The elimination is **not** reflected in the roster in this phase (all players stay
listed) — the result screen computes `living - 1` for its count, intentionally
keeping the "who" vague.

**Backend wiring needed.**
- **Vote state machine:** `PlayerView.vote` should progress
  `open: true` → (after close) `resolved: true` with a `result: { at }` marker.
  Drive the banner and the `result` view off these flags.
- **Deliberately anonymous result:** the resolved payload must **not** carry the
  eliminated player's id, name, or role. This honors the existing privacy rules
  ("vague, delayed, never forensic"). The result screen only needs to know *that*
  someone is out and the new living total.
- **The "who" is revealed later, separately:** consistent with v1, the eliminated
  player surfaces through the normal channels — the roster flipping a name to
  `alive: false` and a feed `death`/`voteResolved` event — on the backend's own
  (delayed) schedule, **not** in the dramatic result reveal. Don't shortcut this
  by naming them on the result screen.
- `livingCount` decrements by one when the vote resolves (already a plain total,
  never split by team).

---

## State management (new client state)

| Component | State | Source today | Should come from |
|---|---|---|---|
| `TasksScreen` | `archive[]`, `done{}` | local React | server completed-tasks read model + optimistic update |
| `TasksScreen` | `proofTask`, `archiveOpen` | local React | local UI only — keep |
| `ProofSheet` | `answer` | local React | local UI only — submit via `POST /tasks/complete` |
| `TutorialScreen` | `i` (slide index) | local React | local UI only; gate first-run on a "seen" flag |
| `VoteScreen` | `cast`, `picked`, `left` | local + `vote.youVoted` | `vote.youVoted` + new `vote.yourVote`; `left` from `closesAtMinute` |
| `VoteResultScreen` | `stage` (0→2 animation) | local timers | local UI only; mount when `vote.resolved` |

## Design tokens
Defined in `theme.css` under `.sd-root[data-theme="light"|"dark"]`. Key ones used
by the new features: `--bad` (vote/kill red), `--good`, `--accent`, `--ink` /
`--ink-soft` / `--ink-faint`, `--surface` / `--surface-2`, `--line` /
`--line-strong`, `--shadow` / `--shadow-sm`. Fonts: `--font-display` (Geist),
`--font-mono` (Geist Mono). New keyframes: `sd-slash`, `sd-jolt` (plus existing
`sd-ping`, `sd-breathe`, `sd-rise`, `sd-fade`).

## Assets
No raster assets. All icons are inline stroke SVGs in `sd-ui.jsx`'s `Icon` map
(new since v1: `pencil`, `box`, `clock`, `lock`, `person`). Avatars are
initial-letter circles tinted by `avatarColor(id)`.

## Files in this bundle
- `Sundown.html` — entry; script load order.
- `theme.css` — design tokens, type, animation keyframes.
- `data.js` — mock fixtures + `buildView`; shows the new `proof` field and
  `result` vote shape. **This is the file whose mock seams map to your API.**
- `sd-ui.jsx` — shared primitives, icons, mood/feed/roster, `StrikeMeter` lives in
  cold (below).
- `sd-cozy.jsx` — Join, Lobby, Home, **Tasks (proof + archive)**, **Vote (fleshed
  confirmation)**, **VoteBanner**, **VoteResultScreen**, **TutorialScreen**.
- `sd-cold.jsx` — Killer (**StrikeMeter arc gauge**), Cop, Medic, Ghost, Game over.
- `sd-app.jsx` — router/theme/tweaks; phases incl. new `tutorial` and `result`.
- `frames/ios-frame.jsx`, `tweaks-panel.jsx` — prototype scaffolds (not shippable).

## How to preview the new states
Open `Sundown.html` and use the Tweaks panel (Phase / Role / Mood), or query params:
- `?phase=tutorial` — the primer
- `?phase=active&role=killer` → open tools → the arc-gauge strike meter
- `?phase=vote` → cast a vote → the fleshed confirmation
- `?phase=result` — the animated anonymous elimination (and back to Home for the
  resolved banner)
- Proof tasks: `?phase=active`, open **Tasks**, tap a "logs proof" row.
