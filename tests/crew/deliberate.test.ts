import { describe, expect, it } from 'vitest';
import { advanceTo, approveCommand, createWorld, harborPoint } from '@crisiscraft/sim';
import {
  briefing, deliberate, handleCrew, scriptedProvider,
  type CrewProvider, type Plan,
} from '@crisiscraft/crew';

const at = (tick: number) => advanceTo(harborPoint, createWorld(harborPoint), tick);

describe('crew briefings', () => {
  it('give each role only its own observations and no future schedule', () => {
    const state = at(2);
    const ids = (role: 'logistics' | 'shelter' | 'field') => briefing(harborPoint, state, role).observations.map(o => o.id);
    expect(ids('logistics')).toEqual(['bridge-0', 'stock-0']);
    expect(ids('shelter')).toEqual(['school-0']);
    expect(ids('field')).toEqual(['risk-1']);
    const text = JSON.stringify(briefing(harborPoint, state, 'logistics'));
    expect(text).not.toContain('bridge-closes');
    expect(text).not.toContain('closure-4');
  });

  it('give the road map to logistics only', () => {
    const state = at(2);
    expect(briefing(harborPoint, state, 'logistics')).toHaveProperty('roadMap');
    expect(briefing(harborPoint, state, 'field')).not.toHaveProperty('roadMap');
  });
});

describe('scripted crew', () => {
  it('turns June\'s bridge warning into a validated hill-road plan', async () => {
    const result = await deliberate(harborPoint, at(2), 'Get supplies to the school. Keep one truck back.', scriptedProvider);
    expect(result.provider.live).toBe(false);
    expect(result.command?.actions[0]).toMatchObject({ vehicleId: 'V1', requestId: 'school', quantity: 6, route: ['D', 'H', 'S'] });
    expect(result.turns.map(t => `${t.from}:${t.kind}`)).toEqual([
      'commander:order', 'logistics:report', 'shelter:report', 'field:report', 'logistics:plan', 'guardrail:passed',
    ]);
  });

  it('follows an explicit bridge order while the bridge is still open', async () => {
    const result = await deliberate(harborPoint, at(2), 'Send the school crates over the bridge.', scriptedProvider);
    expect(result.command?.actions[0]!.route).toEqual(['D', 'J', 'S']);
  });

  it('holds instead of breaking the reserve rule', async () => {
    let state = at(2);
    state = approveCommand(harborPoint, state, { id: 'c1', expectedRevision: state.revision, reserveMinimum: 1,
      actions: [{ vehicleId: 'V1', requestId: 'school', quantity: 6, route: ['D', 'H', 'S'] }] });
    state = advanceTo(harborPoint, state, 5);
    const result = await deliberate(harborPoint, state, 'Send crates to the east shelter.', scriptedProvider);
    expect(result.command).toBeNull();
    expect(result.turns.at(-1)!.kind).toBe('hold');
  });
});

describe('guardrail', () => {
  const planner = (plans: Plan[]): CrewProvider => ({
    ...scriptedProvider, id: 'meta', live: true,
    plan: async () => ({ output: plans.shift()!, usage: null, ms: 1, prompt: { system: '', user: '' } }),
  });
  const plan = (route: string[], quantity = 6): Plan => ({
    message: 'Go.', rationale: 'Test.', hold: false, cites: [],
    actions: [{ vehicleId: 'V1', requestId: 'school', quantity, route }],
  });

  it('refuses an invalid model plan and accepts the revision', async () => {
    const result = await deliberate(harborPoint, at(5), 'school', planner([plan(['D', 'J', 'S']), plan(['D', 'H', 'S'])]));
    const kinds = result.turns.map(t => t.kind);
    expect(kinds.filter(k => k === 'refused')).toHaveLength(1);
    expect(result.turns.find(t => t.kind === 'refused')!.text).toContain('closed');
    expect(result.command?.actions[0]!.route).toEqual(['D', 'H', 'S']);
  });

  it('never returns a command after two refusals', async () => {
    const result = await deliberate(harborPoint, at(2), 'school', planner([plan(['D', 'H', 'S'], 7), plan(['D', 'S'])]));
    expect(result.command).toBeNull();
    expect(result.refusal).toBeTruthy();
  });
});

describe('crew handler', () => {
  it('rebuilds state from history rather than trusting the client', async () => {
    const response = await handleCrew({ minute: 2, order: 'Supplies to the school', commands: [] }, {});
    expect(response.status).toBe(200);
    const stale = await handleCrew({ minute: 2, order: 'x y', commands: [{ tick: 2, command: {
      id: 'bad', expectedRevision: 99, reserveMinimum: 1, actions: [{ vehicleId: 'V1', requestId: 'school', quantity: 6, route: ['D', 'H', 'S'] }],
    } }] }, {});
    expect(stale.status).toBe(409);
    expect((await handleCrew({ minute: 2, order: '', commands: [] }, {})).status).toBe(400);
  });
});
