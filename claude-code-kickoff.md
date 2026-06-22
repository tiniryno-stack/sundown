CLAUDE CODE — KICKOFF PROMPT
============================

(Setup before pasting: make a new folder, save game-spec.md into it, open a terminal
in that folder, launch Claude Code, then paste everything below the line.)

────────────────────────────────────────────────────────────────────────

You are building the **backend** for an all-day social-deduction party game. The complete
design spec is in `game-spec.md` in this directory — **read it in full first; it is your
single source of truth.** Pay special attention to **§18 (Build Handoff)**, which defines
your scope, tech, build order, and required deliverables.

Work autonomously and continuously — I am away and cannot answer questions. **Do not stop to
ask for clarification.** Where the spec doesn't specify something, pick the documented default,
leave a `// TODO(open-question: …)` in the code, and note it in PROGRESS.md. **Do not invent
answers to the §17 open questions** — scaffold them behind clean interfaces/flags so I can fill
them in later.

SETUP
1. Initialize a TypeScript + Node project in this directory (one repo; Vitest for tests;
   Anthropic TypeScript SDK for the AI Director and task-deck generator). Initialize git and
   make small, frequent commits with clear messages as you finish each module.
2. Keep `game-spec.md` at the repo root.
3. Put all Anthropic API usage behind an interface with a **deterministic mock**, so the whole
   project builds, runs, and tests **without an API key** (I'll wire a real key in later).

BUILD — in the order defined in §18:
1. The pure, seedable, **fully unit-tested** core game engine (point economy, town bar + decay,
   kill-meter + move charges, votes, win conditions, moving-killer/resurrection, ghost + ballot).
2. A headless **simulation harness** that runs the real engine N times and re-validates the
   balance numbers in §16 (keep it as a regression test).
3. **Cop/Medic** roles behind config flags, then re-run the harness and report how they shift
   balance (leave final tuning as an open item).
4. The **AI Director** module — the snapshot → bounded-JSON-adjustment loop — with its four hard
   constraints enforced in code (never leak role/state; apply on a delay; stay within guardrail
   bounds; never alter votes, kill targets, roles, or structural params mid-round).
5. The Anthropic-backed **task-deck generator** (weighted, portable, drinking/social-themed,
   hits the target total point value, feasibility-checked, de-duped).
6. The **service layer** + a documented **API.md** contract (lobby/join, get-state,
   complete-task, cast-vote, killer actions, round lifecycle) for the future frontend.
7. Simple, swappable **persistence** (in-memory + a file/SQLite adapter is fine).

DO NOT build any frontend or UI — I'll do that separately in Claude Design. Stop at a clean,
documented API contract.

Enforce these spec invariants in code: separate progress (never cross-feed the town bar and the
killer kill-meter); attribution is internal-only and never exposed to players; all state changes
and Director adjustments apply on a delay.

WHEN DONE (or when you've gone as far as you can):
Write **PROGRESS.md** exactly as specified in §18 — what's built + how to run it, test and
harness results (with the balance numbers, including Cop/Medic impact), decisions/assumptions
tagged to spec sections, the remaining open questions, and a one-paragraph "start here next time"
summary. Make sure README.md has setup/run/test commands.

If something is genuinely blocking, don't wait on me — note it in PROGRESS.md and move to the
next module. Maximize the amount of correct, tested groundwork laid.
