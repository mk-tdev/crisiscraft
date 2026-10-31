import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, type AmbientLight, type Group } from "three";
import { rand } from "./layout";

const HEIGHT = 14;

/** Wind-blown rain streaks: two stacked copies of one streak field scroll downward and wrap. */
export function Rain({ count = 3200 }: { count?: number }) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => {
    const position: number[] = [];
    for (let i = 0; i < count; i++) {
      const x = (rand(i * 3 + 1) - 0.5) * 64;
      const y = rand(i * 3 + 2) * HEIGHT;
      const z = (rand(i * 3 + 3) - 0.5) * 52 + 2;
      position.push(x, y, z, x + 0.05, y + 0.32, z + 0.02);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(position, 3));
    return g;
  }, [count]);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = -((clock.elapsedTime * 9) % HEIGHT);
  });
  return (
    <group ref={group}>
      {[0, HEIGHT].map((y) => (
        <lineSegments key={y} geometry={geometry} position={[0, y, 0]}>
          <lineBasicMaterial color="#dbe4ea" transparent opacity={0.32} depthWrite={false} />
        </lineSegments>
      ))}
    </group>
  );
}

/** Occasional double flash of sheet lightning; never more often than every ~9 seconds. */
export function Lightning() {
  const light = useRef<AmbientLight>(null);
  const next = useRef(6);
  const strike = useRef(-10);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t > next.current) {
      strike.current = t;
      next.current = t + 9 + rand(Math.floor(t)) * 12;
    }
    const since = t - strike.current;
    const pulse = since < 0.08 ? 1 : since > 0.16 && since < 0.24 ? 0.7 : Math.max(0, 0.45 - since) * 0.6;
    if (light.current) light.current.intensity = pulse * 2.4;
  });
  return <ambientLight ref={light} color="#dfe8ff" intensity={0} />;
}
