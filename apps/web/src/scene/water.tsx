import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  type Mesh,
  type MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
} from "three";
import { BRIDGE_DECK, GROUND, RIVER, rand, waterLevel } from "./layout";

/** Procedural ripple normal map; tiny and generated once, so no texture download is needed. */
function useRippleNormals() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(size, size);
    const height = (x: number, y: number) => {
      let h = 0;
      for (let i = 1; i <= 4; i++) {
        const fx = (Math.PI * 2 * i * (1 + rand(i))) / size;
        h += Math.sin(x * fx + rand(i * 3) * 6) * Math.cos(y * fx * 0.8 + rand(i * 7) * 6) / i;
      }
      return h;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = height(x + 1, y) - height(x - 1, y);
        const dy = height(x, y + 1) - height(x, y - 1);
        const o = (y * size + x) * 4;
        image.data[o] = 128 + dx * 70;
        image.data[o + 1] = 128 + dy * 70;
        image.data[o + 2] = 255;
        image.data[o + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    return texture;
  }, []);
}

/** Alpha mask: opaque at the river bank, fading to a ragged edge across the lawn. */
function spillEdge(flip: boolean) {
  const w = 64;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const reach = 0.55 + 0.3 * Math.sin(y * 0.07 + 1.3) * Math.cos(y * 0.023) + 0.12 * (rand(y) - 0.5);
    const taper = Math.min(1, Math.min(y, h - y) / 40);
    for (let x = 0; x < w; x++) {
      const u = flip ? 1 - x / w : x / w;
      const a = Math.max(0, Math.min(1, (reach * taper - u) * 8));
      const o = (y * w + x) * 4;
      image.data[o] = image.data[o + 1] = image.data[o + 2] = a * 255;
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new CanvasTexture(canvas);
}

/** Murky floodwater that rises with the scenario clock; decorative only, never read by the engine. */
export function Floodwater({ tick, bridgeClosed }: { tick: number; bridgeClosed: boolean }) {
  const normals = useRippleNormals();
  const surface = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const deck = useRef<MeshStandardMaterial>(null);
  const spill = useRef<Mesh[]>([]);
  const level = waterLevel(tick);
  const flowing = useMemo(() => {
    const t = normals.clone();
    t.repeat.set(2, 1);
    t.needsUpdate = true;
    return t;
  }, [normals]);
  useMemo(() => normals.repeat.set(84, 56), [normals]);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    normals.offset.set(t * 0.006, -t * 0.018);
    flowing.offset.set(t * 0.25, 0);
    if (surface.current) {
      surface.current.position.y += (level - surface.current.position.y) * Math.min(delta * 1.5, 1);
    }
    if (material.current) material.current.normalScale.setScalar(0.55 + Math.sin(t * 0.7) * 0.08);
    if (deck.current) {
      const target = bridgeClosed ? 0.62 : 0;
      deck.current.opacity += (target - deck.current.opacity) * Math.min(delta * 1.2, 1);
    }
    spill.current.forEach((mesh, i) => {
      const grow = Math.max(0, tick - 2) / 13;
      mesh.scale.x += (0.4 + grow * (1.1 + i * 0.3) - mesh.scale.x) * Math.min(delta * 1.2, 1);
    });
  });
  // Spill sheets are anchored at the bank edge so scaling widens them away from the river.
  const [bankWest, bankEast] = useMemo(
    () => [-1, 1].map((side) => new PlaneGeometry(1, 9).translate(side * 0.5, 0, 0)),
    [],
  );
  const [edgeWest, edgeEast] = useMemo(() => [spillEdge(true), spillEdge(false)], []);
  const river = RIVER.east - RIVER.west;
  return (
    <>
      <mesh ref={surface} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, -150]} receiveShadow>
        <planeGeometry args={[640, 420]} />
        <meshStandardMaterial
          ref={material}
          color="#46605a"
          roughness={0.08}
          metalness={0.15}
          normalMap={normals}
          envMapIntensity={1.1}
        />
      </mesh>
      {/* Overbank flooding creeps across the lawns on both river banks as the clock advances. */}
      {[
        [RIVER.west - 0.02, -4.5, -1],
        [RIVER.east + 0.02, -6, 1],
      ].map(([x, z, side], i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) spill.current[i] = m;
          }}
          position={[x!, GROUND + 0.012, z!]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.4, 1, 1]}
          geometry={side! < 0 ? bankWest : bankEast}
        >
          <meshStandardMaterial
            color="#4f675f"
            transparent
            opacity={0.9}
            roughness={0.06}
            normalMap={normals}
            alphaMap={side! < 0 ? edgeWest : edgeEast}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
      {/* After closure, a sheet of water runs over the bridge deck. */}
      <mesh position={[(RIVER.west + RIVER.east) / 2, BRIDGE_DECK + 0.07, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[river + 1.2, 1]} />
        <meshStandardMaterial
          ref={deck}
          color="#7c8d7c"
          transparent
          opacity={0}
          roughness={0.08}
          normalMap={flowing}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
