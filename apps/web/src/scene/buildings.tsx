import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshStandardMaterial } from "three";
import { type Prop, type Surface, useProp, useSurface } from "./assets";
import { CORE, GROUND, type Point, RIVER, blocked, rand, sites } from "./layout";
import { signTexture } from "./text";

function Gable({ width, depth, height, rise, surface, tint }: { width: number; depth: number; height: number; rise: number; surface: Surface; tint: string }) {
  const roof = useSurface(surface, 2, 1.5);
  const slope = Math.hypot(width / 2, rise);
  const angle = Math.atan2(rise, width / 2);
  return (
    <group position={[0, height, 0]}>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * width) / 4, rise / 2, 0]}
          rotation={[0, 0, -side * angle]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[slope + 0.14, 0.05, depth + 0.16]} />
          <meshStandardMaterial {...roof} color={tint} roughness={0.85} />
        </mesh>
      ))}
      {/* Triangular gable ends fill the wall under the roof pitch. */}
      <mesh position={[0, rise / 3 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[width / 2 / 0.866, 1, rise / 1.5]}>
        <cylinderGeometry args={[1, 1, depth - 0.02, 3, 1, false, Math.PI]} />
        <meshStandardMaterial color="#e6dfd2" />
      </mesh>
    </group>
  );
}

function Windows({ width, floors, lit, front, seed }: { width: number; floors: number; lit: boolean | "mixed"; front: number; seed: number }) {
  const cols = Math.max(2, Math.round(width / 0.55));
  return (
    <>
      {Array.from({ length: floors }, (_, f) =>
        Array.from({ length: cols }, (_, c) => {
          const on = lit === "mixed" ? rand(seed + f * 7 + c) > 0.45 : lit;
          const x = -width / 2 + ((c + 0.5) * width) / cols;
          return (
            <mesh key={`${f}-${c}`} position={[x, 0.42 + f * 0.62, front]}>
              <boxGeometry args={[0.24, 0.28, 0.02]} />
              <meshStandardMaterial
                color={on ? "#ffe2a8" : "#3b4448"}
                emissive={on ? "#ffc66b" : "#000000"}
                emissiveIntensity={on ? 1.1 : 0}
                roughness={0.2}
                metalness={on ? 0 : 0.4}
              />
            </mesh>
          );
        }),
      )}
    </>
  );
}

export function House({ at, turn = 0, floors = 1, tint, seed }: { at: Point; turn?: number; floors?: number; tint: string; seed: number }) {
  const walls = useSurface("painted_plaster_wall", 1, 1);
  const width = 1.5;
  const depth = 1.2;
  const height = floors * 0.62 + 0.1;
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial {...walls} color={tint} />
      </mesh>
      <Gable width={width} depth={depth} height={height} rise={0.45} surface="grey_roof_tiles" tint={rand(seed) > 0.5 ? "#c9877a" : "#8a96a3"} />
      <Windows width={width} floors={floors} lit="mixed" front={depth / 2 + 0.005} seed={seed} />
      <mesh position={[0.45, height + 0.42, -0.2]} castShadow>
        <boxGeometry args={[0.16, 0.36, 0.16]} />
        <meshStandardMaterial color="#8d867c" />
      </mesh>
      <mesh position={[-0.5, 0.22, depth / 2 + 0.01]}>
        <boxGeometry args={[0.24, 0.44, 0.03]} />
        <meshStandardMaterial color="#5b4636" />
      </mesh>
    </group>
  );
}

function PropAt({ name, height, at, turn = 0 }: { name: Prop; height: number; at: Point; turn?: number }) {
  const object = useProp(name, height);
  return <primitive object={object} position={at} rotation={[0, turn, 0]} />;
}

/** A closed relief crate, one per crate in the engine's inventory; matches the truck cargo. */
export function Crate({ at, turn = 0 }: { at: Point; turn?: number }) {
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.075, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.15, 0.18]} />
        <meshStandardMaterial color="#3e6fb0" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.152, 0]} castShadow>
        <boxGeometry args={[0.23, 0.016, 0.19]} />
        <meshStandardMaterial color="#e9eef5" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.08, 0.091]}>
        <planeGeometry args={[0.1, 0.05]} />
        <meshStandardMaterial color="#f4f4f5" />
      </mesh>
    </group>
  );
}

/** Stacks `count` crates on a pallet grid of `cols` x `rows`, filling upward. */
export function CrateStack({ count, at, cols = 3, rows = 2, turn = 0 }: { count: number; at: Point; cols?: number; rows?: number; turn?: number }) {
  return (
    <group position={at} rotation={[0, turn, 0]}>
      {count > 0 && (
        <mesh position={[0, 0.02, 0]} receiveShadow castShadow>
          <boxGeometry args={[cols * 0.27 + 0.06, 0.04, rows * 0.22 + 0.06]} />
          <meshStandardMaterial color="#a88a62" roughness={0.9} />
        </mesh>
      )}
      {Array.from({ length: count }, (_, i) => {
        const layer = Math.floor(i / (cols * rows));
        const slot = i % (cols * rows);
        const x = ((slot % cols) - (cols - 1) / 2) * 0.27;
        const z = (Math.floor(slot / cols) - (rows - 1) / 2) * 0.22;
        return <Crate key={i} at={[x, 0.04 + layer * 0.165, z]} turn={rand(i) * 0.12 - 0.06} />;
      })}
    </group>
  );
}

function Sign({ text, background, color, at, width = 1.2 }: { text: string; background: string; color?: string; at: Point; width?: number }) {
  const map = signTexture(text, background, color);
  return (
    <mesh position={at} castShadow>
      <boxGeometry args={[width, width / 4, 0.03]} />
      <meshStandardMaterial map={map} emissive="#ffffff" emissiveMap={map} emissiveIntensity={0.18} />
    </mesh>
  );
}

export function Depot({ stock }: { stock: number }) {
  const iron = useSurface("corrugated_iron", 3, 1);
  const apron = useSurface("brushed_concrete", 2, 2);
  const { at, turn } = sites.D;
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0.3, 0.012, 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.4, 3.8]} />
        <meshStandardMaterial {...apron} color="#cfccc4" />
      </mesh>
      <mesh position={[0, 0.6, -0.4]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.2, 2]} />
        <meshStandardMaterial {...iron} color="#8fa3ad" metalness={0.35} roughness={0.55} />
      </mesh>
      <Gable width={3.2} depth={2} height={1.2} rise={0.32} surface="corrugated_iron" tint="#6d7c86" />
      <mesh position={[-0.4, 0.46, 0.61]}>
        <boxGeometry args={[1.3, 0.92, 0.03]} />
        <meshStandardMaterial {...iron} color="#cdd3d6" metalness={0.4} roughness={0.5} />
      </mesh>
      <Sign text="SUPPLY DEPOT" background="#18181b" at={[0.8, 1.02, 0.62]} width={1.1} />
      {/* The engine's depot stock, one crate each. */}
      <CrateStack count={stock} at={[1.15, 0.01, 1.3]} cols={3} rows={2} />
      <PropAt name="Barrel_01" height={0.24} at={[-1.55, 0, 0.9]} />
      <PropAt name="Barrel_01" height={0.24} at={[-1.3, 0, 1.05]} turn={1.2} />
      <PropAt name="medical_box" height={0.1} at={[-1.0, 0, 1.3]} turn={0.3} />
      <PropAt name="plastic_crate_02" height={0.14} at={[-0.95, 0, 0.85]} turn={0.1} />
      <PropAt name="plastic_crate_02" height={0.14} at={[-0.95, 0.14, 0.85]} turn={-0.2} />
    </group>
  );
}

function Generator({ powered }: { powered: boolean }) {
  const light = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (light.current) {
      light.current.emissiveIntensity = powered ? 1.6 : Math.sin(clock.elapsedTime * 5) > 0 ? 2.6 : 0.1;
    }
  });
  return (
    <group position={[1.75, 0, 0.5]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[0.45, 0.32, 0.3]} />
        <meshStandardMaterial color="#4f5b62" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.16, 0.36, 0.1]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshStandardMaterial ref={light} color={powered ? "#2f9e6b" : "#e5484d"} emissive={powered ? "#2f9e6b" : "#e5484d"} />
      </mesh>
    </group>
  );
}

export function SchoolShelter({ powered, delivered }: { powered: boolean; delivered: number }) {
  const brick = useSurface("brick_wall_001", 2.5, 1.2);
  const { at, turn } = sites.S;
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.4, 1.9]} />
        <meshStandardMaterial {...brick} color="#e3c7b6" />
      </mesh>
      <mesh position={[0, 1.44, 0]} castShadow>
        <boxGeometry args={[3.35, 0.1, 2.05]} />
        <meshStandardMaterial color="#d8d3c9" />
      </mesh>
      <group position={[0, 0, 0]}>
        <Windows width={3} floors={2} lit={powered} front={0.96} seed={11} />
      </group>
      <mesh position={[0, 0.25, 0.97]}>
        <boxGeometry args={[0.5, 0.5, 0.03]} />
        <meshStandardMaterial color={powered ? "#f6d9a0" : "#3a4246"} emissive={powered ? "#ffc66b" : "#000000"} emissiveIntensity={powered ? 0.8 : 0} />
      </mesh>
      <Sign text="SCHOOL SHELTER" background="#2f6fe4" at={[0, 1.66, 0.6]} width={1.4} />
      <Generator powered={powered} />
      <CrateStack count={delivered} at={[-1.1, 0, 1.45]} cols={3} rows={2} />
    </group>
  );
}

export function EastShelter({ delivered }: { delivered: number }) {
  const walls = useSurface("painted_plaster_wall", 2, 1);
  const { at, turn } = sites.E;
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 1.1, 1.7]} />
        <meshStandardMaterial {...walls} color="#e9e1cf" />
      </mesh>
      <Gable width={2.8} depth={1.7} height={1.1} rise={0.5} surface="grey_roof_tiles" tint="#7d8c99" />
      <Windows width={2.6} floors={1} lit front={0.86} seed={21} />
      <mesh position={[0, 0.26, 0.86]}>
        <boxGeometry args={[0.46, 0.52, 0.03]} />
        <meshStandardMaterial color="#f3dfb5" emissive="#ffc66b" emissiveIntensity={0.6} />
      </mesh>
      <Sign text="EAST SHELTER" background="#2f9e6b" at={[0, 1.32, 0.95]} width={1.2} />
      <CrateStack count={delivered} at={[1.05, 0, 1.35]} cols={3} rows={2} />
    </group>
  );
}

function Tree({ at, scale, seed }: { at: Point; scale: number; seed: number }) {
  const greens = ["#3f6b3d", "#4c7a45", "#365e3a", "#5a8250"];
  const conifer = rand(seed * 5) > 0.55;
  return (
    <group position={at} scale={scale} rotation={[0, rand(seed) * 6, 0]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.7, 7]} />
        <meshStandardMaterial color="#6b5544" roughness={1} />
      </mesh>
      {conifer
        ? [0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.6 + i * 0.32, 0]} castShadow>
              <coneGeometry args={[0.48 - i * 0.12, 0.7, 8]} />
              <meshStandardMaterial color={greens[(seed + i) % 4]} roughness={0.9} flatShading />
            </mesh>
          ))
        : [
            [0, 0.95, 0, 0.45],
            [0.22, 0.8, 0.1, 0.32],
            [-0.18, 0.85, -0.12, 0.34],
            [0.05, 1.18, -0.05, 0.3],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x!, y!, z!]} castShadow>
              <icosahedronGeometry args={[r!, 1]} />
              <meshStandardMaterial color={greens[(seed + i) % 4]} roughness={0.9} flatShading />
            </mesh>
          ))}
    </group>
  );
}

function WaterTower() {
  return (
    <group position={[11.2, GROUND, -2.4]}>
      {[-0.4, 0.4].flatMap((x) =>
        [-0.4, 0.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.1, z]} castShadow>
            <boxGeometry args={[0.07, 2.2, 0.07]} />
            <meshStandardMaterial color="#6b777d" metalness={0.5} roughness={0.5} />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.45, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.66, 0.9, 20]} />
        <meshStandardMaterial color="#c9d1cf" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.05, 0]} castShadow>
        <coneGeometry args={[0.75, 0.32, 20]} />
        <meshStandardMaterial color="#5d6b74" />
      </mesh>
    </group>
  );
}

function Quay() {
  const planks = useSurface("weathered_planks", 3, 0.5);
  return (
    <group position={[6.5, 0, -12.2]}>
      <mesh position={[0, GROUND - 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.08, 1.2]} />
        <meshStandardMaterial {...planks} color="#b9a58c" />
      </mesh>
      {[-1.6, 0.4, 2.2].map((x, i) => (
        <group key={x} position={[x, -0.1, -1.4]} rotation={[0, 0.08 * (i - 1), 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.26, 1.5]} />
            <meshStandardMaterial color={["#e8e3d6", "#d9634a", "#3f6c8f"][i]} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.24, -0.1]} castShadow>
            <boxGeometry args={[0.4, 0.24, 0.5]} />
            <meshStandardMaterial color="#f1efe8" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const houseRows: { at: Point; turn: number; floors: number }[] = [
  ...[-11.2, -8.8, -6.4, -4.0].map((x, i) => ({ at: [x, GROUND, -8.2] as Point, turn: 0, floors: 1 + (i % 2) })),
  ...[4.6, 10.4].map((x, i) => ({ at: [x, GROUND, -9] as Point, turn: 0, floors: 2 - i })),
  ...[-11.6, -9.2].map((x) => ({ at: [x, GROUND, -3.6] as Point, turn: Math.PI / 2, floors: 2 })),
  ...[-10.5, -8, -3.6, -1.1, 2.6].map((x, i) => ({ at: [x, GROUND, 7.6] as Point, turn: Math.PI, floors: 1 + (i % 2) })),
  ...[-10, -7.4, -4.8, -2.2, 0.4, 3].map((x, i) => ({ at: [x, GROUND, 11] as Point, turn: Math.PI, floors: 1 + ((i + 1) % 2) })),
  ...[4.8, 11.6].map((x) => ({ at: [x, GROUND, 1.4] as Point, turn: -Math.PI / 2, floors: 1 })),
];
const tints = ["#efe6d4", "#e7d6c4", "#d8e1e2", "#e9d9b7", "#dfe6d6", "#f1ddd2"];

/** Neighbourhood dressing: houses, trees, shrubs, lamps and benches placed off the road graph. */
export function Neighbourhood({ compact }: { compact: boolean }) {
  const trees = useMemo(() => {
    const result: { at: Point; scale: number; seed: number }[] = [];
    // Inside the playable core only; the outer districts plant their own instanced trees.
    for (let i = 0; result.length < (compact ? 30 : 55) && i < 1500; i++) {
      const x = CORE.x0 + 0.4 + rand(i * 2 + 1) * (CORE.x1 - CORE.x0 - 0.8);
      const z = CORE.z0 + 1.2 + rand(i * 3 + 7) * (CORE.z1 - CORE.z0 - 1.6);
      if (blocked(x, z, 1.7)) continue;
      if (x > 4.2 && x < 11.4 && z > -3.2 && z < 1.4) continue; // keep the school frontage visible
      if (rand(i * 13) > 0.5) continue;
      if (houseRows.some((h) => Math.abs(h.at[0] - x) < 1.2 && Math.abs(h.at[2] - z) < 1.1)) continue;
      result.push({ at: [x, GROUND, z], scale: 0.85 + rand(i * 5) * 0.6, seed: i });
    }
    return result;
  }, [compact]);
  const lamps: Point[] = [
    [-4.2, GROUND, 5.1],
    [-4.4, GROUND, -0.6],
    [-2.3, GROUND, -3.9],
    [4.4, GROUND, -3.9],
    [3.2, GROUND, 0.8],
    [0.2, GROUND, 5.6],
    [5.2, GROUND, 6.4],
  ];
  return (
    <>
      {houseRows.map((h, i) => (
        <House key={i} at={h.at} turn={h.turn} floors={h.floors} tint={tints[i % tints.length]!} seed={i} />
      ))}
      {trees.map((t) => (
        <Tree key={t.seed} at={t.at} scale={t.scale} seed={t.seed} />
      ))}
      {!compact &&
        [
          [-6.2, 6.0],
          [-2.8, 6.2],
          [5.4, -1.4],
          [9.9, -2.4],
          [-9.6, -1.6],
          [2.8, 9.4],
          [10.6, 5.6],
          [-0.4, 9.1],
        ].map(([x, z], i) => (
          <PropAt key={i} name={i % 2 ? "shrub_03" : "shrub_sorrel_01"} height={0.32 + (i % 3) * 0.06} at={[x!, GROUND, z!]} turn={i} />
        ))}
      {lamps.map((at, i) => (
        <PropAt key={i} name="street_lamp_02" height={1.25} at={at} turn={i * 0.9} />
      ))}
      {!compact && (
        <>
          <PropAt name="painted_wooden_bench" height={0.13} at={[6.0, GROUND, -1.9]} turn={Math.PI} />
          <PropAt name="painted_wooden_bench" height={0.13} at={[7.6, GROUND, 6.9]} />
        </>
      )}
      <WaterTower />
      <Quay />
      {/* Sand shoreline where the river meets the lawns. */}
      <Shore />
    </>
  );
}

function Shore() {
  const sand = useSurface("damp_beach_sand", 1, 6);
  return (
    <>
      {[RIVER.west - 0.15, RIVER.east + 0.15].map((x) => (
        <mesh key={x} position={[x, GROUND + 0.004, -6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.32, 12.4]} />
          <meshStandardMaterial {...sand} color="#bfb29a" polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
      <mesh position={[0, GROUND + 0.004, -11.85]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 0.3]} />
        <meshStandardMaterial {...sand} color="#bfb29a" polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </>
  );
}
