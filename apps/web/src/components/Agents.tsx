import { useState } from "react";
import type { CrewTurn, Deliberation } from "@crisiscraft/crew";
import type { Decision } from "../drill";
import type { PilotMove } from "../autopilot";
import { mm, who } from "../format";
import { Icon } from "../icons";
import type { CrewState } from "./Radio";
import type { PhotoState } from "./Photo";

/** Everything the agents did this run, newest last. Kept small: the panel only renders while open. */
export type JourneyEntry =
  | { kind: "crew"; id: string; t: number; minute: number; deliberation: Deliberation; initiative: boolean }
  | { kind: "photo"; id: string; t: number; minute: number; photo: PhotoState };

const STAGES: { id: string; label: string; detail: string; kinds: CrewTurn["kind"][] }[] = [
  { id: "brief", label: "Brief", detail: "Engine projects each role's bounded briefing", kinds: [] },
  { id: "report", label: "Report", detail: "3 agents in parallel, own facts only", kinds: ["report", "alert"] },
  { id: "plan", label: "Plan", detail: "Priya's tool loop: map, dry run, submit", kinds: ["tool", "plan"] },
  { id: "rules", label: "Rules", detail: "Engine validator: stock, roads, reserve", kinds: ["refused", "passed", "hold"] },
  { id: "review", label: "Review", detail: "Malik and June check the draft", kinds: ["review"] },
  { id: "decide", label: "Decide", detail: "You, or Autopilot, approve or send back", kinds: [] },
];

const modelTurns = (turns: CrewTurn[]) => turns.filter((t) => t.ms != null && t.usage !== undefined);
const tokens = (turns: CrewTurn[]) => turns.reduce((n, t) => n + (t.usage ? t.usage.inputTokens + t.usage.outputTokens : 0), 0);

/** Which pipeline stage is running now, from the turns that have streamed in. */
function stageOf(state: CrewState | null) {
  if (!state) return -1;
  if (!state.loading) return state.result?.command ? STAGES.length - 1 : STAGES.length;
  const kinds = new Set(state.turns.map((t) => t.kind));
  if (kinds.has("review")) return kinds.has("passed") ? 5 : 4;
  if (kinds.has("refused") || kinds.has("passed")) return 4;
  if (kinds.has("plan") || kinds.has("tool")) return 2;
  if (kinds.has("report") || kinds.has("alert")) return 2;
  return 1;
}

/** Gantt-style spans: each model call from (finished - duration) to finished; tool calls are ticks. */
function Waterfall({ turns }: { turns: CrewTurn[] }) {
  const timed = turns.filter((t) => t.at != null);
  const total = Math.max(1, ...timed.map((t) => t.at!));
  if (!timed.length) return <p className="agents-empty">Give an order and the trace builds here as each agent runs.</p>;
  return (
    <ol className="waterfall" aria-label="Deliberation timeline">
      {timed.map((t) => {
        const end = t.at!;
        const start = Math.max(0, end - (t.ms ?? 0));
        const span = t.ms != null && t.ms > 0;
        return (
          <li key={t.id} className={`wf-${t.kind} wf-from-${t.from}`}>
            <span className="wf-label">
              <b>{who(t.from).name}</b> {t.kind === "tool" ? t.detail : t.kind}
              {t.verdict && <em className={t.verdict}>{t.kind === "tool" ? (t.verdict === "agree" ? "passes" : "refused") : t.verdict}</em>}
            </span>
            <span className="wf-track">
              <i
                className={span ? "wf-bar" : "wf-tick"}
                style={{ left: `${(start / total) * 100}%`, width: span ? `${Math.max(1.5, ((end - start) / total) * 100)}%` : undefined }}
              />
            </span>
            <span className="wf-ms">{span ? `${(t.ms! / 1000).toFixed(1)}s` : `@${(end / 1000).toFixed(1)}s`}</span>
          </li>
        );
      })}
      <li className="wf-axis"><span /><span className="wf-track"><small>0s</small><small>{(total / 1000).toFixed(1)}s</small></span><span /></li>
    </ol>
  );
}

function Call({ turn, model }: { turn: CrewTurn; model: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`call call-${turn.kind}`}>
      <button type="button" className="call-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b className={`from-${turn.from}`}>{who(turn.from).name}</b>
        <span>{turn.kind}</span>
        <span>{model ?? "scripted"}</span>
        <span>{turn.ms != null ? `${(turn.ms / 1000).toFixed(1)}s` : "—"}</span>
        <span>{turn.usage ? `${turn.usage.inputTokens}→${turn.usage.outputTokens} tok` : "no model"}</span>
        <i aria-hidden="true">{open ? "−" : "+"}</i>
      </button>
      <p className="call-out">{turn.text}</p>
      {open && turn.prompt && (
        <div className="call-io">
          <small>Instructions</small>
          <pre>{turn.prompt.system}</pre>
          <small>What the model saw (bounded briefing)</small>
          <pre>{turn.prompt.user}</pre>
          {turn.detail && <><small>Rationale</small><pre>{turn.detail}</pre></>}
        </div>
      )}
    </li>
  );
}

const moveLabel: Record<PilotMove["move"], string> = { order: "Order", approve: "Approve", send_back: "Send back", wait: "Let the clock run" };

/**
 * The agents, made transparent: the live pipeline and its timing, every model call with the
 * exact input it saw, and the journey of every orchestration this run.
 */
export function AgentsPanel({
  state, journey, moves, decisions, provider,
}: {
  state: CrewState | null;
  journey: JourneyEntry[];
  moves: PilotMove[];
  decisions: Decision[];
  provider: string | null;
}) {
  const [tab, setTab] = useState<"live" | "calls" | "journey">("live");
  const current = state?.turns ?? [];
  const stage = stageOf(state);
  const crewRuns = journey.filter((j): j is Extract<JourneyEntry, { kind: "crew" }> => j.kind === "crew");
  const allTurns = crewRuns.flatMap((j) => j.deliberation.turns);
  const photos = journey.filter((j): j is Extract<JourneyEntry, { kind: "photo" }> => j.kind === "photo");
  const photoCalls = photos.reduce((n, p) => n + p.photo.timings.length, 0);
  const totalCalls = modelTurns(allTurns).length + photoCalls + moves.filter((m) => m.model).length;

  return (
    <div className="agents">
      <div className="agents-stats">
        <div><b>{journey.length}</b><small>orchestrations</small></div>
        <div><b>{totalCalls}</b><small>model calls</small></div>
        <div><b>{(tokens(allTurns) / 1000).toFixed(1)}k</b><small>crew tokens</small></div>
        <div><b>{decisions.length}</b><small>approved</small></div>
      </div>
      <div className="segmented agents-tabs" role="tablist">
        {(["live", "calls", "journey"] as const).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {id === "live" ? "Live pipeline" : id === "calls" ? `Model calls · ${totalCalls}` : `Journey · ${journey.length + moves.length}`}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <>
          <ol className="pipeline" aria-label="Orchestration pipeline">
            {STAGES.map((s, i) => (
              <li key={s.id} className={i === stage ? "active" : i < stage ? "done" : ""}>
                <b>{s.label}</b>
                <small>{s.detail}</small>
              </li>
            ))}
          </ol>
          {state && (
            <p className="agents-now">
              <Icon name="radio" size={13} /> “{state.order}”
              {state.loading ? <em> · running</em> : state.result ? <em> · {state.result.command ? "checked plan ready" : "crew holds"} · {modelTurns(current).length} calls · {(tokens(current) / 1000).toFixed(1)}k tok</em> : null}
            </p>
          )}
          <Waterfall turns={current} />
          <p className="agents-note">
            Each bar is one {provider ?? "model"} call. The three reports overlap because they run in parallel; Priya's tool calls are ticks inside her plan; the rules check is code, not a model.
          </p>
        </>
      )}

      {tab === "calls" && (
        <ol className="calls">
          {[...crewRuns].reverse().slice(0, 6).flatMap((j) =>
            [...j.deliberation.turns].reverse().filter((t) => t.usage !== undefined || t.kind === "tool").map((t) => (
              t.kind === "tool"
                ? <li key={`${j.id}-${t.id}`} className="call call-tool"><code>{t.detail}()</code> <span>{t.text}</span></li>
                : <Call key={`${j.id}-${t.id}`} turn={t} model={j.deliberation.provider.model} />
            )),
          )}
          {[...photos].reverse().slice(0, 3).map((p) => (
            <li key={p.id} className="call call-photo">
              <div className="call-head static"><b className="from-field">June</b><span>bridge photo</span><span>min {mm(p.minute)}</span></div>
              <p className="call-out">{p.photo.timings.map((t) => `${t.model} ${(t.ms / 1000).toFixed(1)}s`).join(" → ")}{p.photo.read ? ` · ${p.photo.read.passable}` : ""}</p>
            </li>
          ))}
          {!totalCalls && <li className="agents-empty">Model calls appear here as the crew works.</li>}
        </ol>
      )}

      {tab === "journey" && (
        <ol className="journey">
          {[
            ...journey.map((j) => ({ t: j.t, node: <JourneyRow key={j.id} entry={j} /> })),
            ...moves.map((m, i) => ({
              t: m.at ?? 0,
              node: (
                <li key={`pilot-${i}`} className="jr jr-pilot">
                  <span className="jr-time">{mm(m.minute)}</span>
                  <div><b>Autopilot · {moveLabel[m.move]}</b>{m.move === "order" && <q>{m.order}</q>}<p>{m.reason}</p><small>{m.model ?? "scripted"}{m.ms ? ` · ${(m.ms / 1000).toFixed(1)}s` : ""}</small></div>
                </li>
              ),
            })),
          ].sort((a, b) => a.t - b.t).map((x) => x.node)}
          {decisions.length > 0 && (
            <li className="jr jr-decisions">
              <span className="jr-time"><Icon name="check" size={13} /></span>
              <div><b>Approved this run</b>{decisions.map((d) => <p key={d.command.id}>min {mm(d.tick)} · {d.summary}</p>)}</div>
            </li>
          )}
          {!journey.length && !moves.length && <li className="agents-empty">The journey fills in as you give orders, take photos or switch on Autopilot.</li>}
        </ol>
      )}
    </div>
  );
}

function JourneyRow({ entry }: { entry: JourneyEntry }) {
  if (entry.kind === "photo") {
    const p = entry.photo;
    return (
      <li className="jr jr-photo">
        <span className="jr-time">{mm(entry.minute)}</span>
        <div>
          <b>Field photo · 3 models chained</b>
          <p>{p.timings.map((t) => `${t.model} ${(t.ms / 1000).toFixed(1)}s`).join(" → ")}</p>
          {p.segments?.waterOnBridge != null && <p>SAM 3.1 measured water over {Math.round(p.segments.waterOnBridge * 100)}% of the bridge.</p>}
          {p.read && <p>June: <em>{p.read.passable}</em>. {p.read.message}</p>}
        </div>
      </li>
    );
  }
  const d = entry.deliberation;
  const calls = modelTurns(d.turns);
  const tools = d.turns.filter((t) => t.kind === "tool");
  const concerns = d.turns.filter((t) => t.kind === "review" && t.verdict === "concern");
  const ms = Math.max(0, ...d.turns.map((t) => t.at ?? 0));
  const end = d.turns.at(-1);
  return (
    <li className={`jr jr-crew ${entry.initiative ? "jr-initiative" : ""}`}>
      <span className="jr-time">{mm(entry.minute)}</span>
      <div>
        <b>{entry.initiative ? d.turns[0] ? `${who(d.turns[0].from).name} radioed in` : "Crew initiative" : "Order"}</b>
        {!entry.initiative && <q>{d.order}</q>}
        <p>
          {calls.length} model calls · {tools.length} tool calls{concerns.length ? ` · ${concerns.length} review concern${concerns.length > 1 ? "s" : ""}` : ""}
          {d.refusal ? " · refused by rules" : ""} · {(ms / 1000).toFixed(1)}s · {(tokens(d.turns) / 1000).toFixed(1)}k tok
        </p>
        {end && <p className={`jr-out jr-${end.kind}`}>{end.kind === "passed" ? "Checked plan ready" : end.kind === "hold" ? "Crew holds" : end.text}</p>}
      </div>
    </li>
  );
}
