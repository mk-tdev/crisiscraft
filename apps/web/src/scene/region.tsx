import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import type { WorldState } from "@crisiscraft/contracts";
import { useSurface } from "./assets";
import { CrateStack, Depot, EastShelter, SchoolShelter } from "./buildings";
import { CAUSEWAY, GROUND, type Point, regionSites, waterLevel } from "./layout";
import { Barrier } from "./roads";
import { signTexture, stripeTexture } from "./text";

/**
 * Landmarks and the tidal causeway for the regional drill. Each landmark sits on the lot beside
 * its scenario node; crate stacks show the engine's delivered counts, nothing more.
 */

/** Ridge tent for the field hospital: a triangular prism with a red cross on the gable end. */
function Tent({ at, turn = 0, cross = false }: { at: Point; turn?: number; cross?: boolean }) {
  const mark = useMemo(() => signTexture("+", "#ffffff", "#e5484d", 64, 64), []);
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.34, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.46, 0.46, 1.5, 3]} />
        <meshStandardMaterial color="#eef0ec" roughness={0.85} />
      </mesh>
      {cross && (
        <mesh position={[0.76, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.32, 0.32]} />
          <meshStandardMaterial map={mark} />
        </mesh>
      )}
    </group>
  );
}

function FieldHospital({ delivered }: { delivered: number }) {
  const { at } = regionSites.H;
  const pad = useSurface("brushed_concrete", 2, 2);
  return (
    <group position={at}>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.2, 3.8]} />
        <meshStandardMaterial {...pad} color="#cfccc4" />
      </mesh>
      <Tent at={[-1.3, 0, -0.7]} cross />
      <Tent at={[0.5, 0, -0.7]} />
      <Tent at={[-0.4, 0, 0.8]} turn={0.05} cross />
      <mesh position={[1.9, 0.5, 0.9]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
        <meshStandardMaterial color="#52525b" />
      </mesh>
      <mesh position={[2.1, 0.88, 0.9]}>
        <planeGeometry args={[0.4, 0.26]} />
        <meshStandardMaterial color="#e5484d" side={2} />
      </mesh>
      <CrateStack count={delivered} at={[1.6, 0, -0.6]} cols={3} rows={2} />
    </group>
  );
}

/** A stone causeway across the bay. The tide washes over it while the engine has road XV closed. */
function Causeway({ closed, tick }: { closed: boolean; tick: number }) {
  const stone = useSurface("brushed_concrete", 1, 12);
  const asphalt = useSurface("asphalt_02", 1, 14);
  const wash = useRef<MeshStandardMaterial>(null);
  const sheet = useRef<Mesh>(null);
  const stripes = useMemo(() => stripeTexture(), []);
  const sign = useMemo(() => signTexture("CAUSEWAY CLOSED · TIDE", "#e5484d"), []);
  const length = CAUSEWAY.z0 - CAUSEWAY.z1;
  const mid = (CAUSEWAY.z0 + CAUSEWAY.z1) / 2;
  useFrame(({ clock }) => {
    if (wash.current) wash.current.opacity = 0.74 + Math.sin(clock.elapsedTime * 1.4) * 0.1;
    if (sheet.current) sheet.current.position.y = CAUSEWAY.deck + 0.08 + Math.sin(clock.elapsedTime * 1.1) * 0.02;
  });
  const piers = Array.from({ length: Math.floor(length / 2.4) }, (_, i) => CAUSEWAY.z0 - 1.2 - i * 2.4);
  return (
    <group>
      {/* Embankment: stone sides down into the water, road surface on top. */}
      <mesh position={[CAUSEWAY.x, CAUSEWAY.deck - 0.45, mid]} castShadow receiveShadow>
        <boxGeometry args={[CAUSEWAY.width + 0.5, 0.9, length]} />
        <meshStandardMaterial {...stone} color="#9c9a92" roughness={0.95} />
      </mesh>
      <mesh position={[CAUSEWAY.x, CAUSEWAY.deck + 0.004, mid]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CAUSEWAY.width - 0.2, length]} />
        <meshStandardMaterial {...asphalt} color="#7d8285" roughness={0.8} />
      </mesh>
      {piers.map((z) => (
        <group key={z}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[CAUSEWAY.x + side * (CAUSEWAY.width / 2 + 0.2), CAUSEWAY.deck + 0.12, z]} castShadow>
              <cylinderGeometry args={[0.04, 0.05, 0.24, 6]} />
              <meshStandardMaterial color="#e4e2da" />
            </mesh>
          ))}
        </group>
      ))}
      {/* High tide: brown water sheets across the deck, and both ends are barred. */}
      {closed && (
        <>
          <mesh ref={sheet} position={[CAUSEWAY.x, CAUSEWAY.deck + 0.08, mid]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[CAUSEWAY.width + 1.1, length - 2.4]} />
            <meshStandardMaterial ref={wash} color="#6e5c44" transparent opacity={0.8} roughness={0.15} metalness={0.15} depthWrite={false} />
          </mesh>
          {[CAUSEWAY.z0 + 0.6, CAUSEWAY.z1 - 0.6].map((z) => (
            <group key={z}>
              <Barrier at={[CAUSEWAY.x - 0.3, GROUND, z]} turn={0} />
              <Barrier at={[CAUSEWAY.x + 0.3, GROUND, z]} turn={0} />
              <mesh position={[CAUSEWAY.x, GROUND + 0.42, z]} castShadow>
                <boxGeometry args={[1.05, 0.1, 0.03]} />
                <meshStandardMaterial map={stripes} />
              </mesh>
              <mesh position={[CAUSEWAY.x, GROUND + 0.62, z]} rotation={[0, z > mid ? 0 : Math.PI, 0]}>
                <boxGeometry args={[1.1, 0.16, 0.02]} />
                <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.25} />
              </mesh>
            </group>
          ))}
        </>
      )}
      {/* Tide gauge at the quay end: the painted scale disappears as the water rises. */}
      <group position={[CAUSEWAY.x + 1.1, 0, CAUSEWAY.z0 - 0.8]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.08, 1.2, 0.04]} />
          <meshStandardMaterial color="#f4f4f2" />
        </mesh>
        <mesh position={[0, waterLevel(tick) + 0.02, 0.025]}>
          <boxGeometry args={[0.1, 0.03, 0.01]} />
          <meshStandardMaterial color="#e5484d" />
        </mesh>
      </group>
    </group>
  );
}

const delivered = (state: WorldState, id: string) => state.requests[id]?.delivered ?? 0;

/** Everything specific to the regional drill, drawn only when that scenario is played. */
export function RegionLandmarks({ state, floodTick }: { state: WorldState; floodTick: number }) {
  return (
    <>
      <Depot stock={state.stock} site={regionSites.P} sign="PORT DEPOT" />
      <EastShelter delivered={delivered(state, "care")} site={regionSites.C} sign="CARE HOME" colour="#7c4ddb" />
      <SchoolShelter powered delivered={delivered(state, "school")} site={regionSites.S} sign="SCHOOL SHELTER" />
      <EastShelter delivered={delivered(state, "village")} site={regionSites.V} sign="VILLAGE HALL" colour="#2f9e6b" />
      <FieldHospital delivered={delivered(state, "hospital")} />
      <Causeway closed={state.roads.XV === false} tick={floodTick} />
    </>
  );
}
