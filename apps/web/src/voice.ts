import { useCallback, useEffect, useRef, useState } from "react";

/** Muse Voice Transcribe takes mono 16-bit PCM WAV at 24 kHz, its native rate. */
const RATE = 24_000;
const MAX_SECONDS = 25;

export function encodeWav(samples: Float32Array, rate = RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return bytes;
}

/** Decode whatever the browser recorded, then mix down and resample to 24 kHz mono. */
async function toWav(blob: Blob) {
  const decoded = await new AudioContext().decodeAudioData(await blob.arrayBuffer());
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  return encodeWav((await offline.startRendering()).getChannelData(0));
}

export interface Heard {
  transcript: string;
  model: string;
  ms: number;
}

export type MicState = "idle" | "listening" | "transcribing";

/** Push-to-talk: start() opens the mic, stop() ends the turn and resolves with the transcript. */
export function useRadioMic(onHeard: (heard: Heard) => void) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const limit = useRef<number>(0);

  const stop = useCallback(() => {
    window.clearTimeout(limit.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");
        try {
          const wav = await toWav(new Blob(chunks, { type: rec.mimeType }));
          const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav as BlobPart });
          const body = (await response.json()) as Heard & { error?: string };
          if (!response.ok) throw new Error(body.error ?? `Transcription failed (${response.status}).`);
          if (!body.transcript) throw new Error("Didn't catch that. Try again, a little closer to the mic.");
          onHeard(body);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          setState("idle");
        }
      };
      recorder.current = rec;
      rec.start();
      setState("listening");
      limit.current = window.setTimeout(stop, MAX_SECONDS * 1000);
    } catch {
      setError("Microphone unavailable. Check the browser's permission for this site.");
      setState("idle");
    }
  }, [onHeard, stop]);

  useEffect(() => () => stop(), [stop]);
  return { state, error, start, stop };
}
