/* Sundown — cold / private screens: Killer, Cop, Medic, Ghost, Game over.
   Ported from sd-cold.jsx, typed and wired to live killer actions. Cop/Medic
   actions stay client-local (the backend has no investigate/shield endpoint yet
   — §17.2 is an open design item), exactly as the prototype modeled them. The
   game-over reveal degrades gracefully: roles only appear if a recap map is
   supplied (demo), never from the live mid-game PlayerView. */

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import type { PlayerView, Role } from "../types";
import {
  Button, Card, EventFeed, Icon, LivingLine, Pill, RosterRow, avatarColor, nameOf,
  type IconComp,
} from "../components/ui";

/* progress ring */
function Ring({
  frac, size = 132, stroke = 12, color = "var(--accent)", children,
}: {
  frac: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, frac))} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{children}</div>
    </div>
  );
}

/* strike meter — a dashed arc gauge; each notch is a task-charge toward a kill */
function StrikeMeter({ filled, total, ready, size = 128 }: { filled: number; total: number; ready: boolean; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 12, sw = 9;
  const START = 130, SWEEP = 280, slice = SWEEP / total, pad = total > 6 ? 3 : 4;
  const polar = (deg: number): [number, number] => { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const seg = (a0: number, a1: number) => {
    const [x0, y0] = polar(a0), [x1, y1] = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, animation: ready ? "sd-breathe 2.8s ease-in-out infinite" : "none" }}>
      <svg width={size} height={size}>
        {Array.from({ length: total }).map((_, i) => {
          const a0 = START + i * slice + pad, a1 = START + (i + 1) * slice - pad;
          const on = i < filled;
          return <path key={i} d={seg(a0, a1)} fill="none" strokeWidth={sw} strokeLinecap="round"
            stroke={on ? "var(--bad)" : "var(--line-strong)"}
            style={{ filter: on && ready ? "drop-shadow(0 0 3px var(--bad))" : "none", opacity: on ? 1 : 0.55, transition: "stroke .3s ease, opacity .3s ease" }} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {ready ? (
          <>
            <span style={{ color: "var(--bad)", display: "flex" }}><Icon.blade s={24} /></span>
            <div className="sd-display" style={{ fontSize: 15, color: "var(--bad)", marginTop: 3, letterSpacing: "0.02em" }}>Ready</div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <span className="sd-display" style={{ fontSize: 30, color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{filled}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-faint)" }}>/{total}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 4, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{total - filled} to go</div>
          </>
        )}
      </div>
    </div>
  );
}

/* shared target picker overlay */
function TargetSheet({
  view, title, sub, verb, tone, suggestions, onPick, onClose,
}: {
  view: PlayerView;
  title: string;
  sub: string;
  verb: string;
  tone: "bad" | "accent" | "good";
  suggestions?: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const living = view.players.filter((p) => p.alive && p.id !== view.you.id);
  return (
    <div className="sd-fade" style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}>
      <div className="sd-rise" onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: "10px 18px 30px", maxHeight: "86%", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: "var(--line-strong)", margin: "0 auto 16px" }} />
        <div className="sd-title" style={{ fontSize: 23, color: `var(--${tone})` }}>{title}</div>
        <div className="sd-riddle" style={{ fontSize: 16, color: "var(--ink-soft)", marginBottom: 14 }}>{sub}</div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {living.map((p, i) => {
            const flagged = suggestions?.includes(p.id);
            return (
              <div key={p.id}>
                <RosterRow p={p} you={view.you.id} onClick={() => setPicked(p.id)}
                  right={picked === p.id
                    ? <div style={{ width: 26, height: 26, borderRadius: 999, background: `var(--${tone})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.check s={16} /></div>
                    : flagged ? <Pill tone="bad" style={{ background: "rgba(229,72,77,0.16)" }}><Icon.eye s={12} /> a whisper</Pill>
                      : <div style={{ width: 24, height: 24, borderRadius: 999, border: "2px solid var(--line-strong)" }} />} />
                {i < living.length - 1 && <div style={{ height: 1, background: "var(--line)", margin: "0 4px" }} />}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <Button danger={tone === "bad"} disabled={!picked} full onClick={() => picked && onPick(picked)}>
            {picked ? `${verb} ${nameOf(view.players, picked)}` : "Choose a name"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* confirmation flash */
function Done({ icon, line, sub, onDone }: { icon: ReactNode; line: string; sub: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="sd-fade" style={{ position: "absolute", inset: 0, zIndex: 60, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 30 }}>
      <div style={{ color: "var(--accent)", marginBottom: 18, animation: "sd-breathe 3s ease-in-out infinite" }}>{icon}</div>
      <div className="sd-display" style={{ fontSize: 30, color: "var(--ink)" }}>{line}</div>
      <div className="sd-riddle" style={{ fontSize: 18, color: "var(--ink-soft)", marginTop: 10, maxWidth: 300 }}>{sub}</div>
    </div>
  );
}

type DoneState = { icon: ReactElement; line: string; sub: string };

/* ── KILLER ── */
export function KillerScreen({
  view, suggestions, onKill, onBankMove, onWhisper,
}: {
  view: PlayerView;
  suggestions: string[];
  onKill: (targetId: string) => void;
  onBankMove: () => void;
  onWhisper: (targetId: string) => void;
}) {
  const k = view.you.killer;
  const [sheet, setSheet] = useState<"kill" | "whisper" | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);
  if (!k) return null;
  const bankFull = k.teamMoveCharges >= k.maxMoves;
  return (
    <div className="sd-screen sd-scroll" style={{ padding: "108px 18px 30px" }}>
      <div className="sd-eyebrow" style={{ color: "var(--bad)", marginBottom: 6 }}>Kept between you and your side</div>
      <div className="sd-display" style={{ fontSize: 32, marginBottom: 14 }}>The quiet work</div>

      <Card raised style={{ display: "flex", alignItems: "center", gap: 18, padding: 18, background: "var(--surface-2)" }}>
        <StrikeMeter filled={k.meterPoints} total={k.killCost} ready={k.canKillNow} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sd-mono" style={{ color: "var(--bad)", marginBottom: 4 }}>Strike meter</div>
          <div className="sd-title" style={{ fontSize: 19, color: k.canKillNow ? "var(--bad)" : "var(--ink)", lineHeight: 1.1 }}>
            {k.canKillNow ? "Charged — ready" : `${k.killCost - k.meterPoints} more to go`}
          </div>
          <div className="sd-riddle" style={{ fontSize: 14.5, color: "var(--ink-soft)", marginTop: 6 }}>
            {k.canKillNow ? "Every notch is filled. A moment of quiet is all you need." : "Each task you finish lights a notch — heavier dares fill more."}
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <Button danger full disabled={!k.canKillNow} onClick={() => setSheet("kill")}>
          <Icon.blade s={20} /> {k.canKillNow ? "Make a move" : "Meter not full"}
        </Button>
      </div>

      {/* bank move — offense vs resilience */}
      <Card style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="sd-title" style={{ fontSize: 18 }}>Bank a move</div>
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: k.maxMoves }).map((_, i) => (
              <span key={i} style={{ width: 12, height: 12, borderRadius: 999, background: i < k.teamMoveCharges ? "var(--bad)" : "var(--surface-2)", border: "1px solid var(--line-strong)" }} />
            ))}
          </div>
        </div>
        <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginBottom: 13 }}>
          Spend the meter on insurance for your side instead of a strike. Resilience now, or blood now — never both.
        </div>
        <Button variant="soft" full disabled={!k.canKillNow || bankFull} onClick={() => {
          onBankMove();
          setDone({ icon: <Icon.shield s={50} />, line: "A move is banked.", sub: "Your side is a little harder to unravel now." });
        }}>
          Bank for the team {bankFull ? "· full" : ""}
        </Button>
      </Card>

      {/* whisper / suggest */}
      <Card style={{ marginTop: 14 }}>
        <div className="sd-title" style={{ fontSize: 18, marginBottom: 6 }}>Whisper a target</div>
        <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginBottom: 13 }}>
          Nudge a name toward your side — anonymously. It's how you find each other without ever saying a word. You'll never know who whispered back.
        </div>
        {suggestions.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, fontSize: 13.5, color: "var(--bad)", fontWeight: 600 }}>
            <Icon.eye s={16} /> A whisper already points at someone.
          </div>
        )}
        <Button variant="ghost" full onClick={() => setSheet("whisper")}><Icon.eye s={18} /> Whisper a name</Button>
      </Card>

      {sheet === "kill" && (
        <TargetSheet view={view} tone="bad" title="Make a move" verb="Move on"
          sub="It lands later, and vaguely. No one will see your hand in it."
          suggestions={suggestions}
          onClose={() => setSheet(null)}
          onPick={(id) => { setSheet(null); onKill(id); setDone({ icon: <Icon.blade s={50} />, line: "It's done.", sub: "Somewhere, in a few minutes, the day will quietly change shape." }); }} />
      )}
      {sheet === "whisper" && (
        <TargetSheet view={view} tone="bad" title="Whisper a name" verb="Whisper"
          sub="Anonymous. Current only. Your own name is never an option."
          suggestions={suggestions}
          onClose={() => setSheet(null)}
          onPick={(id) => { setSheet(null); onWhisper(id); setDone({ icon: <Icon.eye s={50} />, line: "Whispered.", sub: "If they're listening, they'll feel the nudge. If." }); }} />
      )}
      {done && <Done {...done} onDone={() => setDone(null)} />}
    </div>
  );
}

/* ── COP ── (investigate is client-local; §17.2 open) */
const COP_READS = [
  { word: "unsettled", line: "Something doesn't sit right. But people are strange when they're tired." },
  { word: "warm", line: "Easy company. Though the easy ones are sometimes the ones to watch." },
  { word: "guarded", line: "Holding something back. Everyone holds something back." },
];

export function CopScreen({ view }: { view: PlayerView }) {
  const charges = view.you.cop?.investigations ?? 0;
  const [left, setLeft] = useState(charges);
  const [sheet, setSheet] = useState(false);
  const [reading, setReading] = useState<{ name: string; word: string; line: string } | null>(null);
  return (
    <div className="sd-screen sd-scroll" style={{ padding: "108px 18px 30px" }}>
      <div className="sd-eyebrow" style={{ marginBottom: 6 }}>Yours alone — tell no one</div>
      <div className="sd-display" style={{ fontSize: 34, marginBottom: 16 }}>A read on the room</div>

      <Card raised style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Ring frac={left > 0 ? 1 : 0} size={96} stroke={9} color="var(--accent)">
          <div className="sd-display" style={{ fontSize: 26 }}>{left}</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>left</div>
        </Ring>
        <div style={{ flex: 1 }}>
          <div className="sd-title" style={{ fontSize: 19 }}>Quiet readings</div>
          <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginTop: 4 }}>
            A feeling about someone — never proof. It won't clear anyone, and it can be wrong.
          </div>
        </div>
      </Card>

      {reading && (
        <Card raised style={{ marginTop: 14, borderColor: "color-mix(in oklab, var(--accent) 35%, var(--line))" }}>
          <div className="sd-eyebrow" style={{ marginBottom: 6 }}>Your read on {reading.name}</div>
          <div className="sd-display" style={{ fontSize: 28, color: "var(--accent)" }}>Reads {reading.word}.</div>
          <div className="sd-riddle" style={{ fontSize: 17, color: "var(--ink-soft)", marginTop: 8 }}>{reading.line}</div>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Button full disabled={left <= 0} onClick={() => setSheet(true)}><Icon.eye s={20} /> {left > 0 ? "Read someone" : "No readings left"}</Button>
      </div>

      {sheet && (
        <TargetSheet view={view} tone="accent" title="Read someone" verb="Read"
          sub="Choose quietly. They'll never know you looked."
          onClose={() => setSheet(false)}
          onPick={(id) => { setSheet(false); setLeft((l) => l - 1); const r = COP_READS[Math.floor(Math.random() * COP_READS.length)]!; setReading({ name: nameOf(view.players, id), ...r }); }} />
      )}
    </div>
  );
}

/* ── MEDIC ── (shield is client-local; §17.2 open) */
export function MedicScreen({ view }: { view: PlayerView }) {
  const charges = view.you.medic?.shields ?? 0;
  const [left, setLeft] = useState(charges);
  const [sheet, setSheet] = useState(false);
  const [warded, setWarded] = useState<string | null>(null);
  return (
    <div className="sd-screen sd-scroll" style={{ padding: "108px 18px 30px" }}>
      <div className="sd-eyebrow" style={{ marginBottom: 6 }}>Yours alone — tell no one</div>
      <div className="sd-display" style={{ fontSize: 34, marginBottom: 16 }}>Watch over someone</div>

      <Card raised style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Ring frac={left > 0 ? 1 : 0} size={96} stroke={9} color="var(--good)">
          <div className="sd-display" style={{ fontSize: 26 }}>{left}</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>shields</div>
        </Ring>
        <div style={{ flex: 1 }}>
          <div className="sd-title" style={{ fontSize: 19 }}>A quiet shield</div>
          <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginTop: 4 }}>
            Cover one person from the next strike. If you guess right, they'll never know how close it came.
          </div>
        </div>
      </Card>

      {warded && (
        <Card raised style={{ marginTop: 14, borderColor: "color-mix(in oklab, var(--good) 35%, var(--line))" }}>
          <div className="sd-eyebrow" style={{ marginBottom: 6 }}>Tonight you're watching</div>
          <div className="sd-display" style={{ fontSize: 28, color: "var(--good)" }}>{warded}</div>
          <div className="sd-riddle" style={{ fontSize: 17, color: "var(--ink-soft)", marginTop: 8 }}>Say nothing. A shield only works in silence.</div>
        </Card>
      )}

      <div style={{ marginTop: 14 }}>
        <Button full disabled={left <= 0} style={{ background: "var(--good)" }} onClick={() => setSheet(true)}><Icon.shield s={20} /> {left > 0 ? "Shield someone" : "No shields left"}</Button>
      </div>

      {sheet && (
        <TargetSheet view={view} tone="good" title="Shield someone" verb="Shield"
          sub="One name. They're covered from the next strike — if it comes for them."
          onClose={() => setSheet(false)}
          onPick={(id) => { setSheet(false); setLeft((l) => l - 1); setWarded(nameOf(view.players, id)); }} />
      )}
    </div>
  );
}

/* ── GHOST ── */
export function GhostScreen({ view, onOpenTable }: { view: PlayerView; onOpenTable: () => void }) {
  return (
    <div className="sd-screen sd-scroll" style={{ padding: "76px 18px 30px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 22 }}>
        <div style={{ color: "var(--ink-soft)", marginBottom: 14, animation: "sd-breathe 5s ease-in-out infinite" }}><Icon.ghost s={64} /></div>
        <div className="sd-eyebrow" style={{ marginBottom: 8 }}>You're out — but not gone</div>
        <div className="sd-display" style={{ fontSize: 38, color: "var(--ink)" }}>The afterlife</div>
        <div className="sd-riddle" style={{ fontSize: 18, color: "var(--ink-soft)", marginTop: 10, maxWidth: 300 }}>
          The table let you go. Quietly, you've crossed over — their loss is the other side's gain now.
        </div>
      </div>

      <LivingLine players={view.players} you={view.you.id} onOpen={onOpenTable} />
      <div style={{ height: 1, background: "var(--line)", margin: "14px 0" }} />

      <Card raised style={{ background: "linear-gradient(160deg, #1a1113, #0f0c0d)", borderColor: "rgba(229,72,77,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(229,72,77,0.16)", display: "flex", alignItems: "center", justifyContent: "center", color: "#E5484D" }}><Icon.blade s={22} /></div>
          <div style={{ flex: 1 }}>
            <div className="sd-title" style={{ fontSize: 18, color: "#fff" }}>You drift with the killers now</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>Still no proof. Still no names spoken aloud.</div>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 14, opacity: 0.7 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="sd-title" style={{ fontSize: 18 }}>Accuracy ballot</div>
          <Pill tone="neutral">soon</Pill>
        </div>
        <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginTop: 6 }}>
          A side-game for the departed: call who's who before the day ends. Bragging rights for the dead.
        </div>
      </Card>

      <div style={{ marginTop: 20 }}>
        <div className="sd-eyebrow" style={{ marginBottom: 4, padding: "0 2px" }}>You can still watch</div>
        <EventFeed events={view.events} now={view.nowMinute} />
      </div>
    </div>
  );
}

/* ── GAME OVER ── */
const REASON_COPY: Record<string, string> = {
  parity: "The killers reached parity. From there, the day could only end one way.",
  collapse: "The town fell apart from the inside before the truth ever surfaced.",
  allKillersEliminated: "Every knife was found and set down. The day was won in the open.",
  finaleSurvival: "The sun set with the town still standing. They made it.",
};
const ROLE_META: Record<Role, { label: string; tone: "bad" | "accent" | "good" | "neutral"; icon: IconComp }> = {
  killer: { label: "Killer", tone: "bad", icon: Icon.blade },
  cop: { label: "Cop", tone: "accent", icon: Icon.eye },
  medic: { label: "Medic", tone: "good", icon: Icon.shield },
  townsperson: { label: "Townsperson", tone: "neutral", icon: Icon.glass },
};
function RevealRow({ p, role, i }: { p: PlayerView["players"][number]; role: Role | undefined; i: number }) {
  const meta = role ? ROLE_META[role] : null;
  const RIcon = meta?.icon;
  return (
    <div className="sd-rise" style={{ animationDelay: `${300 + i * 90}ms`, display: "flex", alignItems: "center", gap: 13, padding: "11px 4px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ width: 38, height: 38, borderRadius: 999, background: p.alive ? avatarColor(p.id) : "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: p.alive ? "#fff" : "var(--ink-faint)", fontWeight: 800, filter: p.alive ? "none" : "grayscale(1)" }}>{p.name[0]}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16.5, textDecoration: p.alive ? "none" : "line-through", color: p.alive ? "var(--ink)" : "var(--ink-faint)" }}>{p.name}</div>
        <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{p.alive ? "survived" : "fell"}</div>
      </div>
      {meta && RIcon
        ? <Pill tone={meta.tone}><RIcon s={13} /> {meta.label}</Pill>
        : <Pill tone="neutral"><Icon.lock s={13} /> sealed</Pill>}
    </div>
  );
}

export function GameOverScreen({ view, reveal, onLeave }: { view: PlayerView; reveal?: Record<string, Role>; onLeave?: () => void }) {
  const res = view.result;
  if (!res) return null;
  const townWon = res.winner === "town";
  return (
    <div className="sd-screen sd-scroll" style={{ padding: "78px 18px 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="sd-eyebrow" style={{ marginBottom: 10 }}>The day is over</div>
        <div className="sd-display" style={{ fontSize: 52, color: townWon ? "var(--good)" : "var(--bad)", lineHeight: 1 }}>
          {townWon ? "The town survived" : "The killers won"}
        </div>
        <div className="sd-riddle" style={{ fontSize: 18.5, color: "var(--ink-soft)", marginTop: 14, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
          {REASON_COPY[res.reason]}
        </div>
      </div>

      <Card raised>
        <div className="sd-eyebrow" style={{ marginBottom: 8 }}>{reveal ? "The truth, at last" : "The day's final standing"}</div>
        <div className="sd-riddle" style={{ fontSize: 15.5, color: "var(--ink-soft)", marginBottom: 6 }}>
          {reveal
            ? "For the whole day, no one's role was ever shown. Here's who everyone really was."
            : "Roles stay sealed in the app — ask your host to read out the recap. Here's who made it to sundown."}
        </div>
        {view.players.map((p, i) => <RevealRow key={p.id} p={p} role={reveal?.[p.id]} i={i} />)}
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 12, fontStyle: "italic" }}>
          Reveal comes from the host recap — roles are never in the player feed mid-game.
        </div>
      </Card>

      {onLeave && (
        <div style={{ marginTop: 24 }}>
          <Button onClick={onLeave} variant="soft" full>
            ← Join a new game
          </Button>
        </div>
      )}
    </div>
  );
}
