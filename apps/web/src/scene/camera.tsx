import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Fog, PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WorldState } from "@crisiscraft/contracts";
import { isRegion, regionSites, scenarioOf } from "./layout";
import { truckPosition } from "./vehicles";

export type CameraView = "overview" | "bridge" | "school" | "convoy";

/** A low, cinematic three-quarter angle from the south-east (about 25° above the horizon). */
const direction = new Vector3(0.5, 0.45, 0.86).normalize();
const closeDirection = new Vector3(0.52, 0.56, 0.8).normalize();
/** The region runs north–south (village to station), so its overview looks from the east and lays it across the wide screen. */
const regionDirection = new Vector3(0.86, 0.78, 0.12).normalize();

/**
 * Full-bleed layout: floating UI covers the top bar and the bottom command strip, so the
 * projection is shifted up by half their difference to centre the town in the visible band.
 */
const SAFE = { top: 84, bottom: 190 };
/** Panning stays over the town; the camera never dips under the ground plane. */
const BOUNDS = { x: 100, zMin: -64, zMax: 82, minHeight: 0.9 };

/** Smoothly flies to a named view, then hands control back to orbit/zoom until the view changes. */
export function CameraRig({
  view,
  state,
  progress,
  revision,
  compact,
}: {
  view: CameraView;
  state: WorldState;
  progress: number;
  revision: number;
  compact: boolean;
}) {
  const { camera, gl, size, scene } = useThree();
  const control = useRef<OrbitControls | null>(null);
  const transitioning = useRef(true);
  const target = useMemo(() => new Vector3(), []);
  const destination = useMemo(() => new Vector3(), []);
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.minDistance = 4;
    orbit.maxDistance = 170;
    orbit.minPolarAngle = 0.2;
    orbit.maxPolarAngle = 1.36;
    orbit.zoomSpeed = 0.85;
    orbit.screenSpacePanning = false;
    orbit.addEventListener("start", () => {
      transitioning.current = false;
    });
    control.current = orbit;
    return () => {
      orbit.dispose();
      control.current = null;
    };
  }, [camera, gl]);
  useEffect(() => {
    transitioning.current = true;
  }, [view, revision, size.width, size.height]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const shift = compact || size.height < 420 ? 0 : (SAFE.bottom - SAFE.top) / 2;
    if (shift) camera.setViewOffset(size.width, size.height, 0, shift, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, compact, size.width, size.height]);
  useFrame((_frame, delta) => {
    const controls = control.current;
    if (!controls) return;
    const aspect = size.width / Math.max(size.height, 1);
    if (transitioning.current || view === "convoy") {
      let distance = compact ? 12 : 15.5;
      let from = closeDirection;
      const scenario = scenarioOf(state);
      const region = isRegion(scenario);
      if (view === "bridge") target.set(0.5, 0, -3.2);
      else if (view === "school") {
        if (region) target.set(regionSites.S.at[0], 0, regionSites.S.at[2] - 1);
        else target.set(6.6, 0, -4.2);
      } else if (view === "convoy") {
        // Follow the truck on the road; in the region that is whichever one is moving.
        const moving = Object.values(state.vehicles).find((v) => v.status === "travelling");
        const [x, z] = truckPosition(state, moving?.id ?? "V1", progress);
        target.set(x, 0, z);
        distance = compact ? 10 : region ? 16 : 12.5;
      } else if (region) {
        // The whole network: port in the west, care home in the east, village across the bay to the hospital.
        target.set(-9, 0, 8.5);
        distance = (compact ? 136 : 128) * Math.max(1, 1.55 / aspect);
        from = regionDirection;
      } else if (compact) {
        target.set(0.3, 0, 0.4);
        distance = 33 * Math.max(1, 1.6 / aspect);
      } else {
        // The playable core fills the visible band; the outer districts frame it at the edges.
        target.set(0.6, 0, 0.2);
        distance = 34 * Math.max(1, 1.55 / aspect);
        from = direction;
      }
      destination.copy(from).multiplyScalar(distance).add(target);
      const k = Math.min(delta * 3.2, 1);
      if (transitioning.current) {
        controls.target.lerp(target, k);
        camera.position.lerp(destination, k);
      } else {
        // Following the convoy after the user orbits: carry the camera along, keep their angle.
        const shift = target.clone().sub(controls.target).multiplyScalar(k);
        controls.target.add(shift);
        camera.position.add(shift);
      }
      if (camera.position.distanceTo(destination) < 0.02 && view !== "convoy") transitioning.current = false;
    }
    if (camera instanceof PerspectiveCamera && camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    controls.update();
    // Clamp panning to the town and keep the eye above ground.
    const t = controls.target;
    const cx = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, t.x)) - t.x;
    const cz = Math.max(BOUNDS.zMin, Math.min(BOUNDS.zMax, t.z)) - t.z;
    if (cx || cz || t.y) {
      t.x += cx;
      t.z += cz;
      camera.position.x += cx;
      camera.position.z += cz;
      camera.position.y -= t.y;
      t.y = 0;
    }
    if (camera.position.y < BOUNDS.minHeight) camera.position.y = BOUNDS.minHeight;
    // Fog follows zoom so the far edge of the world always dissolves into the storm.
    if (scene.fog instanceof Fog) {
      const d = camera.position.distanceTo(t);
      scene.fog.near = d * 0.75 + 14;
      scene.fog.far = d * 1.7 + 70;
    }
  });
  return null;
}
