import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  type Group,
  type InstancedMesh,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WorldState } from "@crisiscraft/contracts";
import { CRUISE, GROUND, type Point, helipads, scenarioOf } from "./layout";
import { signTexture } from "./text";

/**
 * The coastguard rescue helicopter: one procedural model, merged into a handful of meshes by
 * material, shared by the gameplay aircraft and the decorative one circling the tutorial bay.
 * Nose points +z; the skids rest on y = 0.
 */

const merge = (parts: BufferGeometry[]) => {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => {
    p.deleteAttribute("uv");
    return p;
  }));
  g.computeBoundingSphere();
  return g;
};

function buildParts() {
  const up = (g: BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);
  // Fuselage: a capsule lying along z, slightly taller than wide, with a low engine fairing on top.
  const body = new CapsuleGeometry(0.42, 1.25, 6, 14).rotateX(Math.PI / 2).scale(1, 1.05, 1);
  const cowling = up(new CapsuleGeometry(0.2, 0.62, 4, 10).rotateX(Math.PI / 2).scale(1.15, 0.8, 1), 0, 0.4, -0.2);
  const boom = up(new CylinderGeometry(0.085, 0.17, 1.65, 10).rotateX(Math.PI / 2), 0, 0.2, -1.55);
  const stab = up(new BoxGeometry(0.7, 0.03, 0.18), 0, 0.22, -2.1);
  const white = merge([body, cowling, boom, stab]);
  // Coastguard livery: red belly stripe, red tail fin and red stabiliser tips.
  const stripe = up(new BoxGeometry(0.872, 0.16, 1.5), 0, -0.18, -0.02);
  const fin = up(new BoxGeometry(0.05, 0.62, 0.36), 0, 0.5, -2.32);
  const tips = [-1, 1].map((sd) => up(new BoxGeometry(0.06, 0.12, 0.2), sd * 0.35, 0.26, -2.1));
  const red = merge([stripe, fin, ...tips]);
  // Dark parts: skids and struts, rotor mast and hub, winch arm and cable, searchlight housing.
  const skidL = up(new CylinderGeometry(0.035, 0.035, 1.5, 6).rotateX(Math.PI / 2), -0.4, -0.38, 0.05);
  const skidR = up(new CylinderGeometry(0.035, 0.035, 1.5, 6).rotateX(Math.PI / 2), 0.4, -0.38, 0.05);
  const struts = [-1, 1].flatMap((sd) => [0.42, -0.32].map((z) => up(new BoxGeometry(0.035, 0.32, 0.035).rotateZ(sd * -0.45), sd * 0.33, -0.24, z)));
  const mast = up(new CylinderGeometry(0.05, 0.07, 0.24, 8), 0, 0.62, -0.05);
  const hub = up(new CylinderGeometry(0.13, 0.13, 0.07, 10), 0, 0.76, -0.05);
  const winch = up(new BoxGeometry(0.4, 0.05, 0.06), 0.56, 0.36, 0.32);
  const hook = up(new CylinderGeometry(0.008, 0.008, 0.36, 4), 0.74, 0.17, 0.32);
  const light = up(new CylinderGeometry(0.07, 0.06, 0.1, 10), 0, -0.42, 0.55);
  const dark = merge([skidL, skidR, ...struts, mast, hub, winch, hook, light]);
  // Glazing: a dark windscreen bubble at the nose and a strip of cabin windows down each side.
  const canopy = up(new SphereGeometry(0.37, 16, 12).scale(1, 0.72, 0.85), 0, 0.12, 0.68);
  const windows = up(new BoxGeometry(0.855, 0.15, 0.7), 0, 0.12, 0.0);
  const glass = merge([canopy, windows]);
  // Four main blades and two tail blades, drawn in their own spinning groups.
  const blades = merge([0, 1, 2, 3].map((i) => new BoxGeometry(2.05, 0.022, 0.13).translate(1.05, 0, 0).rotateY((i * Math.PI) / 2)));
  const tail = merge([new BoxGeometry(0.02, 0.62, 0.07), new BoxGeometry(0.02, 0.07, 0.62)]);
  const lens = up(new CylinderGeometry(0.055, 0.055, 0.02, 10), 0, -0.48, 0.55);
  const beacon = new SphereGeometry(0.055, 8, 6);
  return { white, red, dark, glass, blades, tail, lens, beacon };
}

let shared: (ReturnType<typeof buildParts> & { materials: ReturnType<typeof materials> }) | null = null;
function materials() {
  return {
    white: new MeshStandardMaterial({ color: "#f3f1ec", roughness: 0.4, metalness: 0.15 }),
    red: new MeshStandardMaterial({ color: "#d3312b", roughness: 0.42, metalness: 0.15 }),
    dark: new MeshStandardMaterial({ color: "#2a3036", roughness: 0.55, metalness: 0.5 }),
    glass: new MeshStandardMaterial({ color: "#1a242c", roughness: 0.05, metalness: 0.85 }),
    blade: new MeshStandardMaterial({ color: "#23282c", roughness: 0.6, metalness: 0.3 }),
    lens: new MeshBasicMaterial({ color: "#fff6dc", toneMapped: false }),
  };
}
/** Built once for the whole scene; every helicopter reuses the same geometry and materials. */
const parts = () => (shared ??= { ...buildParts(), materials: materials() });

/** Main rotor speed in rad/s at full power; the tail rotor turns faster. */
const ROTOR = 26;

/**
 * The model. `power` (0 = parked, 1 = flying) is read every frame to spin the rotors up and down;
 * `searchlight` lights the lens. The caller moves and turns the group.
 */
export function HeliModel({ power, searchlight = false, side = "RESCUE" }: { power: { current: number }; searchlight?: boolean; side?: string }) {
  const p = parts();
  const rotor = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const beacon = useRef<MeshStandardMaterial>(null);
  const spin = useRef(0);
  const mark = useMemo(() => signTexture(side, "#f3f1ec", "#d3312b", 256, 64), [side]);
  useFrame(({ clock }, delta) => {
    spin.current = MathUtils.damp(spin.current, power.current, 1.6, delta);
    if (rotor.current) rotor.current.rotation.y += delta * ROTOR * spin.current;
    if (tail.current) tail.current.rotation.x += delta * ROTOR * 1.6 * spin.current;
    if (beacon.current) beacon.current.emissiveIntensity = power.current > 0.5 && Math.sin(clock.elapsedTime * 7) > 0.55 ? 4 : 0.15;
  });
  return (
    <group position={[0, 0.42, 0]}>
      <mesh geometry={p.white} material={p.materials.white} castShadow />
      <mesh geometry={p.red} material={p.materials.red} castShadow />
      <mesh geometry={p.dark} material={p.materials.dark} />
      <mesh geometry={p.glass} material={p.materials.glass} />
      {searchlight && <mesh geometry={p.lens} material={p.materials.lens} />}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.428, 0.02, -0.25]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[0.66, 0.16]} />
          <meshStandardMaterial map={mark} transparent />
        </mesh>
      ))}
      <group ref={rotor} position={[0, 0.8, -0.05]} rotation={[0, Math.PI / 4, 0]}>
        <mesh geometry={p.blades} material={p.materials.blade} castShadow />
      </group>
      <group ref={tail} position={[0.07, 0.5, -2.32]}>
        <mesh geometry={p.tail} material={p.materials.blade} />
      </group>
      <mesh geometry={p.beacon} position={[0, 0.62, -0.75]}>
        <meshStandardMaterial ref={beacon} color="#ffd9d0" emissive="#ff3b2e" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ gameplay flight */

const smooth = (t: number) => t * t * (3 - 2 * t);
export interface Flight {
  x: number;
  z: number;
  /** Height above the ground. */
  alt: number;
  heading: number;
  airborne: boolean;
}

/**
 * Where an aircraft is: on its pad when parked or waiting out the gusts, otherwise pad to pad along
 * the engine's leg, climbing out and settling in over the first and last fifth of the flight.
 */
export function flightOf(state: WorldState, id: string, progress: number, out: Flight) {
  const scenario = scenarioOf(state);
  const v = state.vehicles[id]!;
  const pad = (node: string) => helipads[node] ?? (() => {
    const n = scenario.nodes.find((c) => c.id === node)!;
    return [n.x, GROUND, n.z] as Point;
  })();
  if (!v.leg) {
    const at = pad(v.node);
    out.x = at[0];
    out.z = at[2];
    out.alt = 0;
    out.airborne = false;
    return out;
  }
  const a = pad(v.leg.from);
  const b = pad(v.leg.to);
  const span = Math.max(1, v.leg.arrivalTick - v.leg.enteredTick);
  const t = MathUtils.clamp((state.tick + progress - v.leg.enteredTick) / span, 0, 1);
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[2] + (b[2] - a[2]) * t;
  out.alt = CRUISE * Math.min(smooth(Math.min(1, t / 0.2)), smooth(Math.min(1, (1 - t) / 0.2)));
  out.heading = Math.atan2(b[0] - a[0], b[2] - a[2]);
  out.airborne = t > 0 && t < 1;
  return out;
}

/** The scenario's helicopter: parked, flying a leg, or sitting out the gusts on a landing zone. */
export function RescueHelicopter({ state, id, progress, onSelect }: { state: WorldState; id: string; progress: number; onSelect?: () => void }) {
  const group = useRef<Group>(null);
  const power = useRef(0);
  const flight = useMemo<Flight>(() => ({ x: 0, z: 0, alt: 0, heading: Math.PI / 2, airborne: false }), []);
  const heading = useRef(Math.PI / 2);
  const tilt = useRef(0);
  const start = flightOf(state, id, progress, { ...flight });
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    flightOf(state, id, progress, flight);
    if (state.vehicles[id]!.leg) heading.current = flight.heading;
    g.position.x = MathUtils.damp(g.position.x, flight.x, 5, delta);
    g.position.z = MathUtils.damp(g.position.z, flight.z, 5, delta);
    g.position.y = MathUtils.damp(g.position.y, GROUND + 0.02 + flight.alt, 5, delta);
    const diff = Math.atan2(Math.sin(heading.current - g.rotation.y), Math.cos(heading.current - g.rotation.y));
    g.rotation.y += diff * Math.min(delta * 3, 1);
    // Nose dips in forward flight and levels for the hover; rotors spool with the flight.
    tilt.current = MathUtils.damp(tilt.current, flight.airborne && flight.alt > CRUISE * 0.8 ? 0.12 : 0, 2.5, delta);
    g.rotation.x = tilt.current;
    power.current = state.vehicles[id]!.leg ? 1 : 0;
  });
  return (
    <group
      ref={group}
      position={[start.x, GROUND + 0.02 + start.alt, start.z]}
      rotation={[0, Math.PI / 2, 0]}
      scale={0.95}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <HeliModel power={power} searchlight side="COASTGUARD" />
    </group>
  );
}

/** Painted landing circles, the windsock at the port and a grounded sign while gusts close the air routes. */
export function Helipads({ grounded }: { grounded: boolean }) {
  const ring = useMemo(() => signTexture("H", "#2f3437", "#f3f1ec", 128, 128), []);
  const sign = useMemo(() => signTexture("GROUNDED · GUSTS", "#e5484d", "#ffffff", 768, 128), []);
  const sock = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!sock.current) return;
    const t = clock.elapsedTime;
    // Limp in a breeze, streaming and snapping in the gusts.
    const lift = grounded ? 1.45 + Math.sin(t * 9) * 0.06 : 0.55 + Math.sin(t * 1.3) * 0.12;
    // Rotation 0 is straight out; it droops towards the pole as the wind drops.
    sock.current.rotation.z = -(1.5 - lift);
    sock.current.rotation.y = grounded ? Math.sin(t * 4.3) * 0.18 : Math.sin(t * 0.6) * 0.4;
  });
  const port = helipads.P!;
  return (
    <>
      {Object.entries(helipads).map(([id, at]) => (
        <group key={id} position={[at[0], GROUND + 0.012, at[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.3, 32]} />
            <meshStandardMaterial map={ring} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <ringGeometry args={[1.3, 1.42, 32]} />
            <meshStandardMaterial color="#e8a317" polygonOffset polygonOffsetFactor={-3} />
          </mesh>
        </group>
      ))}
      {/* Windsock and grounded board at the port helipad. */}
      <group position={[port[0] + 1.9, GROUND, port[2] - 1.2]}>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 1.2, 6]} />
          <meshStandardMaterial color="#c9ccd0" metalness={0.5} roughness={0.4} />
        </mesh>
        <group ref={sock} position={[0, 1.18, 0]}>
          <mesh position={[0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.05, 0.56, 10, 1, true]} />
            <meshStandardMaterial color="#ff6a1f" side={2} roughness={0.8} />
          </mesh>
        </group>
        {grounded && (
          <group position={[0.3, 0, 1.45]}>
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[1.8, 0.3, 0.04]} />
              <meshStandardMaterial map={sign} />
            </mesh>
            {[-0.8, 0.8].map((x) => (
              <mesh key={x} position={[x, 0.15, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.3, 5]} />
                <meshStandardMaterial color="#52525b" />
              </mesh>
            ))}
          </group>
        )}
      </group>
    </>
  );
}

/* ------------------------------------------------------------------ air-route arc */

const DASHES = 30;
/**
 * A planned or tested flight, drawn as a dashed arc in the sky from pad to pad: one instanced
 * mesh, built once per route. Orange while the air route is open, red when gusts close it.
 */
export function AirArc({ from, to, closed }: { from: string; to: string; closed: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const res = useMemo(() => ({
    geometry: new CapsuleGeometry(0.13, 0.9, 2, 6).rotateX(Math.PI / 2),
  }), []);
  const material = useMemo(() => new MeshStandardMaterial({ color: "#ff7a2e", emissive: "#ff5f1f", emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }), []);
  material.color.set(closed ? "#e5484d" : "#ff7a2e");
  material.emissive.set(closed ? "#e5484d" : "#ff5f1f");
  const placed = useRef("");
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const key = `${from}-${to}`;
    if (placed.current !== key) {
      placed.current = key;
      const a = helipads[from];
      const b = helipads[to];
      if (!a || !b) return;
      const m = new Matrix4();
      const q = new Quaternion();
      const p = new Vector3();
      const n = new Vector3();
      const s = new Vector3(1, 1, 1);
      const at = (t: number, v: Vector3) => v.set(a[0] + (b[0] - a[0]) * t, GROUND + 0.3 + CRUISE * 1.1 * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
      for (let i = 0; i < DASHES; i++) {
        const t = (i + 0.5) / DASHES;
        at(t, p);
        at(Math.min(1, t + 0.01), n);
        q.setFromUnitVectors(new Vector3(0, 0, 1), n.sub(p).normalize());
        mesh.setMatrixAt(i, m.compose(p, q, s));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    material.opacity = 0.65 + Math.sin(clock.elapsedTime * 3) * 0.2;
  });
  return <instancedMesh ref={ref} args={[res.geometry, material, DASHES]} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ decorative */

/** A coastguard helicopter circling the bay, watching the surge. Decorative only. */
export function PatrolHelicopter() {
  const body = useRef<Group>(null);
  const power = useRef(1);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = t * 0.16;
    if (body.current) {
      body.current.position.set(4 + Math.cos(a) * 11, 7.5 + Math.sin(t * 0.7) * 0.25, -27 + Math.sin(a) * 7);
      body.current.rotation.set(0.1, Math.atan2(-Math.sin(a) * 11, Math.cos(a) * 7), -0.18);
    }
  });
  return (
    <group ref={body}>
      <HeliModel power={power} searchlight />
    </group>
  );
}
