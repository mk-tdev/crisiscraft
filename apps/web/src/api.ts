import type { ApprovedCommand } from "@crisiscraft/contracts";
import type { CrewTurn, Deliberation, PhotoEvent } from "@crisiscraft/crew";

export interface ProviderInfo {
  id: "meta" | "scripted";
  label: string;
  model: string | null;
  live: boolean;
}

export interface CrewStatus {
  provider: ProviderInfo;
  /** True when spoken orders can go through Muse Voice Transcribe. */
  voice: boolean;
}

export async function crewStatus(): Promise<CrewStatus | null> {
  try {
    const response = await fetch("/api/crew");
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<CrewStatus>;
    return body.provider
      ? { provider: body.provider, voice: Boolean(body.voice) }
      : null;
  } catch {
    return null;
  }
}

/** Streams each crew turn as it arrives, then resolves with the full deliberation. */
export async function askCrew(
  body: {
    minute: number;
    order: string;
    commands: { tick: number; command: ApprovedCommand }[];
    photo?: { minute: number; text: string };
    initiative?: {
      role: "logistics" | "shelter" | "field";
      observationId: string;
    };
  },
  onTurn: (turn: CrewTurn) => void,
  signal?: AbortSignal,
): Promise<Deliberation> {
  const response = await fetch("/api/crew", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(55_000)])
      : AbortSignal.timeout(55_000),
  });
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("ndjson")
  )
    throw new Error(`The crew service is unavailable (${response.status}).`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (
      let chunk = await reader.read();
      !chunk.done;
      chunk = await reader.read()
    ) {
      buffer += chunk.value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line) as {
          turn?: CrewTurn;
          done?: Deliberation;
          error?: string;
        };
        if (message.turn) onTurn(message.turn);
        if (message.error) throw new Error(message.error);
        if (message.done) return message.done;
      }
    }
    throw new Error(
      "The crew stopped responding before finishing. Nothing was approved. Please try again.",
    );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Streams June's field photo: the image, then SAM 3.1's outlines, then her reading. */
export async function askPhoto(
  body: {
    minute: number;
    commands: { tick: number; command: ApprovedCommand }[];
  },
  onEvent: (event: PhotoEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(55_000)])
      : AbortSignal.timeout(55_000),
  });
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("ndjson")
  ) {
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      detail?.error ?? `The photo service is unavailable (${response.status}).`,
    );
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (
      let chunk = await reader.read();
      !chunk.done;
      chunk = await reader.read()
    ) {
      buffer += chunk.value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line) as {
          event?: PhotoEvent;
          done?: boolean;
          error?: string;
        };
        if (message.event) onEvent(message.event);
        if (message.error) throw new Error(message.error);
        if (message.done) return;
      }
    }
    throw new Error(
      "The photo stopped before June could read it. Please try again.",
    );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
