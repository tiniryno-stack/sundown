/* The two live demos on the landing page.
   HeroDemo – one phone (Alice) playing a whole day, with a "take control" mode.
   TrioDemo – Alice, Dave and Eve's phones side by side on one shared clock. */

import { useEffect, useRef, useState, type RefObject } from "react";
import { clockOf } from "../components/ui";
import { AutoPhone, type PhoneHandle } from "./Phone";
import { useDirector, useInView, useReducedMotion } from "./director";
import { HERO_SCRIPT, TRIO_LABELS, TRIO_SCRIPT, controlView, type Who } from "./story";

/** Restart the script from the top each time it starts running. */
function useRestartOnStart(running: boolean, restart: () => void) {
  const was = useRef(false);
  useEffect(() => {
    if (running && !was.current) restart();
    was.current = running;
  }, [running, restart]);
}

type ControlKind = "town" | "killer" | "vote";
const CONTROLS: { kind: ControlKind; label: string }[] = [
  { kind: "town", label: "Town" },
  { kind: "killer", label: "Killer" },
  { kind: "vote", label: "Vote open" },
];

export function HeroDemo({ mode, onMode }: { mode: "auto" | "control"; onMode: (m: "auto" | "control") => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const phone = useRef<PhoneHandle>(null);
  const inView = useInView(wrapRef, 0.1);
  const reduced = useReducedMotion();
  const [played, setPlayed] = useState(false);
  const running = mode === "auto" && inView && (!reduced || played);
  const { caption, progressRef, restart } = useDirector(HERO_SCRIPT, running, { alice: phone });
  useRestartOnStart(running, restart);

  const [kind, setKind] = useState<ControlKind>("town");
  useEffect(() => {
    if (mode === "control") phone.current?.scene({ mode: "shell", view: controlView(kind), fresh: true });
  }, [mode, kind]);

  const cap = HERO_SCRIPT.captions[caption]!;
  return (
    <div className="hero-demo" ref={wrapRef} id="demo">
      <AutoPhone ref={phone} initial={HERO_SCRIPT.tracks.alice![0]!.scene!} theme="light"
        interactive={mode === "control"} className="hero-phone" label="Sundown app, playing a sample day" />
      {mode === "auto" ? (
        <div className="demo-cap">
          <div className="demo-cap-top">
            <span className="mono demo-clock">{clockOf(cap.minute)}</span>
            <span className="mono demo-tag"><span className="demo-dot" />Real app · sample game</span>
          </div>
          <p key={caption} className="demo-text cap-in">{cap.text}</p>
          <div className="demo-bar"><div ref={progressRef} /></div>
          {reduced && !played
            ? <button type="button" className="demo-btn" onClick={() => setPlayed(true)}>Play the demo</button>
            : <button type="button" className="demo-btn" onClick={() => onMode("control")}>Take control</button>}
        </div>
      ) : (
        <div className="demo-cap">
          <p className="demo-text">Your turn. Tap anything. This is the real app on a sample game.</p>
          <div className="seg" role="group" aria-label="Choose a perspective">
            {CONTROLS.map((c) => (
              <button type="button" key={c.kind} className={kind === c.kind ? "on" : ""} aria-pressed={kind === c.kind}
                onClick={() => setKind(c.kind)}>{c.label}</button>
            ))}
          </div>
          <button type="button" className="demo-btn ghost" onClick={() => onMode("auto")}>Watch the day again</button>
        </div>
      )}
    </div>
  );
}

const WHO: Who[] = ["alice", "dave", "eve"];

export function TrioDemo() {
  const secRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const alice = useRef<PhoneHandle>(null);
  const dave = useRef<PhoneHandle>(null);
  const eve = useRef<PhoneHandle>(null);
  const refs: Record<Who, RefObject<PhoneHandle>> = { alice, dave, eve };
  const inView = useInView(secRef, 0.25);
  const reduced = useReducedMotion();
  const [played, setPlayed] = useState(false);
  const running = inView && (!reduced || played);
  const { caption, progressRef, restart } = useDirector(TRIO_SCRIPT, running, refs);
  useRestartOnStart(running, restart);

  const cap = TRIO_SCRIPT.captions[caption]!;

  // On narrow screens the phones scroll sideways; follow the phone the caption is about,
  // unless the visitor has just swiped the row themselves.
  const touchedAt = useRef(0);
  useEffect(() => {
    const row = rowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth + 4 || Date.now() - touchedAt.current < 5000) return;
    const who = cap.focus ?? "alice";
    const el = row.querySelector<HTMLElement>(`[data-who="${who}"]`);
    if (el) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [caption, cap.focus]);
  const touched = () => { touchedAt.current = Date.now(); };

  return (
    <section className="trio" id="watch" ref={secRef}>
      <div className="wrap">
        <div className="trio-head">
          <div className="kicker">Same moment, three phones</div>
          <h2>Everyone is holding a different truth.</h2>
          <p>Seven friends, one day. Follow three of them. Their phones run the same game and show them very different things.</p>
        </div>
        <div className="trio-cap">
          <div className="trio-clock mono">{clockOf(cap.minute)}</div>
          <p key={caption} className="cap-in">{cap.text}</p>
          <div className="trio-bar">
            <div className="trio-fill" ref={progressRef} />
            {TRIO_SCRIPT.captions.map((c, i) => (
              <span key={c.at} className={`trio-tick ${i <= caption ? "on" : ""}`} style={{ left: `${(c.at / TRIO_SCRIPT.length) * 100}%` }} />
            ))}
          </div>
          {reduced && !played && <button type="button" className="demo-btn light" onClick={() => setPlayed(true)}>Play the scene</button>}
        </div>
      </div>
      <div className="trio-row" ref={rowRef} onPointerDown={touched} onWheel={touched} onTouchStart={touched}>
        {WHO.map((w) => {
          const lab = TRIO_LABELS[w][caption] ?? TRIO_LABELS[w][0]!;
          const dim = !!cap.focus && cap.focus !== w;
          return (
            <figure key={w} className={`trio-item${dim ? " is-dim" : ""}`} data-who={w}>
              <AutoPhone ref={refs[w]} initial={TRIO_SCRIPT.tracks[w]![0]!.scene!} theme="dark"
                className="trio-phone" label={`${lab.name}'s phone`} />
              <figcaption>
                <span className="trio-name">{lab.name}</span>
                <span className={`trio-role tone-${lab.tone}`}>{lab.role}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
