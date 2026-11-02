import type { WorldState } from "@crisiscraft/contracts";
import type { Decision } from "../drill";
import { describe, mm, requestNames, scenario } from "../format";

/** Only the past and publicly known deadlines are marked: the future closure is never revealed. */
export function MinuteStrip({ world, progress, decisions }: { world: WorldState; progress: number; decisions: Decision[] }) {
  const h = scenario().horizon;
  const pct = (t: number) => `${(t / h) * 100}%`;
  const marks = world.events.filter((e) => ["road-closed", "receiving-changed", "request-opened", "delivered"].includes(e.type) && e.tick > 0);
  const deadlines = Object.values(world.requests).filter((r) => r.completedTick === null);
  // Name only the next deadline; the others are marked and named on hover.
  const next = [...deadlines].sort((a, b) => a.dueTick - b.dueTick)[0];
  const every = h > 20 ? 5 : 1;
  const label = h > 20 ? 10 : 3;
  return (
    <div className="strip" aria-label={`Minute ${world.tick} of ${h}`}>
      <span className="clock">{mm(world.tick)}<small>:{String(Math.floor(progress * 60)).padStart(2, "0")}</small></span>
      <div className="track">
        <div className="fill" style={{ width: pct(Math.min(h, world.tick + progress)) }} />
        {/* Long drills get sparser marks so labels never run together. */}
        {Array.from({ length: Math.floor(h / every) + 1 }, (_, i) => i * every).map((t) => (
          <span key={t} className="tick" style={{ left: pct(t) }}>{t % label === 0 ? t : ""}</span>
        ))}
        {deadlines.map((r) => (
          <span key={r.id} className="deadline" style={{ left: pct(r.dueTick) }} title={`${requestNames[r.id]} due by minute ${r.dueTick}`}>
            <i />{r.id === next?.id ? `${requestNames[r.id]?.split(" ")[0]} due` : ""}
          </span>
        ))}
        {marks.map((e) => {
          const d = describe(e);
          return <span key={e.id} className={`event-mark tone-${d.tone}`} style={{ left: pct(e.tick) }} title={`Minute ${e.tick}: ${d.text}`} />;
        })}
        {decisions.map((d) => <span key={d.command.id} className="decision-mark" style={{ left: pct(d.tick) }} title={`Your order at minute ${d.tick}: ${d.order}`} />)}
      </div>
      <span className="horizon">{mm(h)}:00</span>
    </div>
  );
}
