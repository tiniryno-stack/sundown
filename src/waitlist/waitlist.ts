/**
 * Waitlist — collects email addresses from the landing page.
 *
 * Deliberately tiny: no email is ever sent. It exists so the landing page can
 * offer "join the waitlist" and so Andrew can see how many people asked.
 * Stored behind the same `Store` interface as games (Redis in production,
 * files or memory locally), one record per normalized address, so signing up
 * twice is harmless.
 */

import type { Store } from "../persistence/store.js";

export type WaitlistEntry = {
  email: string;
  /** ISO timestamp of the first signup */
  at: string;
  /** where on the site they signed up, e.g. "hero" or "topbar" */
  source: string;
};

export type JoinResult = { ok: true; already: boolean } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trim + lowercase, or null if it doesn't look like an email address. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

function cleanSource(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[a-z0-9_-]{1,24}$/.test(s) ? s : "site";
}

export class Waitlist {
  constructor(
    private readonly store: Store<WaitlistEntry>,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async join(rawEmail: unknown, source?: unknown): Promise<JoinResult> {
    const email = normalizeEmail(rawEmail);
    if (!email) return { ok: false, error: "That doesn't look like an email address." };
    const existing = await this.store.load(email);
    if (existing) return { ok: true, already: true };
    await this.store.save(email, { email, at: new Date(this.now()).toISOString(), source: cleanSource(source) });
    return { ok: true, already: false };
  }

  async count(): Promise<number> {
    return (await this.store.list()).length;
  }

  /** Newest first. */
  async entries(): Promise<WaitlistEntry[]> {
    const ids = await this.store.list();
    const rows = await Promise.all(ids.map((id) => this.store.load(id)));
    return rows
      .filter((r): r is WaitlistEntry => !!r)
      .sort((a, b) => b.at.localeCompare(a.at));
  }
}

/** Very small fixed-window limiter so one visitor can't flood the list. */
export class RateLimiter {
  private hits = new Map<string, { start: number; n: number }>();
  constructor(private readonly max: number, private readonly windowMs: number, private readonly now = () => Date.now()) {}
  allow(key: string): boolean {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || t - h.start > this.windowMs) {
      this.hits.set(key, { start: t, n: 1 });
      if (this.hits.size > 5000) this.hits.clear();
      return true;
    }
    h.n += 1;
    return h.n <= this.max;
  }
}
