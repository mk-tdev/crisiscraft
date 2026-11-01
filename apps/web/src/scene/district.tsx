import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  type Group,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  IcosahedronGeometry,
  type Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import { useProp, useSurface, type Prop } from "./assets";
import { CORE, GROUND, HARBOUR, type Point, RIVER, onStreet, rand, streets, waterLevel } from "./layout";
import { Instances, type Placement, flatQuads, roofGeometry, useFacade, wallGeometry } from "./instancing";
import { Person, look } from "./people";
import { signTexture } from "./text";
import { BOAT_DECK, type BoatModel, boatModel, carModels } from "./models";

/* ------------------------------------------------------------------ geography */

export const walls = ["#efe6d4", "#e7d6c4", "#d8e1e2", "#e9d9b7", "#dfe6d6", "#f1ddd2", "#d6dde8", "#e8cfc0", "#cfd8cf"];
const roofs = ["#b9705f", "#8a96a3", "#6f7c86", "#a45f4f", "#5d6b74", "#c48a6a"];
export const carPaint = ["#e5484d", "#2f6fe4", "#f4f4f5", "#27272a", "#9aa3ab", "#2f9e6b", "#e8a317", "#7c4ddb", "#5b7fa3", "#c7c2b8"];
export const hullPaint = ["#f4f2ec", "#d9634a", "#3f6c8f", "#2f9e6b", "#e8e3d6", "#24303d"];

/** Hillside south-east of the hill road: a soft rise that never covers a street or the core. */
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function hillHeight(x: number, z: number) {
  const main = 6.2 * Math.exp(-(((x - 24) / 11) ** 2 + ((z - 33) / 8.5) ** 2) / 2);
  const shoulder = 3.2 * Math.exp(-(((x - 42) / 9) ** 2 + ((z - 22) / 7) ** 2) / 2);
  return (main + shoulder) * smooth(15, 20, z) * smooth(5, 10, x);
}

/** Paved or built lots (plaza, town hall, church, warehouses, container yard, fountain) where no tree grows. */
const lots: [number, number, number, number][] = [
  [19.4, 28.6, -2.6, 6.2], [31.4, 35.2, 1.4, 7.0], [-34, -17.5, -10.6, 3.5], [-17, -12.8, -10.6, -5.8], [-2.6, 1.2, 15.8, 19.6],
  [12.2, 37.5, -10.6, -0.4],
];
const onLot = (x: number, z: number) => lots.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);

const inCore = (x: number, z: number, pad = 0) =>
  x > CORE.x0 - pad && x < CORE.x1 + pad && z > CORE.z0 - pad && z < CORE.z1 + pad;

export interface Building extends Placement {
  floors: number;
  width: number;
  depth: number;
  roof: "gable" | "flat";
}

/** Lines of houses along a street edge, skipping cross streets and anything in `skip`. */
function row(
  out: Building[],
  { x0, x1, z, turn, seed, step = 2.15, floors = [1, 2], skip }: {
    x0: number; x1: number; z: number; turn: number; seed: number; step?: number; floors?: number[];
    skip?: (x: number, z: number) => boolean;
  },
) {
  for (let x = x0, i = 0; x <= x1; x += step, i++) {
    const s = seed + i * 13;
    const width = 1.35 + rand(s) * 0.45;
    if (onStreet(x, z, width / 2 + 0.35) || inCore(x, z, 0.8) || skip?.(x, z)) continue;
    const f = floors[Math.floor(rand(s + 1) * floors.length)]!;
    out.push({
      at: [x + (rand(s + 2) - 0.5) * 0.2, GROUND, z],
      turn,
      floors: f,
      width,
      depth: 1.15 + rand(s + 3) * 0.3,
      roof: f >= 3 ? "flat" : "gable",
      color: walls[Math.floor(rand(s + 4) * walls.length)],
    });
  }
}

function layoutTown(compact: boolean) {
  const houses: Building[] = [];
  const parkSkip = (x: number, z: number) => x > -6 && x < 4.6 && z > 14 && z < 21.4;
  const hillSkip = (x: number, z: number) => hillHeight(x, z) > 0.12;
  const skip = (x: number, z: number) => parkSkip(x, z) || hillSkip(x, z);
  // West residential, between Quay Street and the Ring Road.
  row(houses, { x0: -36.5, x1: -12, z: 5.9, turn: Math.PI, seed: 1 });
  row(houses, { x0: -36, x1: -12, z: 11.6, turn: 0, seed: 2 });
  row(houses, { x0: -36.2, x1: -12, z: 8.75, turn: Math.PI, seed: 3, floors: [2, 3] });
  // South grid either side of each street.
  for (const [z, seed] of [[15.5, 4], [20.0, 5], [23.6, 6], [28.2, 7], [31.8, 8]] as const) {
    if (compact && z > 22) continue;
    row(houses, { x0: -36.5, x1: 4, z, turn: seed % 2 ? 0 : Math.PI, seed, skip });
  }
  // East residential behind the town hall and along the Ring Road.
  row(houses, { x0: 12.6, x1: 37, z: 11.6, turn: 0, seed: 9, skip: (x) => x > 30.5 && x < 35.5 });
  row(houses, { x0: 12.6, x1: 18, z: 8.6, turn: Math.PI, seed: 10 });
  row(houses, { x0: 20.4, x1: 27.8, z: 8.6, turn: Math.PI, seed: 11, floors: [2, 3] });
  if (!compact) row(houses, { x0: 39.5, x1: 50, z: 11.6, turn: 0, seed: 12, skip });

  // Harbour Street shops: three-storey fronts both sides, lit shop windows at street level.
  const shops: Building[] = [];
  const shop = (x: number, z: number, turn: number, i: number) => {
    if (Math.abs(x - 19) < 1.45 || Math.abs(x - 29) < 1.45 || inCore(x, z, 0.5)) return;
    shops.push({ at: [x, GROUND, z], turn, floors: 3, width: 1.7, depth: 1.5, roof: "flat", color: walls[(i * 5) % walls.length] });
  };
  for (let x = 13.2, i = 0; x < 37.5; x += 1.95, i++) shop(x, -4.62, 0, i);
  for (let x = 13.2, i = 3; x < 18.2; x += 1.95, i++) shop(x, -1.38, Math.PI, i);
  for (let x = 30.4, i = 7; x < 37.5; x += 1.95, i++) shop(x, -1.38, Math.PI, i);

  // Warehouses near the depot and docks.
  const sheds: Placement[] = [];
  for (const [x, z, w, d] of [
    [-21, -7.6, 4.6, 3.2],
    [-30.5, -7.8, 6, 3.4],
    [-30.5, -1.6, 6, 3.8],
    [-20.8, -1.2, 4.4, 3.8],
    [-35.6, 1.6, 2.4, 3],
  ] as const) {
    sheds.push({ at: [x, GROUND, z], scale: [w, 1, d], color: ["#9fb0b8", "#b8a58f", "#8fa3ad", "#a9b4a2"][Math.floor(rand(x) * 4)] });
  }
  return { houses, shops, sheds };
}

/* ------------------------------------------------------------------ streets */

function Streets() {
  const asphalt = useSurface("asphalt_02", 1, 1);
  const concrete = useSurface("brushed_concrete", 1, 1);
  const pavements = useMemo(() => streets.map(([x0, x1, z0, z1]) => [x0 - 0.32, x1 + 0.32, z0 - 0.32, z1 + 0.32] as [number, number, number, number]), []);
  const geometry = useMemo(
    () => ({
      road: flatQuads(streets, GROUND + 0.008, 0.6),
      pavement: flatQuads(pavements, GROUND + 0.004, 0.8),
      // Waterfront promenade, split by the river mouth.
      promenade: flatQuads([[-38, RIVER.west - 0.2, HARBOUR + 0.2, HARBOUR + 1.35], [RIVER.east + 0.2, 38, HARBOUR + 0.2, HARBOUR + 1.35]], GROUND + 0.005, 0.7),
      plaza: flatQuads([[19.7, 28.3, -2.3, 2.2]], GROUND + 0.006, 0.9),
    }),
    [pavements],
  );
  return (
    <>
      <mesh geometry={geometry.pavement} receiveShadow>
        <meshStandardMaterial map={concrete.map} normalMap={concrete.normalMap} color="#d6d2ca" roughness={0.9} />
      </mesh>
      <mesh geometry={geometry.road} receiveShadow>
        <meshStandardMaterial map={asphalt.map} normalMap={asphalt.normalMap} roughnessMap={asphalt.roughnessMap} color="#7d8285" polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh geometry={geometry.promenade} receiveShadow>
        <meshStandardMaterial map={concrete.map} normalMap={concrete.normalMap} color="#cbc4b6" roughness={0.85} />
      </mesh>
      <mesh geometry={geometry.plaza} receiveShadow>
        <meshStandardMaterial map={concrete.map} normalMap={concrete.normalMap} color="#e2d8c6" roughness={0.8} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ buildings */

export function HouseInstances({ items, shadows }: { items: Building[]; shadows: boolean }) {
  const house = useFacade("house", 3);
  const block = useFacade("block", 7);
  const plaster = useSurface("painted_plaster_wall", 1, 1);
  const tiles = useSurface("grey_roof_tiles", 1, 1);
  const res = useMemo(() => {
    const roofTop = new MeshStandardMaterial({ color: "#8d918f", roughness: 0.9 });
    const facade = (f: typeof house) =>
      new MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: "#ffffff", emissiveIntensity: 0.85, normalMap: plaster.normalMap, roughness: 0.92 });
    const houseMat = facade(house);
    const blockMat = facade(block);
    const roofMat = new MeshStandardMaterial({ map: tiles.map, normalMap: tiles.normalMap, roughness: 0.85 });
    const byFloors = new Map<number, BoxGeometry>();
    const wall = (floors: number) => {
      if (!byFloors.has(floors)) byFloors.set(floors, wallGeometry(floors * 0.62 + 0.1, floors / 2));
      return byFloors.get(floors)!;
    };
    return { roofTop, houseMat, blockMat, roofMat, wall, prism: roofGeometry() };
  }, [house, block, plaster, tiles]);
  const groups = useMemo(() => {
    const byKey = new Map<string, Building[]>();
    for (const b of items) {
      const key = `${b.roof}-${b.floors}`;
      byKey.set(key, [...(byKey.get(key) ?? []), b]);
    }
    return [...byKey.entries()];
  }, [items]);
  const gableRoofs = useMemo(
    () =>
      items
        .filter((b) => b.roof === "gable")
        .map((b, i) => ({
          at: [b.at[0], GROUND + b.floors * 0.62 + 0.1, b.at[2]] as Point,
          turn: b.turn,
          scale: [b.width + 0.16, 0.42 + rand(i * 9) * 0.15, b.depth + 0.16] as [number, number, number],
          color: roofs[Math.floor(rand(i * 17 + 3) * roofs.length)],
        })),
    [items],
  );
  const chimneys = useMemo(
    () =>
      items
        .filter((b, i) => b.roof === "gable" && rand(i * 23) > 0.45)
        .map((b) => ({
          at: [b.at[0] + Math.cos(b.turn ?? 0) * b.width * 0.25, GROUND + b.floors * 0.62 + 0.25, b.at[2] - Math.sin(b.turn ?? 0) * b.width * 0.25] as Point,
          scale: [0.15, 0.5, 0.15] as [number, number, number],
          color: "#8d867c",
        })),
    [items],
  );
  const box = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const chimneyMat = useMemo(() => new MeshStandardMaterial({ roughness: 0.9 }), []);
  return (
    <>
      {groups.map(([key, list]) => {
        const floors = list[0]!.floors;
        const material = floors >= 3 ? res.blockMat : res.houseMat;
        return (
          <Instances
            key={key}
            geometry={res.wall(floors)}
            material={[material, material, res.roofTop, res.roofTop, material, material]}
            items={list.map((b) => ({ ...b, scale: [b.width, 1, b.depth] }))}
            shadows={shadows}
          />
        );
      })}
      <Instances geometry={res.prism} material={res.roofMat} items={gableRoofs} shadows={shadows} />
      <Instances geometry={box} material={chimneyMat} items={chimneys} shadows={false} />
    </>
  );
}

const shopNames = [
  "SALT & CRUMB", "HARBOUR BOOKS", "GULL HARDWARE", "PIER PHARMACY", "THE ANCHOR", "DRIFTWOOD CAFÉ",
  "NET & NEEDLE", "LANTERN GROCER", "BLUEFIN FISH", "TIDE TOYS", "COVE BIKES", "MARINER'S INN",
];
const awningColours = ["#d24f0e", "#2f6fe4", "#2f9e6b", "#7c4ddb", "#e5484d", "#e8a317", "#3f4a55"];

function Shops({ items, shadows }: { items: Building[]; shadows: boolean }) {
  const facade = useFacade("shop", 11);
  const plaster = useSurface("painted_plaster_wall", 1, 1);
  const res = useMemo(() => {
    const mat = new MeshStandardMaterial({ map: facade.map, emissiveMap: facade.emissiveMap, emissive: "#ffffff", emissiveIntensity: 0.9, normalMap: plaster.normalMap, roughness: 0.9 });
    const top = new MeshStandardMaterial({ color: "#9a9d9b", roughness: 0.9 });
    const cornice = new MeshStandardMaterial({ color: "#f1ede4", roughness: 0.8 });
    const awning = new MeshStandardMaterial({ roughness: 0.7 });
    return { mat, top, cornice, awning, wall: wallGeometry(3 * 0.62 + 0.25, 1), box: new BoxGeometry(1, 1, 1) };
  }, [facade, plaster]);
  const front = (b: Building, out: number, y: number): Point => {
    const t = b.turn ?? 0;
    return [b.at[0] + Math.sin(t) * out, y, b.at[2] + Math.cos(t) * out];
  };
  const awnings = useMemo(
    () => items.map((b, i) => ({ at: front(b, b.depth / 2 + 0.22, GROUND + 0.62), turn: b.turn, scale: [b.width * 0.92, 0.05, 0.45] as [number, number, number], color: awningColours[i % awningColours.length] })),
    [items],
  );
  const cornices = useMemo(
    () => items.map((b) => ({ at: [b.at[0], GROUND + 3 * 0.62 + 0.3, b.at[2]] as Point, turn: b.turn, scale: [b.width + 0.08, 0.1, b.depth + 0.08] as [number, number, number] })),
    [items],
  );
  return (
    <>
      <Instances geometry={res.wall} material={[res.mat, res.mat, res.top, res.top, res.mat, res.mat]} items={items.map((b) => ({ ...b, scale: [b.width, 1, b.depth] }))} shadows={shadows} />
      <Instances geometry={res.box} material={res.awning} items={awnings} shadows={false} />
      <Instances geometry={res.box} material={res.cornice} items={cornices} shadows={false} />
      {items.slice(0, shopNames.length).map((b, i) => (
        <mesh key={i} position={front(b, b.depth / 2 + 0.03, GROUND + 0.86)} rotation={[0, b.turn ?? 0, 0]}>
          <planeGeometry args={[b.width * 0.8, b.width * 0.16]} />
          <meshStandardMaterial
            map={signTexture(shopNames[i]!, "#18181b", "#f4efe6", 512, 96)}
            emissive="#ffffff"
            emissiveMap={signTexture(shopNames[i]!, "#18181b", "#f4efe6", 512, 96)}
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
    </>
  );
}

function Warehouses({ items, shadows }: { items: Placement[]; shadows: boolean }) {
  const iron = useSurface("corrugated_iron", 4, 1);
  const res = useMemo(
    () => ({
      wall: new BoxGeometry(1, 1.5, 1).translate(0, 0.75, 0),
      prism: roofGeometry(),
      walls: new MeshStandardMaterial({ map: iron.map, normalMap: iron.normalMap, metalness: 0.35, roughness: 0.55 }),
      roof: new MeshStandardMaterial({ map: iron.map, normalMap: iron.normalMap, color: "#6d7c86", metalness: 0.4, roughness: 0.5 }),
    }),
    [iron],
  );
  const roofsOn = useMemo(
    () => items.map((p) => ({ at: [p.at[0], GROUND + 1.5, p.at[2]] as Point, scale: [p.scale![0] + 0.12, 0.45, p.scale![2] + 0.12] as [number, number, number] })),
    [items],
  );
  return (
    <>
      <Instances geometry={res.wall} material={res.walls} items={items} shadows={shadows} />
      <Instances geometry={res.prism} material={res.roof} items={roofsOn} shadows={shadows} />
      {items.slice(0, 3).map((p, i) => (
        <mesh key={i} position={[p.at[0] - p.scale![0] * 0.2, GROUND + 1.25, p.at[2] + p.scale![2] / 2 + 0.02]}>
          <planeGeometry args={[1.6, 0.3]} />
          <meshStandardMaterial map={signTexture(["HARBOR FREIGHT CO.", "COLD STORE 2", "NET LOFT"][i]!, "#2f3a40", "#f4efe6", 512, 96)} />
        </mesh>
      ))}
    </>
  );
}

/** Shipping containers stacked on the west quay. */
function Containers() {
  const items = useMemo(() => {
    const out: Placement[] = [];
    const colours = ["#d24f0e", "#2f6fe4", "#2f9e6b", "#a63d33", "#e8a317", "#5b7fa3", "#7a8a96"];
    let i = 0;
    for (let x = -16.4; x < -13.4; x += 0.98) {
      for (let z = -10.2; z < -7.4; z += 0.42) {
        const layers = 1 + Math.floor(rand(i * 7) * 3);
        for (let y = 0; y < layers; y++, i++) {
          out.push({ at: [x, GROUND + y * 0.38, z], scale: [0.92, 0.37, 0.38], color: colours[Math.floor(rand(i * 3 + 1) * colours.length)] });
        }
      }
    }
    return out;
  }, []);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 }), []);
  return <Instances geometry={geometry} material={material} items={items} />;
}

function Gable({ width, depth, rise, colour }: { width: number; depth: number; rise: number; colour: string }) {
  const prism = useMemo(() => roofGeometry(), []);
  return (
    <mesh geometry={prism} scale={[width, rise, depth]} castShadow>
      <meshStandardMaterial color={colour} roughness={0.8} />
    </mesh>
  );
}

function TownHall() {
  const stone = useSurface("painted_plaster_wall", 2, 1);
  const clock = useMemo(() => {
    const t = signTexture("12", "#f4efe6", "#18181b", 128, 128);
    return t;
  }, []);
  return (
    <group position={[24, GROUND, 4.3]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 2, 2.6]} />
        <meshStandardMaterial {...stone} color="#ece4d4" />
      </mesh>
      <mesh position={[0, 2.06, 0]} castShadow>
        <boxGeometry args={[5.2, 0.14, 2.8]} />
        <meshStandardMaterial color="#d9cfbd" />
      </mesh>
      {/* Portico: columns, pediment and steps facing the plaza. */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-1.6 + i * 0.64, 0.9, 1.65]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 1.6, 12]} />
          <meshStandardMaterial color="#f6f1e6" />
        </mesh>
      ))}
      <group position={[0, 1.72, 1.65]}>
        <Gable width={3.9} depth={0.7} rise={0.55} colour="#efe8da" />
      </group>
      <mesh position={[0, 0.08, 2.2]} receiveShadow>
        <boxGeometry args={[3.6, 0.16, 0.9]} />
        <meshStandardMaterial color="#d6cfc2" />
      </mesh>
      <mesh position={[0, 1.15, 1.32]}>
        <planeGeometry args={[2.4, 0.28]} />
        <meshStandardMaterial map={signTexture("HARBOR POINT TOWN HALL", "#efe8da", "#3a3530", 512, 64)} />
      </mesh>
      {/* Clock tower. */}
      <mesh position={[0, 2.9, -0.2]} castShadow>
        <boxGeometry args={[1.1, 1.6, 1.1]} />
        <meshStandardMaterial {...stone} color="#e4dccb" />
      </mesh>
      <mesh position={[0, 3.15, 0.36]}>
        <circleGeometry args={[0.36, 32]} />
        <meshStandardMaterial map={clock} emissive="#ffffff" emissiveMap={clock} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 4.05, -0.2]} castShadow>
        <coneGeometry args={[0.85, 0.75, 4]} />
        <meshStandardMaterial color="#5d7a74" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Flagpole on the plaza. */}
      <mesh position={[0, 1.3, 4.6]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.6, 8]} />
        <meshStandardMaterial color="#c7ccd0" metalness={0.6} />
      </mesh>
      <mesh position={[0.32, 2.35, 4.6]}>
        <boxGeometry args={[0.6, 0.36, 0.01]} />
        <meshStandardMaterial color="#2f6fe4" />
      </mesh>
    </group>
  );
}

function Church() {
  const stone = useSurface("brick_wall_001", 2, 1.4);
  return (
    <group position={[33.2, GROUND, 4.2]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.9, -0.4]} castShadow receiveShadow>
        <boxGeometry args={[2.1, 1.8, 3.6]} />
        <meshStandardMaterial {...stone} color="#d9cdbd" />
      </mesh>
      <group position={[0, 1.8, -0.4]}>
        <Gable width={2.3} depth={3.8} rise={1.0} colour="#5d6b74" />
      </group>
      <mesh position={[0, 1.6, 1.75]} castShadow>
        <boxGeometry args={[1, 3.2, 1]} />
        <meshStandardMaterial {...stone} color="#d2c5b3" />
      </mesh>
      <mesh position={[0, 4.0, 1.75]} castShadow>
        <coneGeometry args={[0.72, 1.8, 4]} />
        <meshStandardMaterial color="#4f5d66" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 2.26]}>
        <circleGeometry args={[0.22, 24]} />
        <meshStandardMaterial color="#ffd98f" emissive="#ffbe62" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ park */

function PropAt({ name, height, at, turn = 0 }: { name: Prop; height: number; at: Point; turn?: number }) {
  const object = useProp(name, height);
  return <primitive object={object} position={at} rotation={[0, turn, 0]} />;
}

function Fountain() {
  const water = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.emissiveIntensity = 0.15 + Math.sin(clock.elapsedTime * 2) * 0.05;
  });
  return (
    <group position={[-0.7, GROUND, 17.7]}>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.05, 0.24, 32]} />
        <meshStandardMaterial color="#cfc8bb" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshStandardMaterial ref={water} color="#6f8f92" emissive="#9cc2c6" roughness={0.1} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 0.6, 16]} />
        <meshStandardMaterial color="#d9d2c4" />
      </mesh>
    </group>
  );
}

function Park({ compact }: { compact: boolean }) {
  const grass = useSurface("leafy_grass", 4, 3);
  const paths = useMemo(() => flatQuads([[-5.3, 3.9, 17.4, 18.0], [-1.0, -0.4, 14.3, 21.1]], GROUND + 0.012, 0.8), []);
  const concrete = useSurface("brushed_concrete", 1, 1);
  const flowers = useMemo(() => {
    const out: Placement[] = [];
    const colours = ["#e5484d", "#e8a317", "#f4f4f5", "#7c4ddb", "#f2611d"];
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2;
      const r = 1.35 + rand(i) * 0.25;
      out.push({ at: [-0.7 + Math.cos(a) * r, GROUND + 0.01, 17.7 + Math.sin(a) * r], scale: [0.12, 0.08 + rand(i * 3) * 0.06, 0.12], color: colours[i % colours.length] });
    }
    return out;
  }, []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const mat = useMemo(() => new MeshStandardMaterial({ roughness: 0.8 }), []);
  return (
    <group>
      <mesh position={[-0.7, GROUND + 0.006, 17.75]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9.6, 7.0]} />
        <meshStandardMaterial {...grass} color="#b9d39a" polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh geometry={paths} receiveShadow>
        <meshStandardMaterial map={concrete.map} color="#e3dccd" polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <Fountain />
      <Instances geometry={box} material={mat} items={flowers} shadows={false} />
      {!compact &&
        [
          [-3.2, 16.9, 0],
          [1.8, 18.6, Math.PI],
          [-1.6, 15.2, Math.PI / 2],
        ].map(([x, z, t], i) => <PropAt key={i} name="painted_wooden_bench" height={0.13} at={[x!, GROUND, z!]} turn={t} />)}
    </group>
  );
}

/* ------------------------------------------------------------------ trees and hill */

export function Trees({ items, conifer }: { items: Placement[]; conifer: boolean }) {
  const res = useMemo(
    () => ({
      trunk: new CylinderGeometry(0.05, 0.08, 0.7, 6).translate(0, 0.35, 0),
      crown: conifer ? new ConeGeometry(0.5, 1.5, 7).translate(0, 1.25, 0) : new IcosahedronGeometry(0.55, 1).translate(0, 1.05, 0),
      bark: new MeshStandardMaterial({ color: "#6b5544", roughness: 1 }),
      leaves: new MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
    }),
    [conifer],
  );
  return (
    <>
      <Instances geometry={res.trunk} material={res.bark} items={items} shadows={false} />
      <Instances geometry={res.crown} material={res.leaves} items={items} />
    </>
  );
}

function Hill() {
  const grass = useSurface("leafy_grass", 18, 14);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(56, 44, 84, 66).rotateX(-Math.PI / 2).translate(28 + 3, 0, 22 + 12);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const n = (rand(Math.floor(x * 3) * 97 + Math.floor(z * 3)) - 0.5) * 0.12;
      p.setY(i, GROUND - 0.06 + hillHeight(x, z) + (hillHeight(x, z) > 0.2 ? n : 0));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial {...grass} color="#a9c48f" roughness={0.95} />
    </mesh>
  );
}

function useTrees(compact: boolean, houses: Building[]) {
  return useMemo(() => {
    const greens = ["#3f6b3d", "#4c7a45", "#365e3a", "#5a8250", "#2f5534"];
    const conifers: Placement[] = [];
    const broadleaf: Placement[] = [];
    const nearHouse = (x: number, z: number) => houses.some((h) => Math.abs(h.at[0] - x) < 1.3 && Math.abs(h.at[2] - z) < 1.2);
    // Dense forest on the hillside.
    for (let i = 0; conifers.length < (compact ? 90 : 340) && i < 6000; i++) {
      const x = 4 + rand(i * 2 + 501) * 50;
      const z = 15 + rand(i * 5 + 503) * 40;
      const h = hillHeight(x, z);
      if (h < 0.35 && rand(i * 11) > 0.15) continue;
      if (onStreet(x, z, 0.8) || nearHouse(x, z)) continue;
      const s = 0.8 + rand(i * 7) * 0.7;
      conifers.push({ at: [x, GROUND + h - 0.08, z], scale: [s, s * (0.9 + rand(i) * 0.4), s], color: greens[Math.floor(rand(i * 13) * greens.length)] });
    }
    // Street trees and garden trees across the outer districts, plus a ring in the park.
    for (let i = 0; broadleaf.length < (compact ? 60 : 200) && i < 8000; i++) {
      const x = -40 + rand(i * 3 + 901) * 92;
      const z = HARBOUR + 2 + rand(i * 7 + 903) * 50;
      if (inCore(x, z, 0.6) || hillHeight(x, z) > 0.3 || onLot(x, z)) continue;
      if (onStreet(x, z, 0.55) || nearHouse(x, z)) continue;
      const s = 0.75 + rand(i * 5) * 0.55;
      broadleaf.push({ at: [x, GROUND, z], scale: [s, s, s], color: greens[Math.floor(rand(i * 17) * greens.length)] });
    }
    return { conifers, broadleaf };
  }, [compact, houses]);
}

/* ------------------------------------------------------------------ street furniture */

function Cars({ compact }: { compact: boolean }) {
  const fleets = useMemo(() => {
    const out: Placement[][] = [[], []];
    let i = 0;
    const park = (x: number, z: number, turn: number) => {
      if (inCore(x, z, 0.4)) return;
      i++;
      // Parked either way round, never perfectly square to the kerb.
      const facing = turn + (rand(i * 17) > 0.5 ? Math.PI : 0) + (rand(i * 19) - 0.5) * 0.07;
      out[rand(i * 13) > 0.62 ? 1 : 0]!.push({ at: [x, GROUND, z], turn: facing, color: carPaint[Math.floor(rand(i * 7) * carPaint.length)] });
    };
    for (let x = 13; x < 37; x += 1.1) if (rand(x * 3) > 0.35 && Math.abs(x - 19) > 1 && Math.abs(x - 29) > 1) park(x, -3.27, Math.PI / 2);
    for (let x = 13.4; x < 37; x += 1.1) if (rand(x * 5) > 0.55 && (x < 18 || x > 30)) park(x, -2.73, -Math.PI / 2);
    for (let x = -36; x < -12; x += 1.15) if (rand(x * 7) > 0.5) park(x, 4.45, Math.PI / 2);
    for (let x = -36; x < 36; x += 1.15) if (rand(x * 11) > (compact ? 0.85 : 0.62)) park(x, 13.85, Math.PI / 2);
    // Harbour car park.
    for (let k = 0; k < 10; k++) park(13.4 + (k % 5) * 0.75, -8.4 - Math.floor(k / 5) * 1.25, 0);
    // Dock road traffic stuck in the storm.
    for (let z = -9; z < 12; z += 1.3) if (rand(z * 13) > 0.6) park(-23.75, z, 0);
    return out;
  }, [compact]);
  const res = useMemo(
    () => ({
      models: carModels(),
      paint: new MeshPhysicalMaterial({ roughness: 0.42, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.12 }),
      glass: new MeshStandardMaterial({ color: "#18222a", roughness: 0.05, metalness: 0.85 }),
      trim: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }),
      lamps: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    [],
  );
  return (
    <>
      {fleets.map((items, k) => {
        const model = res.models[k]!;
        const plain = items.map(({ color: _, ...rest }) => rest);
        return (
          <group key={k}>
            <Instances geometry={model.paint} material={res.paint} items={items} />
            <Instances geometry={model.glass} material={res.glass} items={plain} shadows={false} />
            <Instances geometry={model.trim} material={res.trim} items={plain} shadows={false} />
            <Instances geometry={model.lamps} material={res.lamps} items={plain} shadows={false} />
          </group>
        );
      })}
    </>
  );
}

function Lamps() {
  const items = useMemo(() => {
    const out: Placement[] = [];
    for (let x = 13.5; x < 37; x += 3.1) out.push({ at: [x, GROUND, Math.round(x) % 2 ? -3.62 : -2.38] });
    for (let x = -36; x < 36; x += 4.2) if (x < RIVER.west - 1 || x > RIVER.east + 1) out.push({ at: [x, GROUND, HARBOUR + 1.25] });
    for (let x = -36; x < 36; x += 5) if (!inCore(x, 13.6, 1)) out.push({ at: [x, GROUND, 12.95] });
    for (let x = -36; x < -12; x += 4) out.push({ at: [x, GROUND, 3.55] });
    for (let z = 15; z < 33; z += 4.5) out.push({ at: [-24.2, GROUND, z] }, { at: [-14.2, GROUND, z] });
    return out;
  }, []);
  const res = useMemo(
    () => ({
      pole: new CylinderGeometry(0.022, 0.03, 1.15, 6).translate(0, 0.575, 0),
      head: new BoxGeometry(0.1, 0.06, 0.1).translate(0, 1.17, 0),
      metal: new MeshStandardMaterial({ color: "#3a4146", metalness: 0.6, roughness: 0.4 }),
      light: new MeshStandardMaterial({ color: "#ffe7b5", emissive: "#ffc66b", emissiveIntensity: 1.6 }),
    }),
    [],
  );
  return (
    <>
      <Instances geometry={res.pole} material={res.metal} items={items} shadows={false} />
      <Instances geometry={res.head} material={res.light} items={items} shadows={false} />
    </>
  );
}

/* ------------------------------------------------------------------ marina */

const piers: { x: number; z0: number; z1: number }[] = [
  { x: 15, z0: HARBOUR + 0.3, z1: HARBOUR - 5.2 },
  { x: 21, z0: HARBOUR + 0.3, z1: HARBOUR - 6 },
  { x: 27, z0: HARBOUR + 0.3, z1: HARBOUR - 5 },
  { x: -20.5, z0: HARBOUR + 0.3, z1: HARBOUR - 4.6 },
  { x: -29, z0: HARBOUR + 0.3, z1: HARBOUR - 5.4 },
];

interface Boat extends Placement {
  scale: [number, number, number];
  sail: boolean;
}

/** One bobbing group; three groups with different phases keep the marina from moving in lockstep. */
function Fleet({ boats, tick, phase, model, res }: { boats: Boat[]; tick: number; phase: number; model: BoatModel; res: BoatMaterials }) {
  const parts = useMemo(() => {
    const plain = boats.map(({ at, turn, scale }) => ({ at, turn, scale }));
    const motor = boats.filter((b) => !b.sail);
    const sail = boats.filter((b) => b.sail);
    return {
      plain,
      cabins: [
        ...motor.map(({ at, turn, scale }) => ({ at, turn, scale })),
        ...sail.map(({ at, turn, scale: [w, h, l] }) => ({ at, turn, scale: [w * 0.82, h * 0.7, l * 0.75] as [number, number, number] })),
      ],
      glass: motor.map(({ at, turn, scale }) => ({ at, turn, scale })),
      rigs: sail.map(({ at, turn = 0, scale: [, h, l] }) => ({
        at: [at[0] + Math.sin(turn) * l * 0.08, BOAT_DECK * h, at[2] + Math.cos(turn) * l * 0.08] as Point,
        turn,
        scale: [1, 0.75 + l * 0.35, 1] as [number, number, number],
      })),
    };
  }, [boats]);
  const float = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!float.current) return;
    const t = clock.elapsedTime;
    const target = waterLevel(tick) - 0.015 + Math.sin(t * 1.1 + phase) * 0.012;
    float.current.position.y += (target - float.current.position.y) * 0.06;
  });
  return (
    <group ref={float} position={[0, waterLevel(tick) - 0.015, 0]}>
      <Instances geometry={model.hull} material={res.hull} items={boats} />
      <Instances geometry={model.deck} material={res.deck} items={parts.plain} shadows={false} />
      <Instances geometry={model.cabin} material={res.cabin} items={parts.cabins} />
      <Instances geometry={model.glass} material={res.glass} items={parts.glass} shadows={false} />
      <Instances geometry={model.rig} material={res.rig} items={parts.rigs} />
    </group>
  );
}

interface BoatMaterials {
  hull: Material;
  deck: Material;
  cabin: Material;
  glass: Material;
  rig: Material;
}

function Marina({ tick, compact }: { tick: number; compact: boolean }) {
  const planks = useSurface("weathered_planks", 1, 6);
  const fleets = useMemo(() => {
    const out: Boat[][] = [[], [], []];
    let i = 0;
    for (const p of piers) {
      for (const side of [-1, 1]) {
        // Berths fill from the quay outwards, with a fender's gap between hulls.
        for (let z = p.z0 - 0.45; ; ) {
          i++;
          const sail = rand(i * 23) > 0.5;
          const len = (sail ? 1.1 : 0.9) + rand(i * 3) * 0.5;
          if (z - len < p.z1 + 0.2) break;
          if (rand(i * 5) > 0.75) {
            z -= 0.9;
            continue;
          }
          const width = sail ? 0.38 : 0.42 + rand(i * 29) * 0.06;
          out[i % 3]!.push({
            at: [p.x + side * (0.32 + width / 2 + 0.06), 0, z - len / 2],
            // Moored bow-in or stern-in, nudged by the swell.
            turn: (rand(i * 31) > 0.5 ? 0 : Math.PI) + (rand(i) - 0.5) * 0.06,
            scale: [width, sail ? 0.22 : 0.26, len],
            color: sail ? hullPaint[Math.floor(rand(i * 9) * 2) * 4]! : hullPaint[Math.floor(rand(i * 9) * hullPaint.length)]!,
            sail,
          });
          z -= len + 0.22;
        }
      }
    }
    // Fishing boats at anchor beyond the piers, swinging to the wind.
    for (let k = 0; k < (compact ? 3 : 8); k++) {
      out[k % 3]!.push({
        at: [-34 + rand(k * 7 + 40) * 70, 0, HARBOUR - 8 - rand(k * 3 + 41) * 10],
        turn: 2.4 + (rand(k) - 0.5) * 0.5,
        scale: [0.62, 0.36, 2.0],
        color: hullPaint[(k + 1) % hullPaint.length]!,
        sail: false,
      });
    }
    return out;
  }, [compact]);
  const model = useMemo(() => boatModel(), []);
  const res = useMemo<BoatMaterials>(
    () => ({
      hull: new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      deck: new MeshStandardMaterial({ color: "#c9a77f", roughness: 0.8 }),
      cabin: new MeshStandardMaterial({ color: "#f4f2ec", roughness: 0.45 }),
      glass: new MeshStandardMaterial({ color: "#1a252e", roughness: 0.05, metalness: 0.85 }),
      rig: new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.5 }),
    }),
    [],
  );
  return (
    <>
      {piers.map((p, i) => (
        <group key={i}>
          <mesh position={[p.x, GROUND - 0.04, (p.z0 + p.z1) / 2]} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.08, Math.abs(p.z1 - p.z0)]} />
            <meshStandardMaterial {...planks} color="#b9a58c" />
          </mesh>
          {Array.from({ length: Math.floor(Math.abs(p.z1 - p.z0) / 1.15) + 1 }, (_, k) => (
            <mesh key={k} position={[p.x + (k % 2 ? 0.3 : -0.3), -0.35, p.z0 - k * 1.15]}>
              <cylinderGeometry args={[0.05, 0.05, 1.1, 6]} />
              <meshStandardMaterial color="#5d4b3a" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      {fleets.map((boats, k) => <Fleet key={k} boats={boats} tick={tick} phase={k * 2.1} model={model} res={res} />)}
    </>
  );
}

/** Rock breakwater curving out from the east quay to a working lighthouse. */
function Breakwater() {
  const rocks = useMemo(() => {
    const out: Placement[] = [];
    for (let i = 0; i < 70; i++) {
      const t = i / 69;
      const x = 36.5 - Math.sin(t * Math.PI * 0.55) * 6.5;
      const z = HARBOUR - t * 10.5;
      for (let k = 0; k < 2; k++) {
        const s = 0.45 + rand(i * 7 + k) * 0.4;
        out.push({ at: [x + (rand(i * 3 + k) - 0.5) * 0.9, -0.15 + rand(i + k) * 0.2, z + (rand(i * 5 + k) - 0.5) * 0.5], turn: rand(i * 11 + k) * 6, scale: [s, s * 0.8, s], color: ["#8d918f", "#7a7f7d", "#9c9d97"][k + (i % 2)] });
      }
    }
    return out;
  }, []);
  const res = useMemo(() => ({ rock: new DodecahedronGeometry(0.6, 0), stone: new MeshStandardMaterial({ roughness: 1, flatShading: true }) }), []);
  return (
    <>
      <Instances geometry={res.rock} material={res.stone} items={rocks} />
      <Lighthouse at={[30.2, 0.2, HARBOUR - 10.8]} />
    </>
  );
}

function Lighthouse({ at }: { at: Point }) {
  const beam = useRef<Group>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }, delta) => {
    if (beam.current) beam.current.rotation.y += delta * 0.9;
    if (lamp.current) lamp.current.emissiveIntensity = 2.4 + Math.sin(clock.elapsedTime * 3) * 0.4;
  });
  return (
    <group position={at}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.0, 0.5, 20]} />
        <meshStandardMaterial color="#9c9d97" roughness={1} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.85 + i * 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.5 - i * 0.05 - 0.05, 0.55 - i * 0.05, 0.7, 20]} />
          <meshStandardMaterial color={i % 2 ? "#d9443a" : "#f4f2ec"} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.55, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 0.08, 20]} />
        <meshStandardMaterial color="#2c3338" />
      </mesh>
      <mesh position={[0, 3.85, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.5, 16]} />
        <meshStandardMaterial ref={lamp} color="#fff4d0" emissive="#ffd27a" emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0, 4.25, 0]} castShadow>
        <coneGeometry args={[0.36, 0.38, 16]} />
        <meshStandardMaterial color="#2c3338" />
      </mesh>
      <group ref={beam} position={[0, 3.85, 0]}>
        {[0, Math.PI].map((r) => (
          <mesh key={r} rotation={[0, r, Math.PI / 2]} position={[Math.cos(r) * 3.2, 0, -Math.sin(r) * 3.2]}>
            <coneGeometry args={[0.7, 6.4, 20, 1, true]} />
            <meshBasicMaterial color="#fff2c8" transparent opacity={0.12} depthWrite={false} side={2} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Seawater spilling over the promenade as the storm surge rises. */
function HarbourSurge({ tick }: { tick: number }) {
  const sheet = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  useFrame((_s, delta) => {
    const grow = Math.max(0, tick - 3) / 12;
    if (sheet.current) sheet.current.scale.z += (0.15 + grow * 1.6 - sheet.current.scale.z) * Math.min(delta, 1);
    if (material.current) material.current.opacity += (Math.min(0.85, grow * 1.4) - material.current.opacity) * Math.min(delta, 1);
  });
  const geometry = useMemo(() => new PlaneGeometry(76, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), []);
  return (
    <mesh ref={sheet} geometry={geometry} position={[0, GROUND + 0.016, HARBOUR + 0.05]} scale={[1, 1, 0.15]}>
      <meshStandardMaterial ref={material} color="#55706a" transparent opacity={0} roughness={0.05} metalness={0.2} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ people */

function Passersby() {
  const paths: [Point, Point][] = [
    [[14, GROUND, -3.66], [22, GROUND, -3.66]],
    [[35, GROUND, -2.34], [24, GROUND, -2.34]],
    [[20, GROUND, -1.6], [27.5, GROUND, 0.8]],
    [[6, GROUND, HARBOUR + 0.8], [16, GROUND, HARBOUR + 0.8]],
    [[-30, GROUND, HARBOUR + 0.75], [-18, GROUND, HARBOUR + 0.75]],
    [[-4.5, GROUND, 17.7], [3.5, GROUND, 17.7]],
    [[-30, GROUND, 3.4], [-19, GROUND, 3.4]],
    [[-0.7, GROUND, 14.6], [-0.7, GROUND, 20.6]],
  ];
  return (
    <>
      {paths.map((path, i) => (
        <Person key={i} at={path[0]} path={path} appearance={look(i + 400, { umbrella: i % 3 === 0 ? "#2f6fe4" : i % 3 === 1 ? undefined : "#e5484d" })} speed={0.22 + rand(i) * 0.1} phase={i * 2.7} />
      ))}
      {/* A small crowd sheltering under the town hall portico. */}
      {Array.from({ length: 5 }, (_, i) => (
        <Person key={`h${i}`} at={[22.6 + i * 0.6, GROUND, 1.75 + (i % 2) * 0.25]} facing={Math.PI + (rand(i + 7) - 0.5)} appearance={look(i + 450)} phase={i * 1.3} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ assembly */

/**
 * Harbor Point beyond the playable core: old town, docks, marina, park, residential grid and a
 * forested hill. Decorative only; the engine never reads any of it.
 */
export function OuterTown({ tick, compact }: { tick: number; compact: boolean }) {
  const { houses, shops, sheds } = useMemo(() => layoutTown(compact), [compact]);
  const trees = useTrees(compact, houses);
  const shadows = !compact;
  return (
    <>
      <Streets />
      <Hill />
      <HouseInstances items={houses} shadows={shadows} />
      <Shops items={shops} shadows={shadows} />
      <Warehouses items={sheds} shadows={shadows} />
      <Containers />
      <TownHall />
      <Church />
      <Park compact={compact} />
      <Trees items={trees.conifers} conifer />
      <Trees items={trees.broadleaf} conifer={false} />
      <Cars compact={compact} />
      <Lamps />
      <Marina tick={tick} compact={compact} />
      <Breakwater />
      <HarbourSurge tick={tick} />
      {!compact && <Passersby />}
    </>
  );
}
