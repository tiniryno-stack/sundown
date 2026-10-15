/* Waitlist signup for the landing page. Collects an email into the backend's
   waitlist (POST /waitlist). No emails are ever sent from here.

   <WaitlistInline> starts as a small text link and opens into an email field.
   <WaitlistBar> is the thin strip at the very top of the page; its button
   opens and focuses the hero's inline form. */

import { useEffect, useId, useRef, useState } from "react";
import { api } from "../api";

const JOINED_KEY = "sundown.waitlist.joined";
const OPEN_EVENT = "sundown:open-waitlist";

function wasJoined(): boolean {
  try { return localStorage.getItem(JOINED_KEY) === "1"; } catch { return false; }
}
function markJoined() {
  try { localStorage.setItem(JOINED_KEY, "1"); } catch { /* private mode: fine */ }
}

/** Ask the hero form to open, scroll into view, and focus. */
export function openWaitlist() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function WaitlistInline({ source = "hero" }: { source?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot: real people never see or fill this
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(() => (wasJoined() ? "done" : "idle"));
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus({ preventScroll: true }); }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      await api.joinWaitlist(email, source, company);
      markJoined();
      setState("done");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error && err.message && !/failed to fetch|load failed|network/i.test(err.message)
        ? err.message
        : "Couldn't reach the server. Try again in a moment.");
    }
  };

  if (state === "done") {
    return (
      <div className="wl" ref={wrapRef} role="status">
        <span className="wl-done"><span className="wl-check" aria-hidden="true">✓</span> You're on the waitlist.</span>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="wl" ref={wrapRef}>
        <button type="button" className="wl-link" onClick={() => setOpen(true)}>
          Join the waitlist <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="wl" ref={wrapRef}>
      <form className="wl-form" onSubmit={submit} noValidate>
        <label className="wl-label mono" htmlFor={`${id}-email`}>Join the waitlist</label>
        <div className="wl-row">
          <input
            ref={inputRef} id={`${id}-email`} type="email" inputMode="email" autoComplete="email"
            placeholder="you@email.com" value={email} required
            onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
          />
          <button type="submit" disabled={state === "sending" || !email.trim()}>
            {state === "sending" ? "Joining…" : "Join"}
          </button>
        </div>
        <input className="wl-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="company"
          value={company} onChange={(e) => setCompany(e.target.value)} />
        <span className={`wl-note${state === "error" ? " err" : ""}`} role={state === "error" ? "alert" : undefined}>
          {state === "error" ? msg : "No spam. Just your spot in line."}
        </span>
      </form>
    </div>
  );
}

export function WaitlistBar() {
  return (
    <div className="wl-bar">
      <div className="wrap wl-bar-inner">
        <span><span className="wl-bar-dot" aria-hidden="true" />Sundown is in early access.</span>
        <button type="button" onClick={openWaitlist}>Join the waitlist <span aria-hidden="true">→</span></button>
      </div>
    </div>
  );
}
