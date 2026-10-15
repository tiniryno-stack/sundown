# Sundown — Brain Dump Session

> Started: Oct 10, 2026 · Living doc, updated as we go
> Update Oct 15: the landing page shipped (live demos, How to play, waitlist). See [`showcase-plan.md`](showcase-plan.md) for status.
> Purpose: ideas, user journeys, and decisions to bring into a future build session.
> Repo: github.com/tiniryno-stack/sundown (public)

---

## 1. Where the project stands (as of Oct 10, 2026)

**One-liner:** An all-day social deduction party game (7–22 players). Hidden killers vs. town. The app is a silent automated host that runs tasks, votes, kills, and a shared "town bar." All the scheming happens out loud, in person or in group chats. The app never handles messaging.

**Build status**
- **Backend:** done and deployed on Railway. 80 tests pass. Engine, balance simulator, AI Director (Claude), AI task-deck generator, Redis storage (Upstash).
- **Frontend:** done and deployed on Vercel as a web app (PWA). Player app (warm "cozy" screens + private "cold" killer screens), host dashboard, admin page, bot testing, rapid mode (3-hour game), public landing page (`?landing`).
- **Not on the App Store yet.** It's a web app only. No native push notifications.

**History**
- 57 commits from Jun 22 to Jul 9, 2026. Built in about two and a half weeks.
- Jun 22–24: backend engine, simulator, Director, deck, API.
- Jun 24–26: frontend, deploys, host dashboard, Redis, lots of mobile and iPad fixes.
- Jun 28 – Jul 1: admin page, rapid mode, bot test tools.
- **Jul 9: last commit** (landing page). Idle about 3 months since.
- Nearly everything was committed straight to `master`. Only one pull request ever (#1, a Railway deploy fix). There's one leftover branch: `railway/fix-deploy-4afbef`.

**Pending features (from DESIGN_REQUESTS.md / CLAUDE.md)**
1. Killer task feedback: a "logged" confirmation and a "town notified in ~X min" countdown on the killer screen.
2. Unified host-as-player flow: create a game, then join as a real player in one flow. A hidden lock icon plus password opens the host dashboard (no separate `?host` tab).

**Open design questions (from game-spec.md §17)**
1. Cop/Medic roles (and an optional killer counter-role) need re-balancing. The sim shows less than 1 point of impact, but the sim can't really model deduction.
2. What the Cop's investigation actually reveals (alignment read vs. "was near a death") and how many uses per game.
3. Director event-card deck: contents and bounds are not defined. Levers are scaffolded but not applied.
4. **Biggest one:** the economy assumes about 1 task per hour per player. Only a real playtest answers this.

**Deferred "post-v1" ideas already in the spec**
- Prize pot (real buy-in that tasks build and the killers drain)
- Killer covert missions ("get someone else accused this round")
- Soft death / jail (first hit benches you instead of killing you)
- Ghost one-time "haunt" clue, ghost side-prize for the accuracy ballot

---

## 2. Earlier notes (Oct 7 chat)

**Launch cost ballpark (about 1,000 users)**
- One-time/yearly: Apple $99/yr, Google Play $25 once, domain ~$15/yr, optional LLC ~$300.
- Monthly: Railway ~$20, Vercel Pro $20, Upstash ~$20–30, Claude API ~$50–100. About **$75–150/mo** total.
- Users: about 100 hosts × 10 friends. Organic growth is roughly free; paid ads would be about $2–5K.
- To get into the App Store it needs a native wrapper (e.g. Capacitor) plus **real push notifications**. Apple rejects plain website wrappers, and an all-day game needs push.
- Cost savers: poll every 10–15s and only while the app is open; run the Director on Haiku.
- Suggested path: launch as a web app first, get 10–20 real groups playing, then build the App Store version.

**Monetization**
- Best fit: **"host pays, everyone else plays free"** (the Jackbox model).
- Ideas: free up to a group size or N games/month; paid host unlock or subscription (bigger groups, Marathon, custom settings); paid themed task packs (bachelor party, wedding weekend, office edition) and new roles.
- Ads are a bad fit; they break the ambient vibe and need huge scale.

---

## 3. Brain dump — ideas & decisions

_(filled in as we go)_

### Decisions made
- **No video on the showcase site** (Oct 14). The hero is the real app screens playing a scripted day on loop. Leaning "same moment, three truths" (Town / Killer / Ghost phones in sync). Details in [`showcase-plan.md`](showcase-plan.md) §5.

### Ideas on the table
- **Showcase / landing site** (Oct 14): full plan in [`showcase-plan.md`](showcase-plan.md). Domain + landing at root, app at `/play`, live phone-frame demo, PM-framed case study, waitlist + PostHog.

- **Waitlist** (Oct 15): shipped. Emails only, no campaigns; the count is the signal of interest.
- **How to play on the landing page** (Oct 15): shipped, reusing the app's own tutorial cards.

### Parked / rejected

---

## 4. User journeys

_(filled in as we go)_

---

## 5. Open questions to come back to

_(filled in as we go)_
