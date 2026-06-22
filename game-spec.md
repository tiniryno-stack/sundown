# All-Day Social Deduction Game — Design Spec (v3)

> **Status:** Consolidated source of truth for handoff to Claude Code. Supersedes v1/v2.
> Numbers are tuned for a **7-player** game and expressed as ratios so they scale.
> Tags: **[CORE]** = decided. **[OPTIONAL]** = liked, not locked. **[TBD]** = open.

---

## 1. Concept

A hidden-role social deduction game (Mafia / *Traitors* / *Million Dollar Secret* lineage) that
runs in the **background of a full day** — e.g. a bachelor-party trip. A companion app is the
automated host, so **nobody sits out to run it**. The app manages state, task completion,
progress meters, votes, eliminations, the moving-killer system, and deliberately-vague push
notifications. **All player-to-player communication happens outside the app** (group texts,
whispering, in person). The app never handles messaging.

Design goal: a **slow burn** where suspicion simmers all day and stakes resolve at natural
breakpoints (meal-time votes), not in one room arguing it out.

---

## 2. Core Design Principles

Only **two dials matter**, and everything derives from them:

1. **Balance** — neither team steamrolls under good play (~50/50 win probability).
2. **Day-length pacing** — the game breathes across the day; no grinding every five minutes, no
   team finishing by noon.

Because both must survive different group sizes and day lengths, the design is built on **ratios**,
not fixed numbers. Three invariants are held; the rest is computed:

- **A — Killer pressure:** killers ≈ **28% of players** (`K = round(0.28 × N)`).
- **B — Per-person cadence:** healthy play costs each player **~1 task / hour** (the "not egregious"
  guarantee).
- **C — Neglect window:** if town ignores the bar, it empties in **~25% of the game length**.

---

## 3. Two Formats by Player Count [CORE]

Game length is driven almost entirely by **player count** — with only ~3–5 eliminations needed to end
a round, a small game resolves faster than a large one. Two levers stretch it: the **moving-killer
system** (§10), which keeps a 7-player round alive into the **early evening (median ~5:30–6:30 PM)**,
and **player count** itself (median climbs toward ~7 PM at 15+). So:

- **7 players → "Seasons" (1–2 rounds).** A single round now fills most of the day (~9 AM → early
  evening) thanks to §10. Run a **second round** after dinner if you want to play into the night —
  fresh re-shuffled roles, each round climaxing at a meal. (Without §10 a 7-player game would resolve
  by ~mid-afternoon, which is why that system exists.)
- **~22 players → the all-day single marathon.** At this size a single continuous game naturally
  fills the day. Killers = `round(0.28 × 22) = 6`.

Same ruleset for both; **headcount picks the format.** Scaling formulas in §16.

---

## 4. Roles & Teams [CORE]

| Team | Who | Knows teammates? | Job |
|---|---|---|---|
| **Killers** (informed minority) | ~28% of players | **No — discovered in play** | Grind tasks → kill; survive / reach parity |
| **Townspeople** (uninformed majority) | the rest | n/a | Keep the bar alive; deduce & vote out killers |

Killers do **not** know each other at the start — they infer teammates over the day (see §9). Some
townspeople may be **"powered" [OPTIONAL]** (extra abilities); the rest are plain.

---

## 5. Win Conditions [CORE]

**Killers win if EITHER:** reach **parity** (living killers ≥ living town) **OR** collapse the town
bar to 0% (rare alternate, ~3–4% of games).

**Townspeople win if:** **all killers are eliminated.** This is possible *because the moving-killer
system is finite* (§10) — a killer caught while the team has no "move charge" banked is gone for good.

If the game reaches the evening finale with killers still alive and below parity, killers win
(they survived undetected).

---

## 6. Timeline & Votes [CORE]

- **Start ~9 AM.** Final vote at the evening climax (~8–10 PM depending on format).
- **Scheduled votes: 4–5**, spread across the day at natural gathering points (≈ 11:30, 2:30,
  5:30, 8:00, 10:00). *Two votes is far too few — it makes the game ~99% killer-favored; this was the
  single biggest balance error in v1.* Vote count is town's strongest lever.
- Each vote: most-voted player is eliminated; the app resolves (death/switch, unnamed — §9).
- **No emergency vote (v1).** Five scheduled votes give town enough catch-attempts; the ad-hoc
  emergency was cut for simplicity. (Revisit only if play shows town needs a safety valve.)

---

## 7. The Task System [CORE]

### 7.1 Why townspeople do tasks — **camouflage**
The load-bearing reason: killing is gated behind tasks, so killers must grind. If only killers did
tasks, doing a task would instantly out you. Townspeople task to **flood the field so killers hide in
the crowd** — at the behavior level (anyone doing a task could be either team) and the
**notification level** (every task fires a vague ping; town tasks are the noise that masks the
killers' signal). **Doing a task never clears you** — killers do them too — so being loud about tasks
is fine but proves nothing (and theatrical over-narration is mildly suspicious). Deduction lives in
the *kills and behavior around them*, never in who's tasking.

### 7.2 Where tasks come from — AI-generated + a few personal (NO NFC)
NFC tags are **dropped** — too much setup. Instead:
- The **AI host** (§15) **generates the bulk of the deck**: general, **portable** (nothing tied to
  the specific venue — "take a selfie with someone," not "scan the kitchen tag"), themed toward
  **drinking and bringing people together**, each tagged with a **point weight** (§7.5) so the deck's
  total value matches the balance budget. The AI **feasibility-checks** (no task needing a prop you
  don't have) and avoids near-duplicates.
- Each player also **submits a few personal tasks** (inside jokes, group lore). The AI validates and
  de-dupes these with a vague rejection so it doesn't leak the deck.

### 7.3 Completion (honor system), attribution, repeatability
- **No scanning.** You do the task and **tap "done."** Honor system — and faking a task is *fine*,
  even in-character: bluffing a task for cover is exactly what a killer should do.
- **Attribution still works.** The app assigned the task and knows *who* tapped done and *their role*,
  so separate progress (§8) is still fully enforceable — **internal only, never displayed.**
- **Tasks are repeatable** with a short **per-task per-player cooldown** (~30–45 min), so the points a
  full game needs come from a modest deck without spamming one prompt.

### 7.4 Task flavors
- **Open social / drinking tasks** (the bulk): done loudly, no secrecy — the party fuel. They bring
  people together and feed progress; being loud is fine (doing a task never clears you).
- **Covert "gotcha" tasks** (*Don't Get Got*–style): trick someone without them realizing; if a
  player catches you and calls it, you **forfeit** that task. These add behavioral camouflage —
  *every* player has a reason to occasionally scheme, so a killer plotting a kill looks like a
  townsperson pulling a prank.

### 7.5 Task Taxonomy & Point Economy
Everything runs on **points**. One point = **+4% to the town bar** (town completions) **or** **+1
toward the killers' meter** (killer completions → kills/moves, §9–§10). The deck mixes tiers so the
**average task ≈ 2 points**, reproducing the balanced economy in §16.

| Tier | Points | Effort / drinking intensity | Example prompts |
|---|---|---|---|
| **Light** | 1 | a sip; a quick social beat | take a selfie with someone; get a cheers going |
| **Standard** | 2 | a shot; the workhorse | take a shot; start a toast; *covert:* get someone to refill your drink |
| **Heavy** | 3 | a shotgun/double; a real lift | shotgun a beer; *covert:* invent a fake rule and get someone to follow it |
| **Group** | 4 (+investigation credit) | 2+ people coordinating | get a group round of shots going; organize a group photo |

Economy constants (in points):
- **Town bar:** +4% per point; decay 0.5%/min; cap 100%.
- **`kill_cost` = 10 points** (≈ 5 average tasks); **`move_cost` = 10 points**; **`max_moves` = 2** (§10).
- **Investigation:** ~**12 points of *group* tasks** → 1 investigation (the Cop's fuel, §11).
- A killer's completions advance their meter by the task's point value (a Heavy = +3).

**Deck mix target** (keeps avg ≈ 2 pts): ~35% Light, ~40% Standard, ~20% Heavy, plus Group tasks
always available. **Intensity tiers + non-alcoholic swaps** are built into every drinking prompt so
nobody is forced to chug and non-drinkers can play.

> Weights are *flavor distribution*; balance only cares about **total points/hour**. Once the real
> deck mix is set, re-run the sim (§16) to confirm throughput still lands on the balanced economy.

---

## 8. Progress Systems — Separate [CORE]

Two independent meters; they do **not** cross-contaminate (the app's attribution enforces this).

- **Town Progress Bar** (shared, **town completions only**): 0–100%, decays over time. Hitting 0% =
  collapse = killer win. It is **not** a town win to fill it (would end the game early); it's a
  survival/fail-state that forces engagement and gives camouflage its stakes.
- **Killer Kill-Meter** (the killer team's task economy, §9–§10): killer completions feed it; killer
  completions do **not** prop up the town bar.

*Consequence:* as townspeople die, fewer hands feed the bar, so collapse becomes a real late-game
threat — a natural escalating squeeze.

---

## 9. Killer Mechanics [CORE]

- **Hidden teammates.** Killers infer each other over the day, mainly via the anonymous suggestion
  channel below.
- **Kills cost points.** **`kill_cost = 10 points` → 1 kill** (≈ 5 average tasks; the balance
  throttle — no cooldown; the task requirement *is* the rate limiter). Tunable 8–12 by group skill.
- **Use-it-or-lose-it.** An unlocked kill must be used within ~20–30 min or it expires (prevents
  observable "just got the power" tells).
- **Individual kills.** Any killer may kill solo (requiring agreement would expose the team).
- **Anonymous suggestions (fresh each time, no history).** A killer activating a kill sees
  **anonymous** target suggestions from other unlocked killers — current ones only, no running log —
  visible only to the activating killer (so with 3+ killers they still don't learn each other). You
  can't suggest yourself; killers piece teammates together through behavior, not a paper trail.
- **Delayed, anonymous resolution.** Kills resolve on a delay and are announced generically as
  **"a death / a switch"** — never naming the victim. Killers know who they removed; town only sees
  the count drop.

---

## 10. The Moving-Killer System [CORE] — *the day-length + replayability engine*

The killer role is **mobile but finite** — it can transfer instead of dying, but only if the killers
have paid for the privilege in tasks. This restores the elimination win **and** stretches the game
into the evening (both confirmed in simulation).

- **Move charge.** The killer team can spend **`move_cost = 10 points`** to bank a **move charge**,
  capped at **`max_moves = 2` per game**. A charge is *insurance*. Banking a charge is a kill the team
  didn't get — the core tension: **offense vs resilience.**
- **On a catch (town correctly votes out a killer):**
  - If the team **has a charge banked AND a ghost exists** → consume the charge and **resurrect a
    ghost as the new killer** (the caught killer becomes a ghost). This is **count-neutral** (no shift
    toward parity) and is the truest "no one really gets out." The new killer starts fresh (reset
    meter, doesn't know teammates).
  - If **no charge or no ghost** → the killer is **permanently removed** (`K` drops). Town progresses
    toward winning.
- **Emergent dynamics (designed-in by the rule, not bolted on):**
  - Killers must split tasks between **killing and insurance**.
  - Town wants to **catch a killer when they're broke** (no charge), and **early** (before any ghost
    exists to resurrect into) — rewarding fast, sharp deduction.
- **[OPTIONAL] variant:** a move could instead **recruit a living townsperson** (Traitors-style "join
  us") — spicier (converts a known-innocent), but it shifts counts toward parity, so use sparingly.

---

## 11. Townsperson Mechanics [CORE / OPTIONAL]

- **Solo tasks** = camouflage + keep the bar up.
- **Group tasks (2+ townsfolk) [CORE]** = harder, give a **bonus** to the bar, **bank toward an
  investigation**, and double as **alibi/witness** moments (you're physically together reading each
  other).
- **Powered roles [CORE — needs sim]:** a subset of town hold classic roles:
  - **Cop / Investigator:** spends ~**12 points of group tasks** (§7.5) on an **investigation** —
    learn one player's alignment (bounded, limited uses). Town's offensive deduction power.
  - **Medic / Protector:** can **shield one player from the next kill** per charge (earned via tasks).
  - *Asymmetry check:* consider a killer counter-role (e.g., one who can block an investigation) so
    the Cop isn't strictly dominant. Reliable town power **shifts balance toward town**, so these must
    be folded into the sim before locking numbers.
- **Standalone shields [DEFERRED — post-v1]:** a separate secret one-time immunity item; shelved for
  v1 since the Medic already covers protection.

---

## 12. Ghost / Afterlife System [CORE / OPTIONAL]

Eliminated players stay physically present — the game **accounts for** their real-world influence
rather than pretending they're gone.

- **Silent flip [CORE]:** an eliminated townsperson flips to the killers' side (new goal: killers
  win); never announced — the public only hears "a death / a switch."
- **No ghost voting (v1).** Ghosts don't vote — but they're far from "out": they're the
  **resurrection pool** for the moving-killer system (§10), they stay socially present, and they keep
  filling the accuracy ballot below.
- **Accuracy ballot [OPTIONAL, recommended]:** each phase, players privately log who they think the
  killers are; ghosts keep filling it for a **ghost side-prize**. Rewards real deduction over
  bandwagoning and keeps the dead engaged. (Borrowed from *The Mole*'s quiz elimination.)
- **Soft-death / "jail" [OPTIONAL]:** the first hit can *wound/bench* you for one phase rather than
  kill, reserving true death for later — keeps people in longer. (Borrowed from *The Devil's Plan*.)
- **One-time "haunt" [OPTIONAL]:** a ghost may drop a single anonymous nudge/clue.
- **Resurrection:** ghosts are the pool the moving-killer system (§10) resurrects from.

---

## 13. Optional Show-Inspired Layers [DEFERRED — post-v1]

*Shelved for the first build to keep scope tight; revisit after a playtest.*

- **Prize pot** (*Mole / Traitors / Devil's Plan*): a visible shared pot — a real bachelor-party
  buy-in — that tasks build and sabotage/failed votes drain; the killers' collapse win becomes "drain
  the pot." Strongest real-world motivator.
- **Killer covert missions** (*Million Dollar Secret*): secret app-assigned side-objectives granting
  advantages (e.g. "get someone else accused this round") — adds texture beyond grind-and-kill.
- **Mobile-role escape** (*MDS*): a cornered killer could go dormant / pass the role to survive — a
  v2 spice on top of §10.

---

## 14. Notifications & Anti-Metagaming [CORE]

- **All state updates are delayed** (random offset ~5 min): tasks, bar changes, kills, **and any
  Game-Director adjustments (§15).** The app must never be usable as a real-time verifier.
- Notifications are **vague and riddly** ("something's afoot" / "a move was made") — they create
  alertness and paranoia, not a forensic location/timestamp trail.

---

## 15. The AI Game Director (Anthropic API) [CORE — new]

A Claude agent embedded in the app acts as host **and** as a dynamic balancer / pacing director —
think *Left 4 Dead*'s "AI Director," adapted for social deduction. It keeps the game tense, fair, and
well-paced **without cheating, leaking, or feeling puppeteered.**

### 15.1 Hard constraints (non-negotiable)
1. **Never leak role/state information.** The Director knows everything (it's the host) but only ever
   *acts*; it never reveals who is a killer, who flipped, the bar's true value, etc.
2. **Adjust subtly and on the standard delay** (§14) so players can't reverse-engineer adjustments to
   infer state ("decay just eased → we must be losing").
3. **Stay within guardrails.** All adjustments are bounded by the ratio model; the Director nudges,
   it does not hand wins.
4. **Never touch the deduction itself.** It does not alter vote outcomes, choose kill targets, or
   reassign roles. Players' choices are sacred.

### 15.2 Two tiers of involvement
- **Pre-round / between-round (structural):** sets structural params from player count via the ratio
  model (§16), and **adapts from prior rounds** in a Seasons format — e.g. if killers steamrolled,
  raise `move_cost` to 6–7 or drop `max_moves` to 1 for the next round; if town crushed it, reverse.
- **In-round (soft levers only):** monitors live metrics and makes small nudges.

### 15.3 Levers the Director MAY nudge in-round (bounded)
- **Decay rate** (±, within ~±30% of baseline) — ease if town is collapsing too early; tighten if the
  bar is trivially safe.
- **Task value** (within bounds) — to keep the bar a live concern.
- **Next-kill timing window / which suggested kill resolves first.**
- **When to surface the next move-charge opportunity.**
- **Timing of the next scheduled vote** (pull earlier/later within a small window) to fix dragging or
  overheating pacing.
- **Optional events from a pre-approved deck** — a challenge granting a shield, a bonus investigation,
  a notification flurry to shake a stalemate.
- **Notification flavor and cadence.**

### 15.4 Levers it may NOT change mid-round
`kill_cost`, `move_cost`, `max_moves`, killer count, win conditions. These are structural; changing
them mid-game would feel unfair. They are set at round start only.

### 15.5 Objective function
Keep **estimated win probability near 50/50** and **resolution pacing on track for the target
evening climax**, while **maximizing tension/engagement** and **preserving fairness + secrecy**. The
ratio model defines "on track"; the Director corrects drift, it doesn't override the model.

### 15.6 Implementation (for Claude Code)
- The app sends the Director a **structured state snapshot** on a cadence (~every 10–15 min and on key
  events: a kill, a vote, a collapse-threshold cross), plus the **guardrails** and a **menu of allowed
  levers with bounded ranges**, and asks for adjustments as **strict JSON** (no prose).
- Snapshot includes (Director-only, never surfaced): living counts by team, bar %, kill pace, recent
  vote accuracy, charges banked, time-of-day vs target finale, recent engagement (tasks/min).
- Suggested model: **`claude-sonnet-4-6`** for the reasoning director; **`claude-haiku-4-5`** for
  cheap high-frequency polls. (App holds the API key; players never see Director reasoning.)
- The app **applies adjustments on the standard delay** and logs them for post-game review/tuning —
  the same logs feed the simulator (§16) to refine the model.
- Note: the Director also performs the host duties from §7.2 (task generation + validation/dedup), §6
  (running votes), and §9/§14 (resolving eliminations, firing vague notifications).

---

## 16. Balance Model

### 16.1 Current 7-player config (from simulation)
| Variable | Value | Notes |
|---|---|---|
| Players / Killers | 7 / 2 | 28% |
| Scheduled votes | **5** (≈11:30/2:30/5:30/8/10) | town's biggest lever |
| Emergency vote | **none (v1)** | 5 scheduled votes is enough |
| Town bar / decay | 100% / 0.5%/min (−30%/hr) | empties in ~200 min if ignored |
| Point value | **+4% bar per point**; avg task ≈ 2 pts | i.e. avg task ≈ +8% (§7.5) |
| `kill_cost` | **10 points** (≈ 5 tasks) | throttle; tunable 8–12 |
| `move_cost` / `max_moves` | **10 points / 2** | the moving-killer dials |
| Cooldown | **none** | throttle is task-based |
| Cadence | ~1 task / hr / player (~2 pts/hr) | double-edged: too-hard tasks starve the bar |

> **Not yet in the sim:** Cop/Medic roles, investigations, and the weighted deck mix. The 51–53%
> figure below covers the **core kill/vote/move loop only** — re-run with the roles + real deck before
> locking final numbers.

**Result:** ~51–53% killers at ~60% town deduction skill; **median resolution ~5:30–6:30 PM**
(vs the unfixable ~4 PM without the moving-killer system). Balance is **skill-sensitive** (≈68%
killers at 50% skill → coin-flip at 60%), which rewards a switched-on group. `move_cost` and
`max_moves` are the live tuning knobs: if killers steamroll, raise `move_cost` to 6–7 or set
`max_moves = 1`.

> **Inherent tension to respect:** moves make the game last longer but favor killers; votes rebalance
> but resolve faster. There is no free lunch — the config above is the chosen compromise. The Game
> Director (§15) exists partly to manage this drift live.

### 16.2 Scaling formulas (any N players, any day length D minutes)
```
Killers:        K = round(0.28 × N)           # 7→2, 11→3, 15→4, 22→6
Townspeople:    T = N − K
Decay (%/min):  d = 100 / (0.25 × D)          # ties pacing to chosen day length
Bar gain:       ~+4% per point at N=7; scale ∝ 1/T   # keeps ~1 task/person/hr at any size
kill_cost:      10 points (≈5 tasks; tune 8–12 by skill)
move_cost:      10 points ; max_moves: 2      # tune for length vs balance
Scheduled votes: scale with N and day length (≥4; ~5 for a long 7-player round)
```
Rounding note: `0.28 × N` rounds badly at some N (e.g. N=9→3 killers = 33% = killer-favored).
Prefer rounding **down** toward ~25% when in doubt to keep town competitive.

---

## 17. Open Questions / TBD

**Closed since v2:** NFC dropped (honor-system tap-done); task rubric defined (§7.4–7.5); emergency
vote cut; ghost voting cut; killer suggestions = fresh / no history; prize pot + soft-death/jail +
standalone shields deferred to post-v1.

**Still open:**
1. **Cop / Medic (+ optional killer counter-role) — re-sim required.** Reliable town power shifts
   balance; fold the roles + weighted deck into the simulator and re-tune before locking numbers.
2. **Investigation** exact effect (alignment read? near-a-death check?) and uses-per-game.
3. **Director event deck** contents + per-lever adjustment ranges (needs playtest data).
4. **Engagement assumption** — numbers assume ~1 task/hr sustained; lumpy real play (meals, travel,
   drinking) means fewer points/hr. **Only a real test round resolves this** — observe actual
   throughput, then tune `decay`. Highest-leverage open item.

---

## 18. Build Handoff — Instructions for Claude Code [CORE]

**Mode: autonomous background build.** Go as far as you can without stopping to ask questions (the
human is away). Where a decision is genuinely required and not specified, choose the **documented
default**, leave a `// TODO(open-question: …)` in code, and record it in the progress report.
**Do NOT invent answers to the §17 open questions** — scaffold them behind clean interfaces/flags so
they can be filled in later.

**Scope this pass:**
- ✅ Build the **backend**: core game engine, simulation harness, Cop/Medic roles, the AI Director and
  task-deck modules (Anthropic API), the service layer, and a documented API contract.
- ⛔ **Build NO frontend / UI.** That is done separately in Claude Design. Stop at a clean, documented
  **`API.md`** the UI can later consume.

**Tech (overridable with good reason, but don't dither):** TypeScript + Node, one repo, Vitest for
tests, Anthropic TS SDK for the Director + deck generator (behind an interface, with a deterministic
mock so everything builds/tests without an API key). Make small, frequent git commits.

**Build order — do as much as time allows, in order:**
1. **Core engine** (pure, framework-agnostic, **seedable**, fully unit-tested): models (Game, Round,
   Player, Role, Ghost); the **point economy** (§7.5); **town bar** + decay; **kill-meter + move
   charges** (§9–§10); **votes** (§6); **win conditions** (§5); **moving-killer / resurrection** (§10);
   ghost + accuracy ballot (§12). Deterministic. This is the heart — correct and tested above all.
2. **Simulation harness** that runs the real engine headless N times and reports win-rate, median
   end-time, and parity/collapse split — reproducing §16's balanced numbers as a **regression test**.
3. **Cop/Medic roles** (§11) behind config flags; run the harness to report how they shift balance
   (leave final tuning as an open item — §17.1).
4. **AI Director** (§15): the snapshot → bounded-JSON-adjustment loop, with the **four hard constraints
   enforced in code** (never leak, delayed application, guardrail bounds, never touch
   votes/targets/roles/structural params). Real calls behind an interface + mock for tests.
5. **Task-deck generator** (§7.2/§7.5): Anthropic-backed, producing a weighted, portable,
   drinking/social-themed deck that hits the target total point value; feasibility + dedup; mock.
6. **Service layer + `API.md`**: endpoints for lobby/join, get-state, complete-task, cast-vote, killer
   actions (kill / bank-move / suggest), round lifecycle. Document every endpoint + payload.
7. **Persistence**: simple and swappable (in-memory + a file/SQLite adapter is fine).

**Quality bar:** unit tests for the engine and every win condition; harness runs; `README.md` with
setup/run/test commands. Enforce the spec invariants in code: separate progress (never cross-feed the
bar and the kill-meter); attribution is internal-only, never exposed; all state changes + Director
adjustments apply on a delay.

**REQUIRED at the end — write `PROGRESS.md`** (keep it skimmable; it's the first thing the human reads):
- **What's built** per module + **how to run** it (exact commands).
- **Test + harness results** (paste the balance numbers, including Cop/Medic impact).
- **Decisions/assumptions** made, each tagged to a spec section.
- **What's left**: the §17 open questions (untouched, as intended) + anything scaffolded-but-unfinished,
  with suggested next steps.
- A one-paragraph **"start here next time"** summary.

If something is genuinely blocking, don't wait — note it in `PROGRESS.md` and move to the next module.
Maximize the amount of correct, tested groundwork laid.
