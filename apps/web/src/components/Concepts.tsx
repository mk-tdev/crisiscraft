import { useEffect } from "react";
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
export function Briefing({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h2>Harbor Point is flooding.</h2>
          <p>
            The school shelter needs <b>six crates by minute 9</b> and has no power to unload. The north bridge is the fastest road there —
            for now. Keep <b>one truck at the depot</b> in case another shelter calls.
          </p>
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
