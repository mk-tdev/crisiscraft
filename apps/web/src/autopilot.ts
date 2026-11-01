import { useEffect, useRef, useState } from "react";
import type { ApprovedCommand } from "@crisiscraft/contracts";
import type { CrewTurn, Move } from "@crisiscraft/crew";
import { who } from "./format";

export interface PilotMove extends Move {
  minute: number;
  ms: number;
  model: string | null;
}

/** At most this many moves per run, so a disagreement can never loop forever. */
const MAX_MOVES = 14;

/**
 * Autopilot drives the drill through the same controls a person uses. Whenever nothing is in
 * flight (crew idle, clock paused), it asks the AI commander for one move and carries it out.
 */
export function useAutopilot({
  enabled, minute, revision, runKey, ended, playing, busy, turns, pending, commands,
  onOrder, onApprove, onSendBack, onWait,
}: {
  enabled: boolean;
  minute: number;
  revision: number;
  /** Changes when the timeline changes, so the move budget and memory reset. */
  runKey: string;
  ended: boolean;
  playing: boolean;
  busy: boolean;
  turns: CrewTurn[];
  pending: string | null;
  commands: { tick: number; command: ApprovedCommand }[];
  onOrder: (order: string) => void;
  onApprove: (reason: string) => void;
  onSendBack: () => void;
  onWait: () => void;
}) {
  const [moves, setMoves] = useState<PilotMove[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = useRef("");
  useEffect(() => {
    setMoves([]);
    last.current = "";
  }, [runKey]);

  const situation = `${runKey}|${minute}|${revision}|${turns.length}|${pending ?? ""}`;
  // Let the same render's other effects (a crew member radioing in) start first, then decide.
  const settled = useRef({ busy, playing, situation });
  settled.current = { busy, playing, situation };
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setTick((n) => n + 1), 600);
    return () => window.clearTimeout(id);
  }, [situation, busy, playing]);
  useEffect(() => {
    if (!enabled || ended || playing || busy || thinking || last.current === situation) return;
    if (settled.current.busy || settled.current.playing || settled.current.situation !== situation) return;
    if (moves.length >= MAX_MOVES) return;
    last.current = situation;
    setThinking(true);
    setError(null);
    const controller = new AbortController();
    fetch("/api/commander", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        minute,
        commands,
        radio: turns.slice(-24).map((t) => ({ from: who(t.from).name, kind: t.kind, text: t.text.slice(0, 600), ...(t.verdict && t.kind === "review" ? { verdict: t.verdict } : {}) })),
        pending,
        history: moves.map((m) => `minute ${m.minute}: ${m.move}${m.move === "order" ? ` "${m.order}"` : ""} (${m.reason})`).slice(-20),
      }),
    })
      .then(async (response) => {
        const body = (await response.json()) as PilotMove & { error?: string };
        if (!response.ok) throw new Error(body.error ?? `Autopilot failed (${response.status}).`);
        const move = { ...body, minute };
        setMoves((all) => [...all, move]);
        if (move.move === "order") onOrder(move.order);
        else if (move.move === "approve") onApprove(move.reason);
        else if (move.move === "send_back") onSendBack();
        else onWait();
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Autopilot failed.");
      })
      .finally(() => setThinking(false));
    // Callbacks change every render; the situation key decides when to act.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ended, playing, busy, thinking, situation, tick]);

  return { moves, thinking, error };
}
