import { scenarioSchema, type Scenario } from '@crisiscraft/contracts';
import harborPointData from '../../../scenarios/harbor-point.json';
import regionData from '../../../scenarios/harbor-point-region.json';

export function parseScenario(input: unknown): Scenario {
  const s = scenarioSchema.parse(input);
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} ID`);
  };
  unique(s.nodes.map(n => n.id), 'node');
  unique(s.edges.map(e => e.id), 'edge');
  unique(s.edges.map(e => [e.mode ?? 'road', e.from, e.to].sort().join('/')), 'road endpoints');
  unique(s.vehicles.map(v => v.id), 'vehicle');
  unique(s.requests.map(r => r.id), 'request');
  unique([...s.events.map(e => e.id), ...s.observations.map(o => o.id)], 'external event');
  const nodes = new Set(s.nodes.map(n => n.id));
  const edges = new Set(s.edges.map(e => e.id));
  if (!nodes.has(s.depot) || s.reserveMinimum > s.vehicles.length || s.checkpointTick > s.horizon) {
    throw new Error('Invalid depot, reserve or checkpoint');
  }
  for (const e of s.edges) {
    if (!nodes.has(e.from) || !nodes.has(e.to) || e.from === e.to) throw new Error('Invalid road endpoint');
  }
  for (const r of s.requests) {
    if (!nodes.has(r.destination) || r.dueTick < r.openedTick || r.openedTick > s.horizon) {
      throw new Error('Invalid request destination or timing');
    }
  }
  for (const e of s.events) {
    if (e.tick > s.horizon || ('edgeId' in e ? !edges.has(e.edgeId) : !nodes.has(e.nodeId))) {
      throw new Error('Invalid scenario event');
    }
  }
  for (const o of s.observations) {
    if (o.observedTick > o.receivedTick || o.receivedTick > s.horizon) throw new Error('Invalid observation timing');
  }
  return s;
}

export const harborPoint = parseScenario(harborPointData);
export const harborRegion = parseScenario(regionData);

/** Every playable scenario, tutorial first. */
export const scenarios: Scenario[] = [harborPoint, harborRegion];
export function scenarioById(id: string): Scenario {
  const found = scenarios.find(s => s.id === id);
  if (!found) throw new Error(`Unknown scenario ${id}`);
  return found;
}
