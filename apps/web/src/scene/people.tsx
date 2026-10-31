import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { GROUND, type Point, rand, sites } from "./layout";

const skins = ["#f1c7a5", "#d9a27e", "#b07752", "#8a5a3b", "#e8b48f", "#6e4630"];
const jackets = ["#2f6fe4", "#e5484d", "#e8a317", "#2f9e6b", "#7c4ddb", "#3f4a55", "#d24f0e", "#5b7fa3"];
const trousers = ["#2b2f36", "#3c4654", "#4a3f35", "#24303d"];

export interface PersonLook {
  jacket: string;
  skin: string;
  trousers: string;
  hood?: boolean;
  umbrella?: string;
  vest?: boolean;
  carrying?: boolean;
}

export function look(seed: number, overrides: Partial<PersonLook> = {}): PersonLook {
  return {
    jacket: jackets[Math.floor(rand(seed) * jackets.length)]!,
    skin: skins[Math.floor(rand(seed + 1) * skins.length)]!,
    trousers: trousers[Math.floor(rand(seed + 2) * trousers.length)]!,
    hood: rand(seed + 3) > 0.5,
    umbrella: rand(seed + 4) > 0.78 ? jackets[Math.floor(rand(seed + 5) * jackets.length)] : undefined,
    ...overrides,
  };
}

/**
 * Procedural humanoid in rain gear, about 0.5 units tall. `path` makes the person walk back and
 * forth between two points; otherwise they idle with a gentle sway. Purely decorative.
 */
export function Person({
  at,
  facing = 0,
  appearance,
  path,
  speed = 0.45,
  phase = 0,
  active = false,
}: {
  at: Point;
  facing?: number;
  appearance: PersonLook;
  path?: [Point, Point];
  speed?: number;
  phase?: number;
  active?: boolean;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    let walking = false;
    if (path && root.current) {
      const [a, b] = path;
      const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const cycle = (t * speed) / length;
      const leg = Math.floor(cycle) % 2;
      const pauseAware = Math.min(1, (cycle % 1) * 1.25);
      const u = leg === 0 ? pauseAware : 1 - pauseAware;
      walking = (cycle % 1) < 0.8;
      root.current.position.set(a[0] + (b[0] - a[0]) * u, a[1], a[2] + (b[2] - a[2]) * u);
      const heading = Math.atan2(b[0] - a[0], b[2] - a[2]);
      root.current.rotation.y = leg === 0 ? heading : heading + Math.PI;
    }
    const swing = walking ? Math.sin(t * 9) * 0.6 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = appearance.carrying ? -1.1 : -swing * 0.8;
    if (armR.current) {
      armR.current.rotation.x = appearance.umbrella ? -0.9 : appearance.carrying ? -1.1 : swing * 0.8;
      armR.current.rotation.z = active ? -2.4 + Math.sin(t * 6) * 0.35 : 0;
    }
    if (body.current) {
      body.current.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.012 : Math.sin(t * 1.6) * 0.004;
      body.current.rotation.z = walking ? 0 : Math.sin(t * 0.7) * 0.03;
      body.current.rotation.y = walking ? 0 : Math.sin(t * 0.4) * 0.25;
    }
  });
  const { jacket, skin, trousers: legs, hood, umbrella, vest, carrying } = appearance;
  return (
    <group ref={root} position={at} rotation={[0, facing, 0]} scale={0.84}>
      <group ref={body}>
        {[-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.045, 0.22, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.032, 0.16, 3, 8]} />
              <meshStandardMaterial color={legs} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.205, 0.015]} castShadow>
              <boxGeometry args={[0.055, 0.03, 0.09]} />
              <meshStandardMaterial color="#1d1f22" roughness={0.6} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.32, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.13, 4, 10]} />
          <meshStandardMaterial color={jacket} roughness={0.35} metalness={0.05} />
        </mesh>
        {vest && (
          <>
            <mesh position={[0, 0.33, 0]}>
              <cylinderGeometry args={[0.083, 0.083, 0.15, 12, 1, true]} />
              <meshStandardMaterial color="#d7f23a" emissive="#b8d41e" emissiveIntensity={0.25} side={2} />
            </mesh>
            {[0.29, 0.36].map((y) => (
              <mesh key={y} position={[0, y, 0]}>
                <cylinderGeometry args={[0.086, 0.086, 0.014, 12, 1, true]} />
                <meshStandardMaterial color="#f4f4f5" emissive="#ffffff" emissiveIntensity={0.5} side={2} />
              </mesh>
            ))}
          </>
        )}
        {[-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.1, 0.4, 0]}>
            <mesh position={[0, -0.08, 0]} castShadow>
              <capsuleGeometry args={[0.025, 0.12, 3, 8]} />
              <meshStandardMaterial color={jacket} roughness={0.35} />
            </mesh>
            <mesh position={[0, -0.165, 0]}>
              <sphereGeometry args={[0.024, 8, 6]} />
              <meshStandardMaterial color={skin} />
            </mesh>
          </group>
        ))}
        {carrying && (
          <mesh position={[0, 0.33, 0.13]} castShadow>
            <boxGeometry args={[0.15, 0.11, 0.11]} />
            <meshStandardMaterial color="#3e6fb0" roughness={0.6} />
          </mesh>
        )}
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.058, 14, 12]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
        {hood ? (
          <mesh position={[0, 0.515, -0.008]} castShadow>
            <sphereGeometry args={[0.066, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color={jacket} roughness={0.35} />
          </mesh>
        ) : (
          <mesh position={[0, 0.535, -0.006]}>
            <sphereGeometry args={[0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#3a2a20" roughness={0.9} />
          </mesh>
        )}
        {umbrella && (
          <group position={[0.1, 0.42, 0.05]}>
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.34, 6]} />
              <meshStandardMaterial color="#27272a" />
            </mesh>
            <mesh position={[-0.05, 0.34, 0]} castShadow>
              <coneGeometry args={[0.2, 0.09, 10, 1, true]} />
              <meshStandardMaterial color={umbrella} side={2} roughness={0.4} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

/** Residents queueing at the shelters and volunteers moving supplies at the depot. */
export function Townsfolk({ compact, schoolOpen }: { compact: boolean; schoolOpen: boolean }) {
  const school = sites.S.at;
  const east = sites.E.at;
  const depot = sites.D.at;
  const queue = compact ? 3 : 7;
  return (
    <>
      {/* The school queue waits outside while power is out, then shuffles toward the door. */}
      {Array.from({ length: queue }, (_, i) => (
        <Person
          key={`s${i}`}
          at={[school[0] + 0.1 + (i % 4) * 0.22 - (schoolOpen ? 0.2 : 0), GROUND, school[2] + 1.35 + Math.floor(i / 4) * 0.28 + (schoolOpen ? -0.15 : 0)]}
          facing={Math.PI + (rand(i) - 0.5) * 0.8}
          appearance={look(i + 40)}
          phase={i * 1.7}
        />
      ))}
      {Array.from({ length: compact ? 2 : 4 }, (_, i) => (
        <Person
          key={`e${i}`}
          at={[east[0] + 0.15 + i * 0.25, GROUND, east[2] - 1.25 - (i % 2) * 0.2]}
          facing={(rand(i + 9) - 0.5) * 0.8}
          appearance={look(i + 70)}
          phase={i * 2.3}
        />
      ))}
      {/* Volunteers ferry boxes between the roll door and the loading pallet. */}
      {Array.from({ length: compact ? 1 : 2 }, (_, i) => (
        <Person
          key={`v${i}`}
          at={[depot[0], GROUND, depot[2]]}
          appearance={look(i + 90, { vest: true, carrying: true, umbrella: undefined, hood: false })}
          path={[
            [depot[0] - 0.4 + i * 0.3, GROUND, depot[2] + 0.75],
            [depot[0] + 1.0 + i * 0.25, GROUND, depot[2] + 1.85],
          ]}
          speed={0.32}
          phase={i * 3}
        />
      ))}
      {!compact &&
        [
          [[-11, GROUND, 5.2], [-7.6, GROUND, 6.4]],
          [[2.2, GROUND, 5.8], [5.6, GROUND, 6.6]],
          [[3.6, GROUND, -2.1], [3.8, GROUND, 1.2]],
          [[-10.4, GROUND, -5.6], [-6.4, GROUND, -5.9]],
        ].map((path, i) => (
          <Person
            key={`w${i}`}
            at={path[0] as Point}
            appearance={look(i + 120, { umbrella: i % 2 ? "#e5484d" : undefined })}
            path={path as [Point, Point]}
            speed={0.28}
            phase={i * 4.1}
          />
        ))}
    </>
  );
}
