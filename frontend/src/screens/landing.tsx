// Public landing/showcase page — rendered at ?landing, same Vercel project and
// deploy as the live player app (mirrors the ?host / ?admin pattern in App.tsx).
// Ported from the Claude Design handoff "Sundown Landing Page.html" — see
// SITE_BRIEF.md and PORTFOLIO.md in the repo root for the source content.
// Styles live in ../landing.css, scoped entirely under .sd-landing.
//
// Two explicit TODOs carried over from the design handoff (search "TODO(site-brief)"):
//   1. #todo-demo-url    — final public demo URL (now: this same origin + "?demo")
//   2. #todo-contact-link — Andrew's resume/contact link
import "../landing.css";

const STEPS = [
  {
    n: "01",
    title: "Morning kickoff",
    body: "Roles go out in secret. About 2 in 7 people are killers — and even they don't know each other yet.",
  },
  {
    n: "02",
    title: "Tasks all day",
    body: "An endless stream of small dares keeps everyone moving. Camouflage, not chores — doing one never clears you.",
  },
  {
    n: "03",
    title: "The bar",
    body: "A shared meter quietly ages down all day. The group keeps it alive together, or the killers win by default.",
  },
  {
    n: "04",
    title: "Five votes",
    body: "At meals and natural pauses, the group votes someone out. Guess right, and a killer falls... maybe.",
  },
  {
    n: "05",
    title: "Sundown",
    body: "A caught killer doesn't always die — sometimes they move. The day ends in one last vote and the truth, all at once.",
  },
];

const SHOTS = [
  { src: "/images/land-home.png", alt: "Home screen", title: "Home", caption: "A banded mood, never a number" },
  { src: "/images/land-tasks.png", alt: "Tasks screen", title: "Tasks", caption: "Camouflage for everyone" },
  { src: "/images/land-vote.png", alt: "Vote screen", title: "A reckoning", caption: "One name, no takebacks" },
  { src: "/images/land-killer.png", alt: "Killer tools screen", title: "The quiet work", caption: "Killer-only tools" },
  { src: "/images/land-over.png", alt: "Game over screen", title: "Sundown", caption: "The only reveal you get" },
];

const RULES = [
  {
    title: "You never see anyone else's role",
    body: "Every read comes from behavior, not a list. The app knows everything and shows you almost nothing.",
  },
  {
    title: "Nothing gets typed in the app",
    body: "There's no chat, no messaging, no log. Every accusation happens to someone's face.",
  },
  {
    title: "Doing a task never clears you",
    body: "Killers task too. Being loud about it proves nothing — which means bluffing your way through one is fair play.",
  },
  {
    title: '"Done" is an honor-system tap',
    body: "No scanning, no verification. The point isn't catching cheaters — it's removing the reason to.",
  },
];

const WORKFLOW = [
  {
    n: "01",
    title: "Design spec first",
    body: (
      <>
        <code className="mono">game-spec.md</code> is a versioned, ratio-based design doc — with open questions
        marked <code className="mono">[TBD]</code> rather than guessed at.
      </>
    ),
  },
  {
    n: "02",
    title: "Autonomous backend build",
    body: (
      <>
        Engine → sim harness → AI Director → deck generator → service layer → persistence, in one unsupervised pass,
        ending in a written <code className="mono">PROGRESS.md</code>.
      </>
    ),
  },
  {
    n: "03",
    title: "A second, independent agent",
    body: "Built the entire player app from only the API contract and sample payloads — no access to backend source at all.",
  },
  {
    n: "04",
    title: "~9 days, first commit to live",
    body: "56 commits, ending in a deployed, phone-playable game — not a prototype that stayed a prototype.",
  },
];

const ARCH_NOTES = [
  (
    <>
      <b>The engine is pure and seedable</b> — every rule (point economy, bar decay, kill-meter, the moving-killer
      mechanic, vote resolution, ghost/resurrection) is a deterministic function, which is what makes the simulation
      harness possible at all.
    </>
  ),
  (
    <>
      <b>The simulation harness runs the real engine thousands of times</b> per config to validate the target balance
      (~50/50 win rate, evening-median resolution) — treated as a regression test, not a one-off script.
    </>
  ),
  (
    <>
      <b>The AI Director</b> is an LLM-in-the-loop pacing system with four hard constraints enforced in code: never
      leak hidden state, apply every adjustment on the same delay as all other events, stay within a bounded lever
      menu, and never touch votes, kill targets, or role assignment.
    </>
  ),
  (
    <>
      <b>Privacy is enforced at a single projection layer</b> — every player's view is built by one choke point that
      guarantees no one ever receives another player's role or the bar's exact value, tested directly rather than
      trusted to the frontend.
    </>
  ),
  (
    <>
      <b>Every LLM call sits behind a deterministic mock</b> — the full test suite, build, and balance harness all
      run with zero <code className="mono">ANTHROPIC_API_KEY</code> set.
    </>
  ),
];

const INFRA = [
  { title: "Vercel", body: "Frontend, auto-deploys on push to main." },
  { title: "Railway", body: <>Backend, auto-deploys on push, <code className="mono">/health</code> checked.</> },
  { title: "Upstash Redis", body: "Serverless persistence — game state survives restarts." },
  { title: "GitHub", body: "Single repo, frontend + backend co-located, CI/CD on push." },
  { title: "Live Anthropic API", body: "The Director and deck generator run for real in production." },
  { title: "Installable PWA", body: "Web Push wired; demo mode runs fully offline for QA." },
];

const DETAILS = [
  {
    title: "Ratio-based balance, not magic numbers",
    body: (
      <>
        The whole model is formulas over player count (<code className="mono">K = round(0.28 × N)</code>), so it
        scales from 7 to 22 players without hand re-tuning — and the spec calls out its own rounding edge cases
        rather than hiding them.
      </>
    ),
  },
  {
    title: "Honest calibration write-up",
    body: (
      <>
        <code className="mono">PROGRESS.md</code> documents a real divergence between simulated balance and the
        spec's estimate, explains the likely cause, and asserts the shape of the result as the regression — not a
        brittle exact number.
      </>
    ),
  },
  {
    title: "Progress never cross-feeds",
    body: "The two teams' meters are fully independent, and that invariant is unit-tested directly — not just assumed true by construction.",
  },
  {
    title: "Honor-system task completion",
    body: "Faking a task is in-character cover for a killer, so there's no scanning or verification layer to build — game design eliminating an entire class of engineering problem.",
  },
];

export function LandingApp() {
  return (
    <div className="sd-landing">
      {/* ============================================================
          TRACK A — PLAY
          ============================================================ */}
      <div className="play">
        <div className="wrap">
          <nav className="playnav">
            <div className="word">
              <span className="dot" />
              Sundown
            </div>
            <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
              <a href="#how-it-works" className="hide-mobile">
                How it plays
              </a>
              <a href="#build">The build</a>
            </div>
          </nav>
        </div>

        {/* HERO */}
        <div className="wrap">
          <section className="hero">
            <div className="kicker">An all-day social deduction game</div>
            <h1>
              Everyone makes it to sundown.
              <br />
              Probably.
            </h1>
            <p className="sub">
              A hidden-role party game for 7–22 people that runs quietly in your pocket from breakfast to nightcap —
              while the real game happens face to face.
            </p>
            <div className="cta-row">
              {/* TODO(site-brief): final public demo URL is this same deployment's ?demo */}
              <a className="btn btn-primary" href="?demo">
                Try the demo
              </a>
              <a className="btn btn-secondary" href="#how-it-works">
                See how it works
              </a>
            </div>
          </section>
        </div>

        {/* WHAT IT IS */}
        <div className="wrap">
          <section className="section" id="what-it-is">
            <div className="lede">
              <h2>Two out of every seven people you trust are killers.</h2>
              <p>
                They don't even know each other yet. Sundown turns a full day together — a bachelor party, a weekend
                trip, any long stretch with the same group — into one slow-burn game. A phone app quietly runs the
                whole thing: it hands out tasks, keeps a shared mood alive, and settles votes and kills on its own
                vague timing.
              </p>
              <p>Nobody has to sit out to host it. Everyone just has to survive it.</p>
            </div>
          </section>
        </div>

        {/* HOW TO PLAY */}
        <div className="wrap">
          <section className="steps" id="how-it-works">
            <div className="steps-head">
              <div className="kicker">How it plays</div>
              <h2>One day. Five reckonings.</h2>
            </div>
            <div className="step-list">
              {STEPS.map((step) => (
                <div className="step" key={step.n}>
                  <div className="n">{step.n}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* SCREENSHOT GALLERY */}
        <div className="wrap">
          <section className="gallery">
            <div className="gallery-head">
              <h2>The real app</h2>
              <p>Actual screens from the player app — not mockups.</p>
            </div>
            <div className="shots">
              {SHOTS.map((shot) => (
                <div className="shot" key={shot.title}>
                  <div className="device">
                    <img src={shot.src} alt={shot.alt} />
                  </div>
                  <div className="cap">
                    <b>{shot.title}</b>
                    <span>{shot.caption}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RULES THAT MAKE IT WORK */}
        <div className="wrap">
          <section className="rules">
            <div className="rules-head">
              <div className="kicker">Rules that make it work</div>
              <h2>Why it stays tense and fair</h2>
            </div>
            <div className="rule-grid">
              {RULES.map((rule) => (
                <div className="rule" key={rule.title}>
                  <h3>{rule.title}</h3>
                  <p>{rule.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ============================================================
          DIVIDER — explicit tonal pivot
          ============================================================ */}
      <div className="divider" id="build">
        <div className="kicker">The other half of this page</div>
        <h2>That's the game. Here's how it got built.</h2>
        <p>
          Sundown was designed and built almost entirely by Claude Code, from a written spec. The rest of this page
          is that story.
        </p>
      </div>

      {/* ============================================================
          TRACK B — BUILD (case study)
          ============================================================ */}
      <div className="build">
        <div className="wrap">
          <section className="build-intro">
            <div className="kicker">Case study — AI-assisted engineering</div>
            <h2>
              A full-stack, end-to-end shipped product — built by Claude Code, from a written spec.
            </h2>
            <p>
              Live URLs, a real database, GitHub-driven deploys, and a played, testable game — not a demo. The
              backend was built by Claude Code in a single autonomous pass from a design spec; the frontend was
              built by a second, independent Claude agent working from only an API contract and sample payloads.
              It's a real example of spec-driven, multi-agent collaboration — not one long chat session.
            </p>
          </section>
        </div>

        {/* WORKFLOW */}
        <div className="wrap">
          <section className="build-section">
            <h3>The actual workflow</h3>
            <div className="workflow">
              {WORKFLOW.map((wf) => (
                <div className="wf-card" key={wf.n}>
                  <div className="n">{wf.n}</div>
                  <h4>{wf.title}</h4>
                  <p>{wf.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ARCHITECTURE */}
        <div className="wrap">
          <section className="build-section">
            <h3>Architecture</h3>
            <div className="arch-grid">
              <div className="arch-panel">
                <div className="label">Backend — Node + TypeScript, Express</div>
                <div className="row">
                  <code>src/engine/</code>
                  <span>pure, deterministic, seedable game rules</span>
                </div>
                <div className="row">
                  <code>src/sim/</code>
                  <span>Monte-Carlo balance harness</span>
                </div>
                <div className="row">
                  <code>src/director/</code>
                  <span>AI Director — snapshot → bounded JSON</span>
                </div>
                <div className="row">
                  <code>src/deck/</code>
                  <span>Anthropic-backed task-deck generator</span>
                </div>
                <div className="row">
                  <code>src/service/</code>
                  <span>GameService — the API.md contract</span>
                </div>
                <div className="row">
                  <code>src/persistence/</code>
                  <span>Store interface — Redis / file adapters</span>
                </div>
              </div>
              <div className="arch-panel">
                <div className="label fe">Frontend — Vite + React + TypeScript</div>
                <div className="row">
                  <code>no framework</code>
                  <span>hand-rolled components, CSS-variable theming</span>
                </div>
                <div className="row">
                  <code>polling</code>
                  <span>
                    <span className="mono">GET /state</span> every 5s — no websockets
                  </span>
                </div>
                <div className="row">
                  <code>auth</code>
                  <span>playerId + token in localStorage</span>
                </div>
                <div className="row">
                  <code>?demo mode</code>
                  <span>every screen runs offline from fixtures</span>
                </div>
              </div>
            </div>
            <div className="arch-notes">
              {ARCH_NOTES.map((note, i) => (
                <div className="arch-note" key={i}>
                  <span className="mark">✓</span>
                  <p>{note}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* DEPLOYED INFRASTRUCTURE */}
        <div className="wrap">
          <section className="build-section">
            <h3>Deployed, live infrastructure</h3>
            <div className="infra-grid">
              {INFRA.map((card) => (
                <div className="infra-card" key={card.title}>
                  <div className="t">{card.title}</div>
                  <div className="d">{card.body}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* NOTABLE ENGINEERING DETAILS */}
        <div className="wrap">
          <section className="build-section">
            <h3>Notable engineering details</h3>
            <div className="detail-grid">
              {DETAILS.map((d) => (
                <div className="detail-card" key={d.title}>
                  <h4>{d.title}</h4>
                  <p>{d.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* LINKS */}
        <div className="wrap">
          <section className="build-section">
            <h3>Links</h3>
            <div className="link-row">
              <a
                className="link-card"
                href="https://github.com/tiniryno-stack/sundown"
                target="_blank"
                rel="noopener"
              >
                <div>
                  <div className="t">GitHub repo</div>
                  <div className="u">tiniryno-stack/sundown</div>
                </div>
                <span className="arrow">→</span>
              </a>
              <a
                className="link-card"
                href="https://sundown-backend-production.up.railway.app/health"
                target="_blank"
                rel="noopener"
              >
                <div>
                  <div className="t">Backend health check</div>
                  <div className="u">Railway · live</div>
                </div>
                <span className="arrow">→</span>
              </a>
              <a className="link-card" href="?demo">
                <div>
                  <div className="t">Live app</div>
                  <div className="u">this deployment · ?demo</div>
                </div>
                <span className="arrow">→</span>
              </a>
            </div>
          </section>
        </div>

        {/* CLOSING RECRUITER CTA */}
        <div className="wrap">
          <section className="closing">
            <h3>Want to talk about how this was built — or about a role?</h3>
            <div className="cta-row" style={{ justifyContent: "center" }}>
              {/* TODO(site-brief): #todo-contact-link — Andrew's resume/contact link */}
              <a className="btn btn-dark" href="#todo-contact-link">
                Get in touch <span className="todo-badge-dark">todo</span>
              </a>
            </div>
          </section>
        </div>

        <footer className="build-footer">Sundown — designed and built with Claude Code, 2026.</footer>
      </div>
    </div>
  );
}
