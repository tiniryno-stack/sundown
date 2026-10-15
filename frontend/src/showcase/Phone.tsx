/* A phone on the landing page that runs the real app.

   <AutoPhone> renders the actual ActiveShell / LobbyScreen inside a CSS device
   frame at true phone size (390×844), scaled down with a CSS variable. It
   exposes three commands for the director:
     scene(s)  – swap the PlayerView (and optionally remount the app)
     tap(text) – find an on-screen control by its text, show a finger tap, click it
     push(msg) – slide a lock-screen style notification over the app
   With `interactive`, the touch shield comes off and the visitor drives. */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
  type CSSProperties, type ReactNode,
} from "react";
import { ActiveShell, type Actions } from "../App";
import { LobbyScreen } from "../screens/cozy";
import { DEMO_KILL_SUGGESTIONS, DEMO_TASKS } from "../demo";
import { PortalTargetContext, clockOf } from "../components/ui";
import { REVEAL, type Scene } from "./story";

export type PhoneHandle = {
  scene: (s: Scene) => void;
  tap: (text: string, dwell?: number) => void;
  push: (msg: string) => void;
};

const NOOP: Actions = {
  completeTask: () => {}, rateTask: () => {}, castVote: () => {},
  killerKill: () => {}, killerBankMove: () => {}, killerSuggest: () => {},
};
const noop = () => {};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── device chrome ── */
function StatusBar({ time }: { time: string }) {
  return (
    <div className="pf-status" aria-hidden="true">
      <span className="pf-time">{time}</span>
      <span className="pf-icons">
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.7 6.7 0 0 0 8 4 6.7 6.7 0 0 0 3.4 5.8l1.2 1.3A5 5 0 0 1 8 5.8Zm0 3.5c.5 0 1 .2 1.3.5L8 11.6 6.7 9.8c.4-.3.8-.5 1.3-.5Z" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="17" height="9" rx="2" /><rect x="24.6" y="4.2" width="1.6" height="4.6" rx=".8" opacity=".5" /></svg>
      </span>
    </div>
  );
}

export function PhoneFrame({
  theme, time, children, screenRef, className, style,
}: {
  theme: "light" | "dark";
  time: string;
  children: ReactNode;
  screenRef?: React.Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`pf ${className ?? ""}`} style={style}>
      <div className="pf-device">
        <span className="pf-btn pf-btn-a" /><span className="pf-btn pf-btn-b" /><span className="pf-btn pf-btn-c" />
        <div className={`pf-screen pf-${theme}`} ref={screenRef}>
          {children}
          <StatusBar time={time} />
          <div className="pf-island" />
          <div className="pf-homebar" />
        </div>
      </div>
    </div>
  );
}

/* ── find + tap helpers ── */
function findByText(root: HTMLElement, text: string): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let fallback: HTMLElement | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.getClientRects().length === 0) continue;
    const t = (n.nodeValue ?? "").trim();
    if (t === text) return el;
    if (!fallback && t.startsWith(text)) fallback = el;
  }
  return fallback;
}

/** Scroll an element with an ease-in-out curve (browser smooth scroll is abrupt and inconsistent). */
function easeScroll(el: HTMLElement, to: number, ms: number): Promise<void> {
  const from = el.scrollTop;
  const max = el.scrollHeight - el.clientHeight;
  const end = Math.max(0, Math.min(max, to));
  if (Math.abs(end - from) < 2) return Promise.resolve();
  return new Promise((done) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      el.scrollTop = from + (end - from) * e;
      if (p < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
}

function scrollParent(el: HTMLElement, stop: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== stop; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 2) return p;
  }
  return null;
}

/* ── the self-driving phone ── */
export const AutoPhone = forwardRef<PhoneHandle, {
  initial: Scene;
  theme: "light" | "dark";
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}>(function AutoPhone({ initial, theme, interactive, className, style, label }, ref) {
  const [scene, setScene] = useState<Scene>(initial);
  const [epoch, setEpoch] = useState(0);
  const [pushes, setPushes] = useState<{ id: number; msg: string }[]>([]);
  const [taps, setTaps] = useState<{ id: number; x: number; y: number; press: boolean }[]>([]);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const uid = useRef(0);
  useEffect(() => {
    alive.current = true; // (re)set on mount — StrictMode mounts twice in dev
    return () => { alive.current = false; };
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    setTimeout(() => { if (alive.current) fn(); }, ms);
  }, []);

  /* Tap like a person would: scroll the target into view (eased), rest a finger on
     it long enough to read, press, then click the real control. */
  const tap = useCallback(async (text: string, dwell = 650) => {
    const screen = screenRef.current, app = appRef.current;
    if (!screen || !app) return;
    const hit = findByText(app, text);
    if (!hit) return;
    const target = (hit.closest(".sd-press") as HTMLElement | null) ?? hit;
    const scale = screen.getBoundingClientRect().width / 390 || 1;

    // Bring it into view inside the phone (never scrolls the page itself).
    const scroller = scrollParent(target, app);
    if (scroller) {
      const sr = scroller.getBoundingClientRect(), tr = target.getBoundingClientRect();
      const topGap = (tr.top - sr.top) / scale, bottomGap = (sr.bottom - tr.bottom) / scale;
      if (topGap < 90 || bottomGap < 130) {
        const delta = topGap < 90 ? topGap - 140 : (tr.height / scale) - bottomGap + 160;
        await easeScroll(scroller, scroller.scrollTop + delta, 650);
        await wait(120);
        if (!alive.current) return;
      }
    }

    const sr = screen.getBoundingClientRect(), r = target.getBoundingClientRect();
    const x = (r.left + r.width / 2 - sr.left) / scale;
    const y = (r.top + r.height / 2 - sr.top) / scale;
    const id = ++uid.current;
    setTaps((t) => [...t, { id, x, y, press: false }]);

    await wait(dwell); // finger rests on the control
    if (!alive.current) return;
    setTaps((t) => t.map((p) => (p.id === id ? { ...p, press: true } : p)));
    const prevT = target.style.transform, prevTr = target.style.transition;
    target.style.transition = "transform .16s cubic-bezier(.2,.7,.3,1)";
    target.style.transform = "scale(0.97)";
    await wait(170);
    target.style.transform = prevT;
    later(200, () => { target.style.transition = prevTr; });
    target.click();
    later(650, () => setTaps((t) => t.filter((p) => p.id !== id)));
  }, [later]);

  useImperativeHandle(ref, () => ({
    scene(s) {
      setScene(s);
      if (s.fresh) setEpoch((e) => e + 1);
    },
    tap(text, dwell) { void tap(text, dwell); },
    push(msg) {
      const id = ++uid.current;
      setPushes((p) => [...p.slice(-1), { id, msg }]);
      later(4200, () => setPushes((p) => p.filter((x) => x.id !== id)));
    },
  }), [tap, later]);

  const time = clockOf(scene.view.nowMinute).replace(/\s?[AP]M$/, "");
  const dark = theme === "dark";

  return (
    <PhoneFrame theme={theme} time={time} screenRef={screenRef} className={className} style={style}>
      <div className="sd-root" data-theme={theme} ref={appRef} aria-label={label}>
        <PortalTargetContext.Provider value={portalEl}>
          {/* keyed wrapper: a fresh scene (new loop, new role) cross-fades in */}
          <div key={`${scene.mode}${epoch}`} className="pf-app">
            {scene.mode === "lobby"
              ? <LobbyScreen view={scene.view} />
              : <ActiveShell view={scene.view} theme={theme} toggleTheme={noop} dark={dark}
                  tasks={DEMO_TASKS} suggestions={scene.view.you.killer && !scene.view.you.isGhost ? DEMO_KILL_SUGGESTIONS : []}
                  actions={NOOP} reveal={REVEAL} demo />}
          </div>
        </PortalTargetContext.Provider>
        <div ref={setPortalEl} />
      </div>
      {pushes.map((p) => (
        <div key={p.id} className="pf-push" role="status">
          <span className="pf-push-icon" />
          <span className="pf-push-body">
            <span className="pf-push-head"><b>Sundown</b><span>now</span></span>
            <span className="pf-push-msg">{p.msg}</span>
          </span>
        </div>
      ))}
      {taps.map((t) => <span key={t.id} className={`pf-finger${t.press ? " press" : ""}`} style={{ left: t.x, top: t.y }} />)}
      {!interactive && <div className="pf-shield" aria-hidden="true" />}
    </PhoneFrame>
  );
});
