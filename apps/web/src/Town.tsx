import { Component, type ReactNode, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, MathUtils } from 'three';
import type { WorldState } from '@crisiscraft/contracts';
import { harborPoint, vehiclePosition } from '@crisiscraft/sim';

type Point = [number, number, number];

function Road({ from, to, closed, bridge }: { from: Point; to: Point; closed: boolean; bridge: boolean }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  return <group position={[(from[0] + to[0]) / 2, bridge ? 0.24 : 0.15, (from[2] + to[2]) / 2]} rotation={[0, Math.atan2(dx, dz), 0]}>
    <mesh receiveShadow><boxGeometry args={[0.65, 0.14, length]} /><meshStandardMaterial color={closed ? '#d9765d' : bridge ? '#839a92' : '#52675f'} /></mesh>
    <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.035, 0.015, length * 0.9]} /><meshStandardMaterial color="#d5d9b9" /></mesh>
    {bridge && [-0.38, 0.38].map(x => <mesh key={x} position={[x, 0.19, 0]}><boxGeometry args={[0.06, 0.25, length]} /><meshStandardMaterial color="#b9c3b1" /></mesh>)}
    {closed && <group position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh><boxGeometry args={[1.2, 0.17, 0.15]} /><meshStandardMaterial color="#f7b08b" /></mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[1.2, 0.17, 0.15]} /><meshStandardMaterial color="#f7b08b" /></mesh>
    </group>}
  </group>;
}

function Building({ x, z, depot, ready }: { x: number; z: number; depot: boolean; ready: boolean }) {
  return <group position={[x, 0.23, z]}>
    <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[1.8, 1, 1.35]} /><meshStandardMaterial color={depot ? '#ddd3a7' : '#e6e1c6'} /></mesh>
    <mesh position={[0, 1.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[1.5, 0.6, 4]} /><meshStandardMaterial color={depot ? '#53695c' : '#ab654d'} /></mesh>
    <mesh position={[0, 0.35, 0.69]}><boxGeometry args={[0.4, 0.7, 0.05]} /><meshStandardMaterial color="#274d47" /></mesh>
    {[-0.6, 0.6].map(offset => <mesh key={offset} position={[offset, 0.65, 0.69]}><boxGeometry args={[0.27, 0.3, 0.06]} /><meshStandardMaterial color={ready ? '#f4ce84' : '#48645d'} emissive={ready ? '#9e803f' : '#000000'} emissiveIntensity={0.3} /></mesh>)}
    <mesh position={[1.3, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.25, 0.35, 24]} /><meshStandardMaterial color={ready ? '#b1d2b6' : '#eea275'} /></mesh>
  </group>;
}

function Truck({ state, id, offset }: { state: WorldState; id: string; offset: number }) {
  const group = useRef<Group>(null);
  const truck = state.vehicles[id]!;
  const [x, z] = vehiclePosition(harborPoint, truck, state.tick);
  useFrame((_frame, delta) => {
    if (!group.current) return;
    group.current.position.x = MathUtils.damp(group.current.position.x, x, 10, delta);
    group.current.position.z = MathUtils.damp(group.current.position.z, z + offset, 10, delta);
  });
  return <group ref={group} position={[x, 0.45, z + offset]}>
    <mesh castShadow><boxGeometry args={[0.8, 0.4, 0.48]} /><meshStandardMaterial color={id === 'V1' ? '#eaa26d' : '#bed5b7'} /></mesh>
    <mesh position={[0.26, 0.29, 0]} castShadow><boxGeometry args={[0.28, 0.25, 0.44]} /><meshStandardMaterial color="#e4e4ca" /></mesh>
    {[-0.25, 0.25].flatMap(a => [-0.26, 0.26].map(b => <mesh key={`${a}-${b}`} position={[a, -0.18, b]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.1, 10]} /><meshStandardMaterial color="#203a35" /></mesh>))}
    {truck.cargo > 0 && <mesh position={[-0.18, 0.3, 0]}><boxGeometry args={[0.3, 0.2, 0.32]} /><meshStandardMaterial color="#a27645" /></mesh>}
  </group>;
}

function Scene({ state }: { state: WorldState }) {
  return <>
    <color attach="background" args={['#243e39']} />
    <ambientLight intensity={1.6} />
    <directionalLight position={[4, 14, 5]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} />
    <mesh position={[0, -0.5, 1]} receiveShadow><boxGeometry args={[24, 0.8, 18]} /><meshStandardMaterial color="#22332e" /></mesh>
    <mesh position={[0, 0, 1]} receiveShadow><boxGeometry args={[23.7, 0.3, 17.7]} /><meshStandardMaterial color="#6e8569" /></mesh>
    <mesh position={[0, 0.17, -3.6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5.7 + state.tick * 0.035, 14]} /><meshStandardMaterial color="#5b9b99" transparent opacity={0.7} roughness={0.3} /></mesh>
    {harborPoint.edges.map(e => {
      const a = harborPoint.nodes.find(n => n.id === e.from)!;
      const b = harborPoint.nodes.find(n => n.id === e.to)!;
      return <Road key={e.id} from={[a.x, 0, a.z]} to={[b.x, 0, b.z]} closed={!state.roads[e.id]} bridge={e.id === 'JS'} />;
    })}
    {harborPoint.nodes.filter(n => n.kind !== 'junction').map(n => <Building key={n.id} x={n.x} z={n.z} depot={n.kind === 'depot'} ready={state.receiving[n.id]!} />)}
    {[-10, -9, -6, -4, 0, 3, 8, 10].map((x, i) => <group key={x} position={[x, 0.2, i % 2 === 0 ? 8 : -6]}>
      <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.08, 0.12, 0.9, 6]} /><meshStandardMaterial color="#574c36" /></mesh>
      <mesh position={[0, 1.2, 0]} castShadow><coneGeometry args={[0.65, 1.7, 7]} /><meshStandardMaterial color="#305949" /></mesh>
    </group>)}
    <Truck state={state} id="V1" offset={0.6} />
    <Truck state={state} id="V2" offset={-0.6} />
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="scene-fallback">3D rendering is unavailable. The simulation, reports and metrics remain usable below.</p> : this.props.children; }
}

export function Town({ state }: { state: WorldState }) {
  return <SceneBoundary><Canvas shadows orthographic camera={{ position: [18, 21, 23], zoom: 22, near: 0.1, far: 150 }} dpr={[1, 1.5]} fallback={<p className="scene-fallback">Town map. Simulation state is also available in the controls, reports and event log.</p>}>
    <Suspense fallback={null}><Scene state={state} /></Suspense>
  </Canvas></SceneBoundary>;
}
