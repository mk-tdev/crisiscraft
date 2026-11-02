import { describe, expect, it } from 'vitest';
import type { ApprovedCommand, WorldState } from '@crisiscraft/contracts';
import { advanceTo, approveCommand, createWorld, harborRegion as region, scenarioById, scenarios } from '@crisiscraft/sim';

const send = (state: WorldState, vehicleId: string, requestId: string, quantity: number, route: string[]) =>
  approveCommand(region, state, { id: `${vehicleId}-${requestId}-${state.tick}`, expectedRevision: state.revision, reserveMinimum: 1, actions: [{ vehicleId, requestId, quantity, route }] } satisfies ApprovedCommand);
const at = (state: WorldState, tick: number) => advanceTo(region, state, tick);
const start = () => at(createWorld(region), region.checkpointTick);

describe('Harbor Point Region', () => {
  it('is registered next to the tutorial', () => {
    expect(scenarios.map(s => s.id)).toEqual(['harbor-point', 'harbor-point-region']);
    expect(scenarioById('harbor-point-region').returnToDepot).toBe(true);
  });

  it('rewards an early bridge run to the care home; the ring road arrives late', () => {
    const bridge = at(send(start(), 'V1', 'care', 8, ['P', 'W', 'Q', 'J', 'B', 'C']), region.horizon);
    expect(bridge.requests.care!.completedTick).toBe(15);
    const ring = at(send(start(), 'V1', 'care', 8, ['P', 'W', 'Q', 'R', 'E', 'C']), region.horizon);
    expect(ring.requests.care!.completedTick).toBe(18);
  });

  it('diverts a late bridge run once the bridge closes at minute 12', () => {
    const late = at(send(at(start(), 4), 'V1', 'care', 8, ['P', 'W', 'Q', 'J', 'B', 'C']), region.horizon);
    expect(late.events.some(e => e.type === 'rerouted')).toBe(true);
    expect(late.requests.care!.completedTick! > 16).toBe(true);
  });

  it('holds a village truck at the causeway through high tide, then delivers when it reopens', () => {
    const run = at(send(at(start(), 6), 'V1', 'village', 8, ['P', 'W', 'Q', 'X', 'V']), region.horizon);
    expect(run.events.find(e => e.type === 'stranded')?.tick).toBe(15);
    expect(run.events.find(e => e.type === 'road-opened' && e.data.edgeId === 'XV')?.tick).toBe(26);
    expect(run.requests.village!.completedTick).toBe(30);
  });

  it('sends trucks back to the depot after unloading, so they can be dispatched again', () => {
    let s = send(start(), 'V1', 'care', 8, ['P', 'W', 'Q', 'J', 'B', 'C']);
    s = at(s, 40);
    expect(s.events.some(e => e.type === 'returned' && e.data.vehicleId === 'V1')).toBe(true);
    expect(s.vehicles.V1).toMatchObject({ status: 'idle', node: 'P', requestId: null });
    // The returned truck counts towards the reserve again and can take the hospital run.
    s = send(s, 'V1', 'hospital', 6, ['P', 'W', 'Q', 'R', 'K', 'H']);
    expect(s.vehicles.V1).toMatchObject({ status: 'travelling', cargo: 6, requestId: 'hospital' });
  });

  it('a well-run drill can supply every place, but only with the right order of moves', () => {
    let s = send(start(), 'V1', 'care', 8, ['P', 'W', 'Q', 'J', 'B', 'C']);
    s = send(at(s, 4), 'V4', 'school', 12, ['P', 'W', 'F', 'S']);
    s = send(at(s, 13), 'V2', 'village', 8, ['P', 'W', 'Q', 'X', 'V']);
    // Lorry 04 is back from the school by minute 31; send Rescue 03 to the hospital, keeping one in reserve.
    s = at(s, 31);
    expect(s.vehicles.V4!.status).toBe('idle');
    s = send(s, 'V3', 'hospital', 6, ['P', 'W', 'Q', 'R', 'K', 'H']);
    const end = at(s, region.horizon);
    const late = Object.values(end.requests).filter(r => r.completedTick === null || r.completedTick > r.dueTick).map(r => r.id);
    expect(late).toEqual([]);
  });

  it('flies the helicopter direct over the flooded causeway, 4 crates at a time, until gusts ground it', () => {
    const heli = (s: WorldState, route: string[]) => approveCommand(region, s, { id: `h-${s.tick}-${route.join('')}`, expectedRevision: s.revision, reserveMinimum: 1, actions: [{ vehicleId: 'H1', requestId: 'village', quantity: 4, route }] });
    // Early flight: over the flooded causeway and home before the gusts.
    let s = at(start(), 14);
    expect(s.roads.XV).toBe(false);
    s = heli(s, ['P', 'V']);
    expect(s.vehicles.H1!.status).toBe('travelling'); // not counted against the truck reserve
    s = at(s, 20);
    expect(s.requests.village!.delivered).toBe(4);
    expect(s.vehicles.H1!.node).toBe('V');
    // Gusts from minute 20: the helicopter cannot fly home, and cannot be sent again.
    s = at(s, 24);
    expect(s.vehicles.H1).toMatchObject({ status: 'stranded', node: 'V' });
    s = at(s, 31);
    expect(s.vehicles.H1).toMatchObject({ status: 'idle', node: 'P' });
    expect(s.events.some(e => e.type === 'returned' && e.data.vehicleId === 'H1')).toBe(true);
  });

  it('refuses a flight while the helicopter is grounded', () => {
    const s = at(start(), 21);
    expect(() => approveCommand(region, s, { id: 'g', expectedRevision: s.revision, reserveMinimum: 1, actions: [{ vehicleId: 'H1', requestId: 'village', quantity: 4, route: ['P', 'V'] }] })).toThrow(/grounded/);
  });

  it('keeps trucks off air routes and the helicopter off roads', () => {
    const s = start();
    const send2 = (vehicleId: string, route: string[]) => approveCommand(region, s, { id: 'x', expectedRevision: s.revision, reserveMinimum: 1, actions: [{ vehicleId, requestId: 'care', quantity: 4, route }] });
    expect(() => send2('V1', ['P', 'C'])).toThrow(/disconnected/);
    expect(() => send2('H1', ['P', 'W', 'Q', 'J', 'B', 'C'])).toThrow(/air routes/);
    expect(send2('H1', ['P', 'C']).vehicles.H1!.status).toBe('travelling');
  });
});
