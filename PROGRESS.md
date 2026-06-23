# PROGRESS — Backend Build Handoff

**Status: all 7 build-order items (§18) are code-complete, typechecked, and tested.**
80 tests pass; the project builds and runs end-to-end **with no API key**. No
frontend was built (out of scope, §18) — the contract is in [`API.md`](API.md).

> **Start here next time:** see the [last section](#start-here-next-time).

---

## 1. What's built (per module) + how to run it

| # (§18) | Module | Path | Run / verify |
|---|---|---|---|
| 1 | Core engine | `src/engine/` | `npm test` (engine + rng + config + economy tests) |
| 2 | Simulation harness | `src/sim/` | `npm run sim` · regression in `src/sim/simulate.test.ts` |
| 3 | Cop/Medic roles | `src/engine/*` (flags) + sim | `npm run sim` (sweeps each role config) |
| 4 | AI Director | `src/director/` | `npm test src/director` |
| 5 | Task-deck generator | `src/deck/` | `npm run deck:generate` · `npm test src/deck` |
| 6 | Service + API contract | `src/service/` + `API.md` | `npm test src/service` |
| 7 | Persistence | `src/persistence/` | `npm test src/persistence` |

Top-level commands: `npm install`, `npm test`, `npm run build`, `npm run typecheck`,
`npm run sim`, `npm run deck:generate`. (Full list in [README.md](README.md).)

**Invariants enforced in code** (with tests):
- **Separate progress (§8):** `completeTask` routes by team; town completions only
  touch the bar, killer completions only touch that killer's meter. (`engine.test.ts`)
- **Attribution internal-only (§7.3/§15.1):** `internalLog` is attributed; `publicEvents`
  are vague and identity-free; the service's `PlayerView` never carries other players'
  roles/teams. (`engine.test.ts`, `gameService.test.ts`)
- **Delayed application (§14):** every state change + Director nudge is scheduled on a
  delay; nothing applies inline. (`engine.test.ts`, `director.test.ts`)

---

## 2. Test + harness results

### Test suite
`npm test` → **80 passed** across 9 files (engine 22, rng 6, config 4, economy 3,
sim 8, director 9, deck 7, service 14, persistence 4). `npm run build` and
`npm run typecheck` are clean.

### Balance harness (§16) — core kill/vote/move loop, N=7, 4000 games/cell

| Town skill | Killer win % | Median resolution | parity / collapse / townElim / finale |
|---|---|---|---|
| 0.50 | **53.7%** | ~5:59 PM | 24% / 10% / 46% / 20% |
| 0.60 | **42.2%** | ~5:36 PM | 16% / 8% / 58% / 18% |
| 0.70 | **30.7%** | ~5:35 PM | 10% / 6% / 69% / 14% |

- **Median resolution lands in §16's 5:30–6:30 PM window** — the moving-killer system
  (§10) is doing its job (stretching a 7-player round from the unfixable ~4 PM into the
  early evening). All four win reasons occur; collapse is the rare alternate (§5).
- **Skill-sensitive**, as §16 requires (more switched-on town → fewer killer wins).
- **Marathon format (N=22):** with the vote-count fix below, killers win 54.8% @skill0.5
  and 13.3% @skill0.7 — resolves in the evening, skill-sensitive, town can win.

### Cop/Medic balance impact (§11, build item 3), N=7, skill 0.6, 1500 games

| Config | Killer win % |
|---|---|
| Core (no roles) | 41.9% |
| + Cop (default fuel) | 42.9% |
| + Cop (well-fueled) | 42.1% |
| + Medic (default fuel) | 43.3% |
| + Medic (well-fueled) | 41.6% |

**Finding:** in the current harness the powered roles shift balance **< ~1 pt** (within
Monte-Carlo noise). This is a *modeling* result, not a claim about the real game: the
harness abstracts town deduction into a single `skill` knob, so a role that works
*through* deduction (the Cop) is largely **already priced in**, and the Medic rarely
fires at baseline fuel. Properly evaluating these roles needs either a per-voter
information model or a real playtest — which is exactly why **§17.1** says to fold the
roles + weighted deck into the simulator and re-tune before locking numbers. **Left as an
open item, as intended.**

---

## 3. Decisions & assumptions (tagged to spec)

| Decision | Why | Spec |
|---|---|---|
| Killer kill-meter is **per-killer**; move charges are **team-level** | Reconciles "unlocked killers" / "individual kills" (per-killer) with "the team can bank a move charge" (team) | §8–§10 |
| `activateKill` is atomic spend-and-schedule (no floating "unlocked kill" object) | Models use-it-or-lose-it without an observable "just got the power" tell | §9 |
| Killer-count rounding floors only when round() would exceed **~30%** | Hits all §16.2 anchors (7→2, 11→3, 15→4, 22→6) and the special 9→2 | §16.2 |
| Scheduled vote **count scales with N**: `max(4, 2K+1)` (7→5, 22→13) | §16.2 says votes scale with N; without this, N=22 was 100% killer (6 killers, 5 votes) | §16.2, §6 |
| Vote ties broken by **seeded random** among the tied (configurable to `noElimination`) | Spec says "most-voted is eliminated"; needed a deterministic tie rule | §6 |
| Eliminated townsperson **silently flips to the killer side** as a ghost (resurrection pool) | Direct from spec; ghosts are the resurrection pool | §12, §10 |
| Resurrection prefers an already-flipped ghost, else any ghost (seeded) | Thematic ("rooting for killers") + deterministic | §10 |
| Public bar is **banded** (healthy/strained/critical), never the % | Anti-metagaming; Director hides true bar value | §14, §15.1 |
| Sim's town deduction = a single `skill` knob; **default killer `insuranceBias` 0.85** | §16 sweeps "deduction skill"; good killers use the §10 resilience system. Lands the coin-flip near skill ~0.52–0.55 | §16, §2 |
| Director applied levers = **decay + task value** only | Cleanly bounded + testable; other levers scaffolded (below) | §15.3 |
| Task cooldown default **35 min**; deck avg ~2 pts via the §7.5 mix | Within the spec's 30–45 min; deck QA asserts the average | §7.3, §7.5 |
| Between-round adaptation: pricier move charges if killers steamrolled, ease if town did | §15.2 structural adaptation; **rule is a scaffold, tuning is open** | §15.2 |

### Known calibration divergence from §16 (called out honestly)
§16 reports "≈68% killers at 50% skill → coin-flip at 60%." This model is somewhat more
town-favorable: ~54% killers at skill 0.5, coin-flip near skill ~0.52–0.55. The **median
resolution time matches §16 precisely**, but the absolute killer-win level sits ~0.05–0.08
in skill-space from §16's figure. Root cause: §16's original simulator is not specified in
the spec, so the harness reconstructs a principled model rather than reproducing an exact
one; the abstracted, always-concentrating vote model is a bit kinder to town than a messy
real ballot would be. Per §16's own "no free lunch" note (moves favor killers but lengthen
the game; votes rebalance but resolve faster) and **§17.4** (real throughput is unknown
until a playtest), the absolute number should be re-tuned against real data. The regression
test asserts the *shape* (coin-flip band, skill-monotonicity, evening median, all four win
reasons) rather than a brittle exact value.

---

## 4. What's left

### §17 open questions — deliberately untouched, scaffolded behind clean interfaces/flags

1. **§17.1 Cop/Medic (+ killer counter-role) tuning.** Roles exist behind config flags
   (`RoleFlags`), with placeholder costs (`investigationCost` 12, `medicShieldCost` 12,
   caps 2) marked `TODO(open-question)`. Counter-role is a `Player.counterRole` flag with a
   scaffolded investigation-block path. **Next:** build a richer deduction model (or run a
   playtest), then set the role numbers + re-run the harness.
2. **§17.2 Investigation effect & uses-per-game.** Default = an alignment read, capped by
   `maxInvestigations`, flagged `TODO`. **Next:** decide alignment-read vs near-a-death
   check; set uses.
3. **§17.3 Director event deck + per-lever ranges.** `SCAFFOLDED_LEVER_KEYS`
   (`nextVoteTimingShiftMin`, `surfaceMoveOpportunity`, `eventCard`, `notificationCadence`)
   are recognized but **not applied** — their ranges/contents need playtest data. **Next:**
   define the event-card deck + bounds, then wire them into `validatePatch`/the engine.
4. **§17.4 Engagement assumption (highest-leverage).** The whole economy assumes ~1 task/hr/
   player; the sim exposes this as `engagement` (default 1.0). **Next:** observe real
   throughput in a test round, then tune `decay` (and re-run the harness).

### Scaffolded-but-unfinished (mine to flag, not §17)
- **Director between-round adaptation** (`adaptConfigFromPriorRound`) — a working but simple
  heuristic; full adaptive tuning is open.
- **Director levers beyond decay/task-value** — see §17.3 above.
- **SQLite persistence** — interface is ready (`Store<T>`); only InMemory + File adapters
  ship. A SQLite adapter would drop in without touching callers.
- **No HTTP layer** — `GameService` methods are the contract; wrapping them in Express/Fastify
  per `API.md` is a small, mechanical follow-up (intentionally left to the frontend/host
  integration).
- **Accuracy ballot side-prize (§12)** — `castBallot` records ballots in the engine; the
  ghost side-prize scoring/reward is not yet computed.

### Grep for follow-ups
```bash
grep -rn "TODO(open-question" src   # every deferred decision, tagged to its §
```

---

## Start here next time

The backend is complete and green: a deterministic, fully-tested core engine drives a
balance harness (median resolution matches §16's early-evening target and balance is
skill-sensitive), an AI Director whose four hard constraints are enforced in code, an
Anthropic-backed deck generator, and a `GameService` whose `PlayerView` projection enforces
every privacy invariant — all behind mocks so nothing needs an API key. The two highest-value
next steps are both **tuning, not building**: (1) resolve the engagement assumption (§17.4) by
watching real task throughput in a playtest and re-running `npm run sim`, and (2) give the
Cop/Medic a richer evaluation than the single-`skill`-knob harness allows (§17.1) so their
real balance impact can be measured and their numbers locked. After that, wrap `GameService`
in a thin HTTP layer per `API.md` for the frontend, and wire a real `ANTHROPIC_API_KEY` to
swap the Director/deck mocks for live Claude calls (the seams are already there).
