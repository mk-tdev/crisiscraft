import { useState } from "react";
import type { WorldState } from "@crisiscraft/contracts";
import { Icon } from "../icons";
import { places, requestNames, routeMinutes, routeName, trucks } from "../format";
import type { CrewState } from "./Radio";

function suggestions(world: WorldState) {
  const open = Object.values(world.requests).filter((r) => r.completedTick === null);
  const assigned = (id: string) => Object.values(world.vehicles).some((v) => v.requestId === id);
  const list: string[] = [];
  if (open.some((r) => r.id === "school" && !assigned("school"))) {
    list.push("Get six crates to the school. Keep one truck back.", "Bridge is fastest — send the school crates that way.", "Take the hill road to the school.");
  }
  if (open.some((r) => r.id === "east" && !assigned("east"))) list.push("East shelter needs crates too. Can we send Rescue 02?");
  if (!list.length) list.push("What's the situation? Anything we should do now?");
  return list;
}

/** Bottom-centre: the dispatch ticket when a checked plan is waiting, otherwise the radio command bar. */
export function Dispatch({
  world, state, ended, stale, onAsk, onApprove, onDismiss, onReplay,
}: {
  world: WorldState;
  state: CrewState | null;
  ended: boolean;
  stale: boolean;
  onAsk: (order: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
  onReplay: (() => void) | null;
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const action = state?.result?.command?.actions[0];
  const send = (order: string) => {
    if (order.trim().length < 2 || state?.loading) return;
    onAsk(order.trim());
    setDraft("");
  };

  if (action) {
    return (
      <section className={`ticket glass ${stale ? "stale" : ""}`} aria-label="Plan waiting for your approval">
        <div className="ticket-stub">
          <span className="eyebrow">Dispatch ticket</span>
          <strong>{trucks[action.vehicleId]}</strong>
          <span className="pill good"><Icon name="shield" size={12} /> Rules passed</span>
        </div>
        <div className="ticket-main">
          <div className="ticket-facts">
            <div><span>Crates</span><b>{action.quantity}</b></div>
            <div><span>To</span><b>{requestNames[action.requestId] ?? places[action.requestId]}</b></div>
            <div><span>Drive</span><b>{routeMinutes(action.route)} min</b></div>
          </div>
          <p className="ticket-route"><Icon name="map" size={14} /> {routeName(action.route)} <small>· nominal, if every road stays open</small></p>
        </div>
        <div className="ticket-actions">
          <button className="go" onClick={onApprove} disabled={stale}>
            {stale ? "World changed" : <>Approve <Icon name="arrow" size={16} /></>}
          </button>
          <button className="ghost" onClick={onDismiss}>Send back</button>
        </div>
      </section>
    );
  }

  if (ended) {
    return (
      <section className="commandbar glass ended">
        <p><strong>Minute 15.</strong> The drill is over. {onReplay ? "Compare the two futures." : "Open the log and rewind a decision to try another road."}</p>
        {onReplay && <button className="go" onClick={onReplay}><Icon name="split" size={15} /> Decision replay</button>}
      </section>
    );
  }

  return (
    <form className={`commandbar glass ${focused ? "focused" : ""}`} onSubmit={(e) => { e.preventDefault(); send(draft); }}>
      {!state?.loading && (
        <div className="chips">
          {suggestions(world).map((s) => <button type="button" key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <div className="command-input">
        <Icon name="radio" size={18} />
        <label htmlFor="order" className="sr-only">Radio an order to the crew</label>
        <input
          id="order"
          value={draft}
          maxLength={400}
          autoComplete="off"
          placeholder={state?.loading ? "The crew is answering…" : "Radio the crew — e.g. get supplies to the school, keep one truck back"}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={state?.loading}
        />
        <button className="go" disabled={draft.trim().length < 2 || state?.loading} aria-label="Send order">
          Send <Icon name="send" size={15} />
        </button>
      </div>
    </form>
  );
}
