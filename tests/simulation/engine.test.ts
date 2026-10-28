import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SimulationError, type ApprovedCommand, type Scenario } from '@crisiscraft/contracts';
import {
  advanceTo, approveCommand, assertInvariants, checkpoint, compareSchoolRoutes, createWorld,
  harborPoint, makeSchoolCommand, metrics, parseScenario, replay, restore, roleContext, shortestOpenRoute,
} from '@crisiscraft/sim';

const decision = () => advanceTo(harborPoint, createWorld(harborPoint), 2);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function expectCode(fn: () => unknown, code: SimulationError['code']) {
  try { fn(); } catch (error) {
    expect(error).toBeInstanceOf(SimulationError);
    expect((error as SimulationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe('Harbor Point golden comparison', () => {
  it('changes only route and makes the deadline difference visible', () => {
    const { original, alternative } = compareSchoolRoutes(harborPoint, 9);
    expect(metrics(harborPoint, original).deliveredCrates).toBe(0);
    expect(metrics(harborPoint, alternative).deliveredCrates).toBe(6);
    expect(original.vehicles.V2).toEqual(alternative.vehicles.V2);
    expect(original.appliedExternalIds).toEqual(alternative.appliedExternalIds);
    expect(original.commands[0]!.command.actions[0]!.quantity).toBe(6);
    expect(alternative.commands[0]!.command.actions[0]!.quantity).toBe(6);
  });

  it('computes final outcomes from delivery events, not canned scores', () => {
    const { original, alternative } = compareSchoolRoutes(harborPoint, 15);
    expect(original.requests.school!.completedTick).toBe(11);
    expect(alternative.requests.school!.completedTick).toBe(8);
    expect(metrics(harborPoint, original)).toMatchObject({
      deliveredCrates: 6, unmetCrates: 6, onTimeDeliveries: 0, completedLatenessMinutes: 2,
      ongoingLatenessMinutes: 3, crateWaitingMinutes: 126, vehicleTravelMinutes: 9,
      idleTrucksAtDepot: 1, reserveViolationTicks: 0,
    });
    expect(metrics(harborPoint, alternative)).toMatchObject({
      deliveredCrates: 6, unmetCrates: 6, onTimeDeliveries: 1, completedLatenessMinutes: 0,
      crateWaitingMinutes: 108, vehicleTravelMinutes: 6,
    });
    const diverted = original.events.find(e => e.type === 'rerouted')!;
    expect(diverted.tick).toBe(4);
    expect(diverted.data.route).toEqual(['J', 'H', 'S']);
    expect(original.events.find(e => e.id === diverted.causeId)?.type).toBe('road-closed');
  });
});

describe('time and resource rules', () => {
  it('conserves crates at every tick and does not mutate prior states', () => {
    const initial = decision();
    const before = digest(initial);
    let state = approveCommand(harborPoint, initial, makeSchoolCommand(initial, ['D', 'J', 'S']));
    for (let tick = 2; tick <= 15; tick++) {
      state = advanceTo(harborPoint, state, tick);
      expect(() => assertInvariants(harborPoint, state)).not.toThrow();
      expect(state.stock + state.vehicles.V1!.cargo + state.vehicles.V2!.cargo
        + Object.values(state.requests).reduce((sum, r) => sum + r.delivered, 0)).toBe(12);
    }
    expect(digest(initial)).toBe(before);
  });

  it('closes roads before vehicles arriving at the junction enter the next edge', () => {
    const state = decision();
    const arrived = advanceTo(harborPoint, approveCommand(harborPoint, state,
      makeSchoolCommand(state, ['D', 'J', 'S'])), 4);
    expect(arrived.vehicles.V1!.leg?.edgeId).toBe('JH');
    const closureIndex = arrived.events.findIndex(e => e.type === 'road-closed');
    expect(closureIndex).toBeLessThan(arrived.events.findIndex(e => e.type === 'rerouted'));
  });

  it('lets a truck already on a closing edge finish, then wait for receiving', () => {
    const initial = createWorld(harborPoint);
    const dispatched = approveCommand(harborPoint, initial, makeSchoolCommand(initial, ['D', 'J', 'S']));
    const atSchool = advanceTo(harborPoint, dispatched, 4);
    expect(atSchool.vehicles.V1).toMatchObject({ node: 'S', cargo: 6, status: 'waiting', leg: null });
    expect(atSchool.requests.school!.delivered).toBe(0);
    const ready = advanceTo(harborPoint, atSchool, 6);
    expect(ready.requests.school!.completedTick).toBe(6);
    expect(ready.events.filter(e => e.type === 'delivered')).toHaveLength(1);
    expect(advanceTo(harborPoint, ready, 15).events.filter(e => e.type === 'delivered')).toHaveLength(1);
  });

  it('opens later requests only on their authored tick', () => {
    expect(advanceTo(harborPoint, createWorld(harborPoint), 4).requests.east).toBeUndefined();
    expect(advanceTo(harborPoint, createWorld(harborPoint), 5).requests.east!.delivered).toBe(0);
  });

  it('accounts for partial deliveries without satisfying an entire request', () => {
    const state = decision();
    const command = makeSchoolCommand(state, ['D', 'H', 'S']);
    command.actions[0]!.quantity = 3;
    const end = advanceTo(harborPoint, approveCommand(harborPoint, state, command), 15);
    expect(end.requests.school).toMatchObject({ delivered: 3, completedTick: null });
    expect(metrics(harborPoint, end).unmetCrates).toBe(9);
    expect(end.stock).toBe(9);
  });

  it('strands a truck without losing cargo if every onward route is closed', () => {
    const scenario = structuredClone(harborPoint);
    scenario.events.push({ id: 'hill-closes', tick: 4, type: 'close-road', edgeId: 'HS' });
    const state = advanceTo(scenario, createWorld(scenario), 2);
    const end = advanceTo(scenario, approveCommand(scenario, state, makeSchoolCommand(state, ['D', 'J', 'S'])), 15);
    expect(end.vehicles.V1).toMatchObject({ status: 'stranded', cargo: 6 });
    expect(end.events.filter(e => e.type === 'stranded')).toHaveLength(1);
    expect(() => assertInvariants(scenario, end)).not.toThrow();
  });

  it.each([-1, 1.5, 16, NaN, Infinity])('rejects invalid target tick %s', target => {
    expectCode(() => advanceTo(harborPoint, decision(), target), 'INVALID_TICK');
  });

  it('stops approvals at the horizon', () => {
    const state = advanceTo(harborPoint, createWorld(harborPoint), 15);
    expectCode(() => approveCommand(harborPoint, state, makeSchoolCommand(state, ['D', 'H', 'S'])), 'HORIZON_REACHED');
  });
});

describe('untrusted approval boundary', () => {
  it.each([
    ['unknown vehicle', { vehicleId: 'V9' }],
    ['prototype identifier', { vehicleId: 'constructor' }],
    ['capacity', { quantity: 7 }],
    ['unknown request', { requestId: 'missing' }],
    ['disconnected nodes', { route: ['D', 'S'] }],
    ['wrong endpoints', { route: ['J', 'S'] }],
    ['missing route', { route: [] }],
    ['fractional quantity', { quantity: 1.5 }],
    ['negative quantity', { quantity: -1 }],
    ['invented action fields', { createTruck: true }],
  ])('rejects %s without mutation', (_label, change) => {
    const state = decision();
    const before = digest(state);
    const command = makeSchoolCommand(state, ['D', 'J', 'S']);
    Object.assign(command.actions[0]!, change);
    expect(() => approveCommand(harborPoint, state, command)).toThrow(SimulationError);
    expect(digest(state)).toBe(before);
  });

  it('rejects an already-closed road and future demand', () => {
    const state = advanceTo(harborPoint, decision(), 4);
    expectCode(() => approveCommand(harborPoint, state, makeSchoolCommand(state, ['D', 'J', 'S'])), 'INVALID_PLAN');
    const future = makeSchoolCommand(decision(), ['D', 'E']);
    future.actions[0]!.requestId = 'east';
    expectCode(() => approveCommand(harborPoint, decision(), future), 'INVALID_PLAN');
  });

  it('rejects insufficient stock and duplicate assignment atomically', () => {
    const scenario: Scenario = { ...structuredClone(harborPoint), stock: 3 };
    const state = advanceTo(scenario, createWorld(scenario), 2);
    expectCode(() => approveCommand(scenario, state, makeSchoolCommand(state, ['D', 'H', 'S'])), 'INVALID_PLAN');
    const original = decision();
    const batch = makeSchoolCommand(original, ['D', 'H', 'S']);
    batch.actions.push(structuredClone(batch.actions[0]!));
    const before = digest(original);
    expectCode(() => approveCommand(harborPoint, original, batch), 'INVALID_PLAN');
    expect(digest(original)).toBe(before);
  });

  it('rejects weakening the reserve rule or dispatching the reserved truck', () => {
    const state = decision();
    const weak = makeSchoolCommand(state, ['D', 'H', 'S']);
    weak.reserveMinimum = 0;
    expectCode(() => approveCommand(harborPoint, state, weak), 'INVALID_PLAN');
    const dispatched = approveCommand(harborPoint, state, makeSchoolCommand(state, ['D', 'H', 'S']));
    const later = advanceTo(harborPoint, dispatched, 5);
    const command: ApprovedCommand = { id: 'east', expectedRevision: later.revision, reserveMinimum: 1,
      actions: [{ vehicleId: 'V2', requestId: 'east', quantity: 6, route: ['D', 'E'] }] };
    expectCode(() => approveCommand(harborPoint, later, command), 'INVALID_PLAN');
  });

  it('prevents overcommitting demand across vehicles in a single batch', () => {
    const scenario = { ...structuredClone(harborPoint), reserveMinimum: 0 };
    const state = advanceTo(scenario, createWorld(scenario), 2);
    const command = makeSchoolCommand(state, ['D', 'H', 'S']);
    command.reserveMinimum = 0;
    command.actions.push({ ...command.actions[0]!, vehicleId: 'V2' });
    expectCode(() => approveCommand(scenario, state, command), 'INVALID_PLAN');
  });

  it('handles retries idempotently, rejects changed IDs and stale approvals', () => {
    const state = decision();
    const command = makeSchoolCommand(state, ['D', 'H', 'S']);
    const first = approveCommand(harborPoint, state, command);
    const later = advanceTo(harborPoint, first, 5);
    expect(approveCommand(harborPoint, later, command)).toEqual(later);
    expectCode(() => approveCommand(harborPoint, later, { ...command, reserveMinimum: 2 }), 'DUPLICATE_COMMAND');
    expectCode(() => approveCommand(harborPoint, later, { ...command, id: 'second' }), 'STALE_REVISION');
  });
});

describe('replay, routing and bounded knowledge', () => {
  it('replays to exactly the same normalized state and event hash', () => {
    const { original } = compareSchoolRoutes(harborPoint, 15);
    const rerun = replay(harborPoint, original.commands, 15);
    expect(digest(rerun)).toBe(digest(original));
    expect(digest(rerun.events)).toBe(digest(original.events));
    expect(replay(harborPoint, original.commands, 1).commands).toHaveLength(0);
  });

  it('replays sequential approvals at different ticks without regenerating decisions', () => {
    const scenario = { ...structuredClone(harborPoint), reserveMinimum: 0 };
    const initial = advanceTo(scenario, createWorld(scenario), 2);
    const first = makeSchoolCommand(initial, ['D', 'H', 'S']);
    first.reserveMinimum = 0;
    first.actions[0]!.quantity = 3;
    const afterFirst = advanceTo(scenario, approveCommand(scenario, initial, first), 5);
    const second: ApprovedCommand = { id: 'east-dispatch', expectedRevision: afterFirst.revision, reserveMinimum: 0,
      actions: [{ vehicleId: 'V2', requestId: 'east', quantity: 6, route: ['D', 'E'] }] };
    const final = advanceTo(scenario, approveCommand(scenario, afterFirst, second), 15);
    expect(final.requests.east!.completedTick).toBe(9);
    expect(digest(replay(scenario, final.commands, 15))).toBe(digest(final));
  });

  it('round-trips checkpoints through JSON and isolates all nested state', () => {
    const source = decision();
    const saved = checkpoint(source);
    const restored = restore(harborPoint, JSON.parse(JSON.stringify(saved)));
    expect(restored).toEqual(source);
    restored.vehicles.V1!.cargo = 99;
    restored.observations[0]!.fact = 'changed';
    restored.roads.JS = false;
    expect(saved.state).toEqual(source);
    const forked = compareSchoolRoutes(harborPoint, 15);
    forked.alternative.events[0]!.message = 'changed';
    expect(forked.original.events[0]!.message).not.toBe('changed');
  });

  it('rejects checkpoint version mismatches', () => {
    const saved = checkpoint(decision());
    saved.scenarioVersion = '99';
    expectCode(() => restore(harborPoint, saved), 'INVALID_CHECKPOINT');
  });

  it('filters private reports and future events out of role contexts', () => {
    const state = decision();
    const logistics = roleContext(state, 'logistics');
    expect(logistics.observations.map(o => o.id)).toEqual(['bridge-0', 'stock-0']);
    expect(roleContext(state, 'field').observations.map(o => o.id)).toEqual(['risk-1']);
    expect(roleContext(state, 'shelter').observations.map(o => o.id)).toEqual(['school-0']);
    expect(Object.keys(logistics)).toEqual(['role', 'tick', 'observations']);
    logistics.observations[0]!.fact = 'mutated';
    expect(state.observations[0]!.fact).not.toBe('mutated');
    const later = advanceTo(harborPoint, state, 6);
    expect(roleContext(later, 'logistics').observations.map(o => o.id)).toContain('closure-4');
    expect(roleContext(later, 'logistics').observations.map(o => o.id)).not.toContain('east-5');
  });

  it('finds deterministic shortest diversions regardless of edge array order', () => {
    const closed = { ...decision().roads, JS: false };
    const route = shortestOpenRoute(harborPoint, closed, 'J', 'S');
    expect(route).toEqual(['J', 'H', 'S']);
    expect(shortestOpenRoute({ ...harborPoint, edges: [...harborPoint.edges].reverse() }, closed, 'J', 'S')).toEqual(route);
    const tie = structuredClone(harborPoint);
    tie.edges.find(e => e.id === 'JH')!.minutes = 5; // J-D-H-S and J-H-S are both 8.
    expect(shortestOpenRoute(tie, closed, 'J', 'S')).toEqual(['J', 'D', 'H', 'S']);
  });

  it('rejects malformed scenario data and cross-reference mistakes', () => {
    expect(() => parseScenario({ ...harborPoint, nodes: [harborPoint.nodes[0], harborPoint.nodes[0]] })).toThrow();
    expect(() => parseScenario({ ...harborPoint, reserveMinimum: 3 })).toThrow();
    const bad = structuredClone(harborPoint);
    bad.edges[0]!.minutes = 0;
    expect(() => parseScenario(bad)).toThrow();
  });
});
