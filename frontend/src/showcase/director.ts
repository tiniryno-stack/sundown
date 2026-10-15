/* The director: a requestAnimationFrame clock that walks a Script and fires
   each phone's commands at their time, then loops. Pausing just stops the
   clock; nothing is lost. Also: in-view + reduced-motion hooks. */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PhoneHandle } from "./Phone";
import type { Cmd, Script } from "./story";

function dispatch(phone: PhoneHandle | null | undefined, c: Cmd) {
  if (!phone) return;
  if (c.scene) phone.scene(c.scene);
  if (c.push) phone.push(c.push);
  if (c.tap) phone.tap(c.tap, c.dwell);
}

export function useDirector(
  script: Script,
  running: boolean,
  phones: Record<string, RefObject<PhoneHandle>>,
) {
  const elapsed = useRef(0);
  const fired = useRef(new Set<string>());
  const progressRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState(0);
  const phonesRef = useRef(phones);
  phonesRef.current = phones;

  const restart = useCallback(() => {
    elapsed.current = 0;
    fired.current = new Set();
    setCaption(0);
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(120, now - last);
      last = now;
      let e = elapsed.current + dt;
      if (e >= script.length) { e = 0; fired.current = new Set(); }
      elapsed.current = e;

      for (const [id, cmds] of Object.entries(script.tracks)) {
        cmds.forEach((c, i) => {
          const key = `${id}:${i}`;
          if (c.at <= e && !fired.current.has(key)) {
            fired.current.add(key);
            dispatch(phonesRef.current[id]?.current, c);
          }
        });
      }

      let ci = 0;
      script.captions.forEach((c, i) => { if (c.at <= e) ci = i; });
      setCaption(ci);
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${e / script.length})`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, script]);

  return { caption, progressRef, restart };
}

/** True while at least `threshold` of the element is on screen. */
export function useInView(ref: RefObject<Element>, threshold = 0.2): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}
