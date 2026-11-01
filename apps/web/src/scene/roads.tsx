import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  type Mesh,
  type MeshStandardMaterial,
  RepeatWrapping,
  type Texture,
} from "three";
import type { Scenario } from "@crisiscraft/contracts";
import { harborPoint } from "@crisiscraft/sim";
import { useProp, useSurface } from "./assets";
import { BRIDGE, BRIDGE_DECK, GROUND, RIVER, node, type Point, roadHeight } from "./layout";
import { chevronTexture, signTexture, stripeTexture } from "./text";

/** A flat strip that follows the road surface height, with v measured in scene units. */
function ribbon(a: Point, b: Point, width: number, lift: number, step = 0.25) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(length / step));
  const nx = -dz / length;
  const nz = dx / length;
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a[0] + dx * t;
    const z = a[2] + dz * t;
    const y = roadHeight(x, z) + lift;
    for (const side of [-1, 1]) {
      position.push(x + (nx * width * side) / 2, y, z + (nz * width * side) / 2);
      uv.push((side + 1) / 2, length * t);
    }
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
  return geometry;
}

function dashTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 6, 8, 30);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 1.4);
  return texture;
}

function Segment({ a, b, asphalt, kerb, dashes }: { a: Point; b: Point; asphalt: Texture[]; kerb: Texture[]; dashes: Texture }) {
  const geometry = useMemo(
    () => ({ road: ribbon(a, b, 1.0, 0.012), kerb: ribbon(a, b, 1.34, 0.004), line: ribbon(a, b, 0.05, 0.02) }),
    [a, b],
  );
  return (
    <>
      <mesh geometry={geometry.kerb} receiveShadow>
        <meshStandardMaterial map={kerb[0]} normalMap={kerb[1]} color="#d9d6cf" roughness={0.9} />
      </mesh>
      <mesh geometry={geometry.road} receiveShadow>
        <meshStandardMaterial
          map={asphalt[0]}
          normalMap={asphalt[1]}
          roughnessMap={asphalt[2]}
          color="#8f9396"
          roughness={0.75}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh geometry={geometry.line}>
        <meshStandardMaterial
          color="#f1ead2"
          alphaMap={dashes}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-3}
        />
      </mesh>
    </>
  );
}

/** Asphalt network for every scenario edge, junction pads, and the north bridge structure. */
export function Roads({ scenario = harborPoint }: { scenario?: Scenario }) {
  const asphaltSet = useSurface("asphalt_02", 1, 1);
  const kerbSet = useSurface("brushed_concrete", 1, 1);
  const asphalt = useMemo(() => [asphaltSet.map, asphaltSet.normalMap, asphaltSet.roughnessMap!], [asphaltSet]);
  const kerb = useMemo(() => [kerbSet.map, kerbSet.normalMap], [kerbSet]);
  const dashes = useMemo(() => dashTexture(), []);
  return (
    <>
      {scenario.edges.map((e) => (
        <Segment key={e.id} a={node(e.from, scenario)} b={node(e.to, scenario)} asphalt={asphalt} kerb={kerb} dashes={dashes} />
      ))}
      {scenario.nodes.map((n) => (
        <group key={n.id} position={[n.x, GROUND, n.z]}>
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[0.8, 28]} />
            <meshStandardMaterial map={kerb[0]} color="#d9d6cf" />
          </mesh>
          <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[0.6, 28]} />
            <meshStandardMaterial map={asphalt[0]} color="#8f9396" polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        </group>
      ))}
      <Bridge />
    </>
  );
}

function Bridge() {
  const span = BRIDGE.x1 - BRIDGE.x0;
  const deckX = (BRIDGE.x0 + BRIDGE.x1) / 2;
  const posts = 11;
  return (
    <group>
      {/* Deck slab and parapets; the asphalt ribbon above already follows the deck height. */}
      <mesh position={[deckX, BRIDGE_DECK - 0.12, BRIDGE.z]} castShadow receiveShadow>
        <boxGeometry args={[span, 0.22, 1.5]} />
        <meshStandardMaterial color="#b9b6ae" roughness={0.85} />
      </mesh>
      {[-0.72, 0.72].map((side) => (
        <group key={side}>
          <mesh position={[deckX, BRIDGE_DECK + 0.26, BRIDGE.z + side]} castShadow>
            <boxGeometry args={[span, 0.05, 0.06]} />
            <meshStandardMaterial color="#5f6a70" metalness={0.6} roughness={0.4} />
          </mesh>
          {Array.from({ length: posts }, (_, i) => (
            <mesh key={i} position={[BRIDGE.x0 + (i * span) / (posts - 1), BRIDGE_DECK + 0.13, BRIDGE.z + side]} castShadow>
              <boxGeometry args={[0.05, 0.26, 0.05]} />
              <meshStandardMaterial color="#5f6a70" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Piers stand in the river; the rising water swallows more of them each minute. */}
      {[RIVER.west + 0.9, RIVER.east - 0.9].map((x) => (
        <mesh key={x} position={[x, -0.4, BRIDGE.z]} castShadow>
          <boxGeometry args={[0.36, 1.8, 1.1]} />
          <meshStandardMaterial color="#9c9a93" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Beacon({ phase }: { phase: number }) {
  const material = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (material.current) {
      const on = Math.sin(clock.elapsedTime * 6 + phase) > 0;
      material.current.emissiveIntensity = on ? 3.2 : 0.15;
    }
  });
  return (
    <mesh>
      <sphereGeometry args={[0.05, 12, 10]} />
      <meshStandardMaterial ref={material} color="#ffb547" emissive="#ff9a1f" emissiveIntensity={2} />
    </mesh>
  );
}

export function Barrier({ at, turn = Math.PI / 2 }: { at: Point; turn?: number }) {
  const block = useProp("concrete_road_barrier_02", 0.2);
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <primitive object={block} />
      <group position={[0, 0.25, 0]}>
        <Beacon phase={at[0] + at[2]} />
      </group>
    </group>
  );
}

/** Concrete blocks, beacons and a sign at both bridge ends once the engine closes edge JS. */
export function BridgeClosure({ closed, warning }: { closed: boolean; warning: boolean }) {
  const stripes = stripeTexture();
  const sign = signTexture("ROAD CLOSED", "#e5484d");
  const caution = signTexture("FLOOD RISK", "#e8a317", "#18181b");
  const ends = [BRIDGE.x0 - BRIDGE.ramp - 0.1, BRIDGE.x1 + BRIDGE.ramp + 0.1];
  if (!closed) {
    return warning ? (
      <group position={[ends[0]! - 0.3, GROUND, BRIDGE.z + 0.85]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.5, 0.16, 0.02]} />
          <meshStandardMaterial map={caution} />
        </mesh>
        <mesh position={[0, 0.16, -0.012]}>
          <boxGeometry args={[0.03, 0.32, 0.02]} />
          <meshStandardMaterial color="#52525b" />
        </mesh>
      </group>
    ) : null;
  }
  return (
    <>
      {ends.map((x) => (
        <group key={x}>
          <Barrier at={[x, roadHeight(x, BRIDGE.z), BRIDGE.z - 0.27]} />
          <Barrier at={[x, roadHeight(x, BRIDGE.z), BRIDGE.z + 0.27]} />
          <mesh position={[x, GROUND + 0.42, BRIDGE.z]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[1.05, 0.1, 0.03]} />
            <meshStandardMaterial map={stripes} />
          </mesh>
          <mesh position={[x, GROUND + 0.6, BRIDGE.z]} rotation={[0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[0.6, 0.15, 0.02]} />
            <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Glowing chevrons scroll along the proposed route; closed legs turn coral. */
export function RouteGlow({ route, roads, scenario = harborPoint }: { route: string[]; roads: Record<string, boolean>; scenario?: Scenario }) {
  const chevrons = useMemo(() => {
    const t = chevronTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(1, 1.6);
    t.needsUpdate = true;
    return t;
  }, []);
  const legs = useMemo(
    () =>
      route.slice(1).map((to, i) => {
        const from = route[i]!;
        const edge = scenario.edges.find((e) => (e.from === from && e.to === to) || (e.to === from && e.from === to));
        return { key: `${from}-${to}`, edgeId: edge?.id ?? "", geometry: ribbon(node(from, scenario), node(to, scenario), 0.42, 0.035) };
      }),
    [route, scenario],
  );
  const meshes = useRef<Mesh[]>([]);
  useFrame(({ clock }) => {
    chevrons.offset.y = -clock.elapsedTime * 0.9;
    meshes.current.forEach((m) => {
      const material = m?.material as MeshStandardMaterial | undefined;
      if (material) material.opacity = 0.7 + Math.sin(clock.elapsedTime * 3) * 0.2;
    });
  });
  return (
    <>
      {legs.map((leg, i) => {
        const open = roads[leg.edgeId] !== false;
        return (
          <mesh
            key={leg.key}
            ref={(m) => {
              if (m) meshes.current[i] = m;
            }}
            geometry={leg.geometry}
          >
            <meshStandardMaterial
              color={open ? "#f2611d" : "#e5484d"}
              emissive={open ? "#f2611d" : "#e5484d"}
              emissiveIntensity={1.4}
              alphaMap={chevrons}
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-4}
            />
          </mesh>
        );
      })}
    </>
  );
}
