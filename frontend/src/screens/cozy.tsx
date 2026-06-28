/* Sundown — warm-state screens: Join, Lobby, Home, Tasks, Vote, Tutorial.
   Ported from the design prototype (sd-cozy.jsx), typed and decoupled from the
   prototype's window.SD globals — data + actions now arrive as props. */

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import type { PlayerView, PublicPlayer, Task, Tier } from "../types";
import { store } from "../storage";
import { drawTask } from "../constants";
import {
  Button, Card, EventFeed, HudReadout, Icon, LivingMini, MoodHero, Pill,
  RoleCard, RosterRow, Sheet, SkyHeader, avatarColor, clockOf, mmss, nameOf, roleKeyOf,
  type IconComp,
} from "../components/ui";

/* ── JOIN ── a code + your name, then you're at the table ── */
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const slots = 6;
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(slots, " ").slice(0, slots).split("");
  const setAt = (i: number, ch: string) => {
    const next = value.split("");
    next[i] = ch.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const joined = next.join("").slice(0, slots);
    onChange(joined);
    if (ch && i < slots - 1) refs.current[i + 1]?.focus();
  };
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
      {Array.from({ length: slots }).map((_, i) => {
        const filled = chars[i] && chars[i] !== " ";
        return (
          <input key={i} ref={(el) => { refs.current[i] = el; }} value={filled ? chars[i] : ""}
            inputMode="text" maxLength={1}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Backspace" && !chars[i]?.trim() && i > 0) refs.current[i - 1]?.focus(); }}
            style={{
              width: 46, height: 58, textAlign: "center", borderRadius: 14,
              border: `1.5px solid ${filled ? "var(--accent)" : "var(--line-strong)"}`,
              background: "var(--surface)", color: "var(--ink)", outline: "none",
              fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, letterSpacing: 0,
              boxShadow: "var(--shadow-sm)", transition: "border-color .2s ease",
            }} />
        );
      })}
    </div>
  );
}

export function JoinScreen({
  temp, initialCode = "SUN", initialName, disconnected, busy, error, onJoin,
}: {
  temp?: "cold" | "warm";
  initialCode?: string;
  initialName?: string;
  disconnected?: boolean;
  busy?: boolean;
  error?: string | null;
  onJoin: (input: { name: string; code: string }) => void;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [code, setCode] = useState(initialCode);
  const ready = name.trim().length > 0 && code.replace(/\s/g, "").length >= 6 && !busy;
  const displayCode = code.length >= 6
    ? code.slice(0, 3) + "-" + code.slice(3, 6)
    : code;
  return (
    <div className="sd-screen sd-scroll">
      <SkyHeader view={{ nowMinute: 0, finaleMinute: 780 }} temp={temp}>
        <div style={{ padding: "70px 24px 26px", textAlign: "center" }}>
          <div className="sd-eyebrow" style={{ marginBottom: 12 }}>An all-day social game</div>
          <div className="sd-display" style={{ fontSize: 56, color: "var(--ink)" }}>Sundown</div>
          <div className="sd-riddle" style={{ fontSize: 18, color: "var(--ink-soft)", marginTop: 8 }}>
            Got a code from your host? Step up to the table.
          </div>
        </div>
      </SkyHeader>

      <div style={{ padding: "22px 18px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        {disconnected && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
            borderRadius: 16, background: "color-mix(in oklab, var(--warn) 10%, var(--surface))",
            border: "1px solid color-mix(in oklab, var(--warn) 30%, transparent)",
          }}>
            <span style={{ color: "var(--warn)", display: "flex", flexShrink: 0, marginTop: 1 }}>
              <Icon.alert s={18} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                You were disconnected from {displayCode}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 3, lineHeight: 1.4 }}>
                The game may still be running — tap Join below to get back in.
              </div>
            </div>
          </div>
        )}

        <Card raised>
          <div className="sd-eyebrow" style={{ marginBottom: 12 }}>Game code</div>
          <CodeInput value={code} onChange={setCode} />
          <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 12 }}>
            Find it on the host's screen — it starts with <strong style={{ color: "var(--ink-soft)" }}>SUN</strong>.
          </div>
        </Card>

        <Card raised>
          <div className="sd-eyebrow" style={{ marginBottom: 9 }}>Your name at the table</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your name"
            style={{
              width: "100%", border: "none", outline: "none", background: "transparent",
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--ink)",
              letterSpacing: "-0.01em",
            }} />
        </Card>

        <Button onClick={ready ? () => onJoin({ name: name.trim(), code }) : undefined} disabled={!ready} full>
          <Icon.spark s={18} /> {busy ? "Joining…" : ready ? (disconnected ? "Rejoin the table" : "Join the table") : "Enter a code and name"}
        </Button>

        {error && <div style={{ textAlign: "center", color: "var(--bad)", fontSize: 13.5, fontWeight: 600 }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontSize: 13, color: "var(--ink-faint)" }}>
          <Icon.eye s={15} /><span>No app, no account — just your name and the code.</span>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, textAlign: "center" }}>
          <a href="?host" style={{ fontSize: 13, color: "var(--ink-faint)", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            <Icon.person s={15} />
            Hosting today? Open the control room →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── LOBBY ── */
function gameCode(gameId: string): string {
  return "SUN-" + gameId.replace("g_", "").slice(0, 3).toUpperCase();
}

export function LobbyScreen({
  view, temp, onStart, onLeave,
}: {
  view: PlayerView;
  temp?: "cold" | "warm";
  onStart?: () => void;
  onLeave?: () => void;
}) {
  const code = gameCode(view.gameId);
  const [name, setName] = useState(view.you.name);
  return (
    <div className="sd-screen sd-scroll">
      <SkyHeader view={view} temp={temp}>
        <div style={{ padding: "78px 24px 30px", textAlign: "center" }}>
          <div className="sd-eyebrow" style={{ marginBottom: 12 }}>An all-day game · {view.players.length} gathered</div>
          <div className="sd-display" style={{ fontSize: 56, color: "var(--ink)" }}>Sundown</div>
          <div className="sd-riddle" style={{ fontSize: 19, color: "var(--ink-soft)", marginTop: 8 }}>
            Everyone makes it to sunset. Probably.
          </div>
        </div>
      </SkyHeader>

      <div style={{ padding: "20px 18px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Card raised>
          <div className="sd-eyebrow" style={{ marginBottom: 9 }}>Your name at the table</div>
          <input value={name} onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%", border: "none", outline: "none", background: "transparent",
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--ink)",
              letterSpacing: "-0.01em",
            }} />
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14,
            paddingTop: 14, borderTop: "1px solid var(--line)",
          }}>
            <span style={{ fontSize: 14, color: "var(--ink-soft)", fontWeight: 600 }}>Game code</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: "0.08em", color: "var(--accent)" }}>{code}</span>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div className="sd-eyebrow">Gathering</div>
            <Pill tone="accent">{view.players.length} here</Pill>
          </div>
          {view.players.map((p) => <RosterRow key={p.id} p={p} you={view.you.id} />)}
        </Card>

        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "4px 0 2px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((i) => <span key={i} style={{
              width: 7, height: 7, borderRadius: 999, background: "var(--accent)",
              animation: `sd-breathe 1.4s ease-in-out ${i * 0.2}s infinite`,
            }} />)}
          </div>
          <div className="sd-riddle" style={{ fontSize: 17, color: "var(--ink-soft)" }}>Waiting for the host to begin the day…</div>
        </div>

        {onStart && (
          <Button onClick={onStart} variant="soft" full>
            <Icon.spark s={18} /> Host: begin the day
          </Button>
        )}

        {onLeave && (
          <div style={{ textAlign: "center" }}>
            <div className="sd-press" onClick={onLeave}
              style={{ display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13.5, color: "var(--ink-faint)", fontWeight: 600, padding: "6px 0" }}>
              ← Wrong game? Leave and join a different one
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── HOME ── */
export function HomeScreen({
  view, nextVoteMin, onNav, theme, onToggleTheme, hideSecret, onToggleSecret,
}: {
  view: PlayerView;
  nextVoteMin: number | null;
  onNav: (dest: "tasks" | "tools" | "vote" | "result" | "roster") => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  hideSecret: boolean;
  onToggleSecret: () => void;
}) {
  const role = roleKeyOf(view.you);
  const code = gameCode(view.gameId);
  const dark = theme === "dark";
  return (
    <div className="sd-screen">
      <div style={{ padding: "62px 22px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span className="sd-mono" style={{ color: "var(--ink-faint)" }}>Sundown · {code}</span>
            <LivingMini players={view.players} onOpen={() => onNav("roster")} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <IconToggle on={hideSecret} onIcon={Icon.eyeOff} offIcon={Icon.eye} active={hideSecret} onClick={onToggleSecret} />
            <IconToggle on={dark} onIcon={Icon.moon} offIcon={Icon.sun} onClick={onToggleTheme} />
          </div>
        </div>
        <MoodHero bar={view.bar} />
      </div>

      <div style={{ padding: "20px 18px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ position: "relative" }}>
          <div className={hideSecret ? "sd-redact" : undefined}>
            <RoleCard role={role} onOpen={hideSecret ? undefined : (role !== "town" ? () => onNav("tools") : undefined)} />
          </div>
          {hideSecret &&
            <div className="sd-press" onClick={onToggleSecret} style={{
              position: "absolute", inset: 0, zIndex: 2,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7,
              color: "var(--ink-soft)", textAlign: "center",
            }}>
              <Icon.eyeOff s={24} />
              <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)" }}>Your role is hidden</div>
              <div style={{ fontSize: 12.5 }}>Tap to reveal · safe to pass the phone</div>
            </div>
          }
        </div>

        <VoteBanner view={view} onNav={onNav} />

        <HudReadout items={[
          { label: "Time of day", value: clockOf(view.nowMinute, view.startedAtMs) },
          {
            label: "Next vote",
            value: view.vote.open ? "Open now" : view.vote.resolved ? "Closed" : nextVoteMin != null ? clockOf(nextVoteMin, view.startedAtMs) : "—",
            color: view.vote.open ? "var(--bad)" : undefined,
          },
        ]} />

        <Button onClick={() => onNav("tasks")} full>
          <Icon.list s={20} /> Today's tasks
        </Button>

        <div style={{ marginTop: 4 }}>
          <div className="sd-mono" style={{ color: "var(--ink-faint)", marginBottom: 8, padding: "0 2px" }}>What's happening today</div>
          <EventFeed events={view.events} now={view.nowMinute} />
        </div>
      </div>
    </div>
  );
}

/* small home control kept here (only used on Home) */
function IconToggle({
  on, onIcon, offIcon, onClick, active,
}: {
  on: boolean;
  onIcon: IconComp;
  offIcon: IconComp;
  onClick: () => void;
  active?: boolean;
}) {
  const On = onIcon, Off = offIcon;
  return (
    <div className="sd-press" onClick={onClick} style={{
      width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
      background: active ? "var(--ink)" : "var(--surface)", color: active ? "var(--bg)" : "var(--ink-soft)",
      border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)",
    }}>
      {on ? <On s={18} /> : <Off s={18} />}
    </div>
  );
}

/* ── TASKS ── */
const TIER_META: Record<Tier, { label: string; tone: "good" | "accent" | "warn" | "bad" }> = {
  light: { label: "Light", tone: "good" },
  standard: { label: "Standard", tone: "accent" },
  heavy: { label: "Heavy", tone: "warn" },
  group: { label: "Group", tone: "bad" },
};
const TIER_ORDER: Tier[] = ["light", "standard", "heavy", "group"];

function CheckCircle({ done, disabled }: { done?: boolean; disabled?: boolean }) {
  if (done) return (
    <div style={{
      width: 28, height: 28, borderRadius: 999, flexShrink: 0, background: "var(--good)", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}><Icon.check s={17} /></div>
  );
  return <div style={{ width: 28, height: 28, borderRadius: 999, flexShrink: 0, border: "2px solid var(--line-strong)", opacity: disabled ? 0.4 : 1 }} />;
}

function ProofChip({ disabled }: { disabled?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 11px", borderRadius: 999, flexShrink: 0,
      border: "1.5px solid var(--accent)", color: "var(--accent)", fontWeight: 700, fontSize: 12.5, opacity: disabled ? 0.4 : 1,
    }}>
      <Icon.pencil s={13} /> Log
    </div>
  );
}

function TaskRow({ t, now, done, onTap, startedAtMs }: { t: Task; now: number; done?: boolean; onTap: (t: Task) => void; startedAtMs?: number }) {
  const tier = TIER_META[t.tier] ?? TIER_META.light;
  const resting = t.availableAtMinute > now;
  const covert = t.kind === "covert";
  const proof = !!t.proof;
  const tone = `var(--${tier.tone})`;
  const Glyph = covert ? Icon.eye : Icon.glass;
  const meta = resting ? `Ready ${clockOf(t.availableAtMinute, startedAtMs)}` : tier.label;
  return (
    <div className="sd-press" onClick={resting || done ? undefined : () => onTap(t)}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 15,
        background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)", opacity: resting ? 0.6 : 1,
      }}>
      <span style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0, color: tone,
        background: `color-mix(in oklab, ${tone} 16%, var(--surface-2))`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Glyph s={19} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 15.5, color: "var(--ink)", lineHeight: 1.22, textWrap: "pretty",
          textDecoration: done ? "line-through" : "none", opacity: done ? 0.5 : 1,
        }}>{t.prompt}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 12.5, color: "var(--ink-faint)", fontWeight: 600 }}>
          {covert && !resting && <Icon.eye s={12} />}
          <span>{covert && !resting ? "Covert" : meta}</span>
          {t.group && <><span style={{ opacity: .5 }}>·</span><span>2+ people</span></>}
          {proof && !resting && <><span style={{ opacity: .5 }}>·</span><span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon.pencil s={11} /> logs proof</span></>}
        </div>
      </div>
      {proof && !done ? <ProofChip disabled={resting} /> : <CheckCircle done={done} disabled={resting} />}
    </div>
  );
}

function SectionHeader({ tone, label, count }: { tone: string; label: string; count?: number }) {
  const c = `var(--${tone})`;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8, height: 33, padding: "0 14px", borderRadius: 999, whiteSpace: "nowrap",
      background: `color-mix(in oklab, ${c} 13%, transparent)`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: c, flexShrink: 0 }} />
      <span className="sd-mono" style={{ color: c, letterSpacing: "0.14em", whiteSpace: "nowrap" }}>{label}{count != null ? ` · ${count}` : ""}</span>
    </div>
  );
}

type ArchiveItem = { prompt: string; tier: Tier; kind: Task["kind"]; answer: string | null; at: number; involvedNames?: string[]; rating?: "up" | "down" };

function ConfirmSheet({ task, players, onConfirm, onClose }: {
  task: Task;
  players: PublicPlayer[];
  onConfirm: (involvedIds: string[], involvedNames: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const tier = TIER_META[task.tier] ?? TIER_META.light;
  const tone = `var(--${tier.tone})`;
  const covert = task.kind === "covert";
  const Glyph = covert ? Icon.eye : Icon.glass;
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const alive = players.filter(p => p.alive);
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, color: tone,
          background: `color-mix(in oklab, ${tone} 16%, var(--surface-2))`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Glyph s={20} /></span>
        <div>
          <div className="sd-mono" style={{ color: "var(--ink-faint)" }}>Mark as complete?</div>
          <div className="sd-title" style={{ fontSize: 16, color: "var(--ink)", lineHeight: 1.2 }}>{tier.label} task</div>
        </div>
      </div>
      <div style={{ fontSize: 16, color: "var(--ink)", fontWeight: 700, lineHeight: 1.35,
        marginBottom: 16, padding: "14px 16px", borderRadius: 14, background: "var(--surface-2)",
        border: "1px solid var(--line)" }}>
        {task.prompt}
      </div>
      {alive.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="sd-mono" style={{ color: "var(--ink-faint)", marginBottom: 10 }}>
            Who was involved? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {alive.map(p => {
              const on = selected.includes(p.id);
              return (
                <div key={p.id} className="sd-press" onClick={() => toggle(p.id)} style={{
                  display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 13px 0 9px",
                  borderRadius: 999, cursor: "pointer",
                  background: on ? "var(--accent)" : "var(--surface-2)",
                  color: on ? "var(--accent-ink)" : "var(--ink)",
                  border: on ? "none" : "1px solid var(--line-strong)",
                  fontWeight: 700, fontSize: 14, transition: "background .15s, color .15s",
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: 999, background: on ? "rgba(0,0,0,0.15)" : avatarColor(p.id),
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                    {p.name[0]}
                  </div>
                  {p.name}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Button full onClick={() => {
        const names = alive.filter(p => selected.includes(p.id)).map(p => p.name);
        onConfirm(selected, names);
      }}>
        <Icon.check s={18} /> {selected.length > 0 ? `Yes — with ${selected.length === 1 ? alive.find(p => p.id === selected[0])?.name : `${selected.length} people`}` : "Yes, I did this"}
      </Button>
      <div style={{ marginTop: 10 }}>
        <Button full variant="soft" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

function ProofSheet({ task, onConfirm, onClose }: { task: Task; onConfirm: (answer: string) => void; onClose: () => void }) {
  const [answer, setAnswer] = useState("");
  const tier = TIER_META[task.tier] ?? TIER_META.light;
  const tone = `var(--${tier.tone})`;
  const ready = answer.trim().length > 0;
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, color: tone,
          background: `color-mix(in oklab, ${tone} 16%, var(--surface-2))`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon.eye s={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sd-mono" style={{ color: "var(--ink-faint)" }}>Covert · logs proof</div>
          <div className="sd-title" style={{ fontSize: 17, color: "var(--ink)", lineHeight: 1.2 }}>Log your proof</div>
        </div>
      </div>
      <div style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.4, marginBottom: 16 }}>{task.prompt}</div>
      <div className="sd-eyebrow" style={{ marginBottom: 9 }}>{task.proof?.q}</div>
      <input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)}
        placeholder={task.proof?.placeholder}
        onKeyDown={(e) => { if (e.key === "Enter" && ready) onConfirm(answer.trim()); }}
        style={{
          width: "100%", height: 54, padding: "0 16px", borderRadius: 14, outline: "none",
          border: "1.5px solid var(--line-strong)", background: "var(--surface-2)", color: "var(--ink)",
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18,
        }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "12px 2px 18px", fontSize: 12.5, color: "var(--ink-faint)" }}>
        <Icon.lock s={13} /><span>Only you ever see this. It's kept in your task archive as a record — never shared.</span>
      </div>
      <Button full onClick={ready ? () => onConfirm(answer.trim()) : undefined} disabled={!ready}>
        <Icon.check s={18} /> {ready ? "Log it & complete" : "Type your answer"}
      </Button>
    </Sheet>
  );
}

function ThumbBtn({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="sd-press" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 30, height: 30, borderRadius: 8, cursor: "pointer",
      background: active ? `color-mix(in oklab, ${color} 18%, var(--surface))` : "var(--surface-2)",
      color: active ? color : "var(--ink-faint)",
      border: active ? `1px solid color-mix(in oklab, ${color} 35%, transparent)` : "1px solid transparent",
      transition: "background .15s, color .15s",
    }}>{children}</div>
  );
}

function ArchiveSheet({ archive, onClose, startedAtMs, onRate }: { archive: ArchiveItem[]; onClose: () => void; startedAtMs?: number; onRate?: (prompt: string, rating: "up" | "down") => void }) {
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="sd-title" style={{ fontSize: 23, color: "var(--ink)" }}>Your archive</div>
        <span className="sd-mono" style={{ color: "var(--ink-faint)" }}>{archive.length} logged</span>
      </div>
      <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginBottom: 14 }}>
        Everything you've completed today, newest first. Proofs you typed are kept here — private to you.
      </div>
      {archive.length === 0 ?
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "34px 0", color: "var(--ink-faint)", textAlign: "center" }}>
          <Icon.box s={30} />
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-soft)" }}>Nothing logged yet</div>
          <div style={{ fontSize: 13, maxWidth: 240 }}>Complete tasks and they'll collect here as your record of the day.</div>
        </div> :
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {archive.map((a, i) => (
            <div key={i} style={{ padding: "12px 14px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ marginTop: 1, color: "var(--good)", display: "flex", flexShrink: 0 }}><Icon.check s={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)", lineHeight: 1.28, textWrap: "pretty", flex: 1 }}>{a.prompt}</div>
                    {onRate && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 1 }}>
                        <ThumbBtn active={a.rating === "up"} color="var(--good)" onClick={() => onRate(a.prompt, "up")}>👍</ThumbBtn>
                        <ThumbBtn active={a.rating === "down"} color="var(--bad)" onClick={() => onRate(a.prompt, "down")}>👎</ThumbBtn>
                      </div>
                    )}
                  </div>
                  <div className="sd-mono" style={{ color: "var(--ink-faint)", marginTop: 5 }}>{(TIER_META[a.tier] ?? TIER_META.light).label}{a.kind === "covert" ? " · covert" : ""} · {clockOf(a.at, startedAtMs)}</div>
                  {a.involvedNames && a.involvedNames.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                      {a.involvedNames.map(name => (
                        <span key={name} style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px",
                          borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line-strong)",
                          fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.answer &&
                    <div style={{
                      display: "flex", alignItems: "center", gap: 7, marginTop: 9, padding: "8px 11px", borderRadius: 10,
                      background: "var(--surface)", border: "1px solid var(--line)",
                    }}>
                      <span style={{ color: "var(--accent)", display: "flex", flexShrink: 0 }}><Icon.pencil s={13} /></span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{a.answer}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      }
    </Sheet>
  );
}

export function TasksScreen({
  view, tasks, refill, onComplete, onRate,
}: {
  view: PlayerView;
  tasks: Task[];
  /** demo flourish: replace a finished dare with a fresh one of the same tier */
  refill?: boolean;
  /** real side-effect: POST /tasks/complete (answer is local-only archive) */
  onComplete: (task: Task, answer: string | null, involvedPlayerIds?: string[]) => void;
  onRate?: (taskPrompt: string, rating: "up" | "down") => void;
}) {
  const now = view.nowMinute;
  const [extra, setExtra] = useState<Task[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>(() =>
    store.getArchive(view.gameId, view.you.id) as ArchiveItem[]
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [proofTask, setProofTask] = useState<Task | null>(null);
  const [confirmTask, setConfirmTask] = useState<Task | null>(null);

  const addToArchive = useCallback((item: ArchiveItem) => {
    setArchive((a) => {
      const next = [item, ...a];
      store.setArchive(view.gameId, view.you.id, next);
      return next;
    });
  }, [view.gameId, view.you.id]);

  // Live refetches flow in through `tasks`; locally-drawn refills live alongside.
  const allTasks = useMemo(() => {
    const seen = new Set<string>();
    return [...tasks, ...extra].filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }, [tasks, extra]);
  const doneCount = Object.values(done).filter(Boolean).length;

  const complete = (t: Task, answer: string | null, involvedIds: string[] = [], involvedNames: string[] = []) => {
    setDone((d) => ({ ...d, [t.id]: true }));
    addToArchive({ prompt: t.prompt, tier: t.tier, kind: t.kind, answer, at: now, involvedNames: involvedNames.length ? involvedNames : undefined });
    const msg = answer ? "Logged — proof saved to your archive."
      : involvedNames.length ? `Noted — logged with ${involvedNames[0]}${involvedNames.length > 1 ? ` +${involvedNames.length - 1}` : ""}.`
      : "Noted — a fresh dare just landed.";
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
    onComplete(t, answer, involvedIds);
    if (refill) setTimeout(() => setExtra((list) => [...list, drawTask(t.tier)]), 650);
  };

  const handleTap = (t: Task) => { if (t.proof) setProofTask(t); else setConfirmTask(t); };

  return (
    <div className="sd-screen sd-scroll" style={{ padding: "62px 18px 30px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div className="sd-mono" style={{ color: "var(--ink-faint)", marginBottom: 6 }}>Camouflage for everyone</div>
          <div className="sd-display" style={{ fontSize: 36 }}>Tasks</div>
        </div>
        <div className="sd-press" onClick={() => setArchiveOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", borderRadius: 999, flexShrink: 0, whiteSpace: "nowrap",
            background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)",
          }}>
          <span style={{ color: "var(--ink-soft)", display: "flex" }}><Icon.box s={15} /></span>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{doneCount}</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-faint)" }}>archive</span>
        </div>
      </div>
      <div className="sd-riddle" style={{ fontSize: 16, color: "var(--ink-soft)", marginBottom: 16, maxWidth: 330 }}>
        An endless stream of small dares to keep the day moving. Everyone does them — which proves nothing about anyone.
      </div>

      {allTasks.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          padding: "48px 20px", textAlign: "center", color: "var(--ink-faint)" }}>
          <span style={{ display: "flex", animation: "sd-breathe 3s ease-in-out infinite" }}>
            <Icon.spark s={30} />
          </span>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink-soft)" }}>Tasks are on their way</div>
          <div style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.5 }}>
            The day just started — your task deck is being dealt. Check back in a moment.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {TIER_ORDER.map((tk) => {
          const items = allTasks.filter((t) => t.tier === tk);
          if (!items.length) return null;
          const m = TIER_META[tk];
          return (
            <div key={tk}>
              <SectionHeader tone={m.tone} label={m.label} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {items.map((t) => <TaskRow key={t.id} t={t} now={now} done={done[t.id]} onTap={handleTap} startedAtMs={view.startedAtMs} />)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 11, marginTop: 18, padding: "13px 14px", borderRadius: 15,
        border: "1.5px dashed var(--line-strong)", color: "var(--ink-faint)",
      }}>
        <span style={{ display: "flex", animation: "sd-breathe 3.5s ease-in-out infinite" }}><Icon.spark s={18} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink-soft)" }}>More dares keep landing all day</div>
          <div style={{ fontSize: 12.5, marginTop: 1 }}>Finish one and another takes its place. You'll never run the deck dry.</div>
        </div>
      </div>


      {toast &&
        <div className="sd-fade" style={{
          position: "absolute", left: "50%", bottom: 92, transform: "translateX(-50%)",
          background: "var(--ink)", color: "var(--bg)", padding: "12px 20px", borderRadius: 14, fontWeight: 700, fontSize: 14.5,
          boxShadow: "var(--shadow)", zIndex: 40, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
        }}>
          <Icon.check s={17} /> {toast}
        </div>
      }

      {confirmTask && <ConfirmSheet
        task={confirmTask}
        players={view.players.filter(p => p.id !== view.you.id)}
        onClose={() => setConfirmTask(null)}
        onConfirm={(ids, names) => { complete(confirmTask, null, ids, names); setConfirmTask(null); }} />}
      {proofTask && <ProofSheet task={proofTask} onClose={() => setProofTask(null)}
        onConfirm={(answer) => { complete(proofTask, answer); setProofTask(null); }} />}
      {archiveOpen && <ArchiveSheet archive={archive} onClose={() => setArchiveOpen(false)} startedAtMs={view.startedAtMs}
        onRate={onRate ? (prompt, rating) => {
          setArchive(prev => {
            const next = prev.map(a => a.prompt === prompt ? { ...a, rating } : a);
            store.setArchive(view.gameId, view.you.id, next);
            return next;
          });
          onRate(prompt, rating);
        } : undefined}
      />}
    </div>
  );
}

/* ── VOTE ── */
export function VoteScreen({
  view, initialPick, onCast,
}: {
  view: PlayerView;
  initialPick?: string | null;
  onCast: (targetId: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(initialPick ?? null);
  const [cast, setCast] = useState(view.vote.youVoted);
  const closes = view.vote.closesAtMinute ?? view.nowMinute;
  const [left, setLeft] = useState(Math.max(0, closes - view.nowMinute));
  useEffect(() => {
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1 / 60)), 1000);
    return () => clearInterval(id);
  }, []);
  const living = view.players.filter((p) => p.alive);
  const castName = picked ? nameOf(view.players, picked) : null;

  const doCast = () => {
    if (!picked) return;
    onCast(picked);
    setCast(true);
  };

  if (cast) {
    const steps = [
      { icon: Icon.check, title: "Your vote is locked", sub: "Counted with everyone else's — one each.", state: "done" as const },
      { icon: Icon.lock, title: "Tallied out of sight", sub: "No running totals. No one sees who you named.", state: "active" as const },
      { icon: Icon.moon, title: "Revealed later, in pieces", sub: "You'll learn what came of it when the day turns.", state: "wait" as const },
    ];
    return (
      <div className="sd-screen sd-scroll" style={{ padding: "84px 20px 40px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ position: "relative", width: 92, height: 92, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            {[0, 1, 2].map((i) =>
              <span key={i} style={{
                position: "absolute", width: 74, height: 74, borderRadius: 999, border: "2px solid var(--good)",
                animation: `sd-ping 3.4s ease-out ${i * 1.13}s infinite`,
              }} />
            )}
            <div style={{
              width: 60, height: 60, borderRadius: 999, color: "#fff", background: "var(--good)",
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 26px color-mix(in oklab, var(--good) 50%, transparent)",
            }}>
              <Icon.check s={30} />
            </div>
          </div>
          <div className="sd-display" style={{ fontSize: 32 }}>Your vote is in.</div>
          <div className="sd-riddle" style={{ fontSize: 17, color: "var(--ink-soft)", marginTop: 8, maxWidth: 290 }}>
            What comes of it, you'll learn with everyone else — later, and only in pieces.
          </div>
        </div>

        {castName &&
          <Card raised style={{ marginTop: 22, padding: 16 }}>
            <div className="sd-mono" style={{ color: "var(--ink-faint)", marginBottom: 11 }}>You cast against</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 999, flexShrink: 0, background: avatarColor(picked!),
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18,
              }}>{castName[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 21, color: "var(--ink)", lineHeight: 1.1 }}>{castName}</div>
                <div style={{ fontSize: 13, color: "var(--ink-faint)", fontWeight: 600 }}>No takebacks — your vote stays cast.</div>
              </div>
              <span style={{ color: "var(--bad)", display: "flex", flexShrink: 0 }}><Icon.lock s={18} /></span>
            </div>
          </Card>
        }

        <div style={{ marginTop: 18 }}>
          <div className="sd-mono" style={{ color: "var(--ink-faint)", marginBottom: 12, padding: "0 2px" }}>What happens next</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {steps.map((s, i) => {
              const active = s.state === "active";
              const dim = s.state === "wait";
              const col = s.state === "done" ? "var(--good)" : active ? "var(--ink)" : "var(--ink-faint)";
              const S = s.icon;
              return (
                <div key={i} style={{ display: "flex", gap: 13 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <span style={{
                      width: 34, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                      color: s.state === "done" ? "#fff" : col,
                      background: s.state === "done" ? "var(--good)" : active ? "var(--surface-2)" : "transparent",
                      border: s.state === "done" ? "none" : `1.5px solid ${active ? "var(--line-strong)" : "var(--line)"}`,
                    }}>
                      <S s={16} />
                    </span>
                    {i < steps.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 16, background: "var(--line)", margin: "2px 0" }} />}
                  </div>
                  <div style={{ paddingBottom: i < steps.length - 1 ? 16 : 0, opacity: dim ? 0.6 : 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: active || s.state === "done" ? "var(--ink)" : "var(--ink-soft)", lineHeight: 1.2 }}>{s.title}</div>
                    <div className="sd-riddle" style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 2 }}>{s.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20,
          padding: "13px 15px", borderRadius: 15, background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--ink-soft)" }}>
            <Icon.clock s={17} /><span style={{ fontWeight: 600, fontSize: 14 }}>Voting closes</span>
          </div>
          <span className="sd-display" style={{ fontSize: 19, color: left <= 1 ? "var(--bad)" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{mmss(left)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, justifyContent: "center", fontSize: 13, color: "var(--ink-faint)" }}>
          <Icon.eye s={15} /><span>{living.length} of {view.players.length} still at the table · keep talking in person.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sd-screen sd-scroll" style={{ padding: "108px 18px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="sd-eyebrow" style={{ color: "var(--bad)" }}>A reckoning</div>
        <Pill tone="bad"><Icon.alert s={13} /> closes {mmss(left)}</Pill>
      </div>
      <div className="sd-display" style={{ fontSize: 34, marginBottom: 6 }}>Who do you trust least?</div>
      <div className="sd-riddle" style={{ fontSize: 17, color: "var(--ink-soft)", marginBottom: 18 }}>
        One name. No takebacks. The count happens out of sight.
      </div>
      <Card raised pad={6}>
        {living.map((p, i) =>
          <div key={p.id}>
            <RosterRow p={p} you={view.you.id} onClick={p.id === view.you.id ? undefined : () => setPicked(p.id)} dim={p.id === view.you.id}
              right={picked === p.id ?
                <div style={{ width: 26, height: 26, borderRadius: 999, background: "var(--bad)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.check s={16} /></div> :
                p.id === view.you.id ? <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>can't vote you</span> :
                  <div style={{ width: 24, height: 24, borderRadius: 999, border: "2px solid var(--line-strong)" }} />} />
            {i < living.length - 1 && <div style={{ height: 1, background: "var(--line)", margin: "0 4px" }} />}
          </div>
        )}
      </Card>
      <div style={{ marginTop: 18 }}>
        <Button danger disabled={!picked} full onClick={doCast}>
          {picked ? `Cast against ${nameOf(view.players, picked)}` : "Choose a name"}
        </Button>
      </div>
    </div>
  );
}

/* ── VOTE BANNER ── home card that tracks the vote: open → results-in ── */
export function VoteBanner({ view, onNav }: { view: PlayerView; onNav: (dest: "vote" | "result") => void }) {
  const v = view.vote;
  if (v.open) {
    return (
      <div className="sd-press" onClick={() => onNav("vote")}
        style={{
          display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 14,
          border: "1px solid color-mix(in oklab, var(--bad) 45%, var(--line))",
          background: "color-mix(in oklab, var(--bad) 9%, var(--surface))",
        }}>
        <span style={{ color: "var(--bad)", display: "flex" }}><Icon.alert s={20} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--bad)" }}>A vote is open</div>
          <div className="sd-mono" style={{ color: "var(--ink-soft)" }}>Everyone votes on who to eliminate · closes soon</div>
        </div>
        <Icon.chevR s={18} />
      </div>
    );
  }
  if (v.resolved) {
    return (
      <div className="sd-press sd-rise" onClick={() => onNav("result")}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 14,
          border: "1px solid var(--line-strong)", background: "var(--surface)", boxShadow: "var(--shadow-sm)",
        }}>
        <span style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--bad)", background: "color-mix(in oklab, var(--bad) 14%, var(--surface-2))",
          border: "1.5px dashed color-mix(in oklab, var(--bad) 50%, var(--line))",
        }}><Icon.person s={19} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>The vote has landed</div>
          <div className="sd-mono" style={{ color: "var(--ink-soft)" }}>Someone is out · tap to see</div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--bad)", fontWeight: 700, fontSize: 13 }}>Result <Icon.chevR s={16} /></span>
      </div>
    );
  }
  return null;
}

/* ── VOTE RESULT ── the reckoning lands: an anonymous figure goes "out" ── */
export function VoteResultScreen({ view }: { view: PlayerView }) {
  const [stage, setStage] = useState(0); // 0 tallying · 1 struck · 2 out
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 900);
    const t2 = setTimeout(() => setStage(2), 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const living = view.players.filter((p) => p.alive).length;
  const remaining = Math.max(0, living - 1);
  const struck = stage >= 1, out = stage >= 2;
  return (
    <div className="sd-screen sd-scroll" style={{ padding: "108px 22px 40px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div className="sd-eyebrow" style={{ color: "var(--bad)", marginBottom: 9 }}>The vote has closed</div>
      <div className="sd-display" style={{ fontSize: 32, marginBottom: 8 }}>{out ? "Someone is out" : "Counting the room…"}</div>
      <div className="sd-riddle" style={{ fontSize: 16.5, color: "var(--ink-soft)", maxWidth: 300, marginBottom: 32, minHeight: 48 }}>
        {out
          ? "The room settled on a name. Who it was — and what they were — stays unspoken, for now."
          : "Every vote is in. The tally happens out of sight."}
      </div>

      <div style={{ position: "relative", width: 156, height: 156, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 30 }}>
        {!struck && [0, 1].map((i) => (
          <span key={i} style={{
            position: "absolute", width: 120, height: 120, borderRadius: 999, border: "2px solid var(--ink-faint)",
            animation: `sd-ping 2.6s ease-out ${i * 1.3}s infinite`,
          }} />
        ))}
        <div style={{
          width: 108, height: 108, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
          background: out ? "transparent" : "var(--surface-2)",
          border: out ? "2px dashed var(--line-strong)" : "1px solid var(--line)",
          color: out ? "var(--ink-faint)" : "var(--ink-soft)",
          filter: out ? "grayscale(1)" : "none", opacity: out ? 0.55 : 1,
          transform: out ? "translateY(6px)" : "none",
          animation: stage === 1 ? "sd-jolt .5s ease both" : "none",
          transition: "background .6s ease, border-color .6s ease, color .6s ease, opacity .6s ease, transform .6s ease, filter .6s ease",
        }}>
          <Icon.person s={54} />
        </div>
        {struck && (
          <span style={{
            position: "absolute", width: 128, height: 4, borderRadius: 999, background: "var(--bad)",
            transformOrigin: "center", animation: "sd-slash .5s ease both", opacity: out ? 0.7 : 1, transition: "opacity .5s ease",
          }} />
        )}
      </div>

      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 15px", borderRadius: 999,
        background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)",
      }}>
        <Icon.users s={16} />
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{out ? `${remaining} of ${view.players.length} still in` : "Tallying…"}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 13.5, color: "var(--ink-faint)", maxWidth: 300 }}>
        <Icon.eyeOff s={15} /><span>No name. No role. Just one empty chair — the rest you'll piece together.</span>
      </div>
    </div>
  );
}

/* ── TUTORIAL ── a short paged primer between the lobby and the day ── */
const TUTORIAL_SLIDES = [
  { icon: "spark", tone: "var(--accent)", eyebrow: "How this works", title: "An all-day game of trust",
    body: "A few of you are secretly killers. Everyone else is trying to name them before sundown. You keep living your normal day — the game just runs quietly underneath it." },
  { icon: "alert", tone: "var(--warn)", eyebrow: "The mood of the day", title: "Read the room, not a number",
    body: "One shared mood meter reads how the day is going. It warms and cools as things happen — but it never shows a score, and it looks the same for everyone." },
  { icon: "glass", tone: "var(--good)", eyebrow: "Tasks", title: "Tasks are everyone's cover",
    body: "Small social dares land all day. Anyone can do them — guilty or not — so completing one proves nothing about you. That's exactly the point. Covert ones ask you to log a little proof, just for your own record." },
  { icon: "eye", tone: "var(--accent)", eyebrow: "Your secret role", title: "Your role is yours alone",
    body: "Tap your role card to see who you are. Tap the eye to blur it before you hand your phone over. The app never reveals anyone's side — working that out is the whole game." },
  { icon: "users", tone: "var(--bad)", eyebrow: "Voting", title: "When a vote opens, name one",
    body: "Everyone casts against a single person. It's tallied out of sight — no running totals, no takebacks. There's no messaging here on purpose: the real game happens face to face." },
];

export function TutorialScreen({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = TUTORIAL_SLIDES[i]!;
  const Glyph = Icon[s.icon as keyof typeof Icon];
  const last = i === TUTORIAL_SLIDES.length - 1;
  const next = () => { if (last) onDone(); else setI((n) => n + 1); };
  const back = () => setI((n) => Math.max(0, n - 1));
  return (
    <div className="sd-screen" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "56px 22px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 34 }}>
        <span className="sd-mono" style={{ color: "var(--ink-faint)" }}>How to play · {i + 1} / {TUTORIAL_SLIDES.length}</span>
        {!last && <span className="sd-press sd-mono" onClick={onDone} style={{ color: "var(--ink-soft)", letterSpacing: "0.1em" }}>Skip</span>}
      </div>

      <div key={i} className="sd-rise" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", padding: "0 6px" }}>
        <div style={{ alignSelf: "center", position: "relative", width: 132, height: 132, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26 }}>
          {[0, 1, 2].map((r) =>
            <span key={r} style={{
              position: "absolute", width: 104, height: 104, borderRadius: 999, border: `2px solid ${s.tone}`,
              animation: `sd-ping 3.4s ease-out ${r * 1.13}s infinite`,
            }} />
          )}
          <div style={{
            position: "relative", width: 76, height: 76, borderRadius: 999, color: s.tone,
            background: `color-mix(in oklab, ${s.tone} 16%, var(--surface))`, border: `1.5px solid ${s.tone}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 30px color-mix(in oklab, ${s.tone} 40%, transparent)`,
          }}>
            <Glyph s={34} />
          </div>
        </div>
        <div className="sd-eyebrow" style={{ marginBottom: 12, color: s.tone }}>{s.eyebrow}</div>
        <div className="sd-display" style={{ fontSize: 34, marginBottom: 14, textWrap: "balance" }}>{s.title}</div>
        <div className="sd-riddle" style={{ fontSize: 17, color: "var(--ink-soft)", maxWidth: 330, alignSelf: "center" }}>{s.body}</div>
      </div>

      <div style={{ display: "flex", gap: 7, justifyContent: "center", marginBottom: 18 }}>
        {TUTORIAL_SLIDES.map((_, k) =>
          <span key={k} className="sd-press" onClick={() => setI(k)} style={{
            height: 7, borderRadius: 999,
            width: k === i ? 22 : 7, background: k === i ? "var(--ink)" : "var(--line-strong)", transition: "width .25s ease, background .25s ease",
          }} />
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {i > 0 && <Button variant="soft" onClick={back} style={{ flex: "0 0 auto", width: 100 }}>Back</Button>}
        <Button full onClick={next}>
          {last ? <><Icon.spark s={18} /> Enter the day</> : <>Next <Icon.chevR s={18} /></>}
        </Button>
      </div>
    </div>
  );
}

export type { ReactNode };
