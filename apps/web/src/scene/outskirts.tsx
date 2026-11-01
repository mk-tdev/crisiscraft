import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  type Group,
  type InstancedMesh,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import { useSurface } from "./assets";
import { LandBlock } from "./environment";
import { type Building, HouseInstances, Trees, carPaint, walls } from "./district";
import { Instances, type Placement, flatQuads, roofGeometry } from "./instancing";
import { GROUND, HARBOUR, type Point, RAIL_Z, rand, waterLevel } from "./layout";
import { BOAT_DECK, type BoatModel, boatModel, carModels } from "./models";
import { signTexture } from "./text";

/**
 * The world beyond Harbor Point's streets: a container port to the west, farmland and a railway,
 * a hillside estate to the south, and a fishing village with a wind farm across the bay.
 * Everything here is decorative; moving traffic, trains, boats and the helicopter never read or
 * imply simulation state.
 */

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const greens = ["#3f6b3d", "#4c7a45", "#365e3a", "#5a8250", "#2f5534"];

/** The far shore of the bay: a western headland, the village cove, and a point receding to the open sea. */
const SHORE = -42;
const farShore: [number, number, number][] = [
  [-260, -66, -37.5],
  [-66, 22, SHORE],
  [22, 48, -49],
];
const onFarShore = (x: number, z: number, pad = 0) => farShore.some(([x0, x1, z1]) => x > x0 && x < x1 && z < z1 - pad);

/* ------------------------------------------------------------------ helpers */

/** A flat ribbon along a smooth curve, for winding roads; UVs run along the length. */
function ribbon(points: [number, number][], width: number, y: number, uvScale = 0.6) {
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)));
  const steps = Math.ceil(curve.getLength() / 0.5);
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  let run = 0;
  let last = curve.getPointAt(0);
  for (let i = 0; i <= steps; i++) {
    const p = curve.getPointAt(i / steps);
    const t = curve.getTangentAt(i / steps);
    run += p.distanceTo(last);
    last = p;
    const nx = -t.z * (width / 2);
    const nz = t.x * (width / 2);
    position.push(p.x - nx, y, p.z - nz, p.x + nx, y, p.z + nz);
    uv.push(0, run * uvScale, width * uvScale, run * uvScale);
    if (i < steps) {
      const o = i * 2;
      index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // Winding order can face down; force the normals up so lighting matches the flat streets.
  const n = geometry.getAttribute("normal");
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return { geometry, curve };
}

const unitBox = () => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

/* ------------------------------------------------------------------ hillside estate */

const estatePath: [number, number][] = [
  [-5.8, 42.5], [-11, 43.6], [-17.5, 46.8], [-24.5, 45], [-31, 48.2], [-34, 53.5],
  [-29, 57.4], [-20, 56.6], [-12.5, 54], [-5.8, 51.5],
];

function Estate() {
  const asphalt = useSurface("asphalt_02", 1, 1);
  const concrete = useSurface("brushed_concrete", 1, 1);
  const { road, pavement, houses, gardens } = useMemo(() => {
    const road = ribbon(estatePath, 0.85, GROUND + 0.008);
    const pavement = ribbon(estatePath, 1.5, GROUND + 0.004, 0.8);
    const samples = road.curve.getSpacedPoints(Math.ceil(road.curve.getLength() / 0.4));
    const houses: Building[] = [];
    const gardens: Placement[] = [];
    const length = road.curve.getLength();
    for (let d = 1.2, i = 0; d < length - 1; d += 2.25, i++) {
      const p = road.curve.getPointAt(d / length);
      const t = road.curve.getTangentAt(d / length);
      for (const side of [-1, 1]) {
        const s = i * 7 + (side > 0 ? 3 : 0);
        const x = p.x - t.z * side * 1.75;
        const z = p.z + t.x * side * 1.75;
        // Keep clear of the road's other bends, the station road and the neighbours.
        if (samples.some((q) => Math.hypot(q.x - x, q.z - z) < 1.35)) continue;
        if (Math.abs(x + 5.8) < 1.7 || houses.some((h) => Math.hypot(h.at[0] - x, h.at[2] - z) < 1.75)) continue;
        if (rand(s + 400) > 0.88) {
          gardens.push({ at: [x, GROUND, z], scale: [0.9, 0.9, 0.9], color: greens[i % greens.length] });
          continue;
        }
        houses.push({
          at: [x, GROUND, z],
          turn: Math.atan2(p.x - x, p.z - z),
          floors: rand(s + 401) > 0.7 ? 2 : 1,
          width: 1.35 + rand(s + 402) * 0.35,
          depth: 1.15 + rand(s + 403) * 0.25,
          roof: "gable",
          color: walls[Math.floor(rand(s + 404) * walls.length)],
        });
        // A garden tree behind most houses.
        if (rand(s + 405) > 0.35) {
          const k = 2.9 + rand(s + 406) * 0.6;
          const tx = p.x - t.z * side * k;
          const tz = p.z + t.x * side * k;
          if (!samples.some((q) => Math.hypot(q.x - tx, q.z - tz) < 1.1)) {
            const sc = 0.7 + rand(s + 407) * 0.4;
            gardens.push({ at: [tx, GROUND, tz], scale: [sc, sc, sc], color: greens[Math.floor(rand(s + 408) * greens.length)] });
          }
        }
      }
    }
    return { road, pavement, houses, gardens };
  }, []);
  return (
    <>
      <mesh geometry={pavement.geometry} receiveShadow>
        <meshStandardMaterial map={concrete.map} normalMap={concrete.normalMap} color="#d6d2ca" roughness={0.9} />
      </mesh>
      <mesh geometry={road.geometry} receiveShadow>
        <meshStandardMaterial map={asphalt.map} normalMap={asphalt.normalMap} color="#7d8285" polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <HouseInstances items={houses} shadows={false} />
      <Trees items={gardens} conifer={false} />
    </>
  );
}

/* ------------------------------------------------------------------ railway */

const STATION_X = -6;

function Railway() {
  const concrete = useSurface("brushed_concrete", 1, 1);
  const brick = useSurface("brick_wall_001", 2, 1);
  const sign = useMemo(() => signTexture("HARBOR POINT", "#1f3a5c", "#ffffff", 512, 96), []);
  const res = useMemo(
    () => ({
      ballast: flatQuads([[-220, 220, RAIL_Z - 0.6, RAIL_Z + 0.6]], GROUND + 0.006, 0.9),
      rail: new BoxGeometry(440, 0.05, 0.05),
      sleeper: new BoxGeometry(0.12, 0.035, 0.7),
      sleepers: Array.from({ length: Math.floor(260 / 0.5) }, (_, i) => ({ at: [-130 + i * 0.5, GROUND + 0.02, RAIL_Z] as Point })),
      wood: new MeshStandardMaterial({ color: "#5b4a3c", roughness: 1 }),
      steel: new MeshStandardMaterial({ color: "#8d9296", metalness: 0.7, roughness: 0.35 }),
    }),
    [],
  );
  return (
    <>
      <mesh geometry={res.ballast} receiveShadow>
        <meshStandardMaterial map={concrete.map} color="#8b857b" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <Instances geometry={res.sleeper} material={res.wood} items={res.sleepers} shadows={false} />
      {[-0.2, 0.2].map((dz) => (
        <mesh key={dz} geometry={res.rail} material={res.steel} position={[0, GROUND + 0.06, RAIL_Z + dz]} />
      ))}
      {/* Station: platform on the town side, a brick booking hall and a canopy. */}
      <mesh position={[STATION_X, GROUND + 0.11, RAIL_Z - 1.15]} receiveShadow>
        <boxGeometry args={[11, 0.22, 0.9]} />
        <meshStandardMaterial map={concrete.map} color="#c9c3b8" roughness={0.9} />
      </mesh>
      <mesh position={[STATION_X, GROUND + 0.23, RAIL_Z - 0.74]}>
        <boxGeometry args={[11, 0.02, 0.08]} />
        <meshStandardMaterial color="#e8c547" />
      </mesh>
      <group position={[STATION_X, 0, RAIL_Z - 1.2]}>
        {[-4, -1.3, 1.3, 4].map((x) => (
          <mesh key={x} position={[x, GROUND + 0.75, 0.05]}>
            <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
            <meshStandardMaterial color="#2c3338" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, GROUND + 1.33, 0.05]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[9.6, 0.06, 1.2]} />
          <meshStandardMaterial color="#3e4a52" roughness={0.6} />
        </mesh>
      </group>
      <group position={[STATION_X, GROUND, RAIL_Z - 3.2]}>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[5.4, 1.3, 1.9]} />
          <meshStandardMaterial map={brick.map} normalMap={brick.normalMap} color="#c98d74" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.3, 0]} scale={[5.8, 0.55, 2.2]} geometry={useMemo(() => roofGeometry(), [])}>
          <meshStandardMaterial color="#5d6b74" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.0, -0.96]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[2.6, 0.48]} />
          <meshStandardMaterial map={sign} />
        </mesh>
        {[-1.8, -0.6, 0.6, 1.8].map((x) => (
          <mesh key={x} position={[x, 0.55, -0.96]}>
            <planeGeometry args={[0.5, 0.6]} />
            <meshStandardMaterial color="#ffe2a8" emissive="#ffc66b" emissiveIntensity={0.7} side={2} />
          </mesh>
        ))}
      </group>
      <Train />
    </>
  );
}

/** A six-car passenger train that crosses the whole valley and stops at the station. */
function Train() {
  const group = useRef<Group>(null);
  const cars = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);
  const res = useMemo(
    () => ({
      body: new MeshStandardMaterial({ color: "#eef0ee", roughness: 0.4, metalness: 0.2 }),
      stripe: new MeshStandardMaterial({ color: "#2f6fe4", roughness: 0.5 }),
      nose: new MeshStandardMaterial({ color: "#e8a317", roughness: 0.5 }),
      glass: new MeshStandardMaterial({ color: "#1d2830", roughness: 0.05, metalness: 0.8, emissive: "#ffd99a", emissiveIntensity: 0.25 }),
      under: new MeshStandardMaterial({ color: "#2a2d31", roughness: 0.8 }),
    }),
    [],
  );
  const LENGTH = 3.05;
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    // Constant speed, a dwell at the platform, then on into the fog; the loop wraps far off-screen.
    const from = -200;
    const to = 200;
    const speed = 5;
    const dwell = 7;
    const stop = STATION_X + (LENGTH * cars.length) / 2;
    const arrive = (stop - from) / speed;
    const cycle = (to - from) / speed + dwell;
    const s = clock.elapsedTime % cycle;
    g.position.x = s < arrive ? from + s * speed : s < arrive + dwell ? stop : stop + (s - arrive - dwell) * speed;
  });
  return (
    <group ref={group} position={[-200, GROUND + 0.1, RAIL_Z]}>
      {cars.map((i) => (
        <group key={i} position={[-i * LENGTH, 0, 0]}>
          <mesh position={[0, 0.06, 0]} material={res.under}>
            <boxGeometry args={[LENGTH - 0.25, 0.14, 0.5]} />
          </mesh>
          <mesh position={[0, 0.45, 0]} material={i === 0 ? res.nose : res.body}>
            <boxGeometry args={[LENGTH - 0.12, 0.66, 0.62]} />
          </mesh>
          <mesh position={[0, 0.52, 0]} material={res.glass}>
            <boxGeometry args={[LENGTH - 0.5, 0.2, 0.635]} />
          </mesh>
          <mesh position={[0, 0.25, 0]} material={res.stripe}>
            <boxGeometry args={[LENGTH - 0.11, 0.06, 0.632]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ container port */

const cranesX = [-84, -71, -58];

function Port({ tick }: { tick: number }) {
  const concrete = useSurface("brushed_concrete", 1, 1);
  const iron = useSurface("corrugated_iron", 4, 1);
  const res = useMemo(() => {
    const colours = ["#d24f0e", "#2f6fe4", "#2f9e6b", "#a63d33", "#e8a317", "#5b7fa3", "#7a8a96", "#e3e1da"];
    const stacks: Placement[] = [];
    let i = 0;
    for (let x = -92; x < -47; x += 1.95) {
      if (Math.abs(x + 70) < 1.4) continue; // a lane through the yard
      for (let z = -8.3; z < -1.6; z += 0.47) {
        if (Math.abs(z + 5) < 0.3) continue;
        const layers = Math.floor(rand(i * 5 + 1) * 4.6);
        for (let y = 0; y < layers; y++, i++) {
          stacks.push({ at: [x, GROUND + y * 0.43, z], scale: [1.8, 0.42, 0.42], color: colours[Math.floor(rand(i * 3 + 7) * colours.length)] });
        }
        i++;
      }
    }
    return {
      apron: flatQuads([[-98, -41.6, HARBOUR + 0.1, -1.0]], GROUND + 0.004, 0.7),
      box: unitBox(),
      stacks,
      steel: new MeshStandardMaterial({ roughness: 0.55, metalness: 0.35 }),
    };
  }, []);
  return (
    <>
      <mesh geometry={res.apron} receiveShadow>
        <meshStandardMaterial map={concrete.map} normalMap={concrete.normalMap} color="#b9b4ab" roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <Instances geometry={res.box} material={res.steel} items={res.stacks} shadows={false} />
      {[[-94, -5.2, 4.4, 1.8, 6], [-95.5, 2.8, 3.4, 1.5, 4]].map(([x, z, d, h, w], i) => (
        <mesh key={i} position={[x!, GROUND + h! / 2, z!]}>
          <boxGeometry args={[d!, h!, w!]} />
          <meshStandardMaterial map={iron.map} normalMap={iron.normalMap} color="#9fb0b8" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
      {cranesX.map((x, i) => <Crane key={x} x={x} phase={i * 1.7} />)}
      <Ship tick={tick} />
    </>
  );
}

/** Ship-to-shore gantry crane: legs straddle the quay rails, the boom reaches out over the ship. */
function Crane({ x, phase }: { x: number; phase: number }) {
  const trolley = useRef<Group>(null);
  const cable = useRef<Group>(null);
  const red = useMemo(() => new MeshStandardMaterial({ color: "#c8452a", roughness: 0.55, metalness: 0.4 }), []);
  const dark = useMemo(() => new MeshStandardMaterial({ color: "#2c3338", roughness: 0.6, metalness: 0.5 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.22 + phase;
    // Out over the ship, lower, lift, back over the quay, lower, lift.
    const travel = (Math.sin(t) + 1) / 2;
    if (trolley.current) trolley.current.position.z = -18 + travel * 9.5;
    if (cable.current) cable.current.scale.y = 1 + Math.max(0, Math.cos(t * 2)) * 1.6;
  });
  const legH = 4.4;
  return (
    <group position={[x, GROUND, 0]}>
      {[-0.7, 0.7].flatMap((dx) => [-11.5, -9.4].map((z) => (
        <mesh key={`${dx}${z}`} position={[dx, legH / 2, z]} material={red}>
          <boxGeometry args={[0.18, legH, 0.18]} />
        </mesh>
      )))}
      {[-0.7, 0.7].map((dx) => (
        <mesh key={dx} position={[dx, 1.6, -10.45]} material={red}>
          <boxGeometry args={[0.14, 0.14, 2.3]} />
        </mesh>
      ))}
      {/* Boom over the water and back-reach over the quay. */}
      {[-0.55, 0.55].map((dx) => (
        <mesh key={dx} position={[dx, legH + 0.1, -12.2]} material={red}>
          <boxGeometry args={[0.16, 0.22, 15.5]} />
        </mesh>
      ))}
      <mesh position={[0, legH + 0.65, -9.7]} material={red}>
        <boxGeometry args={[1.3, 0.8, 1.4]} />
      </mesh>
      <mesh position={[0, legH + 1.35, -10.4]} material={red} rotation={[0.55, 0, 0]}>
        <boxGeometry args={[0.12, 0.12, 4]} />
      </mesh>
      <group ref={trolley} position={[0, legH - 0.05, -14]}>
        <mesh material={dark}>
          <boxGeometry args={[1.0, 0.18, 0.6]} />
        </mesh>
        <group ref={cable}>
          <mesh position={[0, -0.6, 0]} material={dark}>
            <boxGeometry args={[0.03, 1.2, 0.03]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** A container ship moored alongside, rising with the surge like everything else afloat. */
function Ship({ tick }: { tick: number }) {
  const float = useRef<Group>(null);
  const model = useMemo(() => boatModel(), []);
  const res = useMemo(() => {
    const colours = ["#d24f0e", "#2f6fe4", "#2f9e6b", "#a63d33", "#e8a317", "#7a8a96"];
    const boxes: Placement[] = [];
    let i = 0;
    for (let x = -79; x < -61; x += 1.9) {
      for (let z = -17.6; z < -15.4; z += 0.46) {
        const layers = 1 + Math.floor(rand(i * 13 + 3) * 3);
        for (let y = 0; y < layers; y++, i++) boxes.push({ at: [x, 0, z], scale: [1.8, 0.42, 0.42], color: colours[Math.floor(rand(i * 5) * colours.length)] });
        i++;
      }
    }
    return {
      layered: boxes,
      hull: new MeshPhysicalMaterial({ vertexColors: true, color: "#24303d", roughness: 0.4, clearcoat: 0.6 }),
      deck: new MeshStandardMaterial({ color: "#7d4a3a", roughness: 0.8 }),
      white: new MeshStandardMaterial({ color: "#f1efe8", roughness: 0.5 }),
      steel: new MeshStandardMaterial({ roughness: 0.55, metalness: 0.35 }),
      box: unitBox(),
    };
  }, []);
  // Stack heights come from the layering loop; rebuild y from each item's original layer order.
  const stacked = useMemo(() => {
    const seen = new Map<string, number>();
    return res.layered.map((b) => {
      const key = `${b.at[0].toFixed(2)}:${b.at[2].toFixed(2)}`;
      const layer = seen.get(key) ?? 0;
      seen.set(key, layer + 1);
      return { ...b, at: [b.at[0], BOAT_DECK * 1.6 + layer * 0.43, b.at[2]] as Point };
    });
  }, [res]);
  useFrame(() => {
    if (!float.current) return;
    const target = waterLevel(tick) - 0.02;
    float.current.position.y += (target - float.current.position.y) * 0.05;
  });
  return (
    <group ref={float} position={[0, waterLevel(tick) - 0.02, 0]}>
      <group position={[-70, 0, -16.5]} rotation={[0, -Math.PI / 2, 0]} scale={[3.4, 1.6, 23]}>
        <mesh geometry={model.hull} material={res.hull} />
        <mesh geometry={model.deck} material={res.deck} />
      </group>
      <Instances geometry={res.box} material={res.steel} items={stacked} shadows={false} />
      {/* Bridge house at the stern. */}
      <mesh position={[-57.6, BOAT_DECK * 1.6 + 0.9, -16.5]} material={res.white}>
        <boxGeometry args={[1.6, 1.8, 2.6]} />
      </mesh>
      <mesh position={[-57.6, BOAT_DECK * 1.6 + 1.86, -16.5]} material={res.white}>
        <boxGeometry args={[1.2, 0.12, 3.4]} />
      </mesh>
      <mesh position={[-56.9, BOAT_DECK * 1.6 + 2.3, -16.5]}>
        <cylinderGeometry args={[0.22, 0.26, 0.9, 10]} />
        <meshStandardMaterial color="#c8452a" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ farmland */

const fieldColours = ["#c9b46a", "#8fae5e", "#a3864f", "#b5c47a", "#7f9d4f", "#d2c07e"];

function Farmland() {
  const res = useMemo(() => {
    const fields = fieldColours.map(() => [] as [number, number, number, number][]);
    const hedges: Placement[] = [];
    const trees: Placement[] = [];
    const barns: Placement[] = [];
    const barnRoofs: Placement[] = [];
    const silos: Placement[] = [];
    let i = 0;
    const region = (x0: number, x1: number, z0: number, z1: number, cw: number, cd: number, skip?: (x: number, z: number) => boolean) => {
      for (let x = x0; x < x1 - 1; x += cw) {
        for (let z = z0; z < z1 - 1; z += cd, i++) {
          const w = Math.min(cw * (0.8 + rand(i * 3) * 0.4), x1 - x);
          const d = Math.min(cd, z1 - z);
          if (skip?.(x + w / 2, z + d / 2)) continue;
          fields[Math.floor(rand(i * 7 + 1) * fieldColours.length)]!.push([x + 0.25, x + w - 0.25, z + 0.25, z + d - 0.25]);
          // Hedges along the north and west edges of every field, with an occasional gap.
          if (rand(i * 11) > 0.12) hedges.push({ at: [x + w / 2, GROUND, z], scale: [w, 0.32, 0.26], color: greens[i % greens.length] });
          if (rand(i * 13) > 0.12) hedges.push({ at: [x, GROUND, z + d / 2], scale: [0.26, 0.32, d], color: greens[(i + 2) % greens.length] });
          if (rand(i * 17) > 0.55) {
            const s = 0.8 + rand(i * 19) * 0.5;
            trees.push({ at: [x + rand(i * 23) * w, GROUND, z], scale: [s, s, s], color: greens[(i + 1) % greens.length] });
          }
          if (rand(i * 29) > 0.86) {
            const bx = x + w * 0.3;
            const bz = z + d * 0.5;
            const turn = rand(i * 31) > 0.5 ? 0 : Math.PI / 2;
            barns.push({ at: [bx, GROUND, bz], turn, scale: [2.2, 1.1, 1.3], color: rand(i * 37) > 0.5 ? "#9e3b2f" : "#8a6a4c" });
            // The prism's ridge runs along its depth, so turn it to run along the barn's length.
            barnRoofs.push({ at: [bx, GROUND + 1.1, bz], turn: turn + Math.PI / 2, scale: [1.45, 0.6, 2.35], color: "#5d6b74" });
            silos.push({ at: [bx + 1.8, GROUND, bz + 0.4], scale: [0.36, 1.9, 0.36], color: "#c9ccd0" });
          }
        }
      }
    };
    region(-160, -46, 6, 58, 8.5, 6.5);
    region(62, 160, -6, 58, 9, 7);
    region(-140, -66, -66, -48, 8, 6, (x, z) => z > -50 && x > -70);
    return { fields, hedges, trees, barns, barnRoofs, silos };
  }, []);
  const geometry = useMemo(
    () => ({
      fields: res.fields.map((rects) => flatQuads(rects, GROUND + 0.003, 0.4)),
      box: unitBox(),
      prism: roofGeometry(),
      silo: new CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0),
      hedge: new MeshStandardMaterial({ roughness: 1, flatShading: true }),
      paint: new MeshStandardMaterial({ roughness: 0.85 }),
      metal: new MeshStandardMaterial({ roughness: 0.4, metalness: 0.5 }),
    }),
    [res],
  );
  return (
    <>
      {geometry.fields.map((g, k) => (
        <mesh key={k} geometry={g} receiveShadow>
          <meshStandardMaterial color={fieldColours[k]} roughness={1} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
      <Instances geometry={geometry.box} material={geometry.hedge} items={res.hedges} shadows={false} />
      <Instances geometry={geometry.box} material={geometry.paint} items={res.barns} shadows={false} />
      <Instances geometry={geometry.prism} material={geometry.paint} items={res.barnRoofs} shadows={false} />
      <Instances geometry={geometry.silo} material={geometry.metal} items={res.silos} shadows={false} />
      <Trees items={res.trees} conifer={false} />
    </>
  );
}

/* ------------------------------------------------------------------ across the bay */

/** Height of the ridge behind the village, where the wind farm stands. */
function ridgeHeight(x: number, z: number) {
  const crest = 6 * Math.exp(-(((z + 84) / 8) ** 2) / 2) + 1.4 * Math.exp(-(((z + 66) / 6) ** 2) / 2);
  return crest * smooth(-150, -110, x) * (1 - smooth(10, 44, x));
}

function FarShore() {
  const grass = useSurface("leafy_grass", 59, 16);
  const sand = useSurface("damp_beach_sand", 60, 1);
  const concrete = useSurface("brushed_concrete", 1, 1);
  const planks = useSurface("weathered_planks", 1, 4);
  const ridge = useMemo(() => {
    const g = new PlaneGeometry(190, 52, 110, 36).rotateX(-Math.PI / 2).translate(-50, 0, -84);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setY(i, GROUND - 0.05 + ridgeHeight(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  const village = useMemo(() => {
    const houses: Building[] = [];
    let i = 0;
    for (const [z, turn] of [[-46.4, 0], [-49.6, Math.PI]] as const) {
      for (let x = -58; x < 18; x += 2.05, i++) {
        if (Math.abs(x + 12) < 1.6 || Math.abs(x + 26) < 2.6 || rand(i * 3 + 900) > 0.86) continue;
        houses.push({
          at: [x + (rand(i) - 0.5) * 0.3, GROUND, z],
          turn,
          floors: rand(i * 5 + 901) > 0.65 ? 2 : 1,
          width: 1.3 + rand(i * 7 + 902) * 0.4,
          depth: 1.15 + rand(i * 11 + 903) * 0.25,
          roof: "gable",
          color: walls[Math.floor(rand(i * 13 + 904) * walls.length)],
        });
      }
    }
    // Pine woods on the slopes behind the village.
    const pines: Placement[] = [];
    for (let k = 0; pines.length < 260 && k < 4000; k++) {
      const x = -150 + rand(k * 3 + 950) * 210;
      const z = -53 - rand(k * 7 + 951) * 26;
      if ((z > -54 && x > -62 && x < 20) || !onFarShore(x, z, 1.5)) continue;
      const h = ridgeHeight(x, z);
      if (h > 3.2) continue;
      const s = 0.9 + rand(k * 5 + 952) * 0.7;
      pines.push({ at: [x, GROUND + h - 0.08, z], scale: [s, s * 1.1, s], color: greens[k % greens.length] });
    }
    return { houses, pines };
  }, []);
  const street = useMemo(() => flatQuads([[-60, 20, -48.4, -47.6]], GROUND + 0.008, 0.6), []);
  return (
    <>
      {farShore.map(([x0, x1, z1]) => (
        <group key={x0}>
          <LandBlock x0={x0} x1={x1} z0={-260} z1={z1} />
          {/* Beach along each stretch of waterline. */}
          <mesh position={[(x0 + x1) / 2, GROUND + 0.002, z1 - 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[x1 - x0, 1.8]} />
            <meshStandardMaterial {...sand} color="#c9b99a" roughness={1} />
          </mesh>
        </group>
      ))}
      <mesh geometry={ridge} receiveShadow>
        <meshStandardMaterial {...grass} color="#a9c48f" roughness={0.95} />
      </mesh>
      <mesh geometry={street}>
        <meshStandardMaterial map={concrete.map} color="#8a8d8f" roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <HouseInstances items={village.houses} shadows={false} />
      <Trees items={village.pines} conifer />
      <Chapel at={[-26, GROUND, -51.2]} />
      {/* Ferry pier. */}
      <mesh position={[-12, GROUND - 0.04, SHORE + 2.2]}>
        <boxGeometry args={[1.0, 0.1, 4.6]} />
        <meshStandardMaterial {...planks} color="#b9a58c" />
      </mesh>
      <WindFarm />
    </>
  );
}

function Chapel({ at }: { at: Point }) {
  const prism = useMemo(() => roofGeometry(), []);
  return (
    <group position={at}>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[1.6, 1.6, 3]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.9} />
      </mesh>
      <mesh geometry={prism} position={[0, 1.6, 0]} scale={[1.8, 0.9, 3.2]}>
        <meshStandardMaterial color="#5d6b74" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.6, 1.9]}>
        <boxGeometry args={[0.9, 3.2, 0.9]} />
        <meshStandardMaterial color="#e9e4d8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 4.0, 1.9]}>
        <coneGeometry args={[0.66, 1.8, 4]} />
        <meshStandardMaterial color="#4b5961" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Wind turbines along the ridge crest; the rotors face the town across the bay. */
function WindFarm() {
  const rotors = useRef<Group[]>([]);
  const turbines = useMemo(
    () => Array.from({ length: 9 }, (_, i) => {
      const x = -108 + i * 15 + (rand(i * 3 + 1) - 0.5) * 3;
      const z = -84 + (rand(i * 5 + 2) - 0.5) * 2;
      return { x, z, y: GROUND + ridgeHeight(x, z) - 0.1, speed: 0.9 + rand(i * 7) * 0.35, phase: rand(i * 11) * 6 };
    }),
    [],
  );
  const res = useMemo(
    () => ({
      tower: new CylinderGeometry(0.11, 0.2, 9, 10).translate(0, 4.5, 0),
      blade: new BoxGeometry(0.22, 4.2, 0.05).translate(0, 2.1, 0),
      white: new MeshStandardMaterial({ color: "#eef0f0", roughness: 0.5 }),
    }),
    [],
  );
  useFrame(({ clock }) => {
    turbines.forEach((t, i) => {
      const r = rotors.current[i];
      if (r) r.rotation.z = t.phase + clock.elapsedTime * t.speed;
    });
  });
  return (
    <>
      {turbines.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]}>
          <mesh geometry={res.tower} material={res.white} />
          <mesh position={[0, 9.05, -0.15]} material={res.white}>
            <boxGeometry args={[0.36, 0.36, 0.95]} />
          </mesh>
          <group ref={(g) => { if (g) rotors.current[i] = g; }} position={[0, 9.05, 0.38]}>
            <mesh material={res.white}>
              <sphereGeometry args={[0.2, 10, 8]} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} geometry={res.blade} material={res.white} rotation={[0, 0, (k * Math.PI * 2) / 3]} />
            ))}
          </group>
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ moving traffic */

type Path = [number, number][];
/** Closed loops along the outer streets, chosen so no lane crosses a row of parked cars. */
const loops: { path: Path; cars: number }[] = [
  // Ring Road west → West Road south → South Road east → Station Road north.
  { path: [[-5.8, 13.45], [-40.85, 13.45], [-40.85, 60.85], [-5.8, 60.85]], cars: 12 },
  // Around the town hall block: Chapel Lane, Ring Road, Market Lane, Harbour Street.
  { path: [[19.2, -2.75], [19.2, 13.45], [28.8, 13.45], [28.8, -2.75]], cars: 4 },
  // West Road north to the port and back.
  { path: [[-40.15, 12.9], [-40.15, -0.25], [-92, -0.25], [-92, -0.65], [-40.85, -0.65], [-40.85, 12.9]], cars: 8 },
  // The long South Road towards the farms.
  { path: [[-5.5, 61.25], [98, 61.25], [98, 60.85], [-5.5, 60.85]], cars: 9 },
];

function measure(path: Path) {
  const lengths = [0];
  for (let i = 0; i < path.length; i++) {
    const [ax, az] = path[i]!;
    const [bx, bz] = path[(i + 1) % path.length]!;
    lengths.push(lengths[i]! + Math.hypot(bx - ax, bz - az));
  }
  return lengths;
}

function pointAt(path: Path, lengths: number[], s: number, out: [number, number]) {
  const total = lengths[lengths.length - 1]!;
  const d = ((s % total) + total) % total;
  let i = 0;
  while (i < path.length - 1 && lengths[i + 1]! < d) i++;
  const [ax, az] = path[i]!;
  const [bx, bz] = path[(i + 1) % path.length]!;
  const k = (d - lengths[i]!) / Math.max(lengths[i + 1]! - lengths[i]!, 1e-6);
  out[0] = ax + (bx - ax) * k;
  out[1] = az + (bz - az) * k;
}

/** Cars driving slow loops through the storm. One instanced mesh per car part, updated per frame. */
function Traffic() {
  const models = useMemo(() => carModels(), []);
  const cars = useMemo(() => {
    const out: { loop: number; offset: number; model: number; color: string }[] = [];
    let i = 0;
    loops.forEach((l, li) => {
      const total = measure(l.path).at(-1)!;
      for (let k = 0; k < l.cars; k++, i++) {
        out.push({ loop: li, offset: (k / l.cars) * total + rand(i * 3) * 1.5, model: rand(i * 7 + 1) > 0.62 ? 1 : 0, color: carPaint[Math.floor(rand(i * 11) * carPaint.length)]! });
      }
    });
    return out;
  }, []);
  const lengths = useMemo(() => loops.map((l) => measure(l.path)), []);
  const res = useMemo(
    () => ({
      paint: new MeshPhysicalMaterial({ roughness: 0.42, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.12 }),
      glass: new MeshStandardMaterial({ color: "#18222a", roughness: 0.05, metalness: 0.85 }),
      trim: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }),
      lamps: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    [],
  );
  const groups = useMemo(() => [0, 1].map((m) => cars.filter((c) => c.model === m)), [cars]);
  const meshes = useRef<InstancedMesh[][]>([[], []]);
  const scratch = useMemo(() => ({ o: new Object3D(), a: [0, 0] as [number, number], b: [0, 0] as [number, number], c: new Color() }), []);
  useLayoutEffect(() => {
    groups.forEach((list, m) => {
      const paint = meshes.current[m]?.[0];
      if (!paint) return;
      list.forEach((car, i) => paint.setColorAt(i, scratch.c.set(car.color)));
      if (paint.instanceColor) paint.instanceColor.needsUpdate = true;
    });
  }, [groups, scratch]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.4;
    groups.forEach((list, m) => {
      const parts = meshes.current[m]!;
      list.forEach((car, i) => {
        const l = loops[car.loop]!;
        const s = t + car.offset;
        // Heading from a point just behind to one just ahead, so cars swing round corners.
        pointAt(l.path, lengths[car.loop]!, s - 0.3, scratch.a);
        pointAt(l.path, lengths[car.loop]!, s + 0.3, scratch.b);
        const x = (scratch.a[0] + scratch.b[0]) / 2;
        const z = (scratch.a[1] + scratch.b[1]) / 2;
        scratch.o.position.set(x, GROUND, z);
        scratch.o.rotation.set(0, Math.atan2(scratch.b[0] - scratch.a[0], scratch.b[1] - scratch.a[1]), 0);
        scratch.o.updateMatrix();
        for (const part of parts) part.setMatrixAt(i, scratch.o.matrix);
      });
      for (const part of parts) part.instanceMatrix.needsUpdate = true;
    });
  });
  return (
    <>
      {groups.map((list, m) => {
        const model = models[m]!;
        const parts: [BufferGeometry, Material][] = [[model.paint, res.paint], [model.glass, res.glass], [model.trim, res.trim], [model.lamps, res.lamps]];
        return parts.map(([geometry, material], k) => (
          <instancedMesh
            key={`${m}-${k}`}
            ref={(mesh) => { if (mesh) meshes.current[m]![k] = mesh; }}
            args={[geometry, material, list.length]}
            frustumCulled={false}
          />
        ));
      })}
    </>
  );
}

/* ------------------------------------------------------------------ the bay */

interface Sailing {
  scale: [number, number, number];
  color: string;
  motion: (t: number, out: { x: number; z: number; heading: number }) => void;
}

const bayBoats: Sailing[] = [
  {
    // The village ferry shuttling across the bay, pausing at each pier.
    scale: [0.9, 0.42, 2.6],
    color: "#f4f2ec",
    motion: (t, out) => {
      const cycle = 64;
      const s = t % cycle;
      const leg = Math.min(1, Math.max(0, (s % 32 - 4) / 26));
      const ease = leg * leg * (3 - 2 * leg);
      const outward = s < 32;
      out.x = -12.5;
      out.z = outward ? -14 - ease * 22.5 : -36.5 + ease * 22.5;
      out.heading = outward ? Math.PI : 0;
    },
  },
  {
    scale: [0.6, 0.34, 1.9],
    color: "#d9634a",
    motion: (t, out) => {
      const a = t * 0.045;
      out.x = 14 + Math.cos(a) * 16;
      out.z = -34.5 + Math.sin(a) * 3.5;
      out.heading = Math.atan2(-Math.sin(a) * 16, Math.cos(a) * 3.5);
    },
  },
  {
    scale: [0.5, 0.3, 1.6],
    color: "#3f6c8f",
    motion: (t, out) => {
      const a = -t * 0.06 + 2;
      out.x = -32 + Math.cos(a) * 9;
      out.z = -33 + Math.sin(a) * 3;
      out.heading = Math.atan2(Math.sin(a) * 9, -Math.cos(a) * 3);
    },
  },
];

function BayBoats({ tick }: { tick: number }) {
  const model = useMemo<BoatModel>(() => boatModel(), []);
  const groups = useRef<Group[]>([]);
  const state = useMemo(() => ({ x: 0, z: 0, heading: 0 }), []);
  const res = useMemo(
    () => ({
      hulls: bayBoats.map((b) => new MeshPhysicalMaterial({ vertexColors: true, color: b.color, roughness: 0.35, clearcoat: 0.8 })),
      deck: new MeshStandardMaterial({ color: "#c9a77f", roughness: 0.8 }),
      cabin: new MeshStandardMaterial({ color: "#f4f2ec", roughness: 0.45 }),
      glass: new MeshStandardMaterial({ color: "#1a252e", roughness: 0.05, metalness: 0.85 }),
      wake: new MeshBasicMaterial({ color: "#e8eef0", transparent: true, opacity: 0.35, depthWrite: false }),
    }),
    [],
  );
  useFrame(({ clock }) => {
    const level = waterLevel(tick) - 0.02;
    bayBoats.forEach((b, i) => {
      const g = groups.current[i];
      if (!g) return;
      b.motion(clock.elapsedTime, state);
      g.position.set(state.x, level + Math.sin(clock.elapsedTime * 1.3 + i) * 0.02, state.z);
      g.rotation.set(Math.sin(clock.elapsedTime * 0.9 + i) * 0.03, state.heading, Math.sin(clock.elapsedTime * 1.1 + i * 2) * 0.04);
    });
  });
  return (
    <>
      {bayBoats.map((b, i) => (
        <group key={i} ref={(g) => { if (g) groups.current[i] = g; }}>
          <group scale={b.scale}>
            <mesh geometry={model.hull} material={res.hulls[i]} />
            <mesh geometry={model.deck} material={res.deck} />
            <mesh geometry={model.cabin} material={res.cabin} />
            <mesh geometry={model.glass} material={res.glass} />
          </group>
          <mesh position={[0, 0.01, -b.scale[2] * 0.9]} rotation={[-Math.PI / 2, 0, 0]} material={res.wake}>
            <planeGeometry args={[b.scale[0] * 1.4, b.scale[2] * 1.1]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A coastguard helicopter circling the bay, watching the surge. */
function Helicopter() {
  const body = useRef<Group>(null);
  const rotor = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const beacon = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const a = t * 0.16;
    if (body.current) {
      body.current.position.set(4 + Math.cos(a) * 11, 7.5 + Math.sin(t * 0.7) * 0.25, -27 + Math.sin(a) * 7);
      body.current.rotation.set(0, Math.atan2(-Math.sin(a) * 11, Math.cos(a) * 7), -0.18);
    }
    if (rotor.current) rotor.current.rotation.y += delta * 22;
    if (tail.current) tail.current.rotation.x += delta * 30;
    if (beacon.current) beacon.current.emissiveIntensity = Math.sin(t * 6) > 0.6 ? 4 : 0.2;
  });
  return (
    <group ref={body}>
      <mesh scale={[0.5, 0.48, 0.95]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#d9443a" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.08, 0.55]} scale={[0.38, 0.3, 0.42]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#1d2830" roughness={0.05} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.12, -1.4]}>
        <boxGeometry args={[0.14, 0.16, 1.6]} />
        <meshStandardMaterial color="#f1efe8" />
      </mesh>
      <mesh position={[0, 0.38, -2.15]}>
        <boxGeometry args={[0.05, 0.5, 0.32]} />
        <meshStandardMaterial color="#d9443a" />
      </mesh>
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, -0.55, 0]}>
          <boxGeometry args={[0.05, 0.05, 1.3]} />
          <meshStandardMaterial color="#2c3338" />
        </mesh>
      ))}
      <group ref={rotor} position={[0, 0.55, 0]}>
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} rotation={[0, r, 0]}>
            <boxGeometry args={[3.6, 0.02, 0.12]} />
            <meshStandardMaterial color="#2c3338" />
          </mesh>
        ))}
      </group>
      <group ref={tail} position={[0.1, 0.38, -2.15]}>
        <mesh>
          <boxGeometry args={[0.02, 0.7, 0.07]} />
          <meshStandardMaterial color="#2c3338" />
        </mesh>
      </group>
      <mesh position={[0, -0.45, 0.2]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial ref={beacon} color="#ffd9d0" emissive="#ff3b2e" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ flood defences */

/** Sandbag walls along the town quay, either side of the river mouth. */
function Sandbags() {
  const res = useMemo(() => {
    const items: Placement[] = [];
    const colours = ["#b8a27c", "#a99572", "#c1ad86"];
    let i = 0;
    for (const [x0, x1] of [[-12.8, -2.5], [3.3, 12.8]] as const) {
      for (let layer = 0; layer < 2; layer++) {
        for (let x = x0 + (layer ? 0.17 : 0); x < x1; x += 0.34, i++) {
          for (const z of layer ? [HARBOUR + 1.68] : [HARBOUR + 1.55, HARBOUR + 1.8]) {
            items.push({ at: [x, GROUND + 0.055 + layer * 0.1, z], turn: (rand(i * 3 + layer) - 0.5) * 0.15, scale: [0.17, 0.065, 0.11], color: colours[i % 3] });
          }
        }
      }
    }
    return { items, geometry: new SphereGeometry(1, 8, 6), material: new MeshStandardMaterial({ roughness: 1 }) };
  }, []);
  return <Instances geometry={res.geometry} material={res.material} items={res.items} shadows={false} />;
}

/* ------------------------------------------------------------------ outskirts */

export function Outskirts({ tick }: { tick: number }) {
  return (
    <>
      <Estate />
      <Railway />
      <Port tick={tick} />
      <Farmland />
      <FarShore />
      <Traffic />
      <BayBoats tick={tick} />
      <Helicopter />
      <Sandbags />
    </>
  );
}
