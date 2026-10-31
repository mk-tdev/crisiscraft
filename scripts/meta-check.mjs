// One cheap live call per Meta surface CrisisCraft uses, so a new key is proven before a demo.
// Run: npm run meta:check   (reads MODEL_API_KEY from .env; prints no secrets)
const key = process.env.MODEL_API_KEY;
if (!key) { console.error('MODEL_API_KEY is not set. Add it to .env first.'); process.exit(1); }
const base = (process.env.MODEL_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
const model = process.env.MODEL_NAME || 'muse-spark-1.3';
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

const started = Date.now();
const chat = await fetch(`${base}/chat/completions`, {
  method: 'POST', headers,
  body: JSON.stringify({
    model, reasoning_effort: 'low', max_completion_tokens: 200,
    messages: [{ role: 'user', content: 'You are a flood field lead. In one sentence, report the north bridge status.' }],
    response_format: { type: 'json_schema', json_schema: { name: 'report', schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } } },
  }),
});
const body = await chat.json().catch(() => ({}));
if (!chat.ok) { console.error(`✗ ${model}: HTTP ${chat.status}`, JSON.stringify(body).slice(0, 300)); process.exit(1); }
console.log(`✓ ${model} structured output in ${Date.now() - started} ms:`, JSON.parse(body.choices[0].message.content).message);
console.log(`  tokens: ${body.usage?.prompt_tokens ?? '?'} in / ${body.usage?.completion_tokens ?? '?'} out`);

// Half a second of silence proves the transcribe endpoint and auth; an empty transcript is expected.
const rate = 24000, n = rate / 2, wav = new Uint8Array(44 + n * 2), v = new DataView(wav.buffer);
[...'RIFF'].forEach((c, i) => v.setUint8(i, c.charCodeAt(0))); v.setUint32(4, 36 + n * 2, true);
[...'WAVEfmt '].forEach((c, i) => v.setUint8(8 + i, c.charCodeAt(0)));
v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
[...'data'].forEach((c, i) => v.setUint8(36 + i, c.charCodeAt(0))); v.setUint32(40, n * 2, true);
const form = new FormData();
form.append('request', new Blob([JSON.stringify({ model: 'muse-voice-transcribe-1.0', mode: 'PUSH_TO_TALK', audioEncoding: 'WAV' })], { type: 'application/json' }));
form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'silence.wav');
const asr = await fetch(`https://api.meta.ai/v1/asr/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
console.log(asr.ok ? '✓ muse-voice-transcribe-1.0 reachable' : `✗ muse-voice-transcribe-1.0: HTTP ${asr.status} ${(await asr.text()).slice(0, 200)}`);
