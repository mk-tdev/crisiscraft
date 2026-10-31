import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Low-poly street cars and harbour boats, built once and drawn instanced. Each model is split
 * by material: painted parts take the per-instance colour, the rest carry baked vertex colours.
 */

type UV = [number, number];

function tint(g: BufferGeometry, hex: string) {
  const flat = g.index ? g.toNonIndexed() : g;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const gr = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const n = flat.getAttribute("position").count;
  flat.setAttribute("color", new Float32BufferAttribute(Array.from({ length: n }, () => [r, gr, b]).flat(), 3));
  return flat;
}

function merge(parts: BufferGeometry[]) {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  g.computeBoundingSphere();
  return g;
}

/** Side profile (u = along the car, v = up) extruded across its width; front faces +z. */
function profile(points: UV[], width: number, bevel = 0) {
  const s = new Shape(points.map(([u, v]) => new Vector2(u, v)));
  const depth = Math.max(width - bevel * 2, 0.001);
  const g = new ExtrudeGeometry(s, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  g.deleteAttribute("uv");
  return g;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new BoxGeometry(w, h, d).translate(x, y, z);
  g.deleteAttribute("uv");
  return g;
};

function wheels(track: number, base: number, radius: number) {
  const parts: BufferGeometry[] = [];
  for (const x of [-track, track]) {
    for (const z of [-base, base]) {
      const tyre = new CylinderGeometry(radius, radius, 0.042, 14).rotateZ(Math.PI / 2).translate(x, radius, z);
      const hub = new CylinderGeometry(radius * 0.5, radius * 0.5, 0.045, 8).rotateZ(Math.PI / 2).translate(x, radius, z);
      tyre.deleteAttribute("uv");
      hub.deleteAttribute("uv");
      parts.push(tint(tyre, "#1b1d20"), tint(hub, "#4f555b"));
    }
  }
  return parts;
}

export interface CarModel {
  paint: BufferGeometry;
  glass: BufferGeometry;
  trim: BufferGeometry;
  lamps: BufferGeometry;
}

/** A small saloon: bonnet, raked screen, boot. 0.66 long, front at +z. */
function saloon(): CarModel {
  const body = profile(
    [[-0.315, 0.05], [0.315, 0.05], [0.318, 0.13], [0.3, 0.16], [0.13, 0.185], [-0.21, 0.19], [-0.305, 0.175], [-0.318, 0.13]],
    0.3,
    0.014,
  );
  const roof = box(0.272, 0.016, 0.21, 0, 0.287, -0.055);
  const pillar = box(0.272, 0.09, 0.022, 0, 0.235, -0.04);
  const glass = profile([[0.135, 0.18], [0.035, 0.282], [-0.155, 0.282], [-0.25, 0.185]], 0.262);
  const trim = merge([
    ...wheels(0.128, 0.2, 0.064),
    tint(box(0.31, 0.04, 0.025, 0, 0.075, 0.322), "#2a2d31"),
    tint(box(0.31, 0.04, 0.025, 0, 0.075, -0.322), "#2a2d31"),
    tint(box(0.14, 0.03, 0.01, 0, 0.12, 0.331), "#1e2124"),
    tint(box(0.33, 0.012, 0.012, 0, 0.21, 0.06), "#202326"),
  ]);
  const lamps = merge([
    tint(box(0.07, 0.026, 0.012, -0.095, 0.142, 0.327), "#fff6dc"),
    tint(box(0.07, 0.026, 0.012, 0.095, 0.142, 0.327), "#fff6dc"),
    tint(box(0.075, 0.024, 0.012, -0.1, 0.152, -0.324), "#d8262b"),
    tint(box(0.075, 0.024, 0.012, 0.1, 0.152, -0.324), "#d8262b"),
  ]);
  return { paint: merge([body, roof, pillar]), glass: merge([glass]), trim, lamps };
}

/** A hatchback / small van: short nose, tall cabin, square tail. */
function hatch(): CarModel {
  const body = profile(
    [[-0.32, 0.05], [0.32, 0.05], [0.322, 0.14], [0.305, 0.18], [0.19, 0.205], [-0.322, 0.212], [-0.325, 0.14]],
    0.31,
    0.014,
  );
  const roof = box(0.286, 0.018, 0.4, 0, 0.318, -0.105);
  const pillar = box(0.286, 0.1, 0.024, 0, 0.26, -0.02);
  const glass = profile([[0.195, 0.2], [0.095, 0.312], [-0.3, 0.312], [-0.312, 0.205]], 0.272);
  const trim = merge([
    ...wheels(0.134, 0.205, 0.068),
    tint(box(0.32, 0.045, 0.025, 0, 0.08, 0.327), "#2a2d31"),
    tint(box(0.32, 0.045, 0.025, 0, 0.08, -0.33), "#2a2d31"),
    tint(box(0.03, 0.03, 0.06, -0.162, 0.235, 0.14), "#202326"),
    tint(box(0.03, 0.03, 0.06, 0.162, 0.235, 0.14), "#202326"),
  ]);
  const lamps = merge([
    tint(box(0.07, 0.03, 0.012, -0.1, 0.155, 0.332), "#fff6dc"),
    tint(box(0.07, 0.03, 0.012, 0.1, 0.155, 0.332), "#fff6dc"),
    tint(box(0.03, 0.07, 0.012, -0.135, 0.185, -0.335), "#d8262b"),
    tint(box(0.03, 0.07, 0.012, 0.135, 0.185, -0.335), "#d8262b"),
  ]);
  return { paint: merge([body, roof, pillar]), glass: merge([glass]), trim, lamps };
}

export const carModels = () => [saloon(), hatch()];

/* ------------------------------------------------------------------ boats */

/**
 * Boats are modelled in a unit box (x ±0.5, z ±0.5 with the bow at +z) and stretched per
 * instance, so one hull serves dinghies and trawlers. y = 0 is the waterline.
 */
const FREEBOARD = 0.65;
const DRAUGHT = 0.35;
const sheer = (z: number) => Math.max(0, z) * 0.32;

function outline(scale = 1, flip = 1) {
  const p = (x: number, y: number) => [x * scale, y * scale * flip] as const;
  const s = new Shape();
  s.moveTo(...p(-0.4, -0.5));
  s.lineTo(...p(0.4, -0.5));
  s.quadraticCurveTo(...p(0.52, -0.05), ...p(0.42, 0.2));
  s.quadraticCurveTo(...p(0.25, 0.44), ...p(0, 0.5));
  s.quadraticCurveTo(...p(-0.25, 0.44), ...p(-0.42, 0.2));
  s.quadraticCurveTo(...p(-0.52, -0.05), ...p(-0.4, -0.5));
  return s;
}

function hull() {
  const g = new ExtrudeGeometry(outline(), { depth: 1, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(Math.PI / 2);
  g.translate(0, 1, 0);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < 0.5) {
      // Keel: narrow V underneath, raked stem so the bow lifts out of the water.
      pos.setXYZ(i, x * 0.3, 0, z * 0.82 - 0.06);
    } else {
      pos.setXYZ(i, x, 1 + sheer(z), z);
    }
  }
  g.translate(0, -DRAUGHT, 0);
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  // Dark antifouling below, the instance paint above: bake the gradient as vertex colour.
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const top = pos.getY(i) > 0;
    colors.push(...(top ? [1, 1, 1] : [0.32, 0.12, 0.1]));
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return g;
}

function deck() {
  const g = new ShapeGeometry(outline(0.9, -1), 6);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setY(i, FREEBOARD + 0.01 + sheer(pos.getZ(i)));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

/** Wheelhouse with a raked front; sits aft of midships. */
function cabin() {
  const base = FREEBOARD - 0.04;
  const g = profile([[-0.3, 0], [0.12, 0], [0.04, 0.6], [-0.28, 0.6]], 0.56);
  g.translate(0, base, 0);
  const roof = box(0.62, 0.05, 0.42, 0, base + 0.62, -0.11);
  return merge([g, roof]);
}

function cabinGlass() {
  const base = FREEBOARD - 0.04;
  const g = profile([[-0.29, 0.24], [0.098, 0.24], [0.064, 0.46], [-0.285, 0.46]], 0.575);
  g.translate(0, base, 0);
  return g;
}

export interface BoatModel {
  hull: BufferGeometry;
  deck: BufferGeometry;
  cabin: BufferGeometry;
  glass: BufferGeometry;
  rig: BufferGeometry;
}

export function boatModel(): BoatModel {
  // Rig is world-sized (not stretched): mast, boom and a furled sail under its cover.
  const mast = new CylinderGeometry(0.012, 0.018, 1.5, 6).translate(0, 0.75, 0);
  const boom = new CylinderGeometry(0.012, 0.012, 0.5, 6).rotateX(Math.PI / 2).translate(0, 0.2, -0.24);
  const cover = new CylinderGeometry(0.03, 0.022, 0.42, 6).rotateX(Math.PI / 2).translate(0, 0.24, -0.22);
  const stay = new CylinderGeometry(0.004, 0.004, 1.5, 3).rotateX(-0.3).translate(0, 0.72, 0.22);
  [mast, boom, cover, stay].forEach((g) => g.deleteAttribute("uv"));
  const rig = merge([tint(mast, "#d7dade"), tint(boom, "#c3c7cc"), tint(cover, "#24476e"), tint(stay, "#8a9096")]);
  return { hull: hull(), deck: deck(), cabin: cabin(), glass: cabinGlass(), rig };
}

export const BOAT_DECK = FREEBOARD;
