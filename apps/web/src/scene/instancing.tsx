import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  type InstancedMesh,
  type Material,
  Matrix4,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  Vector3,
} from "three";
import { type Point, rand } from "./layout";

export interface Placement {
  at: Point;
  turn?: number;
  scale?: [number, number, number];
  color?: string;
}

/**
 * One draw call for many copies of the same mesh. Placements are static scenery, so matrices
 * are written once; per-instance colour varies houses, cars and boats without extra materials.
 */
export function Instances({
  geometry,
  material,
  items,
  shadows = true,
}: {
  geometry: BufferGeometry;
  material: Material | Material[];
  items: Placement[];
  shadows?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const p = new Vector3();
    const s = new Vector3();
    const c = new Color();
    items.forEach((item, i) => {
      q.setFromEuler(e.set(0, item.turn ?? 0, 0));
      m.compose(p.set(...item.at), q, s.set(...(item.scale ?? [1, 1, 1])));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(item.color ?? "#ffffff"));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={shadows}
      receiveShadow
    />
  );
}

/** Unit box resting on y = 0; side-face v-coordinates repeat once per `tiles` so windows keep their size. */
export function wallGeometry(height: number, tiles: number) {
  const geometry = new BoxGeometry(1, height, 1).translate(0, height / 2, 0);
  const uv = geometry.getAttribute("uv");
  // Box groups: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z; four vertices each.
  for (const face of [0, 1, 4, 5]) {
    for (let v = face * 4; v < face * 4 + 4; v++) uv.setY(v, uv.getY(v) * tiles);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Triangular roof prism, 1 wide (x) by 1 deep (z) by 1 tall, sitting on y = 0. */
export function roofGeometry() {
  const shape = new Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, 1);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
}

/** Flat quads (one merged geometry) with world-space UVs so a single texture tiles seamlessly. */
export function flatQuads(rects: [number, number, number, number][], y: number, uvScale = 0.5) {
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  rects.forEach(([x0, x1, z0, z1], i) => {
    const corners = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    for (const [x, z] of corners) {
      position.push(x!, y, z!);
      normal.push(0, 1, 0);
      uv.push(x! * uvScale, z! * uvScale);
    }
    const o = i * 4;
    index.push(o, o + 2, o + 1, o, o + 3, o + 2);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normal, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

/**
 * Painted facade: two floors of windows per tile with a few lit rooms. Returns the colour map and
 * an emissive map holding only the lit panes, so evening light glows through the storm.
 */
export function useFacade(kind: "house" | "block" | "shop", seed: number) {
  return useMemo(() => {
    const w = 256;
    const h = kind === "shop" ? 384 : 256;
    const make = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      return canvas;
    };
    const colour = make();
    const glow = make();
    const c = colour.getContext("2d")!;
    const g = glow.getContext("2d")!;
    c.fillStyle = "#f3efe7";
    c.fillRect(0, 0, w, h);
    // Faint render streaks so walls are not flat colour.
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(90,80,70,${0.02 + rand(seed + i) * 0.03})`;
      c.fillRect(rand(seed + i * 3) * w, rand(seed + i * 5) * h, 2 + rand(i) * 10, 10 + rand(i * 7) * 40);
    }
    g.fillStyle = "#000000";
    g.fillRect(0, 0, w, h);
    const cols = kind === "block" ? 4 : 3;
    const floorH = 128;
    const floors = kind === "shop" ? 2 : 2;
    const pane = (x: number, y: number, pw: number, ph: number, lit: boolean, shopfront = false) => {
      c.fillStyle = "#d9d2c4";
      c.fillRect(x - 4, y - 4, pw + 8, ph + 8);
      c.fillStyle = lit ? (shopfront ? "#ffe7b0" : "#ffd98f") : "#4a565c";
      c.fillRect(x, y, pw, ph);
      if (!shopfront) {
        c.fillStyle = "#d9d2c4";
        c.fillRect(x + pw / 2 - 2, y, 4, ph);
      }
      if (lit) {
        g.fillStyle = shopfront ? "#ffd9a0" : "#ffbe62";
        g.fillRect(x, y, pw, ph);
      }
    };
    for (let f = 0; f < floors; f++) {
      for (let col = 0; col < cols; col++) {
        const cw = w / cols;
        pane(col * cw + cw * 0.24, f * floorH + 30, cw * 0.52, 62, rand(seed * 31 + f * 7 + col) > 0.58);
      }
    }
    if (kind === "shop") {
      // Bottom third: a lit shop window and a door.
      const y = 2 * floorH;
      c.fillStyle = "#3c4448";
      c.fillRect(0, y, w, h - y);
      pane(16, y + 20, w * 0.62, 92, true, true);
      c.fillStyle = "#6b4f3a";
      c.fillRect(w * 0.74, y + 22, w * 0.18, 106);
    }
    // Plinth line at the bottom of each floor tile.
    if (kind !== "shop") {
      c.fillStyle = "rgba(60,50,40,0.18)";
      c.fillRect(0, h - 6, w, 6);
    }
    const map = new CanvasTexture(colour);
    map.colorSpace = SRGBColorSpace;
    const emissiveMap = new CanvasTexture(glow);
    emissiveMap.colorSpace = SRGBColorSpace;
    for (const t of [map, emissiveMap]) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.anisotropy = 4;
    }
    return { map, emissiveMap };
  }, [kind, seed]);
}
