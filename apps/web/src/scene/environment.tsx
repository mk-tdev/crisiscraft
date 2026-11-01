import { useEffect } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { EquirectangularReflectionMapping, Fog } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { hdriUrl, useSurface } from "./assets";
import { GROUND, HARBOUR, RIVER, WORLD } from "./layout";

const fogColor = "#aeb9bf";

/** Overcast afternoon: CC0 sky HDRI for light and reflections, soft key light for readable shadows. */
export function Sky({ shadows }: { shadows: boolean }) {
  const hdri = useLoader(HDRLoader, hdriUrl);
  const { scene } = useThree();
  useEffect(() => {
    hdri.mapping = EquirectangularReflectionMapping;
    scene.environment = hdri;
    scene.background = hdri;
    scene.backgroundBlurriness = 0.18;
    scene.backgroundIntensity = 0.95;
    scene.environmentIntensity = 0.85;
    // Near/far are retuned every frame by the camera rig so zooming out never reveals the world edge.
    scene.fog = new Fog(fogColor, 46, 120);
    return () => {
      scene.environment = null;
      scene.background = null;
      scene.fog = null;
    };
  }, [hdri, scene]);
  return (
    <>
      <hemisphereLight args={["#e9eef2", "#5e6b52", 0.9]} />
      <directionalLight
        position={[-14, 26, 12]}
        color="#fff3e2"
        intensity={2.1}
        castShadow={shadows}
        shadow-mapSize={[3072, 3072]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}

export function LandBlock({
  x0,
  x1,
  z0,
  z1,
}: {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}) {
  const w = x1 - x0;
  const d = z1 - z0;
  const grass = useSurface("leafy_grass", w / 3.2, d / 3.2);
  const bank = useSurface("damp_beach_sand", w / 2, 0.4);
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]}>
      <mesh position={[0, GROUND - 0.06, 0]} receiveShadow>
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial {...grass} color="#a9c48f" />
      </mesh>
      {/* Earthen bank below the lawn, visible where the river cuts through town. */}
      <mesh position={[0, -0.55, 0]} receiveShadow>
        <boxGeometry args={[w - 0.02, 1, d - 0.02]} />
        <meshStandardMaterial {...bank} color="#9b917f" roughness={1} />
      </mesh>
    </group>
  );
}

/** Land extends far past the playable town so fog, not a diorama edge, ends the world. */
export function Terrain() {
  const far = WORLD;
  const harbour = HARBOUR;
  return (
    <>
      <LandBlock x0={-far} x1={RIVER.west} z0={harbour} z1={RIVER.end} />
      <LandBlock x0={RIVER.east} x1={far} z0={harbour} z1={RIVER.end} />
      <LandBlock x0={-far} x1={far} z0={RIVER.end} z1={far} />
    </>
  );
}
