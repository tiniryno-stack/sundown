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

## Completed
<!-- Move items here once designed + integrated -->
