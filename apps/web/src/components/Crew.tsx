import type { WorldState } from "@crisiscraft/contracts";
import { crew, roles, type CrewTurn } from "@crisiscraft/crew";
import { roleContext } from "@crisiscraft/sim";
import { mm, roleColor } from "../format";
import { Avatar } from "./Radio";

/** "What each person knows": the same bounded projection the model receives. */
export function CrewPanel({ world, turns }: { world: WorldState; turns: CrewTurn[] }) {
  return (
    <div className="crew">
      <span className="eyebrow accent">Bounded knowledge</span>
      <h2>Three people. Three pictures of the flood.</h2>
      <p className="lede">Nobody sees everything. A report only reaches the plan if someone says it on the radio.</p>
      {roles.map((role) => {
        const m = crew[role];
        const known = roleContext(world, role).observations;
        const last = [...turns].reverse().find((t) => t.from === role);
        return (
          <article key={role} className="crew-card" style={{ ["--role" as string]: roleColor[role] }}>
            <header>
              <Avatar from={role} size={38} />
              <div>
                <strong>{m.name}</strong>
                <span>{m.title} · {m.post}</span>
              </div>
            </header>
            <p className="remit">{m.remit}</p>
            <span className="eyebrow">What {m.name} knows at minute {mm(world.tick)}</span>
            <ul className="facts">
              {known.length === 0 && <li className="muted">No reports yet.</li>}
              {known.map((o) => (
                <li key={o.id}>
                  <p>{o.fact}</p>
                  <span>
                    Seen minute {mm(o.observedTick)} · {world.tick - o.observedTick === 0 ? "just now" : `${world.tick - o.observedTick} min old`}
                    {o.audience.includes("public") ? " · public" : " · private"}
                  </span>
                </li>
              ))}
            </ul>
            {last && <blockquote>“{last.text}”</blockquote>}
          </article>
        );
      })}
    </div>
  );
}
