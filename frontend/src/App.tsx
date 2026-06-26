/* Root app — owns the lifecycle, navigation, and the live-vs-demo split.

   LIVE (default): join → store identity → usePlayerView() polls GET /state every
   ~5s and routes by phase/role. Real actions hit the API (api.ts).
   DEMO (?demo, or any of ?role/?bar/?phase): renders every screen from
   buildDemoView() with no backend — a floating panel switches the knobs, so each
   screen in the brief is reachable offline. The two modes share all screens. */

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { store } from "./storage";
import { usePlayerView } from "./usePlayerView";
import type { Identity, PlayerView, Task } from "./types";
import {
  DEMO_KILL_SUGGESTIONS, DEMO_REVEAL, DEMO_TASKS,
  buildDemoView, type DemoBar, type DemoPhase, type DemoRole,
} from "./demo";
import { Icon, TableDrawer, roleKeyOf, type IconComp } from "./components/ui";
import {
  HomeScreen, JoinScreen, LobbyScreen, TasksScreen, TutorialScreen,
  VoteResultScreen, VoteScreen,
} from "./screens/cozy";
import {
  CopScreen, GameOverScreen, GhostScreen, KillerScreen, MedicScreen,
} from "./screens/cold";
import { HostApp } from "./screens/host";

/* ── theme ── */
function useTheme(): ["light" | "dark", () => void] {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = store.getTheme();
    if (saved) return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      store.setTheme(next);
      return next;
    });
  }, []);
  return [theme, toggle];
}

/* ── bottom nav ── */
type NavItem = { key: string; label: string; icon: IconComp; badge?: boolean };
function BottomNav({ items, active, onNav, dark }: { items: NavItem[]; active: string; onNav: (k: string) => void; dark: boolean }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 35, padding: "0 16px 26px", pointerEvents: "none" }}>
      <div style={{
        display: "flex", gap: 4, padding: 6, borderRadius: 24, pointerEvents: "auto",
        background: dark ? "rgba(22,24,28,0.85)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid var(--line)", boxShadow: "var(--shadow)",
      }}>
        {items.map((it) => {
          const on = active === it.key;
          const ItIcon = it.icon;
          return (
            <div key={it.key} className="sd-press" onClick={() => onNav(it.key)}
              style={{
                position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0 8px",
                borderRadius: 18, background: on ? "var(--surface-2)" : "transparent", color: on ? "var(--ink)" : "var(--ink-faint)",
              }}>
              <ItIcon s={22} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.01em" }}>{it.label}</span>
              {it.badge && <span style={{ position: "absolute", top: 6, right: "50%", marginRight: -22, width: 8, height: 8, borderRadius: 999, background: "var(--bad)", border: "2px solid var(--surface)" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div style={{ position: "absolute", top: 56, left: 14, zIndex: 25 }}>
      <div className="sd-press" onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 4, height: 40, padding: "0 15px 0 11px",
        borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)", color: "var(--ink)", fontWeight: 600, fontSize: 14.5,
      }}>
        <span style={{ transform: "scaleX(-1)", display: "inline-flex" }}><Icon.chevR s={16} /></span>
        <span>{label}</span>
      </div>
    </div>
  );
}

/* ── the active-game shell: home/tasks tabs + pushed tools/vote/result ── */
type Pushed = "tools" | "vote" | "result" | null;

function ActiveShell({
  view, theme, toggleTheme, dark, tasks, suggestions, actions, reveal, demo, onLeave,
}: {
  view: PlayerView;
  theme: "light" | "dark";
  toggleTheme: () => void;
  dark: boolean;
  tasks: Task[];
  suggestions: string[];
  actions: Actions;
  reveal?: Record<string, import("./types").Role>;
  demo: boolean;
  onLeave?: () => void;
}) {
  const [tab, setTab] = useState<"home" | "tasks">("home");
  const [pushed, setPushed] = useState<Pushed>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [hideSecret, setHideSecret] = useState(false);

  const you = view.you;
  const ghost = !you.alive || you.isGhost;
  const over = view.phase === "resolved" || !!view.result;
  const role = roleKeyOf(you);

  // When the live view flips to a terminal/ghost state, drop any pushed screen.
  useEffect(() => { if (over || ghost) setPushed(null); }, [over, ghost]);
  // Auto-surface the vote when one opens.
  useEffect(() => { if (view.vote.open) setPushed((p) => (p === "vote" ? p : p)); }, [view.vote.open]);

  if (over) return <GameOverScreen view={view} reveal={reveal} onLeave={onLeave} />;
  if (ghost) {
    return (
      <>
        <GhostScreen view={view} onOpenTable={() => setTableOpen(true)} />
        {tableOpen && <TableDrawer players={view.players} youId={you.id} onClose={() => setTableOpen(false)} />}
      </>
    );
  }

  const nextVoteMin = !view.vote.open && !view.vote.resolved ? view.nowMinute + 38 : null;

  let body: React.ReactNode;
  let backLabel: string | null = null;
  if (pushed === "tools") {
    backLabel = "Home";
    body = role === "killer" && you.killer
      ? <KillerScreen view={view} suggestions={suggestions}
          onKill={actions.killerKill} onBankMove={actions.killerBankMove} onWhisper={actions.killerSuggest} />
      : role === "cop" ? <CopScreen view={view} />
      : role === "medic" ? <MedicScreen view={view} />
      : <HomePlaceholder />;
  } else if (pushed === "vote") {
    backLabel = "Home";
    body = <VoteScreen view={view} initialPick={store.getVotePick(view.gameId, view.vote.index ?? 0)} onCast={actions.castVote} />;
  } else if (pushed === "result") {
    backLabel = "Home";
    body = <VoteResultScreen view={view} />;
  } else if (tab === "tasks") {
    body = <TasksScreen view={view} tasks={tasks} refill={demo} onComplete={actions.completeTask} onRate={actions.rateTask} />;
  } else {
    body = <HomeScreen view={view} nextVoteMin={nextVoteMin}
      theme={theme} onToggleTheme={toggleTheme}
      hideSecret={hideSecret} onToggleSecret={() => setHideSecret((h) => !h)}
      onNav={(d) => {
        if (d === "tasks") { setPushed(null); setTab("tasks"); }
        else if (d === "tools") setPushed("tools");
        else if (d === "vote") setPushed("vote");
        else if (d === "result") setPushed("result");
        else if (d === "roster") setTableOpen(true);
      }} />;
  }

  const nav: NavItem[] = [
    { key: "home", label: "Home", icon: Icon.home },
    { key: "tasks", label: "Tasks", icon: Icon.list, badge: view.vote.open },
  ];
  const showNav = !pushed;

  return (
    <>
      <div className="sd-scroll" key={`${tab}-${pushed}`} style={{ position: "relative" }}>
        {backLabel && <BackBar label={backLabel} onBack={() => setPushed(null)} />}
        {body}
        {showNav && <div style={{ height: 96 }} />}
      </div>
      {showNav && <BottomNav items={nav} active={tab} dark={dark} onNav={(k) => { setPushed(null); setTab(k as "home" | "tasks"); }} />}
      {tableOpen && <TableDrawer players={view.players} youId={you.id} onClose={() => setTableOpen(false)} />}
    </>
  );
}

function HomePlaceholder() {
  return <div className="sd-screen" style={{ padding: "120px 22px", textAlign: "center", color: "var(--ink-faint)" }}>Nothing to see here.</div>;
}

/* ── actions surface (the only thing that differs live vs demo) ── */
type Actions = {
  completeTask: (task: Task, answer: string | null, involvedPlayerIds?: string[]) => void;
  rateTask: (taskPrompt: string, rating: "up" | "down") => void;
  castVote: (targetId: string) => void;
  killerKill: (targetId: string) => void;
  killerBankMove: () => void;
  killerSuggest: (targetId: string) => void;
};

/* ── demo knob panel ── */
function DemoPanel({
  phase, role, bar, theme, set, toggleTheme,
}: {
  phase: DemoPhase; role: DemoRole; bar: DemoBar; theme: "light" | "dark";
  set: (k: "phase" | "role" | "bar", v: string) => void;
  toggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sel: React.CSSProperties = {
    appearance: "none", background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)",
    borderRadius: 8, padding: "5px 8px", fontSize: 12, fontWeight: 600,
  };
  const row = (label: string, node: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      {node}
    </div>
  );
  return (
    <div style={{ position: "fixed", right: 14, bottom: 14, zIndex: 200, fontFamily: "var(--font-ui, system-ui)" }}>
      {open && (
        <div style={{
          marginBottom: 8, width: 220, padding: 14, borderRadius: 16, display: "flex", flexDirection: "column", gap: 10,
          background: "var(--surface)", border: "1px solid var(--line-strong)", boxShadow: "var(--shadow)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>Demo · preview states</div>
          {row("Phase", <select value={phase} style={sel} onChange={(e) => set("phase", e.target.value)}>
            {["join", "lobby", "tutorial", "active", "vote", "result", "over"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>)}
          {row("Your role", <select value={role} style={sel} onChange={(e) => set("role", e.target.value)}>
            {["town", "killer", "cop", "medic", "ghost"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>)}
          {row("Mood", <select value={bar} style={sel} onChange={(e) => set("bar", e.target.value)}>
            {["healthy", "strained", "critical"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>)}
          {row("Theme", <button style={{ ...sel, cursor: "pointer" }} onClick={toggleTheme}>{theme}</button>)}
          <div style={{ fontSize: 10.5, color: "var(--ink-faint)", lineHeight: 1.4 }}>Demo data only — no backend. Drop the URL params for the live app.</div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} style={{
        width: 44, height: 44, borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--ink)", color: "var(--bg)", border: "none", boxShadow: "var(--shadow)",
      }}><Icon.spark s={20} /></button>
    </div>
  );
}

/* ── DEMO app ── */
function DemoApp({ initial }: { initial: { role: DemoRole; bar: DemoBar; phase: DemoPhase } }) {
  const [theme, toggleTheme] = useTheme();
  const [knobs, setKnobs] = useState(initial);
  const [tutorialDone, setTutorialDone] = useState(false);
  const set = (k: "phase" | "role" | "bar", v: string) => {
    setTutorialDone(false);
    setKnobs((s) => ({ ...s, [k]: v }));
  };
  const view = buildDemoView(knobs.role, knobs.bar, knobs.phase);
  const dark = theme === "dark";

  const noopActions: Actions = {
    completeTask: () => {}, castVote: (id) => store.setVotePick(view.gameId, view.vote.index ?? 0, id),
    killerKill: () => {}, killerBankMove: () => {}, killerSuggest: () => {}, rateTask: () => {},
  };

  let body: React.ReactNode;
  if (knobs.phase === "join") {
    body = <JoinScreen onJoin={() => set("phase", "lobby")} />;
  } else if (knobs.phase === "lobby") {
    body = <LobbyScreen view={view} onStart={() => set("phase", "tutorial")} />;
  } else if (knobs.phase === "tutorial" && !tutorialDone) {
    body = <TutorialScreen onDone={() => { setTutorialDone(true); setKnobs((s) => ({ ...s, phase: "active" })); }} />;
  } else {
    body = <ActiveShell view={view} theme={theme} toggleTheme={toggleTheme} dark={dark}
      tasks={DEMO_TASKS} suggestions={knobs.role === "killer" ? DEMO_KILL_SUGGESTIONS : []}
      actions={noopActions} reveal={DEMO_REVEAL} demo />;
  }

  return (
    <div className="sd-root" data-theme={theme}>
      {body}
      <DemoPanel phase={knobs.phase} role={knobs.role} bar={knobs.bar} theme={theme} set={set} toggleTheme={toggleTheme} />
    </div>
  );
}

/* ── LIVE app ── */
function LiveApp() {
  const [theme, toggleTheme] = useTheme();
  const dark = theme === "dark";
  // ?join=SUN7DD pre-fills the code and forces the Join screen regardless of
  // any stored identity — the shared link targets a specific new game.
  const joinParam = new URLSearchParams(window.location.search).get("join") ?? "";
  const initialCode = joinParam ? joinParam.toUpperCase().replace(/^SUN-?/i, "SUN") : "SUN";
  const [identity, setIdentity] = useState<Identity | null>(() =>
    joinParam ? null : store.getIdentity(),
  );
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [tutorialSeen, setTutorialSeen] = useState(() => store.getTutorialSeen());

  const { view, error, loading, refresh } = usePlayerView(identity);

  // Tasks (fetched on load, when game goes active, and after each completion).
  const [tasks, setTasks] = useState<Task[]>([]);
  const fetchTasks = useCallback(async () => {
    if (!identity) return;
    try {
      const r = await api.getTasks(identity.gameId, identity.playerId, identity.token);
      setTasks(r.tasks);
    } catch { /* keep the last good deck */ }
  }, [identity]);
  useEffect(() => { void fetchTasks(); }, [fetchTasks]);
  // Re-fetch when the host starts the round — tasks are generated at that moment.
  useEffect(() => {
    if (view?.phase === "active" && tasks.length === 0) void fetchTasks();
  }, [view?.phase, fetchTasks, tasks.length]);

  // Killer suggestions (fetched when a live killer is present).
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!identity || !view?.you.killer || view.you.isGhost) { setSuggestions([]); return; }
    let alive = true;
    api.getKillContext(identity.gameId, identity.playerId, identity.token)
      .then((c) => { if (alive) setSuggestions(c.suggestions ?? []); })
      .catch(() => { if (alive) setSuggestions([]); });
    return () => { alive = false; };
  }, [identity, view?.you.killer, view?.you.isGhost, view?.nowMinute]);

  // Stale identity (bad creds or a wiped game) → clear it and return to Join.
  useEffect(() => {
    if (error === "stale identity") {
      store.clearIdentity();
      setIdentity(null);
    }
  }, [error]);

  const doJoin = useCallback(async ({ name, code }: { name: string; code: string }) => {
    setJoinBusy(true);
    setJoinError(null);
    // The brief's code is "SUN-XXX"; the gameId is "g_xxxxxx". Accept either, and a
    // raw gameId, so testers can paste exactly what `npm run serve` prints.
    const cleaned = code.trim().replace(/^SUN-?/i, "").toLowerCase();
    const gameId = code.trim().startsWith("g_") ? code.trim() : `g_${cleaned}`;
    try {
      const { playerId, token } = await api.join(gameId, name);
      const id: Identity = { gameId, playerId, token, name };
      store.setIdentity(id);
      // Reset tutorial flag so every new game shows the walkthrough.
      store.setTutorialSeen(false);
      setTutorialSeen(false);
      setIdentity(id);
    } catch (e) {
      setJoinError(e instanceof ApiError ? e.message : "Couldn't join — check the code and try again.");
    } finally {
      setJoinBusy(false);
    }
  }, []);

  const actions: Actions = {
    completeTask: (task, _answer, involvedPlayerIds) => {
      if (!identity) return;
      void api.completeTask(identity.gameId, identity.playerId, identity.token, task.id)
        .then(() => { void fetchTasks(); refresh(); })
        .catch(() => { void fetchTasks(); });
      // Schedule a witness notice to each tagged player (2 min delay).
      for (const targetId of (involvedPlayerIds ?? [])) {
        void api.addWitnessNotice(identity.gameId, identity.playerId, identity.token, targetId, task.prompt, 2 * 60_000).catch(() => {});
      }
    },
    castVote: (targetId) => {
      if (!identity || !view) return;
      store.setVotePick(view.gameId, view.vote.index ?? 0, targetId);
      void api.castVote(identity.gameId, identity.playerId, identity.token, targetId).then(refresh).catch(() => {});
    },
    killerKill: (targetId) => {
      if (!identity) return;
      void api.killerKill(identity.gameId, identity.playerId, identity.token, targetId).then(refresh).catch(() => {});
    },
    killerBankMove: () => {
      if (!identity) return;
      void api.killerBankMove(identity.gameId, identity.playerId, identity.token).then(refresh).catch(() => {});
    },
    killerSuggest: (targetId) => {
      if (!identity) return;
      void api.killerSuggest(identity.gameId, identity.playerId, identity.token, targetId).then(refresh).catch(() => {});
    },
    rateTask: (taskPrompt, rating) => {
      if (!identity) return;
      void api.rateTask(identity.gameId, identity.playerId, identity.token, taskPrompt, rating).catch(() => {});
    },
  };

  // ── render ──
  if (!identity) {
    return (
      <div className="sd-root" data-theme={theme}>
        <JoinScreen busy={joinBusy} error={joinError} onJoin={doJoin} initialCode={initialCode} />
      </div>
    );
  }

  if (loading && !view) {
    return (
      <div className="sd-root" data-theme={theme}>
        <div className="sd-screen" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-faint)" }}>
          <span style={{ display: "flex", animation: "sd-breathe 2s ease-in-out infinite" }}><Icon.spark s={28} /></span>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="sd-root" data-theme={theme}>
        <div className="sd-screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, padding: 24, textAlign: "center", color: "var(--ink-soft)" }}>
          <Icon.alert s={28} />
          <div style={{ fontWeight: 700 }}>Can't reach the table</div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>{error ?? "Trying again…"}</div>
        </div>
      </div>
    );
  }

  // Lobby — only show a host "begin" button on a device that created this game.
  if (view.phase === "lobby") {
    const isHost = store.getHostGames().some((g) => g.gameId === view.gameId);
    const onStart = isHost
      ? () => { void api.startRound(view.gameId, store.getHostId()).then(refresh).catch(() => {}); }
      : undefined;
    const onLeave = () => { store.clearIdentity(); setIdentity(null); };
    return (
      <div className="sd-root" data-theme={theme}>
        <LobbyScreen view={view} onStart={onStart} onLeave={onLeave} />
      </div>
    );
  }

  // First entry into the day → one-time tutorial overlay.
  const over = view.phase === "resolved" || !!view.result;
  const ghost = !view.you.alive || view.you.isGhost;
  if (!tutorialSeen && !over && !ghost) {
    return (
      <div className="sd-root" data-theme={theme}>
        <TutorialScreen onDone={() => { store.setTutorialSeen(true); setTutorialSeen(true); }} />
      </div>
    );
  }

  return (
    <div className="sd-root" data-theme={theme}>
      <ActiveShell view={view} theme={theme} toggleTheme={toggleTheme} dark={dark}
        tasks={tasks} suggestions={suggestions} actions={actions} demo={false}
        onLeave={() => { store.clearIdentity(); setIdentity(null); }} />
    </div>
  );
}

/* ── entry: pick demo vs host vs live from the URL ── */
export default function App() {
  const q = new URLSearchParams(window.location.search);
  // ?reset clears any stored identity and returns to the join screen.
  if (q.has("reset")) {
    store.clearIdentity();
    window.location.replace(window.location.pathname);
    return null;
  }
  if (q.has("host")) return <HostApp />;
  const demo = q.has("demo") || q.has("role") || q.has("phase") || q.has("bar");
  if (demo) {
    return (
      <DemoApp initial={{
        role: (q.get("role") as DemoRole) || "town",
        bar: (q.get("bar") as DemoBar) || "healthy",
        phase: (q.get("phase") as DemoPhase) || "active",
      }} />
    );
  }
  return <LiveApp />;
}
