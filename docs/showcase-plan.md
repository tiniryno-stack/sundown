# Sundown — Showcase Site Plan

> Written Oct 14, 2026 · Plan for a landing page to pitch Sundown from and link as a portfolio piece.
> Companion to [`brain-dump.md`](brain-dump.md).

## Status (Oct 15, 2026)

**Shipped** (PRs #2–#4, live at `?landing`):
- Self-playing hero phone + "same moment, three phones" section, driven by the real app screens (§5)
- Take control mode (tap around as town / killer / during a vote)
- How to play section built from the in-app tutorial cards, plus how each side wins and the mood bar
- Waitlist: top bar + small hero signup, stored in Redis, count and emails in the `?admin` page
- Build section reframed as a full-stack product case study (first pass)

**Still open:** domain + landing at the site root (§3), contact/resume link in the closing section, Open Graph image, product analytics (§7), root README rewrite, deeper case-study rewrite (§6), real playtest photos/stats.

---

## TL;DR

- **You're about 70% there already.** The repo has a two-part landing page (Play + Build) at `?landing`, five real screenshots, and a `?demo` mode that runs every screen with no backend. That's the hard part.
- **What's missing is packaging:**
  - a clean URL
  - motion: a self-playing demo built from the real app screens (no video)
  - a **PM framing**. The current "Build" half is written for AI *engineering* jobs, not product roles.
  - proof that real people played it
- **Recommended path:**
  1. Buy a short domain and put the landing page at the root.
  2. Build a self-playing hero: the real app screens in phone frames, running a scripted day on loop, with a "Take control" button.
  3. Rewrite the second half as a **product case study**.
  4. Add a waitlist and analytics.
  5. Clean up the GitHub README.
  6. Put the link on your resume.

---

## 1. Who the page is for

| Audience | What they need in 10 seconds | What they do next |
|---|---|---|
| **Hiring managers / recruiters** (PM roles) | "This person can take a fuzzy idea → spec → shipped product, and makes good tradeoffs." | Read the case study, open GitHub, maybe tap the demo |
| **Friends / potential players** | "What is this game and would my group have fun?" | Tap the demo, join the waitlist, ask to play |
| **People you pitch** (collaborators, partners, maybe investors later) | "Is there a real product and real demand here?" | Watch the hero demo play, see traction numbers, contact you |

One page can serve all three if the order is right: **hook → see it → how it works → product story → contact.**

---

## 2. What already exists (inventory)

| Asset | Where | Status |
|---|---|---|
| Landing page (Play track + Build track) | `frontend/src/screens/landing.tsx` + `landing.css`, served at `?landing` | Built Jul 9. Has two placeholder links (`#todo-contact-link`, demo URL) |
| Offline demo of every screen | `?demo`, with a floating panel (✦) to switch role/phase/bar | Built. `buildDemoView()` can drive the self-playing hero |
| Real screenshots | `frontend/public/images/land-*.png` (home, tasks, vote, killer, game over) | 5 static images |
| Case study source material | `PORTFOLIO.md`, `SITE_BRIEF.md`, `PROGRESS.md`, `game-spec.md` | Strong, but engineer-voiced |
| Balance sim results | `PROGRESS.md` §2 (killer win % at different town skill levels) | Real data you can chart |
| Bot tester (all bot windows open at once) | Host dashboard bot launcher | Useful for testing; inspiration for the multi-phone hero |
| Narrated game watcher | `npm run watch` (dev tool) | Could generate a real "day in the life" game log to animate |

**Gaps to close**
1. **URL.** `something.vercel.app/?landing` is not resume-worthy, and the root of the site is the join screen, not the pitch.
2. **Framing.** The Build half sells *engineering* (architecture, test counts). For PM roles, lead with problem, users, decisions, tradeoffs, and validation.
3. **No motion.** Static screenshots only.
4. **No proof of real play.** No photos, quotes, or numbers from an actual group.
5. **Loose ends visible to anyone who clicks through:**
   - The root `README.md` still says "backend only, no frontend." That's the first thing a GitHub visitor sees.
   - Placeholder links.

---

## 3. Where should it live? (options)

| Option | What it is | Pros | Cons |
|---|---|---|---|
| **A. Keep `?landing`** | Leave it where it is | Zero work | Ugly URL; root is the join screen; feels like a hidden page |
| **B. Domain + landing at root, app at `/play`** ⭐ | e.g. `playsundown.com` → pitch page; `playsundown.com/play` → the game | One project, one deploy; clean resume link; app stays one click away | Small routing change in `App.tsx` |
| **C. Separate `site/` project** | What `SITE_BRIEF.md` originally planned: its own Vercel project | Clean separation; site can't break the app | Two deploys; duplicate work since the page already exists in `frontend/` |
| **D. Personal portfolio hub** | e.g. `andrew[lastname].com` with Sundown as case study #1 | Holds future projects (G-League board, etc.); stronger personal brand | More to build; do it *after* the Sundown page is solid |

**Recommendation:** do **B** now. Later, build **D** and link it to the Sundown page as the featured case study.

- **Domain ideas:** `playsundown.com`, `sundown.game`, `sundowngame.com`, `getsundown.app`. Availability not checked yet. Roughly $10–20/yr.
- **Hosting:** Vercel's free Hobby plan is fine for a portfolio/landing page. You only need Pro if you start charging.

---

## 4. Revised page structure

Top half keeps the game's voice (warm party energy with a cold undercurrent). Bottom half becomes a plain-spoken **product case study**.

### Play half (players + first impression)
1. **Hero:** name, one-line hook, and the **self-playing demo**: three synced phones on desktop, one cycling phone on mobile. See §5.
   CTAs: `Try the demo` · `Get early access` (waitlist).
   - Hook options to test:
     - "Two out of every seven people you trust are killers." (already on the page)
     - "A murder mystery that runs in the background of your whole day."
     - "The party game that hosts itself."
2. **How it works:** scroll story with a pinned phone (concept D in §5), replacing the static 01–05 cards (morning kickoff → tasks → the bar → five votes → evening finale).
3. **A day in 60 seconds** *(new, optional)*: scroll-driven animation of a real simulated game. Clock moves 9 AM → 10 PM, the town bar drains and refills, "a death" notices pop, votes resolve.
4. **Take control:** the interactive phone demo (real taps), replacing the static screenshot gallery.
5. **Why it stays tense and fair:** the existing rules section.
6. **Played by real groups** *(new, fill only with real data)*: photos, quotes, a stat or two from actual playtests. Leave it out until you have it. Don't use made-up testimonials.

### Divider
"That's the game. Here's how I built it." This line already exists.

### Product story half (hiring managers): rewrite as a PM case study
1. **The problem.** Party games need a host who sits out (Mafia, Werewolf). At trips, bachelor parties, and all-day events, people want something that runs in the background, not one 45-minute sit-down session.
2. **The user and the moment.** A friend group of 7–22 on a trip or all-day event. Phones in pockets, drinks in hand, attention is scarce.
3. **Design principles.** Two dials: balance (~50/50) and day-long pacing. Everything else derives from ratios so it scales from 7 to 22 players.
4. **Key decisions and tradeoffs.** This is the most important section for PM interviews. See §6 for draft content.
5. **How I validated before anyone played.** Monte-Carlo sim of thousands of games per configuration. Include a small chart of killer win % at different town skill levels (54% / 42% / 31%). Balance modeling showed the original 2-vote design was ~99% killer-favored, so the game moved to 5 votes.
6. **How it got built (the AI angle, framed as a PM skill).** You wrote the spec and acceptance criteria; one AI agent built the backend from it unsupervised; a second agent built the frontend from only the API contract. That's PM work: clear requirements, interfaces, handoffs. It's especially strong for "Forward Deployed PM" and AI-product roles.
7. **Shipped.** Live web app, real database, AI Director in production. First deploy 3 days after the first commit; full v1 in under 3 weeks.
8. **What I'd measure / what's next.** North-star metric, launch funnel, roadmap (native push, host-as-player, App Store). Shows you think past shipping.
9. **Links + contact.** GitHub, demo, resume/LinkedIn, email.

Keep the architecture diagram, but move it lower or behind a "Technical details" expander. Engineers will open it; PM interviewers won't need it.

---

## 5. Motion & demo: a coded, self-playing demo (no video)

> Decided Oct 14: **no screen recordings.** The hero is the real app, playing itself.

### The core idea: the real app on autopilot
The landing page lives in the same React app as the game, so it can **import the real screens** (`HomeScreen`, `TasksScreen`, `VoteScreen`, `KillerScreen`, `GhostScreen`, `GameOverScreen`) and feed them fake game states on a timer. `buildDemoView(role, bar, phase)` in `frontend/src/demo.ts` already generates every state. The screens are pure components (state in, UI out), so a script can drive them.

What visitors see: a phone on the page that looks like someone is playing. Screens change, a fake finger-tap ripples on buttons, a "A death. 6 remain." notification slides down, and the in-game clock moves from 9 AM to 10 PM. It loops every ~25 seconds. It's not a recording or a mockup; it's the actual UI running live.

**Why this beats video**
- Sharp on any screen size; no blurry compression.
- Nearly zero file weight; no 5 MB MP4 to load.
- **Never goes stale.** Change a screen in the app and the landing page updates automatically.
- Follows light/dark mode.
- Can hand over control: "Take control" turns the autoplay into the real tap-through demo.
- The hero itself is proof you can build. That's a talking point.

**The honest tradeoff:** more work than a recording (a couple of build sessions), and it needs care so it doesn't stutter on older phones.

### Hero concepts (pick one)

| | Concept | What it looks like | Best for |
|---|---|---|---|
| **A** | **One phone, one day** | A single phone autoplays a day. Captions beside it change with each beat ("2:15 PM — A killer just unlocked a kill. Nobody else knows."). | Clean and simple. The standard app-landing-page pattern. |
| **B** ⭐ | **Same moment, three truths** | Three phones side by side, synced to one clock: a **Town** player (warm screen), a **Killer** (cold screen), and a third player who dies mid-loop and becomes a **Ghost**. The killer's phone says "kill unlocked" while the town phones look normal; 20 seconds later the town phones get "a death." | Sells the hidden-information premise in seconds. This is the thing only Sundown can show. |
| **C** | **Choose your side** | Two buttons, "Play as Town" / "Play as Killer." The phone flips between warm and cold themes. | Interactive hero; fun but less self-explanatory. |
| **D** | **Scroll story** | Phone stays pinned while you scroll; each section advances the clock and changes the screen. | The **How it works** section, not the hero. |

**Recommendation:** Hero = **B** on desktop, collapsing to **A** on mobile (one phone that cycles roles). Replace the static 01–05 "How it works" cards with **D**, reusing the same timeline engine.

### Draft timeline for concept B (~24s loop)

| Time | Clock | Town phone | Killer phone | Third phone | Caption |
|---|---|---|---|---|---|
| 0s | 9:00 AM | Role reveal: Town | Role reveal: Killer | Role reveal: Town | "Roles go out in secret. Even killers don't know each other." |
| 4s | 11:40 AM | Taps a task → done | Taps a task → done | Tasks list | "Everyone does tasks. Including the killers." |
| 9s | 2:15 PM | Home, bar "healthy" | **Kill unlocked**; taps a target | Home | "A killer just unlocked a kill. Nobody else knows." |
| 13s | 2:38 PM | 🔔 "A death. 6 remain." | "Done." | Flips to **Ghost** | "Deaths are announced late and vague. Never who, never exactly when." |
| 17s | 5:30 PM | **Vote open** | Vote open | Ghost watches | "Five votes a day, at meals and gatherings." |
| 21s | 10:02 PM | Game over: reveal | Game over: reveal | Game over | "By sundown, someone's lying." → loop |

Copy is a placeholder. Write the final captions in the game's voice.

### Build pieces
- **Timeline script:** a list of beats `{ at, phones: [{ role, bar, phase, screen, tap? }], clock, caption }`. Easy to edit without touching code.
- **`useTimeline` hook:** advances beats on a timer and loops.
- **CSS phone frame:** no image, scales with `transform: scale()` to fit any layout.
- **Tap ripple + notification toast:** small overlay components; animate only `transform`/`opacity` so it stays smooth.
- **Behaviors:**
  - pause on hover
  - pause when scrolled off-screen
  - "Take control" button hands off to the interactive demo
  - show still frames if the visitor has "reduce motion" turned on
- Autoplay phones ignore real taps; actions are no-ops (`noopActions` already exists in `App.tsx`).
- Plain CSS transitions are enough, consistent with the app's no-UI-library approach. A small animation library (e.g. Motion, formerly Framer Motion) is optional for nicer screen transitions.

### Other motion, ranked

| # | Idea | Effort | Notes |
|---|---|---|---|
| 1 | **Self-playing hero (above)** | Med | The centerpiece |
| 2 | **"Take control" interactive demo** | Low | Same phone frame, real taps, uses existing `?demo` |
| 3 | **Scroll story for How it works** | Med | Reuses the timeline engine |
| 4 | **"A day in 60 seconds"** from a real sim game | Med–High | Export a seeded game log from the engine and animate the real bar/deaths/votes. Could feed concept D. |
| 5 | **Sim results chart** | Low | Win % vs. town skill in the validation section |
| 6 | **Ambient details** | Low | Town bar gently "breathing," clock ticking in the nav, subtle warm→cold color shift at the divider |

### Where to look for inspiration
- **Galleries:** godly.website, land-book.com, lapa.ninja, saaslandingpage.com. Filter for app/product heroes.
- **Mobbin:** real mobile app screens and flows.
- **Product sites known for polished, code-driven heroes:** linear.app, stripe.com, raycast.com, vercel.com.
- **What to notice on each:**
  - How fast you see the actual product.
  - How many CTAs there are (usually 1–2).
  - How the hero collapses on a phone.
  - Whether motion explains the product or just decorates.

The landing page itself should not use video anywhere. The optional 2-minute personal walkthrough (Loom-style) for recruiters stays separate and optional; see §11.

---

## 6. Case study draft content: key decisions & tradeoffs

Raw material to edit into your own voice:

| Decision | Alternative considered | Why this way |
|---|---|---|
| **No in-app chat, ever** | Built-in messaging | The fun is face-to-face accusing and bluffing. Chat would pull people into their phones, the opposite of a party game. |
| **Honor-system task "done" tap** | Photo proof, NFC tags, verification | Faking a task is *in-character* cover for a killer, so cheating is part of the game. It removed an entire anti-cheat problem by design. (NFC was in v1 and was cut.) |
| **Vague, delayed notifications** ("a death / a switch") | Real-time, named events | Exact timing would let players work out who did what. Delay plus vagueness keeps suspicion simmering all day. |
| **5 scheduled votes, not 2** | Fewer votes, or emergency votes | Simulation showed 2 votes made killers win ~99% of the time. It was the single biggest balance error in the first draft. Emergency votes were cut for simplicity. |
| **"Moving killer"**: a caught killer can transfer the role if the team saved up for it | Caught = gone | Stretches a 7-player game from mid-afternoon into the evening and adds an offense-vs-insurance choice. |
| **Ratio-based balance** (killers ≈ 28% of players) | Hand-tuned numbers per group size | One ruleset scales from 7 to 22 players without re-tuning. |
| **AI Director with hard, code-enforced limits** | Let the AI run the game freely | The AI can nudge pacing but can never see-and-leak hidden roles, touch votes, or act instantly. It shows AI product judgment: where to use AI and where to fence it in. |
| **Web app (PWA) first, App Store later** | Native app from day one | Faster to ship and test with friends. The tradeoff is no reliable push notifications, which is the #1 thing the native version must fix. |

**Metrics to show you think in outcomes** (pick 3–4):
- **North star:** games completed (started → reached the evening finale)
- **Activation:** % of created games that reach 7+ players and start
- **Engagement:** tasks per player per hour. This is the spec's biggest open assumption (~1/hr), and only real play answers it.
- **Virality:** players per game who later host their own game. Each game puts ~10 people in front of the app.
- **Retention:** groups that play a second time within 60 days

---

## 7. Waitlist + analytics

- **Waitlist:** "Get notified when the App Store version drops." Gives you a real traction number to pitch with ("120 people signed up"). Simplest options:
  - a Tally or Formspree embed
  - a tiny `POST /waitlist` endpoint that writes to the Upstash Redis you already have
- **Analytics:** add product analytics to both the landing page and the app. **PostHog** is the natural pick: free tier, easy setup, and funnels out of the box. Track:
  - `landing_viewed`, `hero_take_control_clicked`, `demo_opened`, `waitlist_joined`, `github_clicked`
  - in the app: `game_created`, `player_joined`, `game_started`, `task_completed`, `vote_cast`, `game_finished`
  - Then a real funnel screenshot goes into the case study.
- **Link previews:** add an Open Graph image and description so the link looks good when texted or posted on LinkedIn. People will mostly see this page as a link preview first.

---

## 8. Using it on your resume, LinkedIn, and in person

**Resume line (Projects section):**
> **Sundown** — Founder / PM · playsundown.com · [GitHub]
> - Took an all-day social deduction party game from written spec to a live web app in under 3 weeks by authoring the product spec and directing AI coding agents to build the backend and frontend against it.
> - Validated game balance before launch with balance modeling and a simulation of thousands of games. Found that the original 2-vote design left killers winning ~99% of the time and redesigned around 5 votes for a near-50/50 game.
> - Designed guardrails for an AI "game director" that tunes pacing live but can never leak hidden information or touch votes. Code-enforced, not just prompted.
> - *(Add once real) — Playtested with N groups / N players; X% of games completed; N waitlist signups.*

**Other placements**
- **LinkedIn:** Featured section (link with OG image) and a Projects entry.
- **Email signature / job applications:** the "Portfolio" or "Website" field.
- **In person:** a QR code to the page on your phone lock screen or a card, for when you're pitching it out loud.

---

## 9. Pre-launch checklist (before it goes on a resume)

- [ ] **Confirm the backend is still live.** It's been idle 3 months; check Railway didn't pause or sleep it. The demo works offline either way, but "Play for real" needs the backend.
- [ ] **Rewrite the root `README.md`**: one-line pitch, hero GIF, links to site/demo/case study, then the dev setup. It currently says "backend only."
- [ ] Fill both placeholders: demo URL and `#todo-contact-link` (LinkedIn or email).
- [ ] Update stale facts on the page: commit count and dates (57 commits, Jun 22 – Jul 9).
- [ ] Test on an actual phone: iPhone Safari plus one Android if possible.
- [ ] Open Graph image and favicon check.
- [ ] Have 2–3 friends skim it cold and tell you what they think the product is.

---

## 10. Build order

| Phase | Scope | Rough effort |
|---|---|---|
| **1. Make it linkable** | Buy domain → landing at `/`, app at `/play` → fill placeholders → README rewrite → OG image | One evening |
| **2. Add motion** | Self-playing hero (timeline engine, phone frames, tap ripple, notifications) → Take control → scroll story for How it works | Two or three sessions |
| **3. PM case study rewrite** | Rewrite the Build half per §4/§6, add sim chart, move architecture into an expander | One session plus your editing time |
| **4. Traction layer** | Waitlist + PostHog events + funnel. Run 1–2 real playtests and add photos, quotes, numbers | Ongoing |
| **5. Personal hub (later)** | Portfolio site with Sundown as case study #1 | Later |

---

## 11. Open questions for you

1. **Domain:** any name preference? Want it Sundown-branded or under your own name?
2. **Real playtest:** has a group actually played a full game yet? If yes, are there photos, stories, or numbers? That's the most persuasive thing the page could show.
3. **Who's the main reader right now:** PM hiring managers (lead with the case study) or players (lead with the game)?
4. **Your face/voice:** comfortable recording a 2-minute walkthrough of yourself, or keep it product-only?
5. **Contact:** LinkedIn, email, or both on the page?
6. **"Founder" vs "PM" vs "Builder"** as your title on the project line?

---

## 12. Original kickoff prompt (Phase 2 done; kept for reference)

> Read `CLAUDE.md`, `SITE_BRIEF.md`, `PORTFOLIO.md`, and this plan (`docs/showcase-plan.md`).
> Do Phase 1 and Phase 2 from §10:
> (1) Make the landing page the root route and move the player app to `/play`, keeping `?demo`, `?host`, `?admin`, and `?join=` links working under the new path.
> (2) Fill the placeholder links with [DOMAIN] and [CONTACT LINK].
> (3) Add an Open Graph image and meta tags.
> (4) Build the self-playing hero described in §5 (concept B on desktop, A on mobile), driving the real screen components with `buildDemoView()` and a timeline script; include tap ripples, notification toasts, pause-on-hover/offscreen, reduced-motion stills, and a "Take control" handoff to the interactive demo. No video files.
> (5) Rewrite the root `README.md` as a showcase README.
> Don't change game logic or backend behavior. Run `npm run typecheck` and `npm run build` in `frontend/` and fix anything they flag. Show me the result on a phone-width preview before deploying.
