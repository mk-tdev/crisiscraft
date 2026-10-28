import type { Role, Scenario, WorldState } from '@crisiscraft/contracts';
import { idleAtDepot } from './engine';

export function metrics(scenario: Scenario, state: WorldState) {
  const requests = Object.values(state.requests);
  return {
    tick: state.tick,
    deliveredCrates: requests.reduce((sum, r) => sum + r.delivered, 0),
    unmetCrates: requests.reduce((sum, r) => sum + r.quantity - r.delivered, 0),
    onTimeDeliveries: requests.filter(r => r.completedTick !== null && r.completedTick <= r.dueTick).length,
    completedLatenessMinutes: requests.reduce((sum, r) => sum + (r.completedTick === null ? 0 : Math.max(r.completedTick - r.dueTick, 0)), 0),
    ongoingLatenessMinutes: requests.reduce((sum, r) => sum + (r.completedTick !== null ? 0 : Math.max(state.tick - r.dueTick, 0)), 0),
    idleTrucksAtDepot: idleAtDepot(scenario, state),
    ...state.totals,
  };
}

/** Model-facing projection: deliberately excludes world state and the future schedule. */
export function roleContext(state: WorldState, role: Role) {
  return {
    role, tick: state.tick,
    observations: structuredClone(state.observations.filter(o => o.audience.includes('public') || o.audience.includes(role))),
  };
}

export function vehiclePosition(scenario: Scenario, vehicle: WorldState['vehicles'][string], tick: number): [number, number] {
  const start = scenario.nodes.find(n => n.id === (vehicle.leg?.from ?? vehicle.node))!;
  if (!vehicle.leg) return [start.x, start.z];
  const end = scenario.nodes.find(n => n.id === vehicle.leg!.to)!;
  const progress = Math.max(0, Math.min(1, (tick - vehicle.leg.enteredTick) / (vehicle.leg.arrivalTick - vehicle.leg.enteredTick)));
  return [start.x + (end.x - start.x) * progress, start.z + (end.z - start.z) * progress];
}
