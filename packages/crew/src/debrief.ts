import { z } from 'zod';
import { commandSchema, SimulationError, type Scenario, type SimEvent, type WorldState } from '@crisiscraft/contracts';
import { harborPoint, metrics, replay, roleContext } from '@crisiscraft/sim';
import { crew, roles, truckNames } from './roster';
import { routeRoads } from './tools';
import { rateLimit, visitor } from './limit';

/**
 * After-action review. Muse Spark writes the findings, but every finding must cite events from
 * the engine's log, and the server checks each citation against the replayed runs. A finding
 * that cites an event which never happened is removed, and the review says so.
 */

type Env = Record<string, string | undefined>;

const decisionSchema = z.object({ tick: z.number().int().min(0), command: commandSchema, order: z.string().trim().min(1).max(400) }).strict();
const requestSchema = z.object({
  timelines: z.array(z.object({ label: z.enum(['A', 'B']), decisions: z.array(decisionSchema).max(20) }).strict()).min(1).max(2),
}).strict();
export type DebriefRequest = z.infer<typeof requestSchema>;

const reviewSchema = z.object({
  headline: z.string().min(1).max(180).describe('One sentence: what decided the outcome.'),
  findings: z.array(z.object({
    text: z.string().min(1).max(260).describe('One finding in plain words, about a decision, a report or an event.'),
    cites: z.array(z.string().max(60)).min(1).max(4).describe('Event ids from the logs that prove this finding.'),
  }).strict()).min(2).max(4),
  lesson: z.string().min(1).max(220).describe('The one habit a coordinator should take into the next drill.'),
}).strict();
const reviewJsonSchema = z.toJSONSchema(reviewSchema);

export interface Finding { text: string; cites: { id: string; tick: number; message: string }[] }
export interface Debrief {
  headline: string;
  findings: Finding[];
  lesson: string;
  /** Findings dropped because a citation did not match any event in the runs. */
  removed: { text: string; badCites: string[] }[];
  model: string;
  ms: number;
  usage: { inputTokens: number; outputTokens: number } | null;
}

/** What the reviewer sees: each run's orders, the engine log with ids, and the outcome. */
export function runRecord(scenario: Scenario, label: 'A' | 'B', decisions: DebriefRequest['timelines'][number]['decisions']) {
  const state: WorldState = replay(scenario, decisions.map(({ tick, command }) => ({ tick, command })), scenario.horizon);
  const m = metrics(scenario, state);
  const school = state.requests.school;
  return {
    label,
    state,
    record: {
      run: label,
      decisions: decisions.map(d => ({
        minute: d.tick,
        commanderOrder: d.order,
        dispatched: d.command.actions.map(a => `${truckNames[a.vehicleId] ?? a.vehicleId}, ${a.quantity} crates to ${a.requestId} via ${routeRoads(scenario, a.route).join(' → ')}`),
        // Who knew what when the order was given: the bounded knowledge each crew member had.
        crewKnew: roles.map(role => ({
          who: `${crew[role].name} (${crew[role].title})`,
          reports: roleContext(replay(scenario, decisions.filter(p => p.tick < d.tick).map(({ tick, command }) => ({ tick, command })), d.tick), role)
            .observations.map(o => `minute ${o.observedTick}: ${o.fact}`),
        })),
      })),
      events: state.events
        .filter(e => e.type !== 'edge-entered' && e.type !== 'edge-arrived')
        .map(e => ({ id: `${label}:${e.id}`, minute: e.tick, what: e.message })),
      outcome: {
        schoolSuppliedAtMinute: school?.completedTick ?? null,
        schoolDueMinute: school?.dueTick ?? null,
        cratesDelivered: m.deliveredCrates,
        cratesStillNeeded: m.unmetCrates,
        trucksInReserveAtEnd: m.idleTrucksAtDepot,
      },
    },
  };
}

/** Keep findings whose every citation names a real event; report the rest. */
export function verify(review: z.infer<typeof reviewSchema>, events: Map<string, SimEvent>) {
  const findings: Finding[] = [];
  const removed: Debrief['removed'] = [];
  for (const f of review.findings) {
    const bad = f.cites.filter(id => !events.has(id));
    if (bad.length) removed.push({ text: f.text, badCites: bad });
    else findings.push({ text: f.text, cites: f.cites.map(id => ({ id, tick: events.get(id)!.tick, message: events.get(id)!.message })) });
  }
  return { findings, removed };
}

export async function debrief(scenario: Scenario, request: DebriefRequest, env: Env): Promise<Debrief> {
  const runs = request.timelines.map(t => runRecord(scenario, t.label, t.decisions));
  const events = new Map(runs.flatMap(r => r.state.events.map(e => [`${r.label}:${e.id}`, e] as const)));
  const base = (env.MODEL_PHOTO_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
  const model = 'muse-spark-1.3';
  const started = Date.now();
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${env.MODEL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, reasoning_effort: 'low', max_completion_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: [
            'You are the exercise facilitator writing a short after-action review of a FICTIONAL flood drill in Harbor Point.',
            runs.length === 2 ? 'Two runs share the same storm and differ by one decision. Explain what made the outcomes differ.' : 'Explain what decided the outcome of this run.',
            'Every finding must cite event ids copied exactly from the logs (for example "A:ev-…"). Cite only events that support the finding.',
            'crewKnew shows what each crew member knew when each order was given; say whether a warning existed and whether the decision used it.',
            'Use plain names for roads and trucks. No blame; focus on information, timing and decisions.',
          ].join(' '),
        },
        { role: 'user', content: JSON.stringify(runs.map(r => r.record)) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'after_action_review', schema: reviewJsonSchema } },
    }),
  });
  if (!response.ok) throw new Error(`Model API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const review = reviewSchema.parse(JSON.parse(body.choices?.[0]?.message?.content ?? 'null'));
  return {
    headline: review.headline,
    lesson: review.lesson,
    ...verify(review, events),
    model,
    ms: Date.now() - started,
    usage: body.usage ? { inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0 } : null,
  };
}

interface NodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

/** POST {timelines}; returns the verified review as JSON. */
export function nodeDebriefHandler(env: Env) {
  const limiter = rateLimit(Number(env.CREW_RATE_LIMIT) || 40, 10 * 60_000);
  return async (req: NodeRequest, res: NodeResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!env.MODEL_API_KEY || env.CREW_PROVIDER === 'scripted') return json(503, { error: 'The debrief needs MODEL_API_KEY.' });
    if (!limiter.allow(visitor(req))) return json(429, { error: 'Too many debriefs. Try again in a few minutes.' });
    let raw = '';
    for await (const chunk of req) {
      raw += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      if (raw.length > 128_000) return json(413, { error: 'Request too large.' });
    }
    const parsed = requestSchema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
    if (!parsed.success) return json(400, { error: 'Expected {timelines}.' });
    try {
      return json(200, await debrief(harborPoint, parsed.data, env));
    } catch (error) {
      if (error instanceof SimulationError) return json(409, { error: error.message });
      return json(502, { error: error instanceof Error ? error.message : 'The debrief failed.' });
    }
  };
}
