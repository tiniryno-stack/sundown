# Game modes brainstorm

> Started Oct 15, 2026 · An idea log, not a spec. Nothing here is decided.
> Related: [`brain-dump.md`](brain-dump.md) (product notes) · [`../game-spec.md`](../game-spec.md) (the current game)

## The idea in one line

Sundown could be an **all-day task engine for a group**, with Mafia as one of several games you can play on it.

## Where this came from

- Andrew has been showing Sundown to a lot of people to get first impressions.
- A friend described a similar game they play:
  - Everyone secretly has someone, like Secret Santa: you know who you have, but they don't know you have them.
  - One person is the **proctor / taskmaster**. They hand out tasks worth **1, 2, or 3 points**.
  - You can always go back to the taskmaster for more tasks.
  - The taskmaster monitors and **approves** whether a task was done correctly.
- Andrew's reaction: a **team game where you climb a leaderboard all weekend** could be fun, **Taskmaster** could be fun, and the **AI could be the taskmaster**.

---

## The shift

| | Today | The idea |
|---|---|---|
| What the app is | A hidden-role game (Mafia) where tasks are camouflage | A task engine for a group's day or weekend |
| Tasks | Cover for killers; points feed the mood bar or a kill meter | The core activity in every mode |
| Modes | One | Several, e.g. **Task Mafia**, **Taskmaster**, **Task Teams**, **Secret Targets** |

**Why it might be stronger**
- More groups fit. Not every group wants lying and accusations; most groups will happily do dares for points.
- An easier first game. A team leaderboard needs no rules explanation.
- Replay value. The same group can play a different mode next trip.
- Tasks are the part people remember, screenshot, and retell.

**Why to be careful**
- Mafia's tension is the hook that makes Sundown different. A general "task app" is easier to ignore.
- Every mode is more to build, balance, and explain.
- The landing page and name would need to speak to the platform, not one game.

---

## What already exists that every mode could reuse

| Piece | Where it lives | Notes |
|---|---|---|
| Task deck with point tiers | `src/engine/economy.ts`, `game-spec.md` §7.5 | Light 1 · Standard 2 · Heavy 3 · Group 4. Already matches the friend's 1/2/3 idea. |
| AI task generator (Claude) | `src/deck/` | Could generate themed decks per mode or per event (bachelor party, office offsite). |
| AI Director | `src/director/` | Already paces a game with hard limits; a natural base for an AI taskmaster. |
| "Done" tap + optional proof | `TasksScreen`, covert-task proof prompts | Honor system today; proof text is already captured locally. |
| Task ratings (👍 / 👎) | `POST tasks/rate` | Data for what tasks people actually like. |
| All-day clock, join codes, lobby, host dashboard | across the app | The shell of any group game. |
| Personal archive of finished tasks | `TasksScreen` archive | Becomes a recap / highlight reel. |

---

## Mode ideas

### 1. Task Mafia (what exists today)
Hidden killers vs town. Tasks are cover, votes at meals, a vague mood bar. Fully built and live.

### 2. Taskmaster
One person runs the game and everyone else competes for points.
- The taskmaster hands out tasks worth 1, 2, or 3 points. Players can ask for more at any time.
- Players submit tasks as done. The taskmaster **approves or rejects** them, maybe with a photo or a short answer as proof.
- A live points leaderboard. Highest score at the end wins.
- **Human taskmaster:** the host dashboard becomes an approval queue (approve / reject / award a bonus).
- **AI taskmaster:** Claude hands out tasks, judges text proof, keeps a running commentary, and throws in surprise bonus tasks. A human can override any ruling.
- Open questions:
  - Does a human taskmaster also play, or sit out? Sitting out is the exact problem Sundown solved for Mafia.
  - Do approvals become a bottleneck at 15+ players?
  - Should the AI judge photos (needs image understanding) or only text and honor-system taps at first?

### 3. Task Teams
Teams race up a leaderboard over a day or a whole weekend.
- Every task completed adds points to your team. Group tasks are worth more.
- Optional head-to-head challenges between teams, and a daily "big task" worth a lot.
- End-of-weekend ceremony with a recap of each team's best moments.
- Probably the **simplest mode to build** (no hidden information) and the easiest first game for a new group.
- Open questions:
  - How are teams picked: random, captains draft, or the host decides?
  - **Multi-day games.** The engine is built around one day. A weekend means games that pause overnight.
  - Catch-up: do trailing teams get bonus tasks so it stays close?

### 4. Secret Targets (the friend's game)
Everyone secretly draws one other player, like Secret Santa.
- You know who you have. They don't know you have them.
- Tasks and a proctor as described above.
- Ideas to try (not from the friend's game, just possibilities):
  - Tasks aimed at your target ("get your target to say *pineapple*", "get a photo with your target without them noticing").
  - An end-of-game guess: who had you? Points for guessing right.
  - A chain like the classic Assassin game: complete your target's task and inherit their target.
- **Open question for the friend:** how exactly do the targets factor in? Are tasks about your target, or is it more like a gift exchange?

---

## Bigger questions to answer

1. **Which mode is the front door?** The first thing a new group plays decides what people think the app is.
2. **One app with modes, or Sundown stays Mafia and the task platform gets its own name?** "Sundown" fits a day that ends in a reveal. Possible pattern: *Sundown: Mafia*, *Sundown: Teams*.
3. **Proof and approval.** In Mafia the honor system is deliberate: faking a task is fair cover. In Taskmaster and Teams, points are the whole game, so some proof or approval probably matters.
4. **Day vs weekend.** Do games need to span multiple days?
5. **Who pays?** The "host pays, everyone plays free" model from `brain-dump.md` still fits: modes could be part of a paid host unlock.

## Possible first steps (cheapest first)

1. Ask the people giving first impressions which mode they'd want to play first.
2. **Paper-test** Taskmaster or Teams at the next get-together using the existing task deck, with no code. Note what was fun and what dragged.
3. Build **Task Teams** as the second mode. It reuses tasks and points; new pieces are teams, a leaderboard, and maybe multi-day.
4. Add a **Taskmaster** approval queue to the host dashboard, then try an **AI taskmaster**.

---

## Feedback log

First impressions from people Andrew shows Sundown to. Add a row each time.

| Date | Who | What they said | Follow-up |
|---|---|---|---|
| Oct 15, 2026 | A friend | Described a game with secret Secret-Santa-style partners and a taskmaster who hands out 1/2/3-point tasks and approves them. Sparked this doc. | Ask how the secret partners factor into tasks. |
