import { useEffect } from "react";
import { scenarios } from "@crisiscraft/sim";
import { Icon, type IconName } from "../icons";

const concepts: { icon: IconName; title: string; tag: string; body: string; look: string }[] = [
  {
    icon: "users", title: "Everyone knows something", tag: "Bounded context",
    body: "Priya has the depot and road map, Malik the shelters, June the water. Each Meta model call gets only that person's briefing; a fact reaches the plan only if someone says it on the radio.",
    look: "Open “what … saw” under any radio message.",
  },
  {
    icon: "check", title: "The crew proposes. You decide.", tag: "Human approval",
    body: "The model never moves a truck. Priya drafts a dispatch ticket; you approve it or send it back.",
    look: "Radio an order from the command bar.",
  },
  {
    icon: "shield", title: "Rules the model can't bend", tag: "Guardrails",
    body: "Every plan is dry-run in the deterministic engine: stock, capacity, open roads and the one-truck reserve. A refusal goes back to Priya with the reason for one revision.",
    look: "Ask for the bridge after minute 4.",
  },
  {
    icon: "split", title: "Rewind one decision", tag: "Counterfactual replay",
    body: "Branch from just before a decision. Same storm, same closures — only your order changes — and the debrief names the recorded event that made the futures differ.",
    look: "Log → Rewind, then Decision replay.",
  },
];

/** Mission briefing on first visit; the same sheet explains the four ideas behind the drill. */
const pitch: Record<string, { title: string; body: string; meta: string }> = {
  "harbor-point": {
    title: "Harbor Point is flooding.",
    body: "The school shelter needs six crates by minute 9 and has no power to unload. The north bridge is the fastest road there — for now. Keep one truck at the depot in case another shelter calls.",
    meta: "Tutorial · 15 minutes · 1 bridge · 2 trucks",
  },
  "harbor-point-region": {
    title: "The whole region is in trouble.",
    body: "A care home on the low ground, 140 people at the hill school, a village across the bay and a field hospital all need crates — 34 needed, 34 in the port depot. The harbour bridge is failing, the tide will drown the causeway for twelve minutes, and someone has reported a landslide. Trucks come back to reload, but not fast enough to do everything at once.",
    meta: "Regional · 50 minutes · 4 places · 4 trucks · bridge, tide and a rumour",
  },
};

export function Briefing({ open, onClose, scenarioId, onScenario }: {
  open: boolean;
  onClose: () => void;
  scenarioId: string;
  /** Switch drills; starts a fresh run of the chosen scenario. */
  onScenario: (id: string) => void;
}) {
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="briefing" role="dialog" aria-modal="true" aria-label="Mission briefing" onClick={(e) => e.stopPropagation()}>
        <div className="briefing-head">
          <span className="eyebrow accent">Mission briefing · fictional drill</span>
          <h2>{pitch[scenarioId]?.title ?? "Harbor Point is flooding."}</h2>
          <p>{pitch[scenarioId]?.body}</p>
        </div>
        <div className="scenario-pick" role="radiogroup" aria-label="Choose a drill">
          {scenarios.map((s) => (
            <button key={s.id} role="radio" aria-checked={s.id === scenarioId} className={s.id === scenarioId ? "on" : ""} onClick={() => onScenario(s.id)}>
              <strong>{s.name}</strong>
              <small>{pitch[s.id]?.meta ?? s.summary}</small>
            </button>
          ))}
        </div>
        <ol className="concept-list">
          {concepts.map((c, i) => (
            <li key={c.title}>
              <span className={`concept-icon c${i}`}><Icon name={c.icon} size={18} /></span>
              <div>
                <small>{c.tag}</small>
                <strong>{c.title}</strong>
                <p>{c.body}</p>
                <em><Icon name="eye" size={12} /> {c.look}</em>
              </div>
            </li>
          ))}
        </ol>
        <button className="go big" onClick={onClose}>Take command <Icon name="arrow" size={16} /></button>
      </div>
    </div>
  );
}
