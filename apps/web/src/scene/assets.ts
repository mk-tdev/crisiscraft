import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import {
  Box3,
  Mesh,
  type Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** CC0 Poly Haven assets fetched by scripts/fetch-assets.py into apps/web/public/assets. */
const base = `${import.meta.env.BASE_URL}assets`;

export type Surface =
  | "leafy_grass"
  | "asphalt_02"
  | "brushed_concrete"
  | "damp_beach_sand"
  | "painted_plaster_wall"
  | "brick_wall_001"
  | "grey_roof_tiles"
  | "corrugated_iron"
  | "weathered_planks";

const fullPbr = new Set<Surface>(["leafy_grass", "asphalt_02"]);

export interface SurfaceMaps {
  map: Texture;
  normalMap: Texture;
  aoMap?: Texture;
  roughnessMap?: Texture;
  metalnessMap?: Texture;
}

/** Loads a PBR set and returns repeat-specific clones; images stay shared on the GPU. */
export function useSurface(name: Surface, repeatX = 1, repeatY = repeatX): SurfaceMaps {
  const files = fullPbr.has(name) ? ["diff", "nor", "arm"] : ["diff", "nor"];
  const loaded = useLoader(
    TextureLoader,
    files.map((f) => `${base}/textures/${name}/${f}.jpg`),
  );
  return useMemo(() => {
    const [diff, nor, arm] = loaded.map((source, i) => {
      const t = source.clone();
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.anisotropy = 4;
      if (i === 0) t.colorSpace = SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    });
    return {
      map: diff!,
      normalMap: nor!,
      ...(arm ? { aoMap: arm, roughnessMap: arm, metalnessMap: arm } : {}),
    };
  }, [loaded, repeatX, repeatY]);
}

export type Prop =
  | "plastic_crate_02"
  | "medical_box"
  | "Barrel_01"
  | "concrete_road_barrier_02"
  | "street_lamp_02"
  | "painted_wooden_bench"
  | "shrub_03"
  | "shrub_sorrel_01";

/** Returns a fresh clone of a glTF prop, scaled to `height` scene units and resting on y = 0. */
export function useProp(name: Prop, height: number, shadows = true): Object3D {
  const gltf = useLoader(GLTFLoader, `${base}/models/${name}/${name}.gltf`);
  return useMemo(() => {
    const object = gltf.scene.clone(true);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const scale = height / Math.max(size.y, 1e-3);
    object.scale.setScalar(scale);
    object.position.y = -box.min.y * scale;
    object.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = shadows;
        child.receiveShadow = true;
      }
    });
    return object;
  }, [gltf, height, shadows]);
}

export const hdriUrl = `${base}/hdri/kloofendal_overcast_puresky.hdr`;
