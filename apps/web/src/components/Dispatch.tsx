import { useCallback, useState } from "react";
import type { WorldState } from "@crisiscraft/contracts";
import { Icon } from "../icons";
import {
  places,
  isTutorial,
  requestNames,
  routeMinutes,
  routeName,
  trucks,
} from "../format";
import type { CrewState } from "./Radio";
import { type Heard, useRadioMic } from "../voice";

function suggestions(world: WorldState) {
  const open = Object.values(world.requests).filter(
    (r) => r.completedTick === null,
  );
  const assigned = (id: string) =>
    Object.values(world.vehicles).some((v) => v.requestId === id);
  const list: string[] = [];
  if (!isTutorial()) {
    for (const r of open.filter((r) => !assigned(r.id)).sort((a, b) => a.dueTick - b.dueTick).slice(0, 2))
      list.push(`Get ${r.quantity - r.delivered} crates to the ${requestNames[r.id]?.toLowerCase()} by minute ${r.dueTick}.`);
    list.push("Who needs us most right now, and which roads are safe?");
    return list;
  }
  if (open.some((r) => r.id === "school" && !assigned("school"))) {
    list.push(
      "Get six crates to the school. Keep one truck back.",
      "Bridge is fastest — send the school crates that way.",
      "Take the hill road to the school.",
    );
  }
  if (open.some((r) => r.id === "east" && !assigned("east")))
    list.push("East shelter needs crates too. Can we send Rescue 02?");
  if (!list.length)
    list.push("What's the situation? Anything we should do now?");
  return list;
}

/** Bottom-centre: the dispatch ticket when a checked plan is waiting, otherwise the radio command bar. */
export function Dispatch({
  world,
  state,
  ended,
  stale,
  voice,
  onAsk,
  onApprove,
  onDismiss,
  onReplay,
  onReview,
}: {
  world: WorldState;
  state: CrewState | null;
  ended: boolean;
  stale: boolean;
  voice: boolean;
  onAsk: (order: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
  onReplay: (() => void) | null;
  /** Present when a live key can write the after-action review. */
  onReview?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const action = state?.result?.command?.actions[0];
  const send = (order: string) => {
    if (order.trim().length < 2 || state?.loading) return;
    onAsk(order.trim());
    setDraft("");
  };
  const [heard, setHeard] = useState<Heard | null>(null);
  const onHeard = useCallback(
    (h: Heard) => {
      setHeard(h);
      if (h.transcript.trim().length >= 2) onAsk(h.transcript.trim());
    },
    [onAsk],
  );
  const mic = useRadioMic(onHeard);

  if (action) {
    return (
      <section
        className={`ticket glass ${stale ? "stale" : ""}`}
        aria-label="Plan waiting for your approval"
      >
        <div className="ticket-stub">
          <span className="eyebrow">Dispatch ticket</span>
          <strong>{trucks[action.vehicleId]}</strong>
          <span className="pill good">
            <Icon name="shield" size={12} /> Rules passed
          </span>
        </div>
        <div className="ticket-main">
          <div className="ticket-facts">
            <div>
              <span>Crates</span>
              <b>{action.quantity}</b>
            </div>
            <div>
              <span>To</span>
              <b>
                {requestNames[action.requestId] ?? places[action.requestId]}
              </b>
            </div>
            <div>
              <span>Drive</span>
              <b>{routeMinutes(action.route)} min</b>
            </div>
          </div>
          <p className="ticket-route">
            <Icon name="map" size={14} /> {routeName(action.route)}{" "}
            <small>· nominal, if every road stays open</small>
          </p>
        </div>
        <div className="ticket-actions">
          <button className="go" onClick={onApprove} disabled={stale}>
            {stale ? (
              "World changed"
            ) : (
              <>
                Approve <Icon name="arrow" size={16} />
              </>
            )}
          </button>
          <button className="ghost" onClick={onDismiss}>
            Send back
          </button>
        </div>
      </section>
    );
  }

  if (ended) {
    return (
      <section className="commandbar glass ended">
        <p>
          <strong>Minute 15.</strong> The drill is over.{" "}
          {onReplay
            ? "Compare the two futures."
            : "Open the log and rewind a decision to try another road."}
        </p>
        <div className="ended-actions">
          {onReview && (
            <button className="ghost" onClick={onReview}>
              <Icon name="spark" size={15} /> After-action review
            </button>
          )}
          {onReplay && (
            <button className="go" onClick={onReplay}>
              <Icon name="split" size={15} /> Decision replay
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <form
      className={`commandbar glass ${focused ? "focused" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        send(draft);
      }}
    >
      {(mic.error || heard) && (
        <p className={`heard ${mic.error ? "error" : ""}`}>
          <Icon name="mic" size={13} />
          {mic.error ?? (
            <>
              Heard “{heard!.transcript}”{" "}
              <small>
                · {heard!.model} · {(heard!.ms / 1000).toFixed(1)} s
              </small>
            </>
          )}
        </p>
      )}
      {!state?.loading && mic.state === "idle" && (
        <div className="chips">
          {suggestions(world).map((s) => (
            <button
              type="button"
              key={s}
              className="chip"
              onClick={() => send(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="command-input">
        <Icon name="radio" size={18} />
        <label htmlFor="order" className="sr-only">
          Radio an order to the crew
        </label>
        <input
          id="order"
          value={draft}
          maxLength={400}
          autoComplete="off"
          placeholder={
            mic.state === "listening"
              ? "Listening… click the mic again when you're done"
              : mic.state === "requesting"
                ? "Opening microphone…"
                : mic.state === "transcribing"
                  ? "Muse Voice Transcribe is listening back…"
                  : state?.loading
                    ? "The crew is answering…"
                    : voice
                      ? "Speak or type an order — e.g. get supplies to the school, keep one truck back"
                      : "Radio the crew — e.g. get supplies to the school, keep one truck back"
          }
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={state?.loading || mic.state !== "idle"}
        />
        {voice && (
          <button
            type="button"
            className={`mic ${mic.state}`}
            onClick={() =>
              mic.state === "listening" ? mic.stop() : void mic.start()
            }
            disabled={
              state?.loading ||
              mic.state === "transcribing" ||
              mic.state === "requesting"
            }
            aria-pressed={mic.state === "listening"}
            aria-label={
              mic.state === "listening"
                ? "Stop and send spoken order"
                : "Speak an order"
            }
            title="Speak an order · Muse Voice Transcribe"
          >
            <Icon name="mic" size={17} />
          </button>
        )}
        <button
          className="go"
          disabled={draft.trim().length < 2 || state?.loading}
          aria-label="Send order"
        >
          Send <Icon name="send" size={15} />
        </button>
      </div>
    </form>
  );
}
