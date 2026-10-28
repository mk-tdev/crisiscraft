import { z } from 'zod';

export const roleSchema = z.enum(['logistics', 'shelter', 'field']);
export type Role = z.infer<typeof roleSchema>;
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/)
  .refine(value => !Object.hasOwn(Object.prototype, value), 'Reserved identifier');
const tick = z.number().int().nonnegative();

export const dispatchSchema = z.object({
  vehicleId: id,
  requestId: id,
  quantity: z.number().int().positive(),
  route: z.array(id).min(2).max(30),
}).strict();

export const commandSchema = z.object({
  id,
  expectedRevision: tick,
  reserveMinimum: tick,
  actions: z.array(dispatchSchema).min(1).max(2),
}).strict();
export type Dispatch = z.infer<typeof dispatchSchema>;
export type ApprovedCommand = z.infer<typeof commandSchema>;

export const observationSchema = z.object({
  id,
  entityId: id,
  fact: z.string().min(1).max(400),
  observedTick: tick,
  receivedTick: tick,
  audience: z.array(z.enum(['public', 'logistics', 'shelter', 'field'])).min(1),
}).strict();
export type Observation = z.infer<typeof observationSchema>;

const requestSchema = z.object({
  id, destination: id, quantity: z.number().int().positive(), openedTick: tick, dueTick: tick,
}).strict();
export type SupplyRequest = z.infer<typeof requestSchema>;

export const scenarioSchema = z.object({
  id, version: id, name: z.string().min(1).max(100),
  horizon: z.number().int().positive(), checkpointTick: tick, depot: id,
  stock: z.number().int().nonnegative(), reserveMinimum: tick,
  nodes: z.array(z.object({
    id, label: z.string().min(1).max(100), x: z.number().finite(), z: z.number().finite(),
    kind: z.enum(['depot', 'shelter', 'junction']), receiving: z.boolean(),
  }).strict()).min(1),
  edges: z.array(z.object({
    id, from: id, to: id, minutes: z.number().int().positive(),
  }).strict()).min(1),
  vehicles: z.array(z.object({ id, capacity: z.number().int().positive() }).strict()).min(1),
  requests: z.array(requestSchema),
  observations: z.array(observationSchema),
  events: z.array(z.discriminatedUnion('type', [
    z.object({ id, tick, type: z.literal('close-road'), edgeId: id }).strict(),
    z.object({ id, tick, type: z.literal('receiving'), nodeId: id, enabled: z.boolean() }).strict(),
  ])),
}).strict();
export type Scenario = z.infer<typeof scenarioSchema>;

export type VehicleStatus = 'idle' | 'travelling' | 'waiting' | 'stranded' | 'delivered';
export interface VehicleState {
  id: string;
  capacity: number;
  node: string;
  cargo: number;
  status: VehicleStatus;
  requestId: string | null;
  route: string[];
  leg: { edgeId: string; from: string; to: string; enteredTick: number; arrivalTick: number } | null;
}
export interface RequestState extends SupplyRequest {
  delivered: number;
  completedTick: number | null;
}
export interface SimEvent {
  id: string;
  tick: number;
  sequence: number;
  type: 'request-opened' | 'road-closed' | 'receiving-changed' | 'observation-received'
    | 'dispatched' | 'edge-entered' | 'edge-arrived' | 'rerouted' | 'stranded' | 'delivered';
  message: string;
  causeId: string | null;
  data: Record<string, string | number | boolean | string[]>;
}
export interface WorldState {
  scenarioId: string;
  scenarioVersion: string;
  tick: number;
  revision: number;
  stock: number;
  initialStock: number;
  reserveMinimum: number;
  roads: Record<string, boolean>;
  receiving: Record<string, boolean>;
  vehicles: Record<string, VehicleState>;
  requests: Record<string, RequestState>;
  observations: Observation[];
  appliedExternalIds: string[];
  commands: { tick: number; command: ApprovedCommand }[];
  events: SimEvent[];
  totals: { crateWaitingMinutes: number; vehicleTravelMinutes: number; reserveViolationTicks: number };
}
export type ErrorCode = 'MALFORMED_COMMAND' | 'STALE_REVISION' | 'DUPLICATE_COMMAND'
  | 'INVALID_PLAN' | 'HORIZON_REACHED' | 'INVALID_TICK' | 'INVALID_CHECKPOINT';
export class SimulationError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'SimulationError';
  }
}
