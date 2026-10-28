import type { Scenario } from '@crisiscraft/contracts';

export function edgeBetween(scenario: Scenario, from: string, to: string) {
  return scenario.edges.find(e => (e.from === from && e.to === to) || (e.to === from && e.from === to));
}

/** Dijkstra with explicit lexical tie-breaking; independent of array insertion order. */
export function shortestOpenRoute(
  scenario: Scenario, roads: Record<string, boolean>, start: string, destination: string,
): string[] | null {
  const frontier = [{ node: start, cost: 0, path: [start] }];
  const visited = new Set<string>();
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost || compareIds(a.path.join('/'), b.path.join('/')));
    const current = frontier.shift()!;
    if (visited.has(current.node)) continue;
    if (current.node === destination) return current.path;
    visited.add(current.node);
    for (const edge of [...scenario.edges].sort((a, b) => compareIds(a.id, b.id))) {
      if (!roads[edge.id]) continue;
      const neighbor = edge.from === current.node ? edge.to : edge.to === current.node ? edge.from : null;
      if (neighbor !== null && !visited.has(neighbor)) {
        frontier.push({ node: neighbor, cost: current.cost + edge.minutes, path: [...current.path, neighbor] });
      }
    }
  }
  return null;
}

export function compareIds(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }
