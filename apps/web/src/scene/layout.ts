import type { Scenario, WorldState } from "@crisiscraft/contracts";
import { harborPoint, harborRegion, scenarioById } from "@crisiscraft/sim";

/** Shared Harbor Point geography. Road nodes come from the scenario; everything else is scenery. */
export type Point = [number, number, number];

/** The scenario a run belongs to; the scene draws whichever one the state carries. */
export const scenarioOf = (state: Pick<WorldState, "scenarioId">): Scenario => scenarioById(state.scenarioId);
export const isRegion = (scenario: Scenario) => scenario.id === harborRegion.id;

export const GROUND = 0.15;
export const BRIDGE_DECK = 0.55;
/** The river runs north into the harbour between these x bounds, for z below RIVER_END. */
export const RIVER = { west: -1.4, east: 2.4, end: 0.2 };

export function node(id: string, scenario: Scenario = harborPoint): Point {
  const n = scenario.nodes.find((candidate) => candidate.id === id)!;
  return [n.x, GROUND, n.z];
}

/** Building footprints sit beside their road node so trucks stop at the kerb. */
export const sites = {
  D: { at: [-8.6, GROUND, 1.2] as Point, turn: 0 },
  S: { at: [7.6, GROUND, -5.6] as Point, turn: 0 },
  E: { at: [8.9, GROUND, 8.4] as Point, turn: Math.PI },
} as const;

/** Landmark lots for the regional drill, each beside its road node. */
export const regionSites = {
  P: { at: [-55.4, GROUND, 3.1] as Point, turn: 0 },
  C: { at: [32.2, GROUND, -8.4] as Point, turn: -Math.PI / 2 },
  S: { at: [-17.6, GROUND, 50.2] as Point, turn: Math.PI },
  H: { at: [-9.6, GROUND, 58.4] as Point, turn: 0 },
  V: { at: [-17.5, GROUND, -46.1] as Point, turn: 0 },
} as const;

/** Crew stand a little apart from their landmark so name chips never sit on the place chips. */
export const crewSpots = {
  logistics: [-6.0, GROUND, 2.4] as Point,
  shelter: [4.3, GROUND, -1.7] as Point,
  field: [-4.7, GROUND, -2.1] as Point,
} as const;
export const regionCrewSpots = {
  logistics: [-53.2, GROUND, 5.6] as Point,
  shelter: [-14.8, GROUND, 48.4] as Point,
  field: [-15.2, GROUND, -9.4] as Point,
} as const;
export const crewSpotsFor = (scenario: Scenario) => (isRegion(scenario) ? regionCrewSpots : crewSpots);

/** The original playable town; outer districts never place scenery inside it. */
export const CORE = { x0: -13.6, x1: 13.6, z0: -10.5, z1: 13.0 };
/** Shoreline: land ends at z = HARBOUR; everything north of it is sea. */
export const HARBOUR = -12;
export const WORLD = 260;

/** Secondary (non-gameplay) streets as axis-aligned rectangles [x0, x1, z0, z1]. */
export const streets: [number, number, number, number][] = [
  [-41.2, -7.7, 3.75, 4.65], // Quay Street, west to the warehouses
  [12.2, 38, -3.45, -2.55], // Harbour Street, the shopping street
  [18.55, 19.45, -10.6, 13.15], // Chapel Lane
  [28.55, 29.45, -10.6, 13.15], // Market Lane
  [-41.2, 38, 13.15, 14.05], // Ring Road
  [-24.45, -23.55, -10.6, 13.15], // Dock Road
  [-17.95, -17.05, -10.6, 3.75], // Yard Lane
  [-25.45, -24.55, 14.05, 34], // south grid
  [-15.45, -14.55, 14.05, 34],
  [-6.25, -5.35, 14.05, 34],
  [-38, 4.5, 21.35, 22.25],
  [-38, 4.5, 29.55, 30.45],
  // Outskirts: the west road to the port, the station road and the south road along the railway.
  [-41.2, -39.8, -0.9, 61.5], // West Road
  [-96, -41.2, -0.9, 0], // Port Road
  [-6.25, -5.35, 34, 60.6], // Station Road
  [-100, 100, 60.6, 61.5], // South Road
];
/** The railway runs east–west behind the South Road. */
export const RAIL_Z = 66;
export const onStreet = (x: number, z: number, pad = 0) =>
  streets.some(([x0, x1, z0, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad);

/** Small deterministic hash so scenery placement is stable between renders and screenshots. */
export function rand(seed: number) {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Distance from point p to the segment ab in the ground plane. */
export function distanceToSegment(px: number, pz: number, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[2]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[2] + dz * t));
}

/** Gameplay roads of every scenario, so the shared scenery stays clear of whichever is played. */
export const roadSegments = [harborPoint, harborRegion].flatMap((s) =>
  s.edges.map((e) => ({ id: `${s.id}:${e.id}`, a: node(e.from, s), b: node(e.to, s) })),
);

/** True when a scenery item at (x, z) would sit on a road, river, or building lot. */
export function blocked(x: number, z: number, clearance = 1.1) {
  if (x > RIVER.west - 0.6 && x < RIVER.east + 0.6 && z < RIVER.end + 0.6) return true;
  if (roadSegments.some((s) => distanceToSegment(x, z, s.a, s.b) < clearance)) return true;
  if (onStreet(x, z, 0.5)) return true;
  return [...Object.values(sites), ...Object.values(regionSites)].some((s) => Math.abs(x - s.at[0]) < 2.8 && Math.abs(z - s.at[2]) < 2.6);
}

/** The raised span of the north bridge (edge JS, along z = -3). */
export const BRIDGE = { x0: RIVER.west - 0.5, x1: RIVER.east + 0.5, ramp: 0.9, z: -3 };

/** Road surface height, so vehicles climb onto the bridge deck instead of clipping through it. */
export function roadHeight(x: number, z: number) {
  if (Math.abs(x - CAUSEWAY.x) < CAUSEWAY.width / 2 + 0.1 && z < CAUSEWAY.z0 + CAUSEWAY.ramp && z > CAUSEWAY.z1 - CAUSEWAY.ramp) {
    const inside = Math.min(CAUSEWAY.z0 + CAUSEWAY.ramp - z, z - (CAUSEWAY.z1 - CAUSEWAY.ramp));
    return GROUND + (CAUSEWAY.deck - GROUND) * Math.min(1, inside / CAUSEWAY.ramp);
  }
  if (Math.abs(z - BRIDGE.z) > 0.6) return GROUND;
  const inside = Math.min(x - (BRIDGE.x0 - BRIDGE.ramp), BRIDGE.x1 + BRIDGE.ramp - x);
  if (inside <= 0) return GROUND;
  return GROUND + (BRIDGE_DECK - GROUND) * Math.min(1, inside / BRIDGE.ramp);
}

export const waterLevel =(tick: number) => -0.32 + Math.min(tick, 15) * 0.022;
/** The flood visuals were tuned on a 15-minute clock; longer drills rise over their whole run. */
export const floodClock = (scenario: Scenario, tick: number) => (tick * 15) / scenario.horizon;
/** The causeway across the bay in the regional drill (edge XV). */
export const CAUSEWAY = { x: -17.5, z0: -11.6, z1: -42.6, width: 1.3, deck: 0.3, ramp: 1.4 };
