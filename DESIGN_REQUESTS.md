# Claude Design Requests

Handoff doc for new screens and UI elements to be built in Claude Design,
then integrated here. Add items as they come up during playtesting.

---

## Pending

### 1. Killer task feedback + notification countdown
**Context:** When a killer completes a task, their meter now updates immediately.
The delayed town-facing "ominous notification" is a future feature. When it's built,
the killer screen needs UI to show it.

**What's needed:**
- A subtle confirmation state on the task row after a killer taps "done"
  (e.g. a brief "logged" indicator)
- A countdown element showing "town notified in ~X min" — appears on the task
  or in the killer tools area, disappears once the notification fires
- Should feel tense/ominous, not clinical — fits the cold screen aesthetic

**Where it lives:** `frontend/src/screens/cold.tsx` killer tools area

---

### 2. Host / Admin Dashboard (iPad Mini primary, works on phone too)

**Context:** Right now creating and starting a game requires terminal commands. This
feature makes the host experience fully self-serve from any device. The iPad Mini is
the primary target but it must work on phone too (same Safari PWA).

**Entry point:** Add a "Host a game" button to the existing Join screen (`cozy.tsx`)
alongside the existing "Join" flow. Tapping it enters the host creation flow.

**Screens needed:**

#### A. Create Game screen
- Player count picker (4–22, big tappable stepper)
- Optional: day length, enable Cop/Medic roles toggle
- "Create game" CTA → calls `POST /games` → goes to Host Lobby

#### B. Host Lobby screen
- Game code displayed **very large** (the 3-char code e.g. `SUN-4D6`) — this is what
  the host reads aloud / shows to players
- Live roster list — players appear as they join (polling every 3s)
- Player count + minimum (need 4 to start)
- "Start the game" button — disabled until ≥4 joined, calls `POST /games/:id/start`
- Share/copy button for the game code

#### C. Host Active Game dashboard (two modes, toggled)

**Referee blind (default):**
- Living count, bar band (healthy/strained/critical), current game time
- Vote status — is one open? When does it close? Who hasn't voted?
- Event feed (same vague feed players see)
- Admin controls: "Run director tick" button, "Force next vote" (future), end game
- Small lock icon in corner → enter host password → switches to Omniscient mode

**Omniscient mode (password unlocked):**
- Full roster with roles revealed (Killer / Town / Cop / Medic)
- Exact bar percentage
- Each killer's meter value + whether they can kill now
- Living/dead breakdown by team
- Same admin controls as blind mode
- Prominent "hide" button to snap back to blind mode

#### D. Player mid-game admin access
- Small discreet lock/admin icon somewhere on the Home screen (bottom corner or settings)
- Tap → modal asks for host password (the hostId)
- Correct password → shows a simplified read-only omniscient overlay (roles + bar %)
- Wrong password → silent fail (don't confirm the icon exists to other players)

**Layout notes (iPad Mini):**
- iPad Mini is ~768pt wide — use a 2-column layout for the active dashboard
  (left: roster/state, right: controls/feed)
- All tap targets should be large — this is a pass-around device
- Keep the same design tokens / CSS variables as the player app (`theme.css`)

**Backend note for Design:**
- `POST /games` — create game (exists)
- `POST /games/:id/join` — join (exists, host joins as "Host" or doesn't join)
- `POST /games/:id/start` — start (exists, requires hostId)
- `GET /games/:id/host-state?hostId=xxx` — omniscient view (**being built now**)
- The `hostId` IS the admin password — it's the string passed to `createGame`

**Where it lives:** New file `frontend/src/screens/host.tsx`, entry wired into `App.tsx`

---

## Completed
<!-- Move items here once designed + integrated -->
