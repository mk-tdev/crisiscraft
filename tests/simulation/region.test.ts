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
    expect(run.events.find(e => e.type === 'road-opened')?.tick).toBe(26);
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
});
