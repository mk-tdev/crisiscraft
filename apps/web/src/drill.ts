import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApprovedCommand, SimEvent, WorldState } from "@crisiscraft/contracts";
import { approveCommand, replay } from "@crisiscraft/sim";
import { scenario } from "./format";

export type TimelineId = "A" | "B";
export interface Decision {
  tick: number;
  command: ApprovedCommand;
  order: string;
  summary: string;
}
export interface Timeline {
  id: TimelineId;
  minute: number;
  decisions: Decision[];
  /** For the "what if" branch: the minute it split from timeline A. */
  branchTick: number | null;
}

/** Real seconds per drill minute: the longer regional drill plays faster so a run still fits a demo. */
const secondsPerMinute = () => (scenario().horizon > 20 ? 1.2 : 2.4);
const fresh = (): Timeline => ({ id: "A", minute: scenario().checkpointTick, decisions: [], branchTick: null });

export const worldAt = (decisions: Decision[], minute: number): WorldState =>
  replay(scenario(), decisions.map(({ tick, command }) => ({ tick, command })), minute);

/** Moments that need the commander: playback pauses so a new decision can be made. */
const decisionMoment = (events: SimEvent[], tick: number) =>
  events.some((e) => e.tick === tick && e.type === "request-opened");

export function useDrill() {
  const [timelines, setTimelines] = useState<{ A: Timeline; B: Timeline | null }>({ A: fresh(), B: null });
  const [active, setActive] = useState<TimelineId>("A");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const timeline = (active === "B" ? timelines.B : null) ?? timelines.A;
  const world = useMemo(() => worldAt(timeline.decisions, timeline.minute), [timeline]);
  const ended = timeline.minute >= scenario().horizon;

  const update = useCallback((id: TimelineId, change: (t: Timeline) => Timeline) => {
    setTimelines((all) => (id === "B" ? (all.B ? { ...all, B: change(all.B) } : all) : { ...all, A: change(all.A) }));
  }, []);

  const step = useCallback(() => {
    setProgress(0);
    update(active, (t) => {
      if (t.minute >= scenario().horizon) return t;
      const next = worldAt(t.decisions, t.minute + 1);
      if (decisionMoment(next.events, t.minute + 1) || t.minute + 1 >= scenario().horizon) setPlaying(false);
      return { ...t, minute: t.minute + 1 };
    });
  }, [active, update]);

  // Smooth playback: progress drives truck interpolation; each full unit advances the engine one minute.
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let local = 0;
    const tick = (now: number) => {
      local += ((now - last) / 1000) * (speed / secondsPerMinute());
      last = now;
      if (local >= 1) {
        local = 0;
        stepRef.current();
      }
      setProgress(local);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);
  useEffect(() => {
    if (ended) setPlaying(false);
  }, [ended]);

  /** Re-validates locally with the same engine the server used, then records the decision. */
  const approve = useCallback((decision: Omit<Decision, "tick">) => {
    approveCommand(scenario(), world, decision.command);
    update(active, (t) => ({ ...t, decisions: [...t.decisions, { ...decision, tick: t.minute }] }));
    setPlaying(true);
  }, [active, update, world]);

  /** Branch from timeline A just before decision `index`: same world, same events, a new choice. */
  const rewind = useCallback((index: number) => {
    const source = timelines.A.decisions;
    const at = source[index];
    if (!at) return;
    setPlaying(false);
    setProgress(0);
    setTimelines((all) => ({ ...all, B: { id: "B", minute: at.tick, decisions: source.slice(0, index), branchTick: at.tick } }));
    setActive("B");
  }, [timelines.A.decisions]);

  const reset = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    setTimelines({ A: fresh(), B: null });
    setActive("A");
  }, []);

  const switchTo = useCallback((id: TimelineId) => {
    setPlaying(false);
    setProgress(0);
    setActive(id);
  }, []);

  const runToEnd = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    update(active, (t) => ({ ...t, minute: scenario().horizon }));
  }, [active, update]);

  return {
    timelines, timeline, active, world, playing, speed, progress: playing ? progress : 0, ended,
    setPlaying, setSpeed, step, approve, rewind, reset, switchTo, runToEnd,
  };
}
export type Drill = ReturnType<typeof useDrill>;
