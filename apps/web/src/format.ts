import type { Role, SimEvent, WorldState } from "@crisiscraft/contracts";
import { crew } from "@crisiscraft/crew";
import { harborPoint, metrics } from "@crisiscraft/sim";

export const places: Record<string, string> = Object.fromEntries(harborPoint.nodes.map((n) => [n.id, n.label]));
export const roads: Record<string, string> = {
  DJ: "Harbour Road", JS: "North bridge", DH: "Mill Lane", HS: "Hill road", JH: "Ridge link", DE: "Coast road",
};
export const trucks: Record<string, string> = { V1: "Rescue 01", V2: "Rescue 02" };
export const requestNames: Record<string, string> = { school: "School shelter", east: "East shelter" };

export const roleColor: Record<Role, string> = { logistics: "var(--sky)", shelter: "var(--plum)", field: "var(--sage)" };
export const who = (from: Role | "commander" | "guardrail") =>
  from === "commander" ? { name: "You", title: "Commander" }
    : from === "guardrail" ? { name: "Rules check", title: "Simulation engine" }
      : { name: crew[from].name, title: crew[from].title };

export const mm = (tick: number) => String(tick).padStart(2, "0");

/** Readable route: the road names travelled, e.g. "Mill Lane → Hill road". */
export function routeName(route: string[]) {
  const legs: string[] = [];
  for (let i = 1; i < route.length; i++) {
    const edge = harborPoint.edges.find((e) => (e.from === route[i - 1] && e.to === route[i]) || (e.to === route[i - 1] && e.from === route[i]));
    if (edge) legs.push(roads[edge.id] ?? edge.id);
  }
  return legs.join(" → ");
}
export const routeMinutes = (route: string[]) => route.slice(1).reduce((sum, id, i) => {
  const edge = harborPoint.edges.find((e) => (e.from === route[i] && e.to === id) || (e.to === route[i] && e.from === id));
  return sum + (edge?.minutes ?? 0);
}, 0);

export type Tone = "info" | "good" | "warn" | "bad";
export function describe(e: SimEvent): { text: string; tone: Tone } {
  const d = e.data;
  const truck = trucks[String(d.vehicleId)] ?? d.vehicleId;
  switch (e.type) {
    case "request-opened":
      return { text: `${requestNames[String(d.requestId)] ?? d.requestId} asks for ${d.quantity} crates.`, tone: "warn" };
    case "road-closed":
      return { text: `${roads[String(d.edgeId)] ?? d.edgeId} closed to new traffic.`, tone: "bad" };
    case "receiving-changed":
      return { text: `${places[String(d.nodeId)]} ${d.enabled ? "has power again and can unload" : "lost power and cannot unload"}.`, tone: d.enabled ? "good" : "bad" };
    case "observation-received":
      return { text: "A crew member received a new report.", tone: "info" };
    case "dispatched":
      return { text: `${truck} leaves with ${d.quantity} crates via ${routeName(d.route as string[])}.`, tone: "info" };
    case "edge-entered":
      return { text: `${truck} is on ${roads[String(d.edgeId)] ?? d.edgeId}, arriving minute ${d.arrivalTick}.`, tone: "info" };
    case "edge-arrived":
      return { text: `${truck} reached ${places[String(d.nodeId)]}.`, tone: "info" };
    case "rerouted":
      return { text: `${truck} diverted via ${routeName(d.route as string[])}.`, tone: "warn" };
    case "stranded":
      return { text: `${truck} has no open road.`, tone: "bad" };
    case "delivered":
      return { text: `${truck} unloaded ${d.quantity} crates at ${requestNames[String(d.requestId)]}.`, tone: "good" };
    case "road-opened":
      return { text: `${roads[String(d.edgeId)] ?? d.edgeId} is open again.`, tone: "good" };
    case "returned":
      return { text: `${truck} is back at the depot and can be sent again.`, tone: "info" };
  }
}

/** Plain story of one timeline, built only from recorded engine events. */
export function storyBeats(world: WorldState) {
  const wanted = new Set<SimEvent["type"]>(["dispatched", "road-closed", "rerouted", "stranded", "delivered", "receiving-changed"]);
  return world.events.filter((e) => wanted.has(e.type) && e.tick > 0).map((e) => ({ tick: e.tick, ...describe(e), id: e.id }));
}

export function outcome(world: WorldState) {
  const m = metrics(harborPoint, world);
  const school = world.requests.school;
  return {
    ...m,
    schoolMinute: school?.completedTick ?? null,
    schoolOnTime: school?.completedTick != null && school.completedTick <= school.dueTick,
    schoolByDeadline: school && world.tick >= school.dueTick ? school.delivered : null,
  };
}

/** One sentence naming the event that made the two timelines differ. */
export function headline(a: WorldState, b: WorldState) {
  const oa = outcome(a);
  const ob = outcome(b);
  const reroute = (w: WorldState) => w.events.find((e) => e.type === "rerouted");
  const ra = reroute(a);
  const rb = reroute(b);
  const fmt = (o: ReturnType<typeof outcome>) => o.schoolMinute === null ? "not yet supplied" : `supplied at minute ${o.schoolMinute}${o.schoolOnTime ? ", on time" : `, ${o.completedLatenessMinutes} min late`}`;
  const why = (w: WorldState, r: SimEvent, label: string) => {
    const closure = w.events.find((e) => e.id === r.causeId && e.type === "road-closed");
    const road = closure ? roads[String(closure.data.edgeId)] ?? closure.data.edgeId : "a road";
    return ` In ${label}, ${road} closed at minute ${closure?.tick ?? r.tick} before ${trucks[String(r.data.vehicleId)]} could cross, forcing a diversion.`;
  };
  const cause = ra && !rb ? why(a, ra, "A") : rb && !ra ? why(b, rb, "B") : "";
  return `School shelter: A ${fmt(oa)}; B ${fmt(ob)}.${cause}`;
}
