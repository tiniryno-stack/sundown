/* Sundown — Super-admin page (?admin).
   Password-gated: the server checks the password against the ADMIN_KEY env
   var in Railway, so nothing secret lives in this file. Shows the landing page
   waitlist and all games in Redis, and lets you delete dead ones. */

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Icon } from "../components/ui";
import type { AdminGameSummary } from "../types";

const KEY_STORAGE = "sundown.adminKey";
function savedKey(): string {
  try { return sessionStorage.getItem(KEY_STORAGE) ?? ""; } catch { return ""; }
}

function gameCode(id: string) {
  return "SUN-" + id.replace("g_", "").slice(0, 3).toUpperCase();
}

function timeAgo(ms: number) {
  if (!ms) return "never started";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "just now";
}

const PHASE_COLOR: Record<string, string> = {
  lobby: "var(--ink-faint)",
  active: "var(--good)",
  resolved: "var(--accent)",
};

function GameRow({ game, adminKey, onDelete }: { game: AdminGameSummary; adminKey: string; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.adminDeleteGame(game.id, adminKey);
      onDelete();
    } catch {
      setBusy(false);
      setConfirm(false);
    }
  };

  const phaseColor = PHASE_COLOR[game.phase] ?? "var(--ink-faint)";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
      borderBottom: "1px solid var(--line)", flexWrap: "wrap", rowGap: 10,
    }}>
      {/* code + phase */}
      <div style={{ minWidth: 90 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18,
          letterSpacing: "0.06em", color: "var(--ink)" }}>{gameCode(game.id)}</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: phaseColor, marginTop: 2 }}>{game.phase}</div>
      </div>

      {/* players */}
      <div style={{ flex: 1, minWidth: 160 }}>
        {game.playerCount === 0 ? (
          <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>No players</span>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            {game.players.join(", ")}
            <span style={{ color: "var(--ink-faint)", marginLeft: 6 }}>({game.playerCount})</span>
          </div>
        )}
        {game.result && (
          <div style={{ fontSize: 11.5, marginTop: 3, fontWeight: 700,
            color: game.result.winner === "killer" ? "var(--bad)" : "var(--good)" }}>
            {game.result.winner === "killer" ? "Killers won" : "Town won"} · {game.result.reason}
          </div>
        )}
      </div>

      {/* time */}
      <div style={{ fontSize: 12, color: "var(--ink-faint)", minWidth: 70, textAlign: "right" }}>
        {timeAgo(game.startedAtMs)}
      </div>

      {/* delete */}
      <div>
        {confirm ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--bad)", fontWeight: 700 }}>Delete?</span>
            <button onClick={busy ? undefined : doDelete} disabled={busy} style={{
              height: 32, padding: "0 12px", borderRadius: 8, border: "none",
              background: "var(--bad)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>{busy ? "…" : "Yes"}</button>
            <button onClick={() => setConfirm(false)} style={{
              height: 32, padding: "0 10px", borderRadius: 8,
              border: "1px solid var(--line)", background: "transparent",
              color: "var(--ink-faint)", cursor: "pointer", fontSize: 12,
            }}>No</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} style={{
            height: 32, padding: "0 12px", borderRadius: 8,
            border: "1px solid var(--line)", background: "transparent",
            color: "var(--ink-faint)", cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>Delete</button>
        )}
      </div>
    </div>
  );
}

type WaitlistData = Awaited<ReturnType<typeof api.getAdminWaitlist>>;

function WaitlistPanel({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<WaitlistData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api.getAdminWaitlist(adminKey).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load"));
  }, [adminKey]);

  const copy = async () => {
    if (!data?.entries) return;
    try {
      await navigator.clipboard.writeText(data.entries.map((e) => e.email).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div style={{ marginBottom: 32, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: "18px 18px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Landing page waitlist</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", marginTop: 4 }}>
            {data ? data.count : "—"} <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-soft)" }}>{data?.count === 1 ? "signup" : "signups"}</span>
          </div>
        </div>
        {data?.entries && data.entries.length > 0 && (
          <button onClick={() => void copy()} style={{ height: 34, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--ink)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            {copied ? "Copied" : "Copy all emails"}
          </button>
        )}
      </div>
      {err && <div style={{ marginTop: 10, color: "var(--bad)", fontSize: 13, fontWeight: 600 }}>{err}</div>}
      {data?.locked && <div style={{ marginTop: 10, color: "var(--warn)", fontSize: 13, lineHeight: 1.5 }}>{data.locked}</div>}
      {data?.entries && data.entries.length > 0 && (
        <div style={{ marginTop: 12, maxHeight: 260, overflowY: "auto", borderTop: "1px solid var(--line)" }}>
          {data.entries.map((e) => (
            <div key={e.email} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 2px", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
              <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" }}>{e.email}</span>
              <span style={{ color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{e.source} · {new Date(e.at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ adminKey }: { adminKey: string }) {
  const [games, setGames] = useState<AdminGameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminGames(adminKey);
      const sorted = [...res.games].sort((a, b) => b.startedAtMs - a.startedAtMs);
      setGames(sorted);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { void load(); }, [load]);

  const byPhase = (phase: string) => games.filter(g => g.phase === phase);
  const active = byPhase("active");
  const lobbies = byPhase("lobby");
  const resolved = byPhase("resolved");

  const deleteAll = async (ids: string[]) => {
    await Promise.all(ids.map(id => api.adminDeleteGame(id, adminKey).catch(() => {})));
    void load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0C0E", color: "var(--ink)", padding: "32px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28,
              letterSpacing: "-0.02em" }}>Sundown Admin</div>
            <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 4 }}>
              {games.length} games in Redis · {active.length} active · {lobbies.length} in lobby · {resolved.length} finished
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => void load()} style={{
              height: 36, padding: "0 14px", borderRadius: 10,
              border: "1px solid var(--line)", background: "transparent",
              color: "var(--ink)", cursor: "pointer", fontWeight: 600, fontSize: 13,
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <Icon.spark s={14} /> Refresh
            </button>
            {(lobbies.length > 0 || resolved.length > 0) && (
              <button onClick={() => void deleteAll([...lobbies, ...resolved].map(g => g.id))} style={{
                height: 36, padding: "0 14px", borderRadius: 10,
                border: "1px solid color-mix(in oklab, var(--bad) 40%, var(--line))",
                background: "transparent", color: "var(--bad)",
                cursor: "pointer", fontWeight: 600, fontSize: 13,
              }}>
                Delete all dead games ({lobbies.length + resolved.length})
              </button>
            )}
          </div>
        </div>

        <WaitlistPanel adminKey={adminKey} />

        {loading && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--ink-faint)" }}>
            <span style={{ display: "inline-flex", animation: "sd-breathe 2s ease-in-out infinite" }}>
              <Icon.spark s={28} />
            </span>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--bad)", fontWeight: 600 }}>{error}</div>
        )}

        {!loading && !error && games.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--ink-faint)", fontSize: 15 }}>
            No games in Redis.
          </div>
        )}

        {/* active */}
        {active.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--good)", marginBottom: 12 }}>
              Active ({active.length})
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              {active.map(g => <GameRow key={g.id} game={g} adminKey={adminKey} onDelete={() => void load()} />)}
            </div>
          </div>
        )}

        {/* lobby */}
        {lobbies.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 12 }}>
              Lobbies — never started ({lobbies.length})
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              {lobbies.map(g => <GameRow key={g.id} game={g} adminKey={adminKey} onDelete={() => void load()} />)}
            </div>
          </div>
        )}

        {/* resolved */}
        {resolved.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>
              Finished ({resolved.length})
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              {resolved.map(g => <GameRow key={g.id} game={g} adminKey={adminKey} onDelete={() => void load()} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [pw, setPw] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  // The server is the judge: a key is right only if it can read /admin/games.
  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    try {
      await api.getAdminGames(pw);
      onUnlock(pw);
    } catch {
      setWrong(true);
      setPw("");
      setTimeout(() => setWrong(false), 1200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0C0E", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24,
            letterSpacing: "-0.02em" }}>Admin</div>
          <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 6 }}>Enter the password</div>
        </div>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void submit(); }}
          autoFocus
          placeholder="Password"
          style={{
            width: "100%", boxSizing: "border-box", height: 52, padding: "0 16px",
            borderRadius: 14, border: `1.5px solid ${wrong ? "var(--bad)" : "var(--line-strong)"}`,
            background: "var(--surface)", color: "var(--ink)", outline: "none",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18,
            transition: "border-color .15s",
          }}
        />
        {wrong && (
          <div style={{ textAlign: "center", color: "var(--bad)", fontSize: 13, fontWeight: 600 }}>
            Wrong password
          </div>
        )}
        <button onClick={() => void submit()} disabled={busy} style={{
          height: 52, borderRadius: 14, border: "none", cursor: "pointer",
          background: "var(--accent)", color: "var(--accent-ink)",
          fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16,
        }}>
          Enter
        </button>
      </div>
    </div>
  );
}

export function AdminApp() {
  const [key, setKey] = useState(savedKey);
  const unlock = (k: string) => {
    try { sessionStorage.setItem(KEY_STORAGE, k); } catch { /* fine */ }
    setKey(k);
  };
  return (
    <div data-theme="dark" className="host-root">
      {key ? <AdminDashboard adminKey={key} /> : <PasswordGate onUnlock={unlock} />}
    </div>
  );
}
