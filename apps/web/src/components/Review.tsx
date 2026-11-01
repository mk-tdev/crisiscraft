import { useEffect, useState } from "react";
import type { Debrief } from "@crisiscraft/crew";
import { worldAt, type Timeline } from "../drill";
import { describe, mm, scenario } from "../format";
import { Icon } from "../icons";

type Runs = { label: "A" | "B"; timeline: Timeline }[];

async function askDebrief(runs: Runs, signal: AbortSignal): Promise<Debrief> {
  const response = await fetch("/api/debrief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenarioId: scenario().id,
      timelines: runs.map(({ label, timeline }) => ({
        label,
        decisions: timeline.decisions.map(({ tick, command, order }) => ({ tick, command, order })),
      })),
    }),
    signal,
  });
  const body = (await response.json()) as Debrief & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `The debrief failed (${response.status}).`);
  return body;
}

/**
 * After-action review: Muse Spark writes it, the server keeps only findings whose citations
 * name real events in the replayed runs, and each citation is shown with what the engine logged.
 */
export function Review({ runs, onClose }: { runs: Runs; onClose: () => void }) {
  const [review, setReview] = useState<Debrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(runs.map((r) => r.timeline.decisions.map((d) => d.command.id)));
  useEffect(() => {
    const controller = new AbortController();
    setReview(null);
    setError(null);
    askDebrief(runs, controller.signal).then(setReview, (e: unknown) => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The debrief failed.");
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  // Show citations as the drill's own event lines, from the same deterministic replay.
  const worlds = Object.fromEntries(runs.map(({ label, timeline }) => [label, worldAt(timeline.decisions, scenario().horizon)]));
  const line = (id: string) => {
    const [label, eventId] = id.split(":");
    const event = worlds[label!]?.events.find((e) => e.id === eventId);
    return event ? describe(event).text : id;
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="briefing review" role="dialog" aria-modal="true" aria-label="After-action review" onClick={(e) => e.stopPropagation()}>
        <div className="review-head">
          <span className="eyebrow accent">After-action review · {runs.length === 2 ? "runs A and B" : "this run"}</span>
          <button className="ghost icon" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        {!review && !error && (
          <p className="dots">Muse Spark is reviewing the event log<span>.</span><span>.</span><span>.</span></p>
        )}
        {error && <p className="notice bad" role="alert">{error}</p>}
        {review && (
          <>
            <h2>{review.headline}</h2>
            <ol className="findings">
              {review.findings.map((f, i) => (
                <li key={i}>
                  <p>{f.text}</p>
                  <div className="evidence">
                    {f.cites.map((c) => (
                      <span key={c.id} className={`cite run-${c.id[0]}`} title={c.id}>
                        <b>{c.id[0]}</b> min {mm(c.tick)} · {line(c.id)}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <p className="lesson"><Icon name="spark" size={16} /> <span><b>Take into the next drill:</b> {review.lesson}</span></p>
            <p className="review-foot">
              <Icon name="shield" size={13} />
              {review.removed.length === 0
                ? `Every citation checked against the engine log: ${review.findings.reduce((n, f) => n + f.cites.length, 0)} of ${review.findings.reduce((n, f) => n + f.cites.length, 0)} match.`
                : `${review.removed.length} finding${review.removed.length === 1 ? "" : "s"} removed: cited events that never happened (${review.removed.flatMap((r) => r.badCites).join(", ")}).`}
              <span className="faint"> · {review.model} · {(review.ms / 1000).toFixed(1)}s</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
