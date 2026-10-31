import type { WorldState } from "@crisiscraft/contracts";
import { metrics, harborPoint } from "@crisiscraft/sim";
import type { Decision, TimelineId } from "../drill";
import { describe, mm } from "../format";
import { Icon } from "../icons";

function download(world: WorldState, decisions: Decision[]) {
  const blob = new Blob([JSON.stringify({
    scenario: harborPoint, decisions, events: world.events, metrics: metrics(harborPoint, world),
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `crisiscraft-${world.scenarioId}-minute-${world.tick}.json` });
  a.click();
  URL.revokeObjectURL(url);
}

export function LogPanel({
  world, decisions, timeline, onRewind,
}: { world: WorldState; decisions: Decision[]; timeline: TimelineId; onRewind: (index: number) => void }) {
  const events = world.events.filter((e) => e.type !== "observation-received" && e.type !== "edge-arrived");
  return (
    <div className="log">
      <span className="eyebrow accent">Timeline {timeline}</span>
      <h2>Everything that happened.</h2>
      {decisions.length > 0 && (
        <section>
          <span className="eyebrow">Your decisions</span>
          <ul className="decisions">
            {decisions.map((d, i) => (
              <li key={d.command.id}>
                <span className="time">{mm(d.tick)}</span>
                <div>
                  <p>“{d.order}”</p>
                  <span>{d.summary}</span>
                </div>
                {timeline === "A" && (
                  <button className="ghost" onClick={() => onRewind(i)} title="Branch a what-if from just before this decision">
                    <Icon name="rewind" size={14} /> Rewind
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <div className="row-between">
          <span className="eyebrow">Event log · recorded by the engine</span>
          <button className="ghost" onClick={() => download(world, decisions)}><Icon name="download" size={14} /> Export</button>
        </div>
        <ol className="events">
          {[...events].reverse().map((e) => {
            const d = describe(e);
            return (
              <li key={e.id} className={`tone-${d.tone}`}>
                <span className="time">{mm(e.tick)}</span>
                <p>{d.text}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
