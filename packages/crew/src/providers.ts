import type { Role } from '@crisiscraft/contracts';
import { harborPoint, shortestOpenRoute } from '@crisiscraft/sim';
import type { Briefing } from './context';
import { crew, truckNames } from './roster';
import { jsonSchemas, planSchema, reportSchema, type Plan, type Report } from './schemas';

export interface TeamMessage { from: Role; text: string; cites: string[] }

export type CrewTask =
  | { kind: 'report'; role: Role; order: string; briefing: Briefing }
  | { kind: 'plan'; role: 'logistics'; order: string; briefing: Briefing; team: TeamMessage[]; refusal?: string };

export interface Usage { inputTokens: number; outputTokens: number }
export interface TurnResult<T> { output: T; usage: Usage | null; ms: number; prompt: { system: string; user: string } }

export interface CrewProvider {
  id: 'meta' | 'scripted';
  label: string;
  model: string | null;
  live: boolean;
  report(task: Extract<CrewTask, { kind: 'report' }>): Promise<TurnResult<Report>>;
  plan(task: Extract<CrewTask, { kind: 'plan' }>): Promise<TurnResult<Plan>>;
}

export function prompts(task: CrewTask) {
  const me = crew[task.role];
  const system = [
    `You are ${me.name}, ${me.title} at the ${me.post}, in Harbor Point: a FICTIONAL flood coordination drill.`,
    `Your remit: ${me.remit} Your voice: ${me.voice}`,
    'You know ONLY what is in your briefing JSON. Never invent roads, stock, times or reports.',
    'Every observation carries the minute it was observed; an old observation may be stale, so say how old it is when it matters.',
    'Other crew members cannot see your briefing. If you know something the team needs, say it plainly.',
    'Speak like a person on a radio: use names (Rescue 01, the north bridge, the hill road, the school shelter), never ids such as V1, JS, D-H-S or bridge-0. Ids belong only in cites and plan actions.',
    task.kind === 'report'
      ? 'Reply on the team radio in at most two short sentences, then list the observation ids you used.'
      : [
        'You must propose the dispatch plan the commander will approve or reject.',
        'A code validator enforces: the truck must be idle at the depot; quantity <= truck capacity, depot stock and remaining unassigned demand;',
        'the route must start at the depot, end at the request destination and follow roads in your road map; a road already closed is refused;',
        'the reserve rule must still hold after dispatch. Plan only what the commander asked for.',
        'The commander decides. If the order names a route and the validator would allow it, plan that route; never silently swap in another.',
        'If a teammate warned against it, say so in your message in plain words so the commander approves with eyes open.',
        'If the order cannot be done safely, or needs a truck you must keep in reserve, set hold=true with empty actions and explain.',
        'In rationale, name the teammate report or observation id that shaped the route.',
      ].join(' '),
  ].join('\n');
  const user = JSON.stringify({
    commanderOrder: task.order,
    briefing: task.briefing,
    ...(task.kind === 'plan' ? { teamRadio: task.team.map(m => ({ from: `${crew[m.from].name} (${crew[m.from].title})`, said: m.text })) } : {}),
    ...(task.kind === 'plan' && task.refusal ? { validatorRefusedYourLastPlan: task.refusal, instruction: 'Revise the plan so it passes, or hold.' } : {}),
  }, null, 1);
  return { system, user };
}

/** Meta Model API (OpenAI-compatible Chat Completions). Also works for Muse Spark Open on Baseten via MODEL_BASE_URL. */
export function metaProvider(env: Record<string, string | undefined>): CrewProvider {
  const key = env.MODEL_API_KEY!;
  const base = (env.MODEL_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
  const model = env.MODEL_NAME || 'muse-spark-1.3';
  async function call<T>(task: CrewTask, name: 'report' | 'plan', parse: (v: unknown) => T): Promise<TurnResult<T>> {
    const prompt = prompts(task);
    const started = Date.now();
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning_effort: env.MODEL_REASONING || 'low',
        max_completion_tokens: 2000,
        messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
        response_format: { type: 'json_schema', json_schema: { name, schema: jsonSchemas[name] } },
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Model API ${response.status}: ${detail}`);
    }
    const body = await response.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = body.choices?.[0]?.message?.content ?? '';
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new Error(`${crew[task.role].name} replied with text that is not JSON.`); }
    return {
      output: parse(parsed),
      usage: body.usage ? { inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0 } : null,
      ms: Date.now() - started,
      prompt,
    };
  }
  return {
    id: 'meta', label: 'Meta Model API', model, live: true,
    report: task => call(task, 'report', v => reportSchema.parse(v)),
    plan: task => call(task, 'plan', v => planSchema.parse(v)),
  };
}

const truckName = (id: string) => truckNames[id] ?? id;
const has = (b: Briefing, id: string) => b.observations.some(o => o.id === id);
const fact = (b: Briefing, id: string) => b.observations.find(o => o.id === id);

/**
 * Deterministic stand-in used when no model key is configured. It reads the same bounded
 * briefings and is labelled "Scripted crew" in the interface; it is not presented as AI.
 */
export const scriptedProvider: CrewProvider = {
  id: 'scripted', label: 'Scripted crew', model: null, live: false,
  async report(task) {
    const b = task.briefing;
    const lines: Record<Role, () => Report> = {
      logistics: () => {
        const idle = b.board.trucks.filter(t => t.status === 'idle' && t.at === 'Supply depot');
        return { message: `${idle.length} truck${idle.length === 1 ? '' : 's'} idle at the depot, six crates each. The bridge was open when we checked at minute 0 — that's ${b.minute} minutes old.`, cites: ['stock-0', 'bridge-0'].filter(id => has(b, id)) };
      },
      shelter: () => {
        if (has(b, 'power-6')) return { message: 'Power is back at the school — we can unload now.', cites: ['power-6'] };
        const east = has(b, 'east-5') ? ' East shelter also needs six crates by minute 12.' : '';
        return { message: `School needs six crates by minute 9, but we can't unload until power returns around minute 6.${east}`, cites: ['school-0', ...(east ? ['east-5'] : [])] };
      },
      field: () => {
        if (has(b, 'closure-4')) return { message: 'North bridge is closed to new entry. Hill road is the only way to the school.', cites: ['closure-4'] };
        const risk = fact(b, 'risk-1');
        return risk
          ? { message: `Water is rising at the north bridge as of minute ${risk.observedMinute}. Hill road is open — I'd avoid the bridge.`, cites: ['risk-1'] }
          : { message: 'No road reports from the field yet.', cites: [] };
      },
    };
    return { output: lines[task.role](), usage: null, ms: 0, prompt: prompts(task) };
  },
  async plan(task) {
    const b = task.briefing;
    const order = task.order.toLowerCase();
    const open = b.board.openRequests.filter(r => !r.complete && r.quantity > r.delivered
      && !b.board.trucks.some(t => t.assignedTo === r.id && t.cargo > 0));
    const request = open.find(r => order.includes(r.id) || order.includes(r.destinationName.toLowerCase().split(' ')[0]!)) ?? open[0];
    const idle = b.board.trucks.filter(t => t.status === 'idle' && t.at === 'Supply depot');
    const hold = (message: string, rationale: string): Plan => ({ message, rationale, hold: true, actions: [], cites: [] });
    let output: Plan;
    const bridgeRefused = !!task.refusal?.includes('closed');
    if (task.refusal && !bridgeRefused) output = hold('I can\'t make that plan pass the rules, so I\'m holding.', `Validator: ${task.refusal}`);
    else if (!request) output = hold('Nothing is waiting to be delivered right now.', 'Every open request is complete or already has a truck.');
    else if (idle.length <= 1) output = hold('Holding — sending our last idle truck would break the reserve rule.', b.board.reserveRule);
    else {
      const warned = task.team.some(m => m.cites.includes('risk-1') || m.cites.includes('closure-4'));
      const avoidBridge = bridgeRefused || ((warned || order.includes('hill')) && !order.includes('bridge'));
      const roads = Object.fromEntries(harborPoint.edges.map(e => [e.id, !(avoidBridge && e.id === 'JS')]));
      const route = shortestOpenRoute(harborPoint, roads, harborPoint.depot, request.destination)!;
      const viaBridge = route.includes('J') && route.includes('S');
      output = {
        message: `Send ${truckName(idle[0]!.id)} with ${Math.min(6, request.quantity - request.delivered)} crates to the ${request.destinationName} via ${viaBridge ? 'the north bridge' : 'the hill road'}; ${truckName(idle[1]!.id)} stays in reserve.`,
        rationale: viaBridge
          ? 'The bridge is the fastest road on my map and my last report says it was open.'
          : bridgeRefused ? 'The validator says the bridge is already closed, so I rerouted over the hill road.'
            : warned ? 'June reported rising water at the bridge, so I took the longer hill road.'
              : 'You asked for the hill road; it is three minutes slower but avoids the bridge.',
        hold: false,
        actions: [{ vehicleId: idle[0]!.id, requestId: request.id, quantity: Math.min(6, request.quantity - request.delivered), route }],
        cites: warned && !viaBridge ? ['risk-1'] : ['bridge-0'],
      };
    }
    return { output, usage: null, ms: 0, prompt: prompts(task) };
  },
};

export function chooseProvider(env: Record<string, string | undefined>): CrewProvider {
  return env.MODEL_API_KEY && env.CREW_PROVIDER !== 'scripted' ? metaProvider(env) : scriptedProvider;
}
