/* "How to play" for the landing page. The five rule cards are the app's own
   tutorial (TUTORIAL_SLIDES in screens/cozy.tsx), so the page and the app can
   never disagree; the mood bar bands come from BAR_COPY in components/ui. */

import { BAR_COPY, Icon } from "../components/ui";
import { TUTORIAL_SLIDES } from "../screens/cozy";

// Landing-page colors for each tutorial card's icon (the app uses theme tokens).
const TONE: Record<string, string> = {
  spark: "#C9772E", alert: "#A9802F", glass: "#1E9E62", eye: "#1A1714", users: "#CB4439",
};
const BAND_TONE = { healthy: "#1E9E62", strained: "#A9802F", critical: "#CB4439" } as const;

export function HowToPlay() {
  return (
    <section className="htp" id="how-to-play">
      <div className="htp-head">
        <div className="kicker">How to play</div>
        <h2>The whole game, before 9 AM.</h2>
        <p>Everyone gets a secret role on their phone, then goes about the day together. Here's how each side wins, and the same five cards every player sees when a game starts.</p>
      </div>

      <div className="htp-win">
        <div className="htp-side">
          <div className="htp-side-top">
            <span className="htp-ico" style={{ color: "#1E9E62" }}><Icon.users s={20} /></span>
            <span className="htp-side-label" style={{ color: "#1E9E62" }}>Town wins</span>
          </div>
          <p>by voting out every killer before sundown. Watch who's doing what, argue it out face to face, and vote at meals and gatherings.</p>
        </div>
        <div className="htp-side">
          <div className="htp-side-top">
            <span className="htp-ico" style={{ color: "#CB4439" }}><Icon.blade s={20} /></span>
            <span className="htp-side-label" style={{ color: "#CB4439" }}>Killers win</span>
          </div>
          <p>by making it to sundown undetected, matching the town's numbers, or letting the mood bar run dry. Their tasks quietly charge up kills, and they don't know who the other killers are.</p>
        </div>
      </div>
      <p className="htp-twist">
        <span className="htp-ico sm" style={{ color: "#C9772E" }}><Icon.ghost s={15} /></span>
        One twist: if the killers saved up for it, a caught killer hands the role to someone already out instead of leaving the game.
      </p>

      <div className="htp-body">
        <ol className="htp-cards" aria-label="The rules, as the app explains them">
          {TUTORIAL_SLIDES.map((s) => {
            const Glyph = Icon[s.icon as keyof typeof Icon];
            const tone = TONE[s.icon] ?? "#1A1714";
            return (
              <li key={s.title} className="htp-card">
                <span className="htp-ico" style={{ color: tone }}><Glyph s={20} /></span>
                <div>
                  <div className="htp-eyebrow mono" style={{ color: tone }}>{s.eyebrow}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <aside className="htp-bar">
          <div className="htp-eyebrow mono" style={{ color: "#A9802F" }}>The mood bar</div>
          <h3>One shared bar, no numbers.</h3>
          <p>It drifts down all day. Every task the town finishes pushes it back up; killers' tasks don't. It looks the same on every phone and only ever shows a mood, so nobody can do the math.</p>
          <div className="htp-bands">
            {(["healthy", "strained", "critical"] as const).map((b) => {
              const c = BAR_COPY[b];
              return (
                <div key={b} className="htp-band">
                  <div className="htp-band-top">
                    <b style={{ color: BAND_TONE[b] }}>{c.label}</b>
                    <span>{c.sub}</span>
                  </div>
                  <div className="htp-meter"><div style={{ width: `${(c.cells / 6) * 100}%`, background: BAND_TONE[b] }} /></div>
                </div>
              );
            })}
          </div>
          <p className="htp-foot">If it empties, the killers win.</p>
        </aside>
      </div>
    </section>
  );
}
