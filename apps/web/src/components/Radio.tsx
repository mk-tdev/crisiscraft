import { useEffect, useRef, useState } from "react";
import type { Role, WorldState } from "@crisiscraft/contracts";
import { crew, roles, type CrewTurn, type Deliberation } from "@crisiscraft/crew";
import { Icon } from "../icons";
import { mm, roleColor, who } from "../format";

export interface CrewState {
  order: string;
  turns: CrewTurn[];
  result: Deliberation | null;
  error: string | null;
  loading: boolean;
}

export function Avatar({ from, size = 30 }: { from: CrewTurn["from"]; size?: number }) {
  const color = from === "commander" ? "var(--ink)" : from === "guardrail" ? "var(--accent)" : roleColor[from];
  return (
    <span className="avatar" style={{ width: size, height: size, background: color }} aria-hidden="true">
      {from === "guardrail" ? <Icon name="shield" size={size * 0.55} /> : who(from).name[0]}
    </span>
  );
}

const kindLabel: Record<CrewTurn["kind"], string> = {
  order: "Order", report: "Report", plan: "Plan", refused: "Refused", passed: "Checked", hold: "Hold",
};

function Turn({ turn, world }: { turn: CrewTurn; world: WorldState }) {
  const [open, setOpen] = useState(false);
  const person = who(turn.from);
  const facts = turn.cites
    .map((id) => world.observations.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => !!o);
  return (
    <li className={`turn turn-${turn.kind} from-${turn.from}`}>
      <Avatar from={turn.from} size={26} />
      <div className="turn-body">
        <div className="turn-head">
          <strong>{person.name}</strong>
          <span className={`kind kind-${turn.kind}`}>{kindLabel[turn.kind]}</span>
        </div>
        <p>{turn.text}</p>
        {turn.detail && <p className="turn-detail">{turn.detail}</p>}
        {(facts.length > 0 || turn.prompt) && (
          <div className="turn-meta">
            {facts.map((o) => (
              <span key={o.id} className="cite" title={o.fact}><Icon name="radio" size={11} /> {o.id} · min {mm(o.observedTick)}</span>
            ))}
            {turn.prompt && (
              <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>
                {open ? "hide" : `what ${person.name} saw`}
                {turn.ms ? ` · ${(turn.ms / 1000).toFixed(1)}s` : ""}
                {turn.usage ? ` · ${turn.usage.inputTokens + turn.usage.outputTokens} tok` : ""}
              </button>
            )}
          </div>
        )}
        {open && turn.prompt && (
          <div className="prompt">
            <span className="eyebrow">Briefing — the only facts {person.name} had</span>
            <pre>{turn.prompt.user}</pre>
            <span className="eyebrow">Instructions</span>
            <pre>{turn.prompt.system}</pre>
          </div>
        )}
      </div>
    </li>
  );
}

/** Bottom-left radio: three crew channels with live status, and the scrolling log of the last exchange. */
export function Radio({ world, state, open, onToggle }: { world: WorldState; state: CrewState | null; open: boolean; onToggle: () => void }) {
  const log = useRef<HTMLOListElement>(null);
  const said = new Set(state?.turns.map((t) => t.from));
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [state?.turns.length, state?.loading]);
  const status = (r: Role) => (state?.loading && !said.has(r) ? "thinking" : said.has(r) ? "spoke" : "idle");

  return (
    <section className={`radio glass ${open ? "open" : ""}`} aria-label="Crew radio">
      <header className="radio-head">
        <span className="radio-title"><i className={state?.loading ? "live" : ""} /> Crew radio</span>
        <div className="channels">
          {roles.map((r) => (
            <span key={r} className={`channel ${status(r)}`} style={{ ["--role" as string]: roleColor[r] }} title={`${crew[r].name}, ${crew[r].title}`}>
              <Avatar from={r} size={24} />
              <span><b>{crew[r].name}</b><small>{crew[r].post}</small></span>
            </span>
          ))}
        </div>
        <button className="ghost icon" onClick={onToggle} aria-expanded={open} aria-label={open ? "Collapse radio" : "Expand radio"}>
          <Icon name="chevron" size={14} />
        </button>
      </header>
      {open && (
        <ol className="radio-log" ref={log} aria-live="polite">
          {!state && (
            <li className="radio-empty">
              Channel quiet. Give an order below — each crew member answers from what only they know.
            </li>
          )}
          {state?.turns.map((t) => <Turn key={t.id} turn={t} world={world} />)}
          {state?.loading && (
            <li className="turn thinking">
              <span className="avatar" style={{ width: 26, height: 26, background: "var(--line-strong)" }} />
              <p className="dots">
                {said.has("field") && said.has("shelter") && said.has("logistics") ? "Priya is drafting a plan" : "Crew answering"}
                <span>.</span><span>.</span><span>.</span>
              </p>
            </li>
          )}
          {state?.error && <li className="notice bad" role="alert"><strong>No answer.</strong> {state.error} Nothing moved.</li>}
        </ol>
      )}
    </section>
  );
}
