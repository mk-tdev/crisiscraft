import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, MathUtils, type MeshStandardMaterial } from "three";
import type { WorldState } from "@crisiscraft/contracts";
import { vehiclePosition } from "@crisiscraft/sim";
import { isRegion, roadHeight, scenarioOf } from "./layout";
import { signTexture } from "./text";

/** Parking bays beside the depot for idle trucks; moving trucks follow the engine position. */
const parking: Record<string, [number, number]> = { V1: [-6.3, 5.0], V2: [-7.7, 5.0] };
/** In the region the trucks wait in a row on the port apron, beside the depot shed. */
const regionParking: Record<string, [number, number]> = { V1: [-60.4, 2.0], V2: [-61.8, 2.0], V3: [-63.2, 2.0], V4: [-64.9, 2.0] };

export function truckPosition(state: WorldState, id: string, progress: number): [number, number] {
  const scenario = scenarioOf(state);
  const v = state.vehicles[id]!;
  if (v.status === "idle" && v.node === scenario.depot && !v.leg) return (isRegion(scenario) ? regionParking : parking)[id] ?? [0, 0];
  return vehiclePosition(scenario, v, state.tick + (v.leg ? progress : 0));
}

const liveries: Record<string, string> = { V1: "#f2611d", V2: "#2f6fe4", V3: "#2f9e6b", V4: "#e8a317" };
/** The truck's radio name from the scenario, e.g. "Rescue 01" or "Lorry 04". */
export const truckName = (state: WorldState, id: string) =>
  scenarioOf(state).vehicles.find((v) => v.id === id)?.label ?? (id === "V1" ? "Rescue 01" : id === "V2" ? "Rescue 02" : id);

function Wheel({ at }: { at: [number, number, number] }) {
  return (
    <mesh position={at} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
      <meshStandardMaterial color="#1f2225" roughness={0.8} />
    </mesh>
  );
}

export function Truck({
  state,
  id,
  progress,
  selected,
  onSelect,
}: {
  state: WorldState;
  id: string;
  progress: number;
  selected: boolean;
  onSelect?: () => void;
}) {
  const group = useRef<Group>(null);
  const beacon = useRef<MeshStandardMaterial>(null);
  const heading = useRef(Math.PI / 2);
  const vehicle = state.vehicles[id]!;
  const [x, z] = truckPosition(state, id, progress);
  const moving = vehicle.status === "travelling";
  const scenario = scenarioOf(state);
  const livery = liveries[id] ?? "#2f6fe4";
  const door = signTexture(truckName(state, id).toUpperCase(), livery, "#ffffff", 256, 64);
  // Regional distances are long, so trucks read a little larger there; the lorry is bigger still.
  const capacity = state.vehicles[id]!.capacity;
  const scale = isRegion(scenario) ? (capacity > 8 ? 1.5 : 1.25) : 1;
  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    if (vehicle.leg) {
      const from = scenario.nodes.find((n) => n.id === vehicle.leg!.from)!;
      const to = scenario.nodes.find((n) => n.id === vehicle.leg!.to)!;
      heading.current = Math.atan2(to.x - from.x, to.z - from.z);
    }
    g.position.x = MathUtils.damp(g.position.x, x, 6, delta);
    g.position.z = MathUtils.damp(g.position.z, z, 6, delta);
    g.position.y = roadHeight(g.position.x, g.position.z) + 0.01;
    const diff = Math.atan2(Math.sin(heading.current - g.rotation.y), Math.cos(heading.current - g.rotation.y));
    g.rotation.y += diff * Math.min(delta * 5, 1);
    if (beacon.current) {
      beacon.current.emissiveIntensity = moving ? (Math.sin(clock.elapsedTime * 10) > 0 ? 3 : 0.2) : 0.3;
    }
  });
  const crates = Array.from({ length: vehicle.cargo }, (_, i) => i);
  return (
    <group
      ref={group}
      position={[x, roadHeight(x, z), z]}
      rotation={[0, Math.PI / 2, 0]}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Chassis */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.08, 1.2]} />
        <meshStandardMaterial color="#2a2d31" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Cab */}
      <group position={[0, 0, 0.42]}>
        <mesh position={[0, 0.34, 0]} castShadow>
          <boxGeometry args={[0.5, 0.34, 0.34]} />
          <meshStandardMaterial color="#f4f4f2" roughness={0.35} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.41, 0.172]}>
          <boxGeometry args={[0.44, 0.15, 0.01]} />
          <meshStandardMaterial color="#233039" roughness={0.05} metalness={0.6} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.252, 0.3, -0.02]} rotation={[0, (side * Math.PI) / 2, 0]}>
            <planeGeometry args={[0.26, 0.065]} />
            <meshStandardMaterial map={door} />
          </mesh>
        ))}
        <mesh position={[0, 0.24, 0.172]}>
          <boxGeometry args={[0.5, 0.04, 0.01]} />
          <meshStandardMaterial color={livery} />
        </mesh>
        {[-0.17, 0.17].map((hx) => (
          <mesh key={hx} position={[hx, 0.22, 0.175]}>
            <boxGeometry args={[0.08, 0.04, 0.01]} />
            <meshStandardMaterial color="#fff8e0" emissive="#fff1c2" emissiveIntensity={moving ? 2.4 : 0.6} />
          </mesh>
        ))}
        <mesh position={[0, 0.53, 0]}>
          <boxGeometry args={[0.3, 0.04, 0.08]} />
          <meshStandardMaterial ref={beacon} color="#ffb547" emissive="#ff9a1f" />
        </mesh>
      </group>
      {/* Cargo bed with side rails; one crate per unit of engine cargo. */}
      <group position={[0, 0, -0.18]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.04, 0.78]} />
          <meshStandardMaterial color={livery} roughness={0.5} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.24, 0.27, 0]} castShadow>
            <boxGeometry args={[0.02, 0.1, 0.78]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        {crates.map((i) => (
          <mesh key={i} position={[((i % 2) - 0.5) * 0.2, 0.29 + Math.floor(i / 6) * 0.13, (Math.floor(i / 2) % 3 - 1) * 0.22]} castShadow>
            <boxGeometry args={[0.17, 0.13, 0.19]} />
            <meshStandardMaterial color="#3e6fb0" roughness={0.55} />
          </mesh>
        ))}
      </group>
      {[0.36, -0.12, -0.42].flatMap((wz) => [-0.22, 0.22].map((wx) => <Wheel key={`${wx}${wz}`} at={[wx, 0.1, wz]} />))}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.78, 0.84, 48]} />
          <meshBasicMaterial color="#f2611d" />
        </mesh>
      )}
    </group>
  );
}
