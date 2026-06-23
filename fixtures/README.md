# Fixtures — sample PlayerView payloads

Real responses from the live `GameService` (seed `fixtures`), one per UI state.
Build screens against these; they match exactly what `GET /games/:id/state` returns.
Regenerate with `npm run fixtures`.

- `playerview.lobby.json` — Lobby / waiting room (phase=lobby, roles not yet assigned)
- `playerview.town_active.json` — Plain townsperson, active round, bar healthy, no vote open
- `playerview.tasks.json` — Task deck + this player's cooldowns (GET /games/:id/tasks)
- `playerview.cop.json` — Cop / Investigator view (note you.cop.investigations)
- `playerview.medic.json` — Medic / Protector view (note you.medic.shields)
- `playerview.killer_can_kill.json` — Killer with a kill unlocked (you.killer.canKillNow=true, team charges)
- `playerview.killer_context.json` — getKillContext payload (anonymized current suggestions, §9)
- `playerview.vote_open.json` — An open scheduled vote (vote.open=true, closesAtMinute set)
- `playerview.ghost_flipped.json` — A voted-out townsperson's own view (alive=false, isGhost=true, secretly flipped)
- `playerview.game_over.json` — End-of-round view (result populated)
