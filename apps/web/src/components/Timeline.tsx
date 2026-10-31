import type { WorldState } from "@crisiscraft/contracts";
import { harborPoint } from "@crisiscraft/sim";
import type { Decision } from "../drill";
import { describe, mm, requestNames } from "../format";

/** Only the past and publicly known deadlines are marked: the future closure is never revealed. */
export function MinuteStrip({ world, progress, decisions }: { world: WorldState; progress: number; decisions: Decision[] }) {
  const h = harborPoint.horizon;
  const pct = (t: number) => `${(t / h) * 100}%`;
  const marks = world.events.filter((e) => ["road-closed", "receiving-changed", "request-opened", "delivered"].includes(e.type) && e.tick > 0);
  const deadlines = Object.values(world.requests).filter((r) => r.completedTick === null);
  return (
    <div className="strip" aria-label={`Minute ${world.tick} of ${h}`}>
      <span className="clock">{mm(world.tick)}<small>:{String(Math.floor(progress * 60)).padStart(2, "0")}</small></span>
      <div className="track">
        <div className="fill" style={{ width: pct(Math.min(h, world.tick + progress)) }} />
        {Array.from({ length: h + 1 }, (_, t) => <span key={t} className="tick" style={{ left: pct(t) }}>{t % 3 === 0 ? t : ""}</span>)}
        {deadlines.map((r) => (
          <span key={r.id} className="deadline" style={{ left: pct(r.dueTick) }} title={`${requestNames[r.id]} deadline`}>
            <i />{requestNames[r.id]?.split(" ")[0]} due
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
