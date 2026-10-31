import { afterEach, describe, expect, it, vi } from 'vitest';
import { crewStatus, nodeVoiceHandler, radioVocabulary } from '@crisiscraft/crew';
import { encodeWav } from '../../apps/web/src/voice';

const env = { MODEL_API_KEY: 'test-key' };
const wav = encodeWav(new Float32Array(2400).map((_, i) => Math.sin(i / 10) * 0.5));

async function call(handlerEnv: Record<string, string | undefined>, body: Uint8Array, method = 'POST') {
  const res = { statusCode: 0, headers: {} as Record<string, string>, body: '', setHeader(k: string, v: string) { this.headers[k] = v; }, end(b?: string) { this.body = b ?? ''; } };
  const req = { method, async *[Symbol.asyncIterator]() { yield body; } };
  await nodeVoiceHandler(handlerEnv)(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body) as Record<string, unknown> };
}

afterEach(() => vi.unstubAllGlobals());

describe('spoken orders', () => {
  it('encodes 24 kHz mono 16-bit WAV', () => {
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(wav.length).toBe(44 + 2400 * 2);
  });

  it('forwards the recording to Muse Voice Transcribe with push-to-talk settings and radio vocabulary', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ transcript: ' Send Rescue 01 by the hill road. ', audioDurationMs: 2100, turns: [] })));
    vi.stubGlobal('fetch', fetch);
    const { status, json } = await call(env, wav);
    expect(status).toBe(200);
    expect(json.transcript).toBe('Send Rescue 01 by the hill road.');
    expect(json.model).toBe('muse-voice-transcribe-1.0');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.meta.ai/v1/asr/transcribe');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const form = init.body as FormData;
    const settings = JSON.parse(await (form.get('request') as Blob).text());
    expect(settings).toMatchObject({ model: 'muse-voice-transcribe-1.0', mode: 'PUSH_TO_TALK', audioEncoding: 'WAV', keywords: radioVocabulary });
    expect((form.get('audio') as Blob).size).toBe(wav.length);
  });

  it('refuses without a key, non-WAV bodies, oversize recordings and upstream errors', async () => {
    expect((await call({}, wav)).status).toBe(503);
    expect((await call(env, new TextEncoder().encode('not audio at all'))).status).toBe(400);
    expect((await call(env, new Uint8Array(2_000_001))).status).toBe(413);
    expect((await call(env, wav, 'GET')).status).toBe(405);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad key', { status: 401 })));
    const failed = await call(env, wav);
    expect(failed.status).toBe(502);
    expect(String(failed.json.error)).toContain('401');
  });

  it('advertises voice only when a live key is configured', () => {
    expect(crewStatus({}).voice).toBe(false);
    expect(crewStatus(env).voice).toBe(true);
    expect(crewStatus({ ...env, CREW_PROVIDER: 'scripted' }).voice).toBe(false);
  });
});

describe('public demo rate limit', () => {
  it('lets a visitor through up to the limit per window, then refuses until it slides', async () => {
    const { rateLimit } = await import('../../packages/crew/src/limit');
    const limiter = rateLimit(2, 1000);
    expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('a', 10)).toBe(true);
    expect(limiter.allow('a', 20)).toBe(false);
    expect(limiter.allow('b', 20)).toBe(true);
    expect(limiter.allow('a', 1001)).toBe(true);
  });
});
