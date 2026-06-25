# Sundown — Player App

The player-facing PWA for the all-day social-deduction game. Mobile-first, built
for glancing at one-handed in the sun. It's a quiet instrument panel, **not** a
chat app — all the scheming happens out loud, in person.

- **Stack:** Vite + React + TypeScript (no UI framework; hand-rolled components +
  CSS-variable theming in `src/theme.css`).
- **Backend contract:** [`../API.md`](../API.md). Fixtures the UI was built against
  live in [`../fixtures/`](../fixtures/).
- **Design source:** [`../FRONTEND_BRIEF.md`](../FRONTEND_BRIEF.md).

## Quick start

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173  (also exposed on your LAN)
```

Scripts: `dev`, `build` (typecheck + Vite build → `dist/`), `preview` (serve the
build), `typecheck`.

## Two ways to run

### DEMO mode — no backend needed (use this for the playtest UI walkthrough)
Add `?demo` to the URL. A floating panel (bottom-right ✦) switches **phase /
role / mood / theme**, so every screen in the brief is reachable offline with no
server running. You can also deep-link a single state:

```
/?demo
/?role=killer&phase=active&bar=critical
/?role=cop&phase=active
/?phase=vote
/?role=ghost
/?phase=over
```

Demo data mirrors the real fixtures (`src/demo.ts`).

### LIVE mode — against the backend
1. In the **root** project, start the server: `npm run serve` (defaults to port 3000).
2. Point the app at it: copy `.env.example` → `.env.local` and set
   `VITE_API_BASE_URL` (defaults to `http://localhost:3000`).
3. `npm run dev`, open the app, enter a **game code** + your name to join. The app
   then polls `GET /state` every ~5s and drives the whole game from there.

Game codes are shown as `SUN-XXXX`; the join screen also accepts a raw `g_xxxx`
gameId, so you can paste whatever `npm run serve` prints.

## 📱 Testing from your phone (same Wi-Fi)

`npm run dev` already binds to `0.0.0.0`, so Vite prints a **Network** URL like
`http://192.168.254.25:5173/`. On a phone on the same Wi-Fi:

- **UI / design test (easiest):** open `http://<your-LAN-IP>:5173/?demo` — no
  backend, every screen browsable from the demo panel.
- **Full gameplay:** also run the backend (`npm run serve` in the root) and set
  `VITE_API_BASE_URL=http://<your-LAN-IP>:3000` in `.env.local` before
  `npm run dev` — otherwise the phone tries to reach *its own* localhost. (The
  backend server must also accept LAN connections.)
- **Install as an app:** Safari → Share → *Add to Home Screen*. It launches
  full-screen; iOS Web Push works only once installed (iOS 16.4+).

> Find your LAN IP any time with `ipconfig` (look for the Wi-Fi adapter's IPv4),
> or just read it off Vite's Network line.

## Hard rules baked into the UI (don't regress these)

These are load-bearing game mechanics, not styling choices:

1. **Never show another player's role/team** — the roster is names + alive/dead only.
2. **Never show the exact bar value** — only the band (healthy / strained / critical).
3. **No in-app messaging** of any kind.
4. **Doing a task never clears anyone** — no "verified innocent" UI.
5. **Killer / Cop / Medic tools render only** when the relevant `you.*` object is present.
6. **Game-over role reveal** only appears if a recap map is supplied (demo). The live
   `PlayerView` never carries roles mid-game, so live game-over shows alive/dead +
   a "sealed — ask your host for the recap" note.

## Structure

```
src/
  main.tsx          entry; mounts App, registers SW in prod
  App.tsx           lifecycle routing + nav; live-vs-demo split; action wiring
  api.ts            typed client for the backend (../API.md)
  usePlayerView.ts  5s polling hook (the heartbeat)
  storage.ts        on-device identity + small prefs (localStorage)
  push.ts           service-worker registration + Web Push
  types.ts          wire types (mirror of API.md)
  demo.ts           offline fixture-mirroring data + buildDemoView()
  constants.ts      task copy + the endless-deck reserve pool
  theme.css         light/dark tokens + animations
  components/ui.tsx shared primitives (Button, Card, MoodHero, feed, roster, …)
  screens/
    cozy.tsx        Join, Lobby, Home, Tasks, Vote(+result), Tutorial
    cold.tsx        Killer, Cop, Medic, Ghost, Game over
public/             manifest, service worker, icons (PWA)
```

## Notes / open items

- **Cop & Medic actions are client-local** — the backend has no investigate/shield
  endpoint yet (spec §17.2 is an open design item). The UI models them faithfully;
  wiring is a drop-in once those endpoints exist.
- **Web Push** is fully wired (`push.ts` + `public/sw.js`) but not auto-prompted;
  surface an "enable notifications" control when desired.
- **Deployment (Vercel etc.) is deferred** — for now LAN testing covers the
  playtest. When ready: `npm run build` → deploy `dist/`, and set
  `VITE_API_BASE_URL` to the deployed backend.
