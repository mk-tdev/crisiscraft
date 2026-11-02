import {
  commandSchema, SimulationError,
  type ApprovedCommand, type Scenario, type SimEvent, type VehicleState, type WorldState,
} from '@crisiscraft/contracts';
import { compareIds, edgeBetween, shortestOpenRoute } from './routing';

const clone = <T>(value: T): T => structuredClone(value);
function invalid(message: string): never { throw new SimulationError('INVALID_PLAN', message); }

function event(
  state: WorldState, type: SimEvent['type'], message: string,
  data: SimEvent['data'] = {}, causeId: string | null = null,
) {
  const sequence = state.events.length;
  state.events.push({ id: `event-${sequence}`, tick: state.tick, sequence, type, message, causeId, data });
}

function assertScenario(scenario: Scenario, state: WorldState) {
  if (state.scenarioId !== scenario.id || state.scenarioVersion !== scenario.version) {
    throw new SimulationError('INVALID_CHECKPOINT', 'Scenario ID or version does not match the run.');
  }
}

function externalChanges(scenario: Scenario, state: WorldState) {
  for (const e of scenario.events.filter(e => e.tick === state.tick).sort((a, b) => compareIds(a.id, b.id))) {
    if (state.appliedExternalIds.includes(e.id)) continue;
    state.appliedExternalIds.push(e.id);
    if (e.type === 'close-road') {
      state.roads[e.edgeId] = false;
      event(state, 'road-closed', `${e.edgeId} closed to new entry.`, { edgeId: e.edgeId }, e.id);
    } else if (e.type === 'open-road') {
      state.roads[e.edgeId] = true;
      event(state, 'road-opened', `${e.edgeId} open again.`, { edgeId: e.edgeId }, e.id);
    } else {
      state.receiving[e.nodeId] = e.enabled;
      event(state, 'receiving-changed', `${e.nodeId} receiving ${e.enabled ? 'enabled' : 'disabled'}.`,
        { nodeId: e.nodeId, enabled: e.enabled }, e.id);
    }
  }
  for (const r of scenario.requests.filter(r => r.openedTick === state.tick).sort((a, b) => compareIds(a.id, b.id))) {
    state.requests[r.id] = { ...clone(r), delivered: 0, completedTick: null };
    event(state, 'request-opened', `${r.id}: ${r.quantity} crates requested by minute ${r.dueTick}.`,
      { requestId: r.id, quantity: r.quantity }, `request:${r.id}`);
  }
}

function publishObservations(scenario: Scenario, state: WorldState) {
  for (const o of scenario.observations.filter(o => o.receivedTick === state.tick).sort((a, b) => compareIds(a.id, b.id))) {
    if (state.observations.some(existing => existing.id === o.id)) continue;
    state.observations.push(clone(o));
    // Do not copy role-private report contents into the shared event feed.
    event(state, 'observation-received', `New ${o.audience.includes('public') ? 'public' : 'role'} observation.`,
      { observationId: o.id }, o.id);
  }
}

export function createWorld(scenario: Scenario): WorldState {
  const state: WorldState = {
    scenarioId: scenario.id, scenarioVersion: scenario.version, tick: 0, revision: 0,
    stock: scenario.stock, initialStock: scenario.stock, reserveMinimum: scenario.reserveMinimum,
    roads: Object.fromEntries(scenario.edges.map(e => [e.id, true])),
    receiving: Object.fromEntries(scenario.nodes.map(n => [n.id, n.receiving])),
    vehicles: Object.fromEntries(scenario.vehicles.map(v => [v.id, {
      ...v, node: scenario.depot, cargo: 0, status: 'idle' as const, requestId: null, route: [], leg: null,
    }])),
    requests: {}, observations: [], appliedExternalIds: [], commands: [], events: [],
    totals: { crateWaitingMinutes: 0, vehicleTravelMinutes: 0, reserveViolationTicks: 0 },
  };
  externalChanges(scenario, state);
  publishObservations(scenario, state);
  assertInvariants(scenario, state);
  return state;
}

/** Idle trucks at the depot: the reserve rule is about trucks, so aircraft never count. */
export function idleAtDepot(scenario: Scenario, state: WorldState): number {
  return Object.values(state.vehicles).filter(v => v.status === 'idle' && v.node === scenario.depot && v.mode !== 'air').length;
}

/** An empty truck heading home after a delivery, in scenarios where trucks return to reload. */
const homeward = (scenario: Scenario, v: VehicleState) =>
  !!scenario.returnToDepot && v.requestId === null && v.cargo === 0 && v.status !== 'idle';

function startNextLeg(scenario: Scenario, state: WorldState, vehicle: VehicleState, causeId: string | null) {
  const returning = homeward(scenario, vehicle);
  if (vehicle.leg || (!returning && (!vehicle.requestId || !vehicle.cargo))) return;
  const destination = returning ? scenario.depot : state.requests[vehicle.requestId!]!.destination;
  if (vehicle.node === destination) {
    if (!returning) { vehicle.status = 'waiting'; return; }
    vehicle.status = 'idle';
    vehicle.route = [vehicle.node];
    event(state, 'returned', `${vehicle.id} is back at the depot and can be sent again.`, { vehicleId: vehicle.id }, causeId);
    return;
  }
  let next = vehicle.route[1];
  let edge = next ? edgeBetween(scenario, vehicle.node, next, vehicle.mode) : undefined;
  if (!edge || !state.roads[edge.id]) {
    const blockedEdgeId = edge?.id;
    const route = shortestOpenRoute(scenario, state.roads, vehicle.node, destination, vehicle.mode);
    if (!route) {
      if (vehicle.status !== 'stranded') {
        event(state, 'stranded', `${vehicle.id} has no open route to ${destination}; waiting for a road to open.`, { vehicleId: vehicle.id }, causeId);
      }
      vehicle.status = 'stranded';
      return;
    }
    vehicle.route = route;
    next = route[1]!;
    edge = edgeBetween(scenario, vehicle.node, next, vehicle.mode)!;
    // A truck heading home has no planned route yet; only a blocked planned road is a diversion.
    if (blockedEdgeId) {
      const closure = [...state.events].reverse().find(e => e.type === 'road-closed' && e.data.edgeId === blockedEdgeId);
      event(state, 'rerouted', `${vehicle.id} diverted via ${route.join(' → ')}.`,
        { vehicleId: vehicle.id, route: [...route] }, closure?.id ?? causeId);
    }
  }
  vehicle.leg = { edgeId: edge.id, from: vehicle.node, to: next!, enteredTick: state.tick, arrivalTick: state.tick + edge.minutes };
  vehicle.status = 'travelling';
  event(state, 'edge-entered', `${vehicle.id} entered ${edge.id}; arrives at minute ${vehicle.leg.arrivalTick}.`,
    { vehicleId: vehicle.id, edgeId: edge.id, arrivalTick: vehicle.leg.arrivalTick }, causeId);
}

function unload(scenario: Scenario, state: WorldState, vehicle: VehicleState) {
  if (vehicle.leg || !vehicle.requestId || vehicle.cargo === 0) return;
  const request = state.requests[vehicle.requestId]!;
  if (vehicle.node !== request.destination || !state.receiving[vehicle.node]) return;
  const quantity = vehicle.cargo;
  request.delivered += quantity;
  vehicle.cargo = 0;
  vehicle.status = 'delivered';
  vehicle.route = [vehicle.node];
  if (scenario.returnToDepot) {
    // Unloaded: the truck is free and heads home on the next minute.
    vehicle.requestId = null;
    vehicle.status = 'returning';
  }
  if (request.delivered === request.quantity) request.completedTick = state.tick;
  const dispatch = [...state.events].reverse().find(e => e.type === 'dispatched' && e.data.vehicleId === vehicle.id);
  event(state, 'delivered', `${vehicle.id} unloaded ${quantity} crates for ${request.id}.`,
    { vehicleId: vehicle.id, requestId: request.id, quantity }, dispatch?.id ?? null);
}

/** An approval is atomic at the current paused tick boundary. Input is untrusted. */
export function approveCommand(scenario: Scenario, current: WorldState, input: unknown): WorldState {
  assertScenario(scenario, current);
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) throw new SimulationError('MALFORMED_COMMAND', 'Command does not match the dispatch schema.');
  const command = parsed.data;
  const prior = current.commands.find(entry => entry.command.id === command.id);
  if (prior) {
    if (JSON.stringify(prior.command) !== JSON.stringify(command)) {
      throw new SimulationError('DUPLICATE_COMMAND', 'Command ID already belongs to different input.');
    }
    return clone(current); // Successful retry remains idempotent even after later revisions.
  }
  if (command.expectedRevision !== current.revision) {
    throw new SimulationError('STALE_REVISION', 'World changed. Review and approve the plan again.');
  }
  if (current.tick >= scenario.horizon) throw new SimulationError('HORIZON_REACHED', 'The exercise has ended.');
  if (command.reserveMinimum < current.reserveMinimum) invalid('The existing reserve rule cannot be weakened.');
  const state = clone(current);
  state.reserveMinimum = command.reserveMinimum;
  for (const action of command.actions) {
    const vehicle = state.vehicles[action.vehicleId];
    const request = state.requests[action.requestId];
    if (!vehicle) invalid('Unknown vehicle.');
    if (!request) invalid('Request is not open.');
    if (vehicle.status !== 'idle' || vehicle.node !== scenario.depot) invalid('Vehicle must be idle at depot.');
    if (action.quantity > vehicle.capacity) invalid('Quantity exceeds vehicle capacity.');
    if (action.quantity > state.stock) invalid('Insufficient depot stock.');
    const committed = Object.values(state.vehicles)
      .filter(v => v.requestId === request.id).reduce((sum, v) => sum + v.cargo, 0);
    if (action.quantity > request.quantity - request.delivered - committed) invalid('Quantity exceeds unassigned request demand.');
    if (action.route[0] !== vehicle.node || action.route.at(-1) !== request.destination) invalid('Route endpoints do not match the assignment.');
    for (let i = 1; i < action.route.length; i++) {
      const edge = edgeBetween(scenario, action.route[i - 1]!, action.route[i]!, vehicle.mode);
      if (!edge) invalid(vehicle.mode === 'air' ? 'The helicopter can only fly the air routes on the map.' : 'Route contains disconnected nodes.');
      if (!state.roads[edge.id]) invalid(vehicle.mode === 'air' ? 'That air route is closed: the helicopter is grounded.' : 'Route uses an already-closed road.');
    }
    state.stock -= action.quantity;
    vehicle.cargo = action.quantity;
    vehicle.requestId = request.id;
    vehicle.route = [...action.route];
    vehicle.status = 'waiting';
    event(state, 'dispatched', `${vehicle.id}: ${action.quantity} crates to ${request.destination} via ${action.route.join(' → ')}.`,
      { vehicleId: vehicle.id, requestId: request.id, quantity: action.quantity, route: [...action.route] }, command.id);
    startNextLeg(scenario, state, vehicle, command.id);
    unload(scenario, state, vehicle);
  }
  if (idleAtDepot(scenario, state) < state.reserveMinimum) invalid('Dispatch would violate the idle-at-depot reserve rule.');
  state.commands.push({ tick: state.tick, command: clone(command) });
  state.revision++;
  assertInvariants(scenario, state);
  return state;
}

export function advanceTo(scenario: Scenario, current: WorldState, targetTick: number): WorldState {
  assertScenario(scenario, current);
  if (!Number.isInteger(targetTick) || targetTick < current.tick || targetTick > scenario.horizon) {
    throw new SimulationError('INVALID_TICK', 'Advance requires an integer tick between now and the scenario horizon.');
  }
  const state = clone(current);
  while (state.tick < targetTick) {
    // Integrate the interval [tick, tick + 1), before the new tick's events or deliveries.
    state.totals.crateWaitingMinutes += Object.values(state.requests).reduce((sum, r) => sum + r.quantity - r.delivered, 0);
    state.totals.vehicleTravelMinutes += Object.values(state.vehicles).filter(v => v.leg !== null).length;
    if (idleAtDepot(scenario, state) < state.reserveMinimum) state.totals.reserveViolationTicks++;
    state.tick++;
    externalChanges(scenario, state);
    const vehicles = Object.values(state.vehicles).sort((a, b) => compareIds(a.id, b.id));
    for (const vehicle of vehicles) {
      if (vehicle.leg && vehicle.leg.arrivalTick === state.tick) {
        const leg = vehicle.leg;
        vehicle.node = leg.to;
        vehicle.leg = null;
        vehicle.route = vehicle.route.slice(1);
        event(state, 'edge-arrived', `${vehicle.id} reached ${vehicle.node}.`,
          { vehicleId: vehicle.id, nodeId: vehicle.node, edgeId: leg.edgeId });
      }
    }
    for (const vehicle of vehicles) startNextLeg(scenario, state, vehicle, null);
    for (const vehicle of vehicles) unload(scenario, state, vehicle);
    publishObservations(scenario, state);
    state.revision++;
    assertInvariants(scenario, state);
  }
  return state;
}

export function assertInvariants(scenario: Scenario, state: WorldState) {
  assertScenario(scenario, state);
  const vehicles = Object.values(state.vehicles);
  const requests = Object.values(state.requests);
  const total = state.stock + vehicles.reduce((sum, v) => sum + v.cargo, 0) + requests.reduce((sum, r) => sum + r.delivered, 0);
  if (total !== state.initialStock || state.initialStock !== scenario.stock || !Number.isInteger(state.stock) || state.stock < 0) {
    throw new Error('Supply conservation invariant violated.');
  }
  for (const v of vehicles) {
    if (!Number.isInteger(v.cargo) || v.cargo < 0 || v.cargo > v.capacity) throw new Error('Vehicle capacity invariant violated.');
    if ((v.status === 'travelling') !== (v.leg !== null)) throw new Error('Vehicle travel invariant violated.');
  }
  for (const r of requests) {
    const cargo = vehicles.filter(v => v.requestId === r.id).reduce((sum, v) => sum + v.cargo, 0);
    if (r.delivered < 0 || r.delivered + cargo > r.quantity) throw new Error('Demand allocation invariant violated.');
  }
  if (idleAtDepot(scenario, state) < state.reserveMinimum) throw new Error('Reserve invariant violated.');
}

/** Canonical shape after schema parsing is also used to compare approval retries. */
export function makeSchoolCommand(state: WorldState, route: string[], id = 'school-dispatch'): ApprovedCommand {
  return { id, expectedRevision: state.revision, reserveMinimum: 1,
    actions: [{ vehicleId: 'V1', requestId: 'school', quantity: 6, route: [...route] }] };
}
