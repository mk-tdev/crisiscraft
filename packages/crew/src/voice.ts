/**
 * Spoken orders through Muse Voice Transcribe. The browser records one push-to-talk turn as a
 * mono 16-bit WAV; the server forwards it to Meta's file endpoint so the key never leaves it.
 */

import { rateLimit, visitor } from './limit';

type Env = Record<string, string | undefined>;

/** Names and places the radio hears often; biases recognition without forcing spellings. */
export const radioVocabulary = [
  'Priya', 'Malik', 'June', 'Harbor Point', 'Rescue 01', 'Rescue 02',
  'north bridge', 'hill road', 'Mill Lane', 'Harbour Road', 'ridge link', 'coast road',
  'school shelter', 'east shelter', 'depot', 'crates',
  'Rescue 03', 'Lorry 04', 'care home', 'village hall', 'field hospital', 'causeway', 'harbour bridge',
  'Port Road', 'Quay Street', 'Station Road', 'West Road', 'Farm Lane', 'Ring Road', 'Market Lane',
];

export const MAX_AUDIO_BYTES = 2_000_000;

export interface Transcript {
  transcript: string;
  model: string;
  ms: number;
  audioMs: number | null;
}

export function voiceAvailable(env: Env) {
  return Boolean(env.MODEL_API_KEY) && env.CREW_PROVIDER !== 'scripted';
}

export async function transcribe(wav: Uint8Array, env: Env): Promise<Transcript> {
  const base = (env.ASR_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
  const model = env.ASR_MODEL || 'muse-voice-transcribe-1.0';
  const form = new FormData();
  const settings = { model, mode: 'PUSH_TO_TALK', audioEncoding: 'WAV', languageBias: ['English'], keywords: radioVocabulary };
  form.append('request', new Blob([JSON.stringify(settings)], { type: 'application/json' }));
  form.append('audio', new Blob([wav as BlobPart], { type: 'audio/wav' }), 'order.wav');
  const started = Date.now();
  const response = await fetch(`${base}/asr/transcribe`, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${env.MODEL_API_KEY}`, Accept: 'application/json' },
    body: form,
  });
  if (!response.ok) throw new Error(`Muse Voice Transcribe returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as { transcript?: unknown; audioDurationMs?: unknown };
  if (typeof body.transcript !== 'string') throw new Error('Muse Voice Transcribe returned no transcript.');
  return { transcript: body.transcript.trim(), model, ms: Date.now() - started, audioMs: typeof body.audioDurationMs === 'number' ? body.audioDurationMs : null };
}

interface NodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

/** POST a WAV body, get {transcript}. Shared by the Vite dev server and the Vercel Function. */
export function nodeVoiceHandler(env: Env) {
  const limiter = rateLimit(Number(env.CREW_RATE_LIMIT) || 40, 10 * 60_000);
  return async (req: NodeRequest, res: NodeResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!voiceAvailable(env)) return json(503, { error: 'Voice orders need MODEL_API_KEY.' });
    if (!limiter.allow(visitor(req))) return json(429, { error: 'Too many recordings. Try again in a few minutes.' });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      size += bytes.length;
      if (size > MAX_AUDIO_BYTES) return json(413, { error: 'Recording too long. Keep orders under 30 seconds.' });
      chunks.push(bytes);
    }
    const wav = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) { wav.set(c, offset); offset += c.length; }
    const riff = String.fromCharCode(...wav.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...wav.subarray(8, 12)) === 'WAVE';
    if (!riff) return json(400, { error: 'Expected a WAV recording.' });
    try {
      return json(200, await transcribe(wav, env));
    } catch (error) {
      return json(502, { error: error instanceof Error ? error.message : 'Transcription failed.' });
    }
  };
}
