import { z } from 'zod';
import type { Scenario, WorldState } from '@crisiscraft/contracts';
import { edgeBetween } from '@crisiscraft/sim';
import { check, toCommand } from './deliberate';
import { roadName, truckName } from './roster';
import { planSchema, type Plan } from './schemas';

/**
 * Priya's planning tools. Both run on the server against the engine, never on the model:
 * `list_routes` reads only her paper road map (no live road status), and `check_plan` is the
 * same dry-run the guardrail uses, so she can test a plan before she proposes it.
 */

export interface ToolCall {
  name: 'list_routes' | 'check_plan';
  args: unknown;
  result: unknown;
  /** One radio-style line describing the call and what came back. */
  summary: string;
}

export interface PlanTools {
  call(name: string, rawArgs: unknown): { result: unknown; call: ToolCall | null };
}

const listArgs = z.object({ destination: z.string().max(40) });
const checkArgs = z.object({ actions: planSchema.shape.actions });

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'list_routes',
      description: 'List every road route on your map from the supply depot to a place or request, with nominal driving minutes. The map does not know which roads are open now.',
      parameters: z.toJSONSchema(listArgs.describe('Destination place id (e.g. S) or request id (e.g. school).')),
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_plan',
      description: 'Dry-run dispatch actions against the rules validator: truck idle at the depot, capacity, stock, remaining demand, roads, closed roads, reserve rule. Returns ok or the refusal reason. Nothing moves.',
      parameters: z.toJSONSchema(checkArgs),
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_plan',
      description: 'Submit your final plan to the commander. Call this exactly once, last.',
      parameters: z.toJSONSchema(planSchema),
    },
  },
] as const;

const place = (scenario: Scenario, id: string) => scenario.nodes.find(n => n.id === id)?.label ?? id;

/** Road names along a route; a two-place route with no road between them is a flight. */
export function routeRoads(scenario: Scenario, route: string[]) {
  return route.slice(1).map((node, i) => {
    const edge = edgeBetween(scenario, route[i]!, node) ?? edgeBetween(scenario, route[i]!, node, 'air');
    return edge ? roadName(scenario, edge.id) : `${route[i]}–${node}`;
  });
}

export function routeMinutes(scenario: Scenario, route: string[]) {
  return route.slice(1).reduce((sum, node, i) => sum + ((edgeBetween(scenario, route[i]!, node) ?? edgeBetween(scenario, route[i]!, node, 'air'))?.minutes ?? 0), 0);
}

/** Every simple route from the depot, shortest first, by road and (when the map has them) by air. */
export function mapRoutes(scenario: Scenario, destination: string) {
  const out: { route: string[]; roads: string[]; minutes: number; mode: 'road' | 'air' }[] = [];
  for (const mode of ['road', 'air'] as const) {
    const walk = (path: string[], minutes: number) => {
      const here = path.at(-1)!;
      if (here === destination) {
        out.push({ route: path, roads: routeRoads(scenario, path), minutes, mode });
        return;
      }
      for (const e of scenario.edges) {
        if ((e.mode ?? 'road') !== mode) continue;
        const next = e.from === here ? e.to : e.to === here ? e.from : null;
        if (next && !path.includes(next)) walk([...path, next], minutes + e.minutes);
      }
    };
    walk([scenario.depot], 0);
  }
  return out.sort((a, b) => a.minutes - b.minutes || a.route.join().localeCompare(b.route.join()));
}

export function planTools(scenario: Scenario, state: WorldState): PlanTools {
  return {
    call(name, rawArgs) {
      if (name === 'list_routes') {
        const args = listArgs.safeParse(rawArgs);
        if (!args.success) return { result: { error: 'Expected {destination}.' }, call: null };
        const request = state.requests[args.data.destination];
        const target = request?.destination ?? args.data.destination;
        if (!scenario.nodes.some(n => n.id === target)) return { result: { error: `Unknown place ${args.data.destination}.` }, call: null };
        const routes = mapRoutes(scenario, target);
        const byRoad = routes.find(r => r.mode === 'road');
        const byAir = routes.find(r => r.mode === 'air');
        return {
          result: { destination: target, routes, note: 'Nominal minutes from the map. Road status is not on the map. Air routes are for the helicopter only.' },
          call: {
            name: 'list_routes', args: args.data, result: routes,
            summary: `Map: ${routes.length} routes to the ${place(scenario, target)}${byRoad ? `; fastest by road ${byRoad.minutes} min via ${byRoad.roads.join(' → ')}` : '; no road'}${byAir ? `; by helicopter ${byAir.minutes} min` : ''}.`,
          },
        };
      }
      if (name === 'check_plan') {
        const args = checkArgs.safeParse(rawArgs);
        if (!args.success) return { result: { ok: false, reason: 'Actions did not match the schema.' }, call: null };
        const plan: Plan = { message: '-', rationale: '-', hold: false, actions: args.data.actions, cites: [] };
        const problem = args.data.actions.length ? check(scenario, state, toCommand(state, plan, 'dry-run')) : 'No actions to check.';
        const what = args.data.actions
          .map(a => `${truckName(scenario, a.vehicleId)} · ${a.quantity} crates · ${routeRoads(scenario, a.route).join(' → ')}`)
          .join('; ');
        const result = problem ? { ok: false, reason: problem } : { ok: true };
        return { result, call: { name: 'check_plan', args: args.data, result, summary: `Dry run: ${what} — ${problem ? `refused: ${problem.replace(/\.$/, '')}` : 'passes'}.` } };
      }
      return { result: { error: `Unknown tool ${name}.` }, call: null };
    },
  };
}
