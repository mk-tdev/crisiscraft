import { useEffect, useMemo, useState } from "react";
import { harborPoint } from "@crisiscraft/sim";
import { LazyTown as Town } from "../LazyTown";
import { worldAt, type Timeline } from "../drill";
import { headline, mm, outcome, storyBeats } from "../format";
import { Icon } from "../icons";

function Future({ side, tag, timeline, minute }: { side: "a" | "b"; tag: string; timeline: Timeline; minute: number }) {
  const world = useMemo(() => worldAt(timeline.decisions, minute), [timeline.decisions, minute]);
  const o = outcome(world);
  const last = timeline.decisions.at(-1);
  const beats = storyBeats(world).filter((b) => b.tick >= (timeline.branchTick ?? 0)).slice(-3);
  return (
    <article className={`future future-${side}`}>
      <Town state={world} compact weather labels={false} cameraView="overview" />
      <header className="future-head glass">
        <span className="future-tag">{side.toUpperCase()}</span>
        <div>
          <span className="eyebrow">{tag}</span>
          <p>“{last?.order ?? "No order given"}”</p>
        </div>
        <span className={`pill ${o.schoolMinute === null ? "" : o.schoolOnTime ? "good" : "warn"}`}>
          {o.schoolMinute === null ? "School waiting" : o.schoolOnTime ? `School supplied · min ${o.schoolMinute}` : `School ${o.completedLatenessMinutes} min late`}
        </span>
      </header>
      <footer className="future-foot glass">
        <dl>
          <div><dt>Delivered</dt><dd>{o.deliveredCrates}<small>/12</small></dd></div>
          <div><dt>On time</dt><dd>{o.onTimeDeliveries}</dd></div>
          <div><dt>Still needed</dt><dd>{o.unmetCrates}</dd></div>
          <div><dt>In reserve</dt><dd>{o.idleTrucksAtDepot}</dd></div>
        </dl>
        <ol className="beats">
          {beats.map((b) => <li key={b.id} className={`tone-${b.tone}`}><span className="time">{mm(b.tick)}</span>{b.text}</li>)}
        </ol>
      </footer>
    </article>
  );
}

/** Full-screen split: two towns, one clock. Same storm, one changed order. */
export function Compare({ a, b, onClose, onReview }: { a: Timeline; b: Timeline; onClose: () => void; onReview?: () => void }) {
  const start = b.branchTick ?? harborPoint.checkpointTick;
  const [minute, setMinute] = useState(start);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setMinute((m) => {
      if (m >= harborPoint.horizon) { setPlaying(false); return m; }
      return m + 1;
    }), 1000);
    return () => clearInterval(id);
  }, [playing]);
  const end = useMemo(() => ({ a: worldAt(a.decisions, harborPoint.horizon), b: worldAt(b.decisions, harborPoint.horizon) }), [a, b]);
  const deadline = harborPoint.requests.find((r) => r.id === "school")!.dueTick;

  return (
    <section className="compare" aria-label="Decision replay">
      <Future side="a" tag="What you did" timeline={a} minute={minute} />
      <div className="compare-spine" aria-hidden="true"><span>{mm(minute)}</span></div>
      <Future side="b" tag="What if" timeline={b} minute={minute} />

      <div className="compare-top">
        <div className="glass compare-title">
          <span className="eyebrow accent">Decision replay · branch at minute {mm(start)}</span>
          <h2>One decision. Two futures.</h2>
        </div>
        <button className="glass-btn" onClick={onClose}><Icon name="close" size={15} /> Back to the drill</button>
      </div>

      <div className="compare-console glass">
        <p className="debrief"><Icon name="spark" size={16} /> {minute >= harborPoint.horizon ? headline(end.a, end.b) : "Same storm, same trucks, same closures. Watch where the two runs part ways."}</p>
        <div className="scrub">
          <button className="go icon" onClick={() => { if (minute >= harborPoint.horizon) setMinute(start); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play both"}>
            <Icon name={playing ? "pause" : "play"} size={15} />
          </button>
          <input type="range" min={start} max={harborPoint.horizon} value={minute} onChange={(e) => { setPlaying(false); setMinute(Number(e.target.value)); }} aria-label="Minute" />
          <span className="clock-sm">{mm(minute)}:00</span>
          <button className="ghost" onClick={() => { setPlaying(false); setMinute(deadline); }}>Deadline {mm(deadline)}</button>
          <button className="ghost" onClick={() => { setPlaying(false); setMinute(harborPoint.horizon); }}>End {mm(harborPoint.horizon)}</button>
          {onReview && <button className="go" onClick={() => { setPlaying(false); setMinute(harborPoint.horizon); onReview(); }}><Icon name="spark" size={15} /> Review</button>}
        </div>
      </div>
    </section>
  );
}
