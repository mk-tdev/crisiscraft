import type { ApprovedCommand } from "@crisiscraft/contracts";
import type { CrewTurn, Deliberation } from "@crisiscraft/crew";

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
    return body.provider ? { provider: body.provider, voice: Boolean(body.voice) } : null;
  } catch {
    return null;
  }
}

/** Streams each crew turn as it arrives, then resolves with the full deliberation. */
export async function askCrew(
  body: { minute: number; order: string; commands: { tick: number; command: ApprovedCommand }[] },
  onTurn: (turn: CrewTurn) => void,
  signal?: AbortSignal,
): Promise<Deliberation> {
  const response = await fetch("/api/crew", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.body || !response.headers.get("content-type")?.includes("ndjson")) throw new Error(`The crew service is unavailable (${response.status}).`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    buffer += chunk.value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line) as { turn?: CrewTurn; done?: Deliberation; error?: string };
      if (message.turn) onTurn(message.turn);
      if (message.error) throw new Error(message.error);
      if (message.done) return message.done;
    }
  }
  throw new Error("The crew stopped responding before finishing.");
}
