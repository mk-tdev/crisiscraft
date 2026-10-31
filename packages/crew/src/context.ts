import type { Role, Scenario, WorldState } from '@crisiscraft/contracts';
import { roleContext } from '@crisiscraft/sim';
import { crew } from './roster';

const label = (scenario: Scenario, id: string) => scenario.nodes.find(n => n.id === id)?.label ?? id;

/**
 * Everything one crew member may see. Built only from the engine's role projection plus
 * the commander's public board, so the model never sees the future schedule or another
 * role's private reports.
 */
export function briefing(scenario: Scenario, state: WorldState, role: Role) {
  const own = roleContext(state, role);
  return {
    minute: state.tick,
    you: crew[role],
    observations: own.observations.map(o => ({
      id: o.id, about: scenario.edges.some(e => e.id === o.entityId) ? `road ${o.entityId}` : label(scenario, o.entityId),
      fact: o.fact, observedMinute: o.observedTick, ageMinutes: state.tick - o.observedTick,
    })),
    board: {
      openRequests: Object.values(state.requests).map(r => ({
        id: r.id, destination: r.destination, destinationName: label(scenario, r.destination),
        quantity: r.quantity, delivered: r.delivered, dueMinute: r.dueTick,
        complete: r.completedTick !== null,
      })),
      trucks: Object.values(state.vehicles).map(v => ({
        id: v.id, capacity: v.capacity, status: v.status, at: v.leg ? `on road ${v.leg.edgeId}` : label(scenario, v.node),
        cargo: v.cargo, assignedTo: v.requestId,
      })),
      reserveRule: `Keep at least ${state.reserveMinimum} truck idle at the depot.`,
    },
    // Only logistics holds the road map; nobody receives live road status except through reports.
    ...(role === 'logistics' ? {
      roadMap: {
        places: scenario.nodes.map(n => ({ id: n.id, name: n.label })),
        roads: scenario.edges.map(e => ({ id: e.id, between: [e.from, e.to], minutes: e.minutes })),
        depot: scenario.depot,
      },
    } : {}),
  };
}
export type Briefing = ReturnType<typeof briefing>;
