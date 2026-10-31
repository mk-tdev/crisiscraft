import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceTo, createWorld, harborPoint } from '@crisiscraft/sim';
import { briefing, chooseProvider, metaProvider } from '@crisiscraft/crew';

const reply = (content: unknown) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 900, completion_tokens: 60 },
}), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('Meta Model API provider', () => {
  const task = { kind: 'report' as const, role: 'field' as const, order: 'Status?', briefing: briefing(harborPoint, advanceTo(harborPoint, createWorld(harborPoint), 2), 'field') };

  it('sends an OpenAI-compatible, schema-constrained request with only the role briefing', async () => {
    const fetch = vi.fn(async () => reply({ message: 'Water rising at the bridge.', cites: ['risk-1'] }));
    vi.stubGlobal('fetch', fetch);
    const result = await metaProvider({ MODEL_API_KEY: 'test-key' }).report(task);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe('https://api.meta.ai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(body.model).toBe('muse-spark-1.3');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages[1].content).toContain('risk-1');
    expect(body.messages[1].content).not.toContain('stock-0');
    expect(result.output.cites).toEqual(['risk-1']);
    expect(result.usage).toEqual({ inputTokens: 900, outputTokens: 60 });
  });

  it('rejects replies that do not match the schema instead of guessing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ say: 'wrong shape' })));
    await expect(metaProvider({ MODEL_API_KEY: 'k' }).report(task)).rejects.toThrow();
  });

  it('surfaces API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    await expect(metaProvider({ MODEL_API_KEY: 'k' }).report(task)).rejects.toThrow('Model API 401');
  });

  it('uses the scripted crew only without a key or when forced', () => {
    expect(chooseProvider({}).live).toBe(false);
    expect(chooseProvider({ MODEL_API_KEY: 'k' }).live).toBe(true);
    expect(chooseProvider({ MODEL_API_KEY: 'k', CREW_PROVIDER: 'scripted' }).live).toBe(false);
  });
});
