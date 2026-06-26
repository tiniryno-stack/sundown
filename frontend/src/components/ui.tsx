/* Shared UI primitives + signature components.
   Ported from the design handoff (sd-ui.jsx), typed for TS and decoupled from
   the prototype's window globals. Visuals (inline styles + theme.css tokens) are
   preserved verbatim so the look stays pixel-accurate. */

import { type CSSProperties, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Band, FeedEvent, PublicPlayer } from "../types";

/* ── time helpers ───────────────────────────────────────── */
export function clockOf(nowMinute: number): string {
  const total = 9 * 60 + nowMinute; // day starts 9:00 AM
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const ap = h >= 12 ? "PM" : "AM";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
export function vagueAgo(at: number, now: number): string {
  const d = now - at;
  if (d <= 2) return "just now";
  if (d < 18) return "a few minutes ago";
  if (d < 45) return "a little while ago";
  if (d < 120) return "earlier";
  return "this morning";
}
export function mmss(mins: number): string {
  const m = Math.max(0, Math.floor(mins));
  const s = Math.max(0, Math.round((mins - m) * 60));
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── icons (inline, stroke = currentColor) ──────────────── */
export type IconProps = { s?: number };
export type IconComp = (p: IconProps) => ReactElement;

export const Icon = {
  spark: (p) => <svg viewBox="0 0 24 24" width={p.s || 20} height={p.s || 20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>,
  alert: (p) => <svg viewBox="0 0 24 24" width={p.s || 20} height={p.s || 20} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></svg>,
  check: (p) => <svg viewBox="0 0 24 24" width={p.s || 20} height={p.s || 20} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6" /></svg>,
  list: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>,
  home: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" /></svg>,
  eye: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></svg>,
  blade: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l9.5-9.5M14 4l6 6-3 3-6-6z" /><path d="M4 20l2.5-.5L4 20z" /></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /></svg>,
  glass: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l-1.5 8a4 4 0 01-4 3.2h-1A4 4 0 017.5 11zM12 14v6M8 20h8" /></svg>,
  chevR: (p) => <svg viewBox="0 0 24 24" width={p.s || 18} height={p.s || 18} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>,
  ghost: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V10a7 7 0 0114 0v10l-2.5-1.6L14 20l-2-1.6L10 20l-2.5-1.4z" /><path d="M9.5 10h.01M14.5 10h.01" /></svg>,
  moon: (p) => <svg viewBox="0 0 24 24" width={p.s || 16} height={p.s || 16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" /></svg>,
  sun: (p) => <svg viewBox="0 0 24 24" width={p.s || 16} height={p.s || 16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>,
  users: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0111 0M16 5.2a3.2 3.2 0 010 5.6M17.5 19a5.5 5.5 0 00-3-4.9" /></svg>,
  eyeOff: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.6 6.1A9.6 9.6 0 0112 6c6.5 0 10 6 10 6a16 16 0 01-3.1 3.6M6.6 6.6A16 16 0 002 12s3.5 6 10 6a9.4 9.4 0 003.4-.6" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /><path d="M3 3l18 18" /></svg>,
  pencil: (p) => <svg viewBox="0 0 24 24" width={p.s || 18} height={p.s || 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1 9.5-9.5a2.1 2.1 0 00-3-3L5 16z" /><path d="M14 6l3 3" /></svg>,
  box: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" width={p.s || 18} height={p.s || 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  lock: (p) => <svg viewBox="0 0 24 24" width={p.s || 18} height={p.s || 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>,
  person: (p) => <svg viewBox="0 0 24 24" width={p.s || 22} height={p.s || 22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 20a7 7 0 0114 0" /></svg>,
  bell: (p) => <svg viewBox="0 0 24 24" width={p.s || 18} height={p.s || 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 004 0" /></svg>,
  share: (p) => <svg viewBox="0 0 24 24" width={p.s || 18} height={p.s || 18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13M8 7l4-4 4 4M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6" /></svg>,
} satisfies Record<string, IconComp>;

/* ── Button ─────────────────────────────────────────────── */
type ButtonVariant = "primary" | "soft" | "ghost";
const BUTTON_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: { color: "var(--accent-ink)", border: "none", boxShadow: "var(--shadow-sm)" },
  soft: { background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" },
  ghost: { background: "transparent", color: "var(--ink)", border: "1px solid var(--line-strong)" },
};
export function Button({
  children, onClick, variant = "primary", disabled, full, style, danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  full?: boolean;
  style?: CSSProperties;
  danger?: boolean;
}) {
  const base = { ...BUTTON_STYLES[variant] };
  if (variant === "primary") base.background = danger ? "var(--bad)" : "var(--accent)";
  return (
    <div className="sd-press" aria-disabled={disabled ? "true" : "false"} onClick={disabled ? undefined : onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
        height: 56, borderRadius: 18, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em",
        whiteSpace: "nowrap", textAlign: "center",
        width: full ? "100%" : undefined, padding: "0 22px", ...base, ...style,
      }}>
      {children}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────── */
export function Card({
  children, style, onClick, pad = 18, raised,
}: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  pad?: number;
  raised?: boolean;
}) {
  return (
    <div className={onClick ? "sd-press" : undefined} onClick={onClick}
      style={{
        background: "var(--surface)", borderRadius: 24, padding: pad,
        border: "1px solid var(--line)", boxShadow: raised ? "var(--shadow)" : "none", ...style,
      }}>
      {children}
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
const PILL_TONES: Record<Tone, CSSProperties> = {
  neutral: { background: "var(--surface-2)", color: "var(--ink-soft)" },
  accent: { background: "color-mix(in oklab, var(--accent) 16%, transparent)", color: "var(--accent)" },
  good: { background: "color-mix(in oklab, var(--good) 18%, transparent)", color: "var(--good)" },
  warn: { background: "color-mix(in oklab, var(--warn) 20%, transparent)", color: "var(--warn)" },
  bad: { background: "color-mix(in oklab, var(--bad) 18%, transparent)", color: "var(--bad)" },
};
export function Pill({ children, tone = "neutral", style }: { children: ReactNode; tone?: Tone; style?: CSSProperties }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 11px",
      borderRadius: 999, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.01em", ...PILL_TONES[tone], ...style,
    }}>
      {children}
    </span>
  );
}

/* ── MoodBar / mood copy — banded health, never a number ── */
export const BAR_COPY: Record<Band, { label: string; sub: string; tone: Tone; cells: number }> = {
  healthy: { label: "The day holds", sub: "Warm, loud, alive. For now.", tone: "good", cells: 6 },
  strained: { label: "A strain in the air", sub: "Something thins the mood. You can't name it.", tone: "warn", cells: 4 },
  critical: { label: "Something is wrong", sub: "The room knows it before it's said.", tone: "bad", cells: 2 },
  unknown: { label: "The day hasn't begun", sub: "Glasses still empty.", tone: "neutral", cells: 0 },
};

/* ── Activity feed ─────────────────────────────────────── */
const FEED_GLYPH: Record<string, IconComp> = {
  start: Icon.spark, task: Icon.glass, calm: Icon.moon, mood: Icon.alert,
  death: Icon.blade, vote: Icon.users, ambient: Icon.moon, taskWave: Icon.glass, bar: Icon.alert,
  voteResolved: Icon.users, gameOver: Icon.alert, kill: Icon.blade, resurrection: Icon.ghost,
};
type FeedItem = FeedEvent & { title?: string; note?: string };
export function EventFeed({ events, now, max = 6 }: { events: FeedItem[]; now: number; max?: number }) {
  const sorted = [...events].sort((a, b) => b.at - a.at).slice(0, max);
  if (!sorted.length) {
    return <div className="sd-riddle" style={{ fontSize: 16, color: "var(--ink-faint)", padding: "6px 2px" }}>
      Nothing's happened yet — the day is just getting started.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sorted.map((e, i) => {
        const G = FEED_GLYPH[e.kind] || Icon.moon;
        const isBad = e.kind === "death" || e.kind === "bar" || e.kind === "mood" || e.kind === "gameOver" || e.kind === "kill";
        return (
          <div key={`${e.at}-${i}`} className="sd-rise" style={{
            animationDelay: `${i * 70}ms`,
            display: "flex", gap: 13, padding: "13px 2px",
            borderBottom: i < sorted.length - 1 ? "1px solid var(--line)" : "none",
          }}>
            <div style={{ flexShrink: 0, marginTop: 2, color: isBad ? "var(--bad)" : "var(--ink-faint)" }}><G s={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--ink)", lineHeight: 1.25 }}>{e.title || e.message}</div>
              {e.note && <div className="sd-riddle" style={{ fontSize: 15, color: "var(--ink-soft)", marginTop: 3, lineHeight: 1.32 }}>{e.note}</div>}
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4, letterSpacing: "0.01em" }}>{vagueAgo(e.at, now)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Roster row — names + alive/dead only. No roles, ever. ─ */
export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `oklch(0.7 0.12 ${h})`;
}
export function RosterRow({
  p, you, right, onClick, dim,
}: {
  p: PublicPlayer;
  you: string;
  right?: ReactNode;
  onClick?: () => void;
  dim?: boolean;
}) {
  const isYou = p.id === you;
  return (
    <div className={onClick ? "sd-press" : undefined} onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 4px", opacity: dim ? 0.5 : 1 }}>
      <div style={{
        position: "relative", width: 40, height: 40, borderRadius: 999, flexShrink: 0,
        background: p.alive ? avatarColor(p.id) : "var(--surface-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: p.alive ? "#fff" : "var(--ink-faint)", fontWeight: 800, fontSize: 16,
        filter: p.alive ? "none" : "grayscale(1)",
      }}>
        {p.name[0]}
        {!p.alive && <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: "1.5px dashed var(--ink-faint)" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16.5, textDecoration: p.alive ? "none" : "line-through", color: p.alive ? "var(--ink)" : "var(--ink-faint)" }}>
          {p.name}{isYou && <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}> · you</span>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>{p.alive ? "still standing" : "gone"}</div>
      </div>
      {right}
    </div>
  );
}

/* ── Sky header — sun arc by time of day ─ */
export function SkyHeader({
  view, temp, children,
}: {
  view: { nowMinute: number; finaleMinute: number };
  temp?: "cold" | "warm";
  children?: ReactNode;
}) {
  const frac = Math.min(1, Math.max(0, view.nowMinute / view.finaleMinute));
  const x = 12 + frac * 76;
  const y = 78 - Math.sin(frac * Math.PI) * 56;
  const night = temp === "cold";
  return (
    <div style={{ position: "relative", overflow: "hidden", background: `linear-gradient(180deg, var(--sky-top), var(--sky-bot))`, transition: "background .8s ease" }}>
      <div style={{
        position: "absolute", left: `${x}%`, top: `${y}%`, width: 64, height: 64,
        transform: "translate(-50%,-50%)", borderRadius: 999,
        background: night ? "transparent" : "var(--sun)",
        boxShadow: night ? "none" : `0 0 48px 18px var(--sun-glow)`,
        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)",
        transition: "all .8s ease",
      }}>
        {night && <Icon.moon s={34} />}
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: night ? 0.12 : 0.5, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "30%", left: "8%", width: 120, height: 30, borderRadius: 999, background: "#fff", filter: "blur(8px)", animation: "sd-drift 9s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", top: "55%", right: "10%", width: 90, height: 24, borderRadius: 999, background: "#fff", filter: "blur(7px)", animation: "sd-drift 12s ease-in-out infinite alternate" }} />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

/* ── MoodHero — the "pulse of the room" ── */
export function MoodHero({ bar }: { bar: Band }) {
  const c = BAR_COPY[bar] || BAR_COPY.healthy;
  const moodVar = bar === "critical" ? "--bad" : bar === "strained" ? "--warn" : "--good";
  const mood = `var(${moodVar})`;
  const speed = bar === "critical" ? 1.5 : bar === "strained" ? 2.3 : 3.2;
  const Glyph = bar === "critical" ? Icon.alert : Icon.spark;
  const cells = c.cells, total = 6;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: 116, height: 116, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        {[0, 1, 2].map((i) =>
          <span key={i} style={{ position: "absolute", width: 92, height: 92, borderRadius: 999, border: `2px solid ${mood}`, animation: `sd-ping ${speed}s ease-out ${i * (speed / 3)}s infinite` }} />
        )}
        <div style={{
          position: "relative", width: 60, height: 60, borderRadius: 999, color: mood,
          background: `color-mix(in oklab, ${mood} 18%, var(--surface))`, border: `1.5px solid ${mood}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 26px color-mix(in oklab, ${mood} 45%, transparent)`,
          animation: bar === "critical" ? "sd-breathe-fast 1.8s ease-in-out infinite" : "sd-breathe 4.5s ease-in-out infinite",
        }}>
          <Glyph s={26} />
        </div>
      </div>
      <div className="sd-title" style={{ fontSize: 22, color: mood, textAlign: "center" }}>{c.label}</div>
      <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginTop: 4, textAlign: "center", maxWidth: 300 }}>{c.sub}</div>
      <div style={{ position: "relative", width: "100%", maxWidth: 280, height: 8, marginTop: 16, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, width: `${Math.max(6, cells / total * 100)}%`, background: mood, transition: "width .9s cubic-bezier(.3,.8,.3,1), background .8s ease" }} />
      </div>
    </div>
  );
}

/* ── HudReadout — thin instrument strip ── */
export function HudReadout({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ display: "flex", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      {items.map((it, i) =>
        <div key={i} style={{ flex: 1, padding: "11px 13px", borderLeft: i ? "1px solid var(--line)" : "none" }}>
          <div className="sd-mono" style={{ color: "var(--ink-faint)", marginBottom: 5 }}>{it.label}</div>
          <div className="sd-display" style={{ fontWeight: 800, fontSize: 19, color: it.color || "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{it.value}</div>
        </div>
      )}
    </div>
  );
}

/* ── RoleCard — same neutral treatment for every role ── */
type RoleKey = "killer" | "cop" | "medic" | "town";
const ROLE_INFO: Record<RoleKey, { name: string; team: string; icon: IconComp; desc: string; action: string | null }> = {
  killer: { name: "Killer", team: "Killers", icon: Icon.blade, desc: "You can eliminate other players. Complete tasks to charge your strike, then act when no one's watching.", action: "Open your tools" },
  cop: { name: "Investigator", team: "Town", icon: Icon.eye, desc: "Each round you can quietly investigate one player and get a private read on them. Tell no one.", action: "Open your tools" },
  medic: { name: "Medic", team: "Town", icon: Icon.shield, desc: "Each round you can protect one player from being eliminated. Choose silently — say nothing.", action: "Open your tools" },
  town: { name: "Townsperson", team: "Town", icon: Icon.glass, desc: "You have no special abilities. Read the room, talk, and vote to find the killers before they win.", action: null },
};
export function RoleCard({ role, onOpen }: { role: RoleKey; onOpen?: () => void }) {
  const r = ROLE_INFO[role] || ROLE_INFO.town;
  const RIcon = r.icon;
  return (
    <div style={{ borderRadius: 20, background: "var(--surface)", border: "1px solid var(--line-strong)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
      <div style={{ padding: "15px 16px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><RIcon s={24} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sd-mono" style={{ color: "var(--ink-faint)" }}>Your secret role</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--ink)", lineHeight: 1.1 }}>{r.name}</div>
          </div>
          <span className="sd-mono" style={{ color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 999, padding: "5px 10px" }}>{r.team}</span>
        </div>
        <div style={{ fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.42, marginTop: 12 }}>{r.desc}</div>
      </div>
      {r.action &&
        <div className="sd-press" onClick={onOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderTop: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)", fontWeight: 700, fontSize: 15 }}>
          <span>{r.action}</span><Icon.chevR s={18} />
        </div>
      }
    </div>
  );
}

/* ── LivingLine — players-remaining as a flat instrument line ── */
export function LivingLine({ players, onOpen }: { players: PublicPlayer[]; you?: string; onOpen?: () => void }) {
  const total = players.length;
  const living = players.filter((p) => p.alive);
  return (
    <div className={onOpen ? "sd-press" : undefined} onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 13, padding: "4px 2px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
        <span className="sd-display" style={{ fontSize: 24, color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{living.length}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-faint)" }}>/ {total} in</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {players.map((p) =>
          <span key={p.id} style={{ width: 8, height: 8, borderRadius: 999, background: p.alive ? "var(--good)" : "transparent", border: p.alive ? "none" : "1.5px solid var(--line-strong)", transition: "background .4s ease" }} />
        )}
      </div>
      <div style={{ flex: 1 }} />
      {onOpen && <span style={{ color: "var(--ink-faint)", flexShrink: 0, display: "flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 600 }}>Table<Icon.chevR s={15} /></span>}
    </div>
  );
}

/* ── LivingMini — players-remaining as a quiet header note ── */
export function LivingMini({ players, onOpen }: { players: PublicPlayer[]; onOpen?: () => void }) {
  const living = players.filter((p) => p.alive);
  const total = players.length;
  return (
    <div className={onOpen ? "sd-press" : undefined} onClick={onOpen} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span className="sd-mono" style={{ color: "var(--ink-faint)" }}>{living.length} of {total} still in</span>
      <span style={{ display: "flex", gap: 4 }}>
        {players.map((p) => (
          <span key={p.id} style={{ width: 6, height: 6, borderRadius: 999, background: p.alive ? "var(--ink-soft)" : "transparent", border: p.alive ? "none" : "1px solid var(--line-strong)" }} />
        ))}
      </span>
    </div>
  );
}

/* ── Sheet — bottom-sheet drawer scaffold ── */
export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void; tone?: string }) {
  return createPortal(
    <div className="sd-fade" onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.55)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      overflow: "hidden",
    }}>
      <div className="sd-rise" onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)",
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: "10px 18px 30px",
        maxHeight: "86vh",
        width: "100%", boxSizing: "border-box", overflow: "hidden",
        display: "flex", flexDirection: "column",
        fontFamily: "var(--font-ui, 'Geist', system-ui, sans-serif)",
        color: "var(--ink)",
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: "var(--line-strong)", margin: "0 auto 16px", flexShrink: 0 }} />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ── TableDrawer — names + who's in ── */
export function TableDrawer({ players, youId, onClose }: { players: PublicPlayer[]; youId: string; onClose: () => void }) {
  const living = players.filter((p) => p.alive).length;
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="sd-title" style={{ fontSize: 23, color: "var(--ink)" }}>The table</div>
        <span className="sd-mono" style={{ color: "var(--ink-faint)" }}>{living} of {players.length} still in</span>
      </div>
      <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginBottom: 12 }}>
        Names only. Sundown never shows whose side anyone is on.
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {players.map((p, i) =>
          <div key={p.id}>
            <RosterRow p={p} you={youId} />
            {i < players.length - 1 && <div style={{ height: 1, background: "var(--line)", margin: "0 4px" }} />}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ── IconToggle — compact in-app control ── */
export function IconToggle({ on, onIcon, offIcon, onClick, active }: { on: boolean; onIcon: IconComp; offIcon: IconComp; onClick: () => void; active?: boolean }) {
  const On = onIcon, Off = offIcon;
  return (
    <div className="sd-press" onClick={onClick} style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--ink)" : "var(--surface)", color: active ? "var(--bg)" : "var(--ink-soft)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
      {on ? <On s={18} /> : <Off s={18} />}
    </div>
  );
}

/* ── Toast — transient confirmation ── */
export function Toast({ msg }: { msg: string }) {
  return (
    <div className="sd-fade" style={{ position: "absolute", left: "50%", bottom: 92, transform: "translateX(-50%)", background: "var(--ink)", color: "var(--bg)", padding: "12px 20px", borderRadius: 14, fontWeight: 700, fontSize: 14.5, boxShadow: "var(--shadow)", zIndex: 40, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <Icon.check s={17} /> {msg}
    </div>
  );
}

export function roleKeyOf(you: { killer?: unknown; cop?: unknown; medic?: unknown; isGhost: boolean }): RoleKey {
  if (you.killer && !you.isGhost) return "killer";
  if (you.cop) return "cop";
  if (you.medic) return "medic";
  return "town";
}

/* small helper used across screens */
export function nameOf(players: PublicPlayer[], id: string | null): string {
  if (!id) return "Someone";
  return players.find((p) => p.id === id)?.name ?? "Someone";
}
