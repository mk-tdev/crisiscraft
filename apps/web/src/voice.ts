import { useCallback, useEffect, useRef, useState } from "react";

/** Muse Voice Transcribe takes mono 16-bit PCM WAV at 24 kHz, its native rate. */
const RATE = 24_000;
const MAX_SECONDS = 25;

export function encodeWav(samples: Float32Array, rate = RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
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
  samples.forEach((s, i) =>
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true),
  );
  return bytes;
}

/** Decode whatever the browser recorded, then mix down and resample to 24 kHz mono. */
async function toWav(blob: Blob) {
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close();
  }
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * RATE),
    RATE,
  );
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

export type MicState = "idle" | "requesting" | "listening" | "transcribing";

/** Push-to-talk: start() opens the mic, stop() ends the turn and resolves with the transcript. */
export function useRadioMic(onHeard: (heard: Heard) => void) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const upload = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const limit = useRef<number>(0);
  const heard = useRef(onHeard);
  heard.current = onHeard;

  const stop = useCallback(() => {
    window.clearTimeout(limit.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    const turn = ++generation.current;
    const current = () => generation.current === turn;
    setError(null);
    setState("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (!current()) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(media);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        if (!current()) return;
        recorder.current = null;
        stream.current = null;
        setState("transcribing");
        const controller = new AbortController();
        upload.current = controller;
        try {
          const wav = await toWav(new Blob(chunks, { type: rec.mimeType }));
          if (!current()) return;
          const response = await fetch("/api/voice", {
            method: "POST",
            headers: { "Content-Type": "audio/wav" },
            body: wav as BlobPart,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(50_000),
            ]),
          });
          const body = (await response.json()) as Heard & { error?: string };
          if (!current()) return;
          if (!response.ok)
            throw new Error(
              body.error ?? `Transcription failed (${response.status}).`,
            );
          if (!body.transcript)
            throw new Error(
              "Didn't catch that. Try again, a little closer to the mic.",
            );
          heard.current(body);
        } catch (e) {
          if (current())
            setError(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          if (current()) {
            setState("idle");
            upload.current = null;
          }
        }
      };
      recorder.current = rec;
      rec.start();
      setState("listening");
      limit.current = window.setTimeout(stop, MAX_SECONDS * 1000);
    } catch {
      if (!current()) return;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setError(
        "Microphone unavailable. Check the browser's permission for this site.",
      );
      setState("idle");
    }
  }, [stop]);

  useEffect(
    () => () => {
      ++generation.current;
      window.clearTimeout(limit.current);
      upload.current?.abort();
      const rec = recorder.current;
      // Discard a cancelled recording; normal stop() deliberately submits it.
      if (rec) {
        rec.onstop = null;
        rec.ondataavailable = null;
        if (rec.state === "recording") rec.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  return { state, error, start, stop };
}
