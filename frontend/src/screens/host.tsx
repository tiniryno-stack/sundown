/* Sundown — Host / Control Room.
   Omniscient host-only surface. Accessible via ?host in the URL.
   Three phases: Create → Lobby → Active dashboard.
   Polls GET /games/:id/host-state every 5 s. */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api, ApiError } from "../api";
import { store } from "../storage";
import { Icon, avatarColor, clockOf } from "../components/ui";
import type { HostView } from "../types";

const POLL_MS = 5000;

/* ── responsive window width (iOS orientation-safe) ─────── */
function useWindowWidth(): number {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("resize", cb);
      // iOS Safari fires orientationchange but not always resize.
      window.addEventListener("orientationchange", cb);
      return () => {
        window.removeEventListener("resize", cb);
        window.removeEventListener("orientationchange", cb);
      };
    },
    () => window.innerWidth,
    () => 1280,
  );
}

/* ── host-only icons ─────────────────────────────────────── */
const HIcon = {
  gavel: (p: { s?: number }) => (
    <svg viewBox="0 0 24 24" width={p.s ?? 18} height={p.s ?? 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11l5-5M10 13l5-5M5.5 13.5l5 5M3 21h7M14.5 3.5l6 6M16 8l-7 7" />
    </svg>
  ),
  scales: (p: { s?: number }) => (
    <svg viewBox="0 0 24 24" width={p.s ?? 18} height={p.s ?? 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16M6 20h12M5 7l-3 6h6zM5 7l7-1.5M19 7l-3 6h6zM19 7l-7-1.5M2 13a3 3 0 006 0M16 13a3 3 0 006 0" />
    </svg>
  ),
  skull: (p: { s?: number }) => (
    <svg viewBox="0 0 24 24" width={p.s ?? 18} height={p.s ?? 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a8 8 0 00-5 14v3h10v-3a8 8 0 00-5-14z" />
      <circle cx="9" cy="11" r="1.4" />
      <circle cx="15" cy="11" r="1.4" />
      <path d="M12 15v2" />
    </svg>
  ),
  box: (p: { s?: number }) => (
    <svg viewBox="0 0 24 24" width={p.s ?? 18} height={p.s ?? 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  ),
};

/* ── small atoms ─────────────────────────────────────────── */
function Mono({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: "var(--font-ui, system-ui)", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.06em", color: "var(--ink-faint)", ...style }}>
      {children}
    </span>
  );
}

function PanelHead({ icon: Ic, title, hint }: { icon?: (p: { s?: number }) => React.ReactElement; title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
      {Ic && <span style={{ color: "var(--ink-faint)", display: "inline-flex" }}><Ic s={16} /></span>}
      <Mono style={{ color: "var(--ink-soft)" }}>{title}</Mono>
      {hint && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-faint)", fontWeight: 500 }}>{hint}</span>}
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18,
      padding: 18, boxShadow: "var(--shadow-sm)", ...style }}>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div>
      <Mono style={{ display: "block", marginBottom: 6 }}>{label}</Mono>
      <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums",
        color: color ?? "var(--ink)", lineHeight: 1, minHeight: 20, display: "flex", alignItems: "center",
        fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 5, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function Dots({ filled, total, color = "var(--accent)" }: { filled: number; total: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          width: 9, height: 9, borderRadius: 3,
          background: i < filled ? color : "transparent",
          border: i < filled ? "none" : "1.5px solid var(--line-strong)",
        }} />
      ))}
    </span>
  );
}

function gameCode(gameId: string): string {
  return "SUN-" + gameId.replace("g_", "").slice(0, 3).toUpperCase();
}

function playerJoinUrl(gameId: string): string {
  const code = gameCode(gameId).replace("-", "");
  return `${window.location.origin}/?join=${code}`;
}

function ResetGameButton({ gameId, onDone }: { gameId: string; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.deleteGame(gameId, store.getHostId());
    } catch { /* gone anyway */ }
    // Clear the gameId from URL so we go back to create screen.
    const next = new URL(window.location.href);
    next.searchParams.delete("gameId");
    window.history.replaceState({}, "", next.toString());
    onDone();
  };

  if (confirm) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--bad)", fontWeight: 700 }}>Delete this game?</span>
        <button onClick={busy ? undefined : doDelete} disabled={busy} style={{
          height: 36, padding: "0 14px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "var(--bad)", color: "#fff", fontWeight: 700, fontSize: 13,
        }}>{busy ? "Deleting…" : "Yes, delete"}</button>
        <button onClick={() => setConfirm(false)} style={{
          height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)",
          background: "var(--surface-2)", color: "var(--ink)", cursor: "pointer", fontWeight: 600, fontSize: 13,
        }}>Cancel</button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirm(true)} style={{
      display: "flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px",
      borderRadius: 10, border: "1px solid var(--line)", cursor: "pointer",
      background: "transparent", color: "var(--ink-faint)", fontWeight: 600, fontSize: 13,
    }}>
      Reset game
    </button>
  );
}

function CopyLinkButton({ gameId }: { gameId: string }) {
  const [copied, setCopied] = useState(false);
  const url = playerJoinUrl(gameId);
  const code = gameCode(gameId);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Sundown",
          text: `Join the game — code ${code}`,
          url,
        });
      } catch {
        // user cancelled share sheet — no action needed
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button onClick={() => void share()} style={{
      display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px",
      borderRadius: 12, border: "1px solid var(--line)", cursor: "pointer",
      background: copied ? "color-mix(in oklab, var(--good) 15%, var(--surface))" : "var(--surface)",
      color: copied ? "var(--good)" : "var(--ink)", fontWeight: 700, fontSize: 14,
      transition: "background .2s, color .2s",
    }}>
      <Icon.share s={16} />
      {copied ? "Link copied!" : "Share player link"}
    </button>
  );
}

/* ── polling hook ────────────────────────────────────────── */
function useHostView(gameId: string | null) {
  const hostId = store.getHostId();
  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!gameId) return;
    try {
      const v = await api.getHostState(gameId, hostId);
      setView(v);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "network error");
    } finally {
      setLoading(false);
    }
  }, [gameId, hostId]);

  useEffect(() => {
    if (!gameId) { setLoading(false); return; }
    setLoading(true);
    void fetch();
    const id = setInterval(() => void fetch(), POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") void fetch(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [gameId, fetch]);

  return { view, error, loading, refresh: fetch };
}

/* ── RosterPanel ─────────────────────────────────────────── */
function TeamTag({ team }: { team: string }) {
  const killer = team === "killer";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px",
      borderRadius: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em",
      background: killer ? "color-mix(in oklab, var(--bad) 16%, transparent)" : "var(--surface-2)",
      color: killer ? "var(--bad)" : "var(--ink-soft)",
    }}>
      {killer ? "KILLER" : "TOWN"}
    </span>
  );
}

function RosterPanel({ view }: { view: HostView }) {
  const standing = view.players.filter(p => p.alive).length;
  return (
    <Panel>
      <PanelHead icon={Icon.users} title="True roster" hint={`${standing} of ${view.players.length} standing`} />
      <div>
        {view.players.map((p, i) => {
          const alive = p.alive;
          const killer = p.team === "killer";
          const ring = killer ? "var(--bad)" : "var(--line-strong)";
          const label = ({ townsperson: "Townsperson", killer: "Killer", cop: "Investigator", medic: "Medic" } as Record<string, string>)[p.role] ?? p.role;
          const meterFrac = (p.meterPoints != null && view.killCost > 0)
            ? Math.min(1, p.meterPoints / view.killCost) : 0;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12,
              padding: "10px 2px", opacity: alive ? 1 : 0.4,
              borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{
                position: "relative", width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: alive ? avatarColor(p.id) : "var(--surface-2)",
                filter: alive ? "none" : "grayscale(1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: alive ? "#fff" : "var(--ink-faint)", fontWeight: 800, fontSize: 15,
                boxShadow: `0 0 0 2px var(--surface), 0 0 0 3.5px ${ring}`,
              }}>
                {p.name[0]}
                {!alive && (
                  <div style={{ position: "absolute", right: -3, bottom: -3, color: "var(--ink-faint)",
                    background: "var(--surface)", borderRadius: 999, display: "flex" }}>
                    <HIcon.skull s={14} />
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15.5,
                    textDecoration: alive ? "none" : "line-through" }}>{p.name}</span>
                  <TeamTag team={p.team} />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-faint)", fontWeight: 600, marginTop: 2 }}>{label}</div>
              </div>
              {alive && killer && p.meterPoints != null && (
                <div style={{ width: 60, flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 700,
                    fontVariantNumeric: "tabular-nums" }}>{p.meterPoints}/{view.killCost}</div>
                  <div style={{ height: 4, borderRadius: 999, background: "var(--surface-2)", marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${meterFrac * 100}%`,
                      background: p.canKillNow ? "var(--bad)" : "var(--ink-faint)", borderRadius: 999 }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── ParityWatch ─────────────────────────────────────────── */
function ParityWatch({ view }: { view: HostView }) {
  const t = view.townCount;
  const k = view.killerCount;
  const parity = k >= t && k > 0;
  const total = Math.max(1, t + k);
  const toParity = Math.max(0, t - k);
  return (
    <Panel style={{ borderColor: parity ? "var(--bad)" : "var(--line)" }}>
      <PanelHead icon={HIcon.scales} title="Parity watch"
        hint={parity ? "PARITY — killers win" : `${toParity} town from parity`} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", fontWeight: 700, marginBottom: 3 }}>Living town</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: "var(--ink)", lineHeight: 1,
            fontFamily: "var(--font-display)" }}>{t}</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 700, paddingBottom: 6 }}>vs</div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "var(--bad)", fontWeight: 700, marginBottom: 3 }}>Living killers</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: "var(--bad)", lineHeight: 1,
            fontFamily: "var(--font-display)" }}>{k}</div>
        </div>
      </div>
      <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}>
        <div style={{ width: `${(t / total) * 100}%`, background: "var(--ink-soft)", transition: "width .4s ease" }} />
        <div style={{ width: `${(k / total) * 100}%`, background: "var(--bad)", transition: "width .4s ease" }} />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 11, lineHeight: 1.4 }}>
        Players see only <b style={{ color: "var(--ink)" }}>{view.livingCount} still standing</b> — never the split.
      </div>
    </Panel>
  );
}

/* ── TownBarPanel ────────────────────────────────────────── */
function TownBarPanel({ view }: { view: HostView }) {
  const band = view.barBand;
  const color = band === "healthy" ? "var(--good)" : band === "strained" ? "var(--warn)" : "var(--bad)";
  const bannerText: Record<string, string> = { healthy: '"The day holds"', strained: '"A strain in the air"', critical: '"Something is wrong"' };
  const playerSees = bannerText[band] ?? '"…"';
  return (
    <Panel>
      <PanelHead icon={Icon.alert} title="Town bar — exact" />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 44, fontWeight: 800, color, lineHeight: 0.9,
          fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-display)" }}>
          {Math.round(view.bar)}
        </span>
        <span style={{ fontSize: 16, color: "var(--ink-faint)", fontWeight: 700, paddingBottom: 4 }}>/ 100</span>
        <span style={{ marginLeft: "auto", textTransform: "uppercase", letterSpacing: "0.12em",
          fontSize: 12, fontWeight: 800, color, paddingBottom: 6 }}>{band}</span>
      </div>
      <div style={{ position: "relative", height: 14, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${view.bar}%`,
          background: color, borderRadius: 999, transition: "width .2s linear, background .6s ease" }} />
        {[33, 66].map((v) => (
          <span key={v} style={{ position: "absolute", left: `${v}%`, top: 0, bottom: 0,
            width: 2, background: "var(--surface)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <Mono>critical</Mono><Mono>strained</Mono><Mono>healthy</Mono>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, padding: "10px 12px",
        borderRadius: 11, background: "var(--surface-2)" }}>
        <Icon.eyeOff s={15} />
        <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
          Players see only the band: <b style={{ color }}>{playerSees}</b>
        </span>
      </div>
    </Panel>
  );
}

/* ── VotesPanel ──────────────────────────────────────────── */
function VotesPanel({ view }: { view: HostView }) {
  const now = view.nowMinute;
  const s = view.startedAtMs;
  const votes = view.voteTimesMin;
  const next = votes.find(v => v > now);
  return (
    <Panel>
      <PanelHead icon={HIcon.gavel} title="Votes"
        hint={`${votes.filter(v => v <= now).length} held · ${view.vote.totalVotes}/${view.vote.totalEligible} cast`} />
      {view.vote.open && (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 11,
          background: "color-mix(in oklab, var(--warn) 12%, var(--surface-2))",
          border: "1px solid color-mix(in oklab, var(--warn) 30%, transparent)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--warn)" }}>
            Vote {(view.vote.index ?? 0) + 1} open now
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
            {view.vote.totalVotes} of {view.vote.totalEligible} players voted
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {votes.map((v, i) => {
          const done = v <= now && !view.vote.open;
          const isOpen = view.vote.open && view.vote.index === i;
          const isNext = v === next && !isOpen;
          const opensAt = v - 20;
          return (
            <div key={v} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10,
              background: isOpen ? "color-mix(in oklab, var(--warn) 8%, var(--surface-2))"
                : isNext ? "color-mix(in oklab, var(--accent) 8%, var(--surface-2))"
                : "var(--surface-2)",
              opacity: done ? 0.55 : 1,
              border: isOpen ? "1px solid var(--warn)"
                : isNext ? "1px solid var(--line-strong)"
                : "1px solid transparent",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 7,
                background: done ? "var(--ink-faint)" : isOpen ? "var(--warn)" : isNext ? "var(--accent)" : "var(--surface)",
                color: done || isOpen || isNext ? "var(--accent-ink)" : "var(--ink-faint)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800,
              }}>{i + 1}</span>
              <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                {clockOf(v, s)}
              </span>
              <span style={{
                marginLeft: "auto", fontSize: 11.5, fontWeight: 700,
                color: done ? "var(--ink-faint)" : isOpen ? "var(--warn)" : isNext ? "var(--accent)" : "var(--ink-faint)",
              }}>
                {done ? "held" : isOpen ? "open now" : isNext ? `opens ${clockOf(opensAt, s)}` : "scheduled"}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── EconomyPanel ────────────────────────────────────────── */
function EconomyPanel({ view }: { view: HostView }) {
  const livingKillers = view.players.filter(p => p.alive && p.team === "killer");
  return (
    <Panel>
      <PanelHead icon={HIcon.box} title="Killer economy" hint={`${livingKillers.length} active`} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Stat label="Move charges"
          value={<Dots filled={view.moveCharges} total={view.maxMoves} color="var(--accent)" />}
          sub={`${view.maxMoves} max`} />
        <Stat label="Kill cost" value={`${view.killCost} pts`} />
        {livingKillers.map(k => (
          <div key={k.id} style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 10, background: "var(--surface-2)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: avatarColor(k.id),
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
              {k.name[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{k.name}</div>
              <div style={{ height: 4, borderRadius: 999, background: "var(--line)", marginTop: 5, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, ((k.meterPoints ?? 0) / view.killCost) * 100)}%`,
                  background: k.canKillNow ? "var(--bad)" : "var(--accent)", borderRadius: 999,
                }} />
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: k.canKillNow ? "var(--bad)" : "var(--ink-faint)",
              flexShrink: 0 }}>
              {k.meterPoints ?? 0}/{view.killCost}{k.canKillNow ? " ⚡" : ""}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ── ResultBanner ────────────────────────────────────────── */
function ResultBanner({ result, startedAtMs }: { result: NonNullable<HostView["result"]>; startedAtMs: number }) {
  const killerWin = result.winner === "killer";
  const color = killerWin ? "var(--bad)" : "var(--good)";
  const reasons: Record<string, string> = {
    parity: "Killers reached parity",
    collapse: "Town bar collapsed",
    allKillersEliminated: "Town eliminated every killer",
    finaleSurvival: "Killers survived to finale",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderRadius: 16,
      background: "var(--surface)", border: `1px solid ${color}`, borderTop: `3px solid ${color}`,
      boxShadow: "var(--shadow-sm)" }}>
      <span style={{ width: 42, height: 42, borderRadius: 12, background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {killerWin ? <Icon.blade s={22} /> : <Icon.shield s={22} />}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "var(--font-display)" }}>
          {killerWin ? "Killers win" : "Town wins"}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>
          {reasons[result.reason] ?? result.reason} · {clockOf(result.at, startedAtMs)}
        </div>
      </div>
      <Mono>Roles now public</Mono>
    </div>
  );
}

/* ── HostTimeline ────────────────────────────────────────── */
const EVENT_ICON: Record<string, (p: { s?: number }) => React.ReactElement> = {
  kill: Icon.blade,
  shield: Icon.shield,
  vote: HIcon.gavel,
  task: Icon.glass,
  witness: Icon.bell,
};
function HostTimeline({ view }: { view: HostView }) {
  const events = [...(view.events ?? [])].reverse();
  return (
    <Panel style={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: 420, overflow: "hidden" }}>
      <PanelHead icon={Icon.list} title="Event log" hint={`${events.length} event${events.length !== 1 ? "s" : ""}`} />
      <div style={{ overflowY: "auto", flex: 1, margin: "0 -4px", paddingRight: 4 }}>
        {events.length === 0 ? (
          <div style={{ fontSize: 13.5, color: "var(--ink-faint)", padding: "12px 4px", lineHeight: 1.5 }}>
            The day just began — events will appear here as the game unfolds.
          </div>
        ) : events.map((e, i) => {
          const Ic = EVENT_ICON[e.kind] ?? Icon.spark;
          const isWitness = e.kind === "witness";
          return (
            <div key={i} style={{ display: "flex", gap: 11, padding: "11px 4px",
              borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                background: isWitness ? "color-mix(in oklab, var(--accent) 12%, var(--surface-2))" : "var(--surface-2)",
                color: isWitness ? "var(--accent)" : "var(--ink-faint)" }}>
                <Ic s={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600, lineHeight: 1.35 }}>
                  {e.message}
                </div>
                <div className="sd-mono" style={{ color: "var(--ink-faint)", marginTop: 3 }}>
                  {clockOf(e.at, view.startedAtMs)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── StatsPanel ──────────────────────────────────────────── */
function StatsPanel({ view }: { view: HostView }) {
  const s = view.startedAtMs;
  return (
    <Panel>
      <PanelHead icon={Icon.spark} title="Round stats" />
      <div className="host-stat-grid">
        <Stat label="Now" value={clockOf(view.nowMinute, s)} sub="game clock" />
        <Stat label="Alive" value={view.livingCount} sub={`of ${view.players.length}`} />
        <Stat label="Finale" value={clockOf(view.finaleMinute, s)} />
        <Stat label="Votes left" value={view.voteTimesMin.filter(v => v > view.nowMinute).length} sub="remaining" />
      </div>
    </Panel>
  );
}

/* ── OmniscientBadge ─────────────────────────────────────── */
function OmniscientBadge() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, height: 28, padding: "0 12px",
      borderRadius: 999, background: "color-mix(in oklab, var(--bad) 12%, transparent)",
      color: "var(--bad)", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
      <Icon.eyeOff s={15} /> Omniscient — players see none of this
    </div>
  );
}

/* ── HostActiveScreen ────────────────────────────────────── */
function HostActiveScreen({ view, gameId, onReset }: { view: HostView; gameId: string; onReset: () => void }) {
  const w = useWindowWidth();
  const frac = Math.min(1, view.nowMinute / view.finaleMinute);

  return (
    <div style={{ minHeight: "100vh", background: "#0B0C0E", color: "var(--ink)" }}>
      {/* sticky top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--surface)",
        borderBottom: "1px solid var(--line)", padding: "12px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", rowGap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent)",
              color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0 }}>
              <Icon.eye s={15} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
                letterSpacing: "-0.02em", lineHeight: 1 }}>Sundown</div>
              <Mono style={{ marginTop: 2 }}>Host · {gameCode(gameId)} · {view.players.length}p</Mono>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <CopyLinkButton gameId={gameId} />
            <ResetGameButton gameId={gameId} onDone={onReset} />
            {w >= 600 && <OmniscientBadge />}
          </div>
        </div>
        {/* day arc */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, position: "relative", height: 10, borderRadius: 999,
            background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${frac * 100}%`,
              background: "var(--accent)", borderRadius: 999, transition: "width .3s ease" }} />
            {view.voteTimesMin.map(v => (
              <span key={v} title={`Vote · ${clockOf(v, view.startedAtMs)}`} style={{
                position: "absolute", left: `${(v / view.finaleMinute) * 100}%`,
                top: 0, bottom: 0, width: 2, marginLeft: -1,
                background: v <= view.nowMinute ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.4)",
              }} />
            ))}
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", flexShrink: 0 }}>
            {clockOf(view.nowMinute, view.startedAtMs)}
          </span>
        </div>
      </div>

      {/* panels grid — layout driven by CSS classes so rotation works natively */}
      <div className="host-grid">
        {/* col A — roster + economy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <RosterPanel view={view} />
          <EconomyPanel view={view} />
        </div>
        {/* col B — parity + bar + col-C content on narrow screens */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {view.result && <ResultBanner result={view.result} startedAtMs={view.startedAtMs} />}
          <div className="host-stat-grid">
            <ParityWatch view={view} />
            <TownBarPanel view={view} />
          </div>
          <HostTimeline view={view} />
          {/* Col C content shown here when 3-col collapses */}
          <div className="host-col-c-inline">
            <VotesPanel view={view} />
            <StatsPanel view={view} />
          </div>
        </div>
        {/* col C — hidden on narrow screens via CSS */}
        <div className="host-col-c-aside">
          <VotesPanel view={view} />
          <StatsPanel view={view} />
        </div>
      </div>
    </div>
  );
}

const BOT_NAMES = ["Alex", "Morgan", "Jordan", "Quinn", "Riley", "Casey", "Drew", "Blake", "Sage", "River"];

/* ── HostLobbyScreen ─────────────────────────────────────── */
function HostLobbyScreen({
  view, gameId, onStart, onReset,
}: {
  view: HostView;
  gameId: string;
  onStart: () => void;
  onReset: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [botConfirm, setBotConfirm] = useState(false);
  const code = gameCode(gameId);
  const minPlayers = 4;
  const canStart = view.players.length >= minPlayers;
  const botsNeeded = Math.max(0, minPlayers - view.players.length);

  const handleStart = async (withBots = false) => {
    setBusy(true);
    setBotConfirm(false);
    setErr(null);
    try {
      if (withBots && botsNeeded > 0) {
        const taken = new Set(view.players.map(p => p.name));
        const available = BOT_NAMES.filter(n => !taken.has(n));
        for (let i = 0; i < botsNeeded; i++) {
          await api.join(gameId, available[i] ?? `Bot ${i + 1}`);
        }
      }
      await onStart();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to start");
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0C0E", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: 14, background: "var(--accent)", color: "var(--accent-ink)",
            marginBottom: 16 }}>
            <Icon.eye s={24} />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28,
            letterSpacing: "-0.02em" }}>Waiting for players</div>
          <div style={{ color: "var(--ink-faint)", marginTop: 6, fontSize: 14 }}>
            Share the code — players join on their phone
          </div>
        </div>

        {/* code */}
        <Panel style={{ textAlign: "center" }}>
          <Mono style={{ display: "block", marginBottom: 8 }}>Game code</Mono>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 48,
            letterSpacing: "0.1em", color: "var(--accent)" }}>
            {code}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 8 }}>
            Players visit the app and type this code
          </div>
          <div style={{ marginTop: 14 }}>
            <CopyLinkButton gameId={gameId} />
          </div>
        </Panel>

        {/* player list */}
        <Panel>
          <PanelHead icon={Icon.users} title="Players joined"
            hint={`${view.players.length} / need ≥ ${minPlayers}`} />
          {view.players.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-faint)", fontSize: 13.5 }}>
              Nobody here yet — waiting for the first join…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {view.players.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 2px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: avatarColor(p.id),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {p.name[0]}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--good)",
                    fontWeight: 700 }}>ready</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {err && <div style={{ textAlign: "center", color: "var(--bad)", fontSize: 13.5, fontWeight: 600 }}>{err}</div>}

        {/* Bot fill confirmation — shown when under minimum and host tries to start */}
        {botConfirm && !canStart && (
          <div style={{ padding: "16px 18px", borderRadius: 16, background: "var(--surface)",
            border: "1px solid var(--line-strong)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Only {view.players.length} player{view.players.length !== 1 ? "s" : ""} so far</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-faint)", marginTop: 4, lineHeight: 1.45 }}>
                Fill the remaining <b style={{ color: "var(--ink)" }}>{botsNeeded} spot{botsNeeded !== 1 ? "s" : ""}</b> with bots and start anyway? Good for testing.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={busy ? undefined : () => handleStart(true)} disabled={busy} style={{
                flex: 1, height: 48, borderRadius: 12, border: "none", cursor: "pointer",
                background: "var(--accent)", color: "var(--accent-ink)",
                fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15,
              }}>{busy ? "Starting…" : `Fill ${botsNeeded} bot${botsNeeded !== 1 ? "s" : ""} & start`}</button>
              <button onClick={() => setBotConfirm(false)} style={{
                height: 48, padding: "0 18px", borderRadius: 12, border: "1px solid var(--line)",
                background: "var(--surface-2)", color: "var(--ink)", cursor: "pointer",
                fontWeight: 600, fontSize: 14,
              }}>Cancel</button>
            </div>
          </div>
        )}

        <button
          onClick={busy ? undefined : canStart ? () => handleStart(false) : () => setBotConfirm(true)}
          disabled={busy}
          style={{
            width: "100%", height: 56, borderRadius: 16, border: "none",
            cursor: busy ? "wait" : "pointer",
            background: canStart ? "var(--accent)" : "var(--surface-2)",
            color: canStart ? "var(--accent-ink)" : "var(--ink)",
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "background .2s, color .2s",
          }}>
          <Icon.spark s={20} />
          {busy ? "Starting…" : canStart ? "Start the day" : `Start anyway (${view.players.length}/${minPlayers} players)`}
        </button>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
          <ResetGameButton gameId={gameId} onDone={onReset} />
        </div>
      </div>
    </div>
  );
}

/* ── HostCreateScreen ────────────────────────────────────── */
function HostCreateScreen({ onCreate }: { onCreate: (gameId: string) => void }) {
  const [players, setPlayers] = useState(8);
  const [dayHours, setDayHours] = useState(13);
  const [cop, setCop] = useState(false);
  const [medic, setMedic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { gameId } = await api.createGame({
        hostId: store.getHostId(),
        players,
        dayLengthMin: dayHours * 60,
        roles: { cop, medic },
      });
      store.addHostGame(gameId);
      onCreate(gameId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create game");
      setBusy(false);
    }
  };

  const row = (label: string, node: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0",
      borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      {node}
    </div>
  );

  const numBtn = (label: string, onClick: () => void, disabled?: boolean) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      width: 36, height: 36, borderRadius: 10, border: "1px solid var(--line)",
      background: "var(--surface-2)", color: disabled ? "var(--ink-faint)" : "var(--ink)",
      fontWeight: 800, fontSize: 18, cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{label}</button>
  );

  const toggle = (checked: boolean, onChange: (v: boolean) => void) => (
    <div onClick={() => onChange(!checked)} style={{ cursor: "pointer" }}>
      <div style={{ width: 44, height: 26, borderRadius: 999, position: "relative",
        background: checked ? "var(--accent)" : "var(--surface-2)",
        border: "1px solid var(--line)", transition: "background .2s" }}>
        <div style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 20, height: 20,
          borderRadius: 999, background: "#fff", transition: "left .15s ease",
          boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0B0C0E", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: 14, background: "var(--accent)", color: "var(--accent-ink)",
            marginBottom: 16 }}>
            <Icon.eye s={24} />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28,
            letterSpacing: "-0.02em" }}>New game</div>
          <div style={{ color: "var(--ink-faint)", marginTop: 6, fontSize: 14 }}>
            Set up today's Sundown
          </div>
        </div>

        <Panel>
          {row("Players",
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {numBtn("−", () => setPlayers(p => Math.max(4, p - 1)), players <= 4)}
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22,
                minWidth: 28, textAlign: "center" }}>{players}</span>
              {numBtn("+", () => setPlayers(p => Math.min(20, p + 1)), players >= 20)}
            </div>
          )}
          {row("Day length",
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {numBtn("−", () => setDayHours(h => Math.max(4, h - 1)), dayHours <= 4)}
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22,
                minWidth: 52, textAlign: "center" }}>{dayHours}h</span>
              {numBtn("+", () => setDayHours(h => Math.min(16, h + 1)), dayHours >= 16)}
            </div>
          )}
          <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: 14, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", marginBottom: 10, marginTop: 14 }}>Optional roles</div>
            {row("Investigator (Cop)", toggle(cop, setCop))}
            {row("Medic", toggle(medic, setMedic))}
          </div>
          <div style={{ paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.5 }}>
              Killers: ~28% of players · {Math.round(players * 0.28)} estimated
            </div>
          </div>
        </Panel>

        {err && <div style={{ textAlign: "center", color: "var(--bad)", fontSize: 13.5, fontWeight: 600 }}>{err}</div>}

        <button onClick={busy ? undefined : handleCreate} disabled={busy} style={{
          width: "100%", height: 56, borderRadius: 16, border: "none", cursor: busy ? "wait" : "pointer",
          background: "var(--accent)", color: "var(--accent-ink)",
          fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <Icon.spark s={20} />
          {busy ? "Creating…" : "Create game"}
        </button>
      </div>
    </div>
  );
}

/* ── HostApp — root ──────────────────────────────────────── */
/* ── HostPreStartScreen ──────────────────────────────────── */
function HostPreStartScreen({ view, gameId, onEnter, onReset }: {
  view: HostView;
  gameId: string;
  onEnter: () => void;
  onReset: () => void;
}) {
  const living = view.players.filter(p => p.alive);
  const killerCount = view.players.filter(p => p.team === "killer").length;
  return (
    <div style={{ minHeight: "100vh", background: "#0B0C0E", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* header */}
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16, background: "var(--accent)", color: "var(--accent-ink)",
            marginBottom: 18 }}>
            <Icon.eyeOff s={26} />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28,
            letterSpacing: "-0.02em", color: "var(--ink)" }}>The day has begun</div>
          <div style={{ color: "var(--ink-faint)", marginTop: 8, fontSize: 14, lineHeight: 1.5, maxWidth: 320, margin: "10px auto 0" }}>
            Roles have been assigned. The control room knows everything — only open it when you're ready and away from players.
          </div>
        </div>

        {/* player count summary — no roles shown */}
        <Panel>
          <PanelHead icon={Icon.users} title="Table" hint={`${living.length} players`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 4 }}>
            <Stat label="Players" value={living.length} />
            <Stat label="Finale" value={clockOf(view.finaleMinute, view.startedAtMs)} />
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 11, background: "var(--surface-2)",
            display: "flex", alignItems: "center", gap: 9, marginTop: 4 }}>
            <Icon.eyeOff s={15} />
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.4 }}>
              Killer count hidden here. It will show in the control room. There {killerCount === 1 ? "is" : "are"} {killerCount} killer{killerCount !== 1 ? "s" : ""} — don't open the room near players.
            </span>
          </div>
        </Panel>

        <button onClick={onEnter} style={{
          width: "100%", height: 56, borderRadius: 16, border: "none", cursor: "pointer",
          background: "var(--accent)", color: "var(--accent-ink)",
          fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <Icon.eye s={20} /> Open control room
        </button>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <ResetGameButton gameId={gameId} onDone={onReset} />
        </div>
      </div>
    </div>
  );
}

export function HostApp() {
  const q = new URLSearchParams(window.location.search);
  const urlGameId = q.get("gameId");

  // If a gameId is in the URL, try to load that game directly.
  const [gameId, setGameId] = useState<string | null>(urlGameId);
  const { view, error, loading } = useHostView(gameId);
  // Gate: host must explicitly confirm before seeing omniscient roles.
  const [rolesConfirmed, setRolesConfirmed] = useState(false);

  const handleCreate = (id: string) => {
    setGameId(id);
    // Reflect in URL so a refresh re-connects.
    const next = new URL(window.location.href);
    next.searchParams.set("gameId", id);
    window.history.replaceState({}, "", next.toString());
  };

  const handleStart = useCallback(async () => {
    if (!gameId) return;
    await api.startRound(gameId, store.getHostId());
  }, [gameId]);

  // No game yet — show create screen.
  if (!gameId) {
    return (
      <div data-theme="dark" className="host-root">
        <HostCreateScreen onCreate={handleCreate} />
      </div>
    );
  }

  // Waiting for first fetch.
  if (loading && !view) {
    return (
      <div data-theme="dark" className="host-root" style={{
        display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <span style={{ display: "flex", animation: "sd-breathe 2s ease-in-out infinite", color: "var(--accent)" }}>
          <Icon.spark s={32} />
        </span>
      </div>
    );
  }

  // Error (bad hostId, unknown game, etc.)
  if (error && !view) {
    return (
      <div data-theme="dark" className="host-root" style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100vh", gap: 12, color: "var(--ink-soft)" }}>
        <Icon.alert s={28} />
        <div style={{ fontWeight: 700 }}>Can't reach the table</div>
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>{error}</div>
        <button onClick={() => setGameId(null)} style={{
          marginTop: 12, padding: "10px 20px", borderRadius: 12, border: "1px solid var(--line)",
          background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600,
        }}>← New game</button>
      </div>
    );
  }

  if (!view) return null;

  const handleReset = () => { setGameId(null); setRolesConfirmed(false); };

  return (
    <div data-theme="dark" className="host-root">
      {view.phase === "lobby" ? (
        <HostLobbyScreen view={view} gameId={gameId} onStart={handleStart} onReset={handleReset} />
      ) : !rolesConfirmed ? (
        <HostPreStartScreen view={view} gameId={gameId} onEnter={() => setRolesConfirmed(true)} onReset={handleReset} />
      ) : (
        <HostActiveScreen view={view} gameId={gameId} onReset={handleReset} />
      )}
    </div>
  );
}
