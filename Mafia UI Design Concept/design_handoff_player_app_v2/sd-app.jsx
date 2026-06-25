/* Quorum — root app: light/dark theme, navigation, privacy, tweaks. */

const { useState: useStateA, useEffect: useEffectA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "phase": "active",
  "role": "town",
  "bar": "strained",
  "motion": true
}/*EDITMODE-END*/;

/* allow ?theme=&phase=&role=&bar= to preview any state directly */
function initialTweaks() {
  const q = new URLSearchParams(location.search);
  const out = { ...TWEAK_DEFAULTS };
  ["theme", "phase", "role", "bar"].forEach((k) => { if (q.get(k)) out[k] = q.get(k); });
  if (q.get("motion") === "off") out.motion = false;
  return out;
}

function BackBar({ label, onBack }) {
  return (
    <div style={{ position: "absolute", top: 56, left: 14, zIndex: 25 }}>
      <div className="sd-press" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, height: 40, padding: "0 15px 0 11px",
        borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)", color: "var(--ink)", fontWeight: 600, fontSize: 14.5 }}>
        <span style={{ transform: "scaleX(-1)", display: "inline-flex" }}><Icon.chevR s={16} /></span>
        <span>{label}</span>
      </div>
    </div>
  );
}

function BottomNav({ items, active, onNav, dark }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 35, padding: "0 16px 26px", pointerEvents: "none" }}>
      <div style={{ display: "flex", gap: 4, padding: 6, borderRadius: 24, pointerEvents: "auto",
        background: dark ? "rgba(22,24,28,0.85)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}>
        {items.map((it) => {
          const on = active === it.key;
          return (
            <div key={it.key} className="sd-press" onClick={() => onNav(it.key)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0 8px",
                borderRadius: 18, background: on ? "var(--surface-2)" : "transparent", color: on ? "var(--ink)" : "var(--ink-faint)" }}>
              <it.icon s={22} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.01em" }}>{it.label}</span>
              {it.badge && <span style={{ position: "absolute", marginTop: -33, marginLeft: 22, width: 8, height: 8, borderRadius: 999, background: "var(--bad)", border: "2px solid var(--surface)" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RosterScreen({ view }) {
  const living = view.players.filter((p) => p.alive).length;
  return (
    <div className="sd-screen sd-scroll" style={{ padding: "64px 18px 110px" }}>
      <div className="sd-mono" style={{ color: "var(--ink-faint)", marginBottom: 8 }}>Players · names only</div>
      <div className="sd-display" style={{ fontSize: 34, marginBottom: 6 }}>The table</div>
      <div className="sd-riddle" style={{ fontSize: 16, color: "var(--ink-soft)", marginBottom: 18 }}>
        {living} players still in. Quorum never shows whose side anyone is on — working that out is the whole game.
      </div>
      <Card raised pad={6}>
        {view.players.map((p, i) => (
          <div key={p.id}>
            <RosterRow p={p} you={view.you.id} />
            {i < view.players.length - 1 && <div style={{ height: 1, background: "var(--line)", margin: "0 4px" }} />}
          </div>
        ))}
      </Card>
    </div>
  );
}

function App({ t, setTweak, view, theme, dark }) {
  const [tab, setTab] = useStateA("home");
  const [pushed, setPushed] = useStateA(null);   // 'tools' | 'vote'
  const [tableOpen, setTableOpen] = useStateA(false);
  const [hideSecret, setHideSecret] = useStateA(false);

  // reduced-motion override from tweak
  useEffectA(() => {
    document.body.dataset.motion = t.motion ? "on" : "off";
  }, [t.motion]);

  // reset nav when phase/role changes
  useEffectA(() => { setTab("home"); setPushed(t.phase === "result" ? "result" : null); setTableOpen(false); }, [t.phase, t.role]);

  const nextVoteMin = t.phase === "active" ? view.nowMinute + 38 : null;
  const toggleTheme = () => setTweak("theme", theme === "dark" ? "light" : "dark");

  let body, nav = null, backLabel = null;
  if (t.phase === "join") {
    body = <JoinScreen view={view} onJoin={() => setTweak("phase", "lobby")} />;
  } else if (t.phase === "lobby") {
    body = <LobbyScreen view={view} onStart={() => setTweak("phase", "tutorial")} />;
  } else if (t.phase === "tutorial") {
    body = <TutorialScreen onDone={() => setTweak("phase", "active")} />;
  } else if (t.phase === "over") {
    body = <GameOverScreen view={view} />;
  } else if (t.role === "ghost") {
    nav = [{ key: "home", label: "Out", icon: Icon.ghost }];
    body = <GhostScreen view={view} onOpenTable={() => setTableOpen(true)} />;
  } else {
    const ToolScreen = { killer: KillerScreen, cop: CopScreen, medic: MedicScreen }[t.role];
    nav = [
      { key: "home", label: "Home", icon: Icon.home },
      { key: "tasks", label: "Tasks", icon: Icon.list },
    ];
    if (pushed === "tools" && ToolScreen) { body = <ToolScreen view={view} />; backLabel = "Home"; }
    else if (pushed === "vote") { body = <VoteScreen view={view} />; backLabel = "Home"; }
    else if (pushed === "result") { body = <VoteResultScreen view={view} />; backLabel = "Home"; }
    else if (tab === "tasks") body = <TasksScreen view={view} />;
    else body = <HomeScreen view={view} nextVoteMin={nextVoteMin}
      theme={theme} onToggleTheme={toggleTheme} hideSecret={hideSecret} onToggleSecret={() => setHideSecret((h) => !h)}
      onNav={(d) => { if (d === "tools") setPushed(d); else if (d === "vote") setPushed("vote"); else if (d === "result") setPushed("result"); else if (d === "roster") setTableOpen(true); else { setPushed(null); setTab(d); } }} />;
  }

  const showNav = nav && !pushed;

  return (
    <div className="sd-root" data-theme={theme}>
      <div className="sd-scroll" key={`${t.phase}-${t.role}-${tab}-${pushed}`} style={{ position: "relative" }}>
        {backLabel && <BackBar label={backLabel} onBack={() => setPushed(null)} />}
        {body}
        {showNav && <div style={{ height: 96 }} />}
      </div>
      {showNav && <BottomNav items={nav} active={tab} onNav={(k) => { setPushed(null); setTab(k); }} dark={dark} />}

      {tableOpen && <TableDrawer view={view} onClose={() => setTableOpen(false)} />}

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.theme} options={["light", "dark"]} onChange={(v) => setTweak("theme", v)} />
        <TweakToggle label="Ambient motion" value={t.motion} onChange={(v) => setTweak("motion", v)} />
        <TweakSection label="Preview game state" />
        <TweakRadio label="Phase" value={t.phase} options={["join", "lobby", "tutorial", "active", "vote", "result", "over"]} onChange={(v) => setTweak("phase", v)} />
        <TweakSelect label="Your role" value={t.role} options={["town", "killer", "cop", "medic", "ghost"]} onChange={(v) => setTweak("role", v)} />
        <TweakRadio label="Group mood" value={t.bar} options={["healthy", "strained", "critical"]} onChange={(v) => setTweak("bar", v)} />
      </TweaksPanel>
    </div>
  );
}

function Mount() {
  const [t, setTweak] = useTweaks(initialTweaks());
  const view = window.SD.buildView({ role: t.role, bar: t.bar, phase: t.phase });
  const theme = t.theme === "dark" ? "dark" : "light";
  const dark = theme === "dark";
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      background: dark ? "#000" : "#E7E7E3" }}>
      <IOSDevice dark={dark} width={402} height={874}>
        <App t={t} setTweak={setTweak} view={view} theme={theme} dark={dark} />
      </IOSDevice>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Mount />);
