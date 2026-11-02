import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliberate, mapRoutes, metaProvider, planTools } from '@crisiscraft/crew';
import { harborPoint, replay } from '@crisiscraft/sim';

const at = (minute: number) => replay(harborPoint, [], minute);
const ship = (route: string[]) => ({ actions: [{ vehicleId: 'V1', requestId: 'school', quantity: 6, route }] });

afterEach(() => vi.unstubAllGlobals());

describe("Priya's planning tools", () => {
  it('lists every map route from the depot, shortest first, without live road status', () => {
    const routes = mapRoutes(harborPoint, 'S');
    expect(routes.map(r => [r.route.join(''), r.minutes])).toEqual([['DJS', 4], ['DHS', 6], ['DHJS', 9], ['DJHS', 9]]);
    const listed = planTools(harborPoint, at(5)).call('list_routes', { destination: 'school' });
    expect(JSON.stringify(listed.result)).not.toMatch(/closed|open":/);
    expect(listed.call?.summary).toContain('fastest by road 4 min via Harbour Road → north bridge');
  });

  it('dry-runs a plan with the same validator as the guardrail', () => {
    const tools = planTools(harborPoint, at(5));
    expect(tools.call('check_plan', ship(['D', 'H', 'S'])).result).toEqual({ ok: true });
    const refused = tools.call('check_plan', ship(['D', 'J', 'S']));
    expect(refused.result).toMatchObject({ ok: false });
    expect(refused.call?.summary).toContain('refused');
    expect(tools.call('check_plan', { actions: 'nope' }).call).toBeNull();
  });

  it('runs the live planner as a tool loop: map, dry run, then submit', async () => {
    const reply = (message: unknown) => new Response(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 100, completion_tokens: 20 } }));
    const report = reply({ content: JSON.stringify({ message: 'Copy.', cites: [] }) });
    const tool = (id: string, name: string, args: unknown) => reply({ content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
    const plan = { message: 'Rescue 01 by the hill road.', rationale: 'Bridge refused in my dry run.', hold: false, cites: [], ...ship(['D', 'H', 'S']) };
    const queue = [
      tool('a', 'list_routes', { destination: 'school' }),
      tool('b', 'check_plan', ship(['D', 'J', 'S'])),
      tool('c', 'check_plan', ship(['D', 'H', 'S'])),
      tool('d', 'submit_plan', plan),
    ];
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.tools) return queue.shift()!;
      return body.response_format.json_schema.name === 'review' ? reply({ content: JSON.stringify({ verdict: 'agree', message: 'Hill road works.', cites: [] }) }) : report.clone();
    });
    vi.stubGlobal('fetch', fetch);
    const result = await deliberate(harborPoint, at(5), 'Get the crates to the school.', metaProvider({ MODEL_API_KEY: 'k' }));
    expect(result.turns.filter(t => t.kind === 'tool').map(t => t.detail)).toEqual(['list_routes', 'check_plan', 'check_plan']);
    expect(result.turns.find(t => t.kind === 'tool' && t.text.includes('refused'))).toBeTruthy();
    expect(result.command?.actions[0]!.route).toEqual(['D', 'H', 'S']);
    // Each tool result went back to the model under its call id.
    const last = (fetch.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => JSON.parse(String(init.body))).filter(b => b.tools).at(-1);
    expect(last.messages.filter((m: { role: string }) => m.role === 'tool').map((m: { tool_call_id: string }) => m.tool_call_id)).toEqual(['a', 'b', 'c']);
    expect(last.tool_choice).toBe('auto');
  });
});
