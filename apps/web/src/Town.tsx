import { Component, type ReactNode, Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import type { WorldState } from "@crisiscraft/contracts";
import { Depot, EastShelter, Neighbourhood, SchoolShelter } from "./scene/buildings";
import { OuterTown } from "./scene/district";
import { CameraRig, type CameraView } from "./scene/camera";
import { Sky, Terrain } from "./scene/environment";
import { CrewChip, PlaceChip, type Tone } from "./scene/labels";
import { GROUND, type Point, crewSpots, sites } from "./scene/layout";
import { Person, Townsfolk, look } from "./scene/people";
import { BridgeClosure, RouteGlow, Roads } from "./scene/roads";
import { Truck, truckPosition } from "./scene/vehicles";
import { Floodwater } from "./scene/water";
import { Lightning, Rain } from "./scene/weather";

export type { CameraView } from "./scene/camera";
export type Selection = "D" | "S" | "E" | "JS" | "V1" | "V2";
export type CrewRole = "logistics" | "shelter" | "field";
export interface CrewMarker {
  role: CrewRole;
  name: string;
  title: string;
  status: "idle" | "thinking" | "speaking";
  line?: string;
}
export interface TownProps {
  state: WorldState;
  progress?: number;
  cameraView?: CameraView;
  cameraRevision?: number;
  route?: string[];
  selected?: Selection | null;
  onSelect?: (id: Selection) => void;
  crew?: CrewMarker[];
  labels?: boolean;
  weather?: boolean;
  compact?: boolean;
}

/** Each crew member has a distinct rain jacket so they read at a glance in the scene. */
const crewLook = {
  logistics: look(301, { jacket: "#f2611d", vest: true, hood: false, umbrella: undefined, skin: "#b07752" }),
  shelter: look(302, { jacket: "#2f6fe4", vest: false, hood: true, umbrella: undefined, skin: "#8a5a3b" }),
  field: look(303, { jacket: "#e8a317", vest: true, hood: true, umbrella: undefined, skin: "#f1c7a5" }),
};
const crewFacing: Record<CrewRole, number> = { logistics: 0.6, shelter: Math.PI * 0.85, field: Math.PI * 0.6 };

function Scene({
  state,
  progress = 0,
  cameraView = "overview",
  cameraRevision = 0,
  route = [],
  selected = null,
  onSelect,
  crew = [],
  labels = true,
  weather = true,
  compact = false,
  root,
}: TownProps & { root: HTMLDivElement | null }) {
  const bridgeClosed = state.roads.JS === false;
  const schoolPowered = Boolean(state.receiving.S);
  const school = state.requests.school;
  const east = state.requests.east;
  const showTruck = (id: string) => {
    const v = state.vehicles[id]!;
    return v.status !== "idle" || v.cargo > 0 || v.node !== "D";
  };
  const placeChips: { id: Selection; at: Point; name: string; detail: string; tone: Tone }[] = [
    {
      id: "D",
      at: [sites.D.at[0] - 0.6, 2.5, sites.D.at[2] - 0.6],
      name: "Supply depot",
      detail: `${state.stock} crates on hand`,
      tone: state.stock > 0 ? "ok" : "idle",
    },
    {
      id: "S",
      at: [sites.S.at[0], 2.15, sites.S.at[2]],
      name: "School shelter",
      detail: school?.completedTick != null
        ? "Supplied"
        : schoolPowered
          ? `Receiving · ${school?.delivered ?? 0}/${school?.quantity ?? 6}`
          : "No power · can't unload",
      tone: school?.completedTick != null ? "ok" : schoolPowered ? "warn" : "alert",
    },
    {
      id: "E",
      at: [sites.E.at[0], 1.95, sites.E.at[2]],
      name: "East shelter",
      detail: east
        ? east.completedTick != null
          ? "Supplied"
          : `Needs ${east.quantity - east.delivered} crates`
        : "Standing by",
      tone: east ? (east.completedTick != null ? "ok" : "warn") : "idle",
    },
    {
      id: "JS",
      at: [0.5, 1.45, -3],
      name: "North bridge",
      detail: bridgeClosed ? "Closed · flooded" : state.tick >= 1 ? "Open · flood risk" : "Open",
      tone: bridgeClosed ? "alert" : state.tick >= 1 ? "warn" : "ok",
    },
  ];
  return (
    <>
      <Sky shadows={!compact} />
      {weather && <Lightning />}
      <Terrain />
      <Floodwater tick={state.tick + progress} bridgeClosed={bridgeClosed} />
      <Roads />
      <BridgeClosure closed={bridgeClosed} warning={state.tick >= 1} />
      {route.length > 1 && <RouteGlow route={route} roads={state.roads} />}
      <Neighbourhood compact={compact} />
      <OuterTown tick={state.tick + progress} compact={compact} />
      <Depot stock={state.stock} />
      <SchoolShelter powered={schoolPowered} delivered={school?.delivered ?? 0} />
      <EastShelter delivered={east?.delivered ?? 0} />
      <Townsfolk compact={compact} schoolOpen={schoolPowered} />
      {crew.map((member) => (
        <Person
          key={member.role}
          at={crewSpots[member.role]}
          facing={crewFacing[member.role]}
          appearance={crewLook[member.role]}
          active={member.status === "speaking"}
          phase={member.role.length}
        />
      ))}
      {(["V1", "V2"] as const).map((id) => (
        <Truck
          key={id}
          state={state}
          id={id}
          progress={progress}
          selected={selected === id}
          onSelect={onSelect ? () => onSelect(id) : undefined}
        />
      ))}
      {weather && !compact && <Rain />}
      <CameraRig view={cameraView} state={state} progress={progress} revision={cameraRevision} compact={compact} />
      {root && labels && (
        <>
          {placeChips.map((chip) => (
            <PlaceChip
              key={chip.id}
              root={root}
              at={chip.at}
              name={chip.name}
              detail={chip.detail}
              tone={chip.tone}
              selected={selected === chip.id}
              onSelect={onSelect ? () => onSelect(chip.id) : undefined}
            />
          ))}
          {(["V1", "V2"] as const).filter(showTruck).map((id) => {
            const v = state.vehicles[id]!;
            return (
              <PlaceChip
                key={id}
                root={root}
                at={() => {
                  const [x, z] = truckPosition(state, id, progress);
                  return [x, 1.05, z];
                }}
                name={id === "V1" ? "Rescue 01" : "Rescue 02"}
                detail={`${v.status}${v.cargo ? ` · ${v.cargo} crates` : ""}`}
                tone={v.status === "stranded" ? "alert" : v.status === "travelling" ? "warn" : "ok"}
                selected={selected === id}
                onSelect={onSelect ? () => onSelect(id) : undefined}
              />
            );
          })}
          {!compact && crew.map((member) => {
            const spot = crewSpots[member.role];
            return (
              <CrewChip
                key={member.role}
                root={root}
                at={[spot[0], GROUND + 0.78, spot[2]]}
                name={member.name}
                title={member.title}
                status={member.status}
                line={member.line}
                bubbles={!compact}
              />
            );
          })}
        </>
      )}
    </>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="scene-fallback">
        3D rendering is unavailable. Use the mission controls, crew reports and event log to continue.
      </p>
    ) : (
      this.props.children
    );
  }
}

export function Town(props: TownProps) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const compact = Boolean(props.compact);
  return (
    <div className={`town-render${compact ? " compact" : ""}`}>
      <SceneBoundary>
        <Canvas
          shadows={!compact}
          camera={{ position: [16, 20, 24], fov: 36, near: 0.1, far: 520 }}
          dpr={compact ? [1, 1.25] : [1, 1.75]}
          gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
          fallback={
            <p className="scene-fallback">
              Harbor Point town map. Use the location list and mission controls to inspect the simulation.
            </p>
          }
        >
          <Suspense fallback={null}>
            <Scene {...props} root={root} />
          </Suspense>
        </Canvas>
      </SceneBoundary>
      <div className="town-labels" ref={setRoot} />
    </div>
  );
}
