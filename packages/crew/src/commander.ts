import { z } from 'zod';
import { commandSchema, SimulationError, type Scenario, type WorldState } from '@crisiscraft/contracts';
import { harborPoint, replay } from '@crisiscraft/sim';
import { truckNames } from './roster';
import { rateLimit, visitor } from './limit';

/**
 * Autopilot: an AI commander for the drill. It sees only what the human commander sees (the
 * public board, public reports and the crew radio) and picks one move: give an order, approve the
 * crew's checked plan, send it back, or let the clock run. The client carries out the move through
 * the same buttons a person would use, so every rule still applies.
 */

type Env = Record<string, string | undefined>;

const radioLine = z.object({
  from: z.string().max(20),
  kind: z.string().max(20),
  text: z.string().max(600),
  verdict: z.enum(['agree', 'concern']).optional(),
}).strict();

const requestSchema = z.object({
  minute: z.number().int().min(0).max(harborPoint.horizon),
  commands: z.array(z.object({ tick: z.number().int().min(0), command: commandSchema }).strict()).max(20),
  radio: z.array(radioLine).max(40),
  /** The crew's plan waiting for approval, in plain words, if any. */
  pending: z.string().max(400).nullable(),
  /** The autopilot's earlier moves this run, oldest first, so it knows what it already did. */
  history: z.array(z.string().max(400)).max(20),
}).strict();
export type CommanderRequest = z.infer<typeof requestSchema>;

export const moveSchema = z.object({
  move: z.enum(['order', 'approve', 'send_back', 'wait']),
  order: z.string().max(300).describe('Only for move=order: the order to radio to the crew, in plain words.'),
  reason: z.string().min(1).max(240).describe('One sentence: why this move now.'),
}).strict();
export type Move = z.infer<typeof moveSchema>;
const moveJsonSchema = z.toJSONSchema(moveSchema);

/** The commander's view: the public board and public reports. Never the schedule or private reports. */
export function commanderView(scenario: Scenario, state: WorldState) {
  return {
    minute: state.tick,
    horizon: scenario.horizon,
    requests: Object.values(state.requests).map(r => ({
      shelter: scenario.nodes.find(n => n.id === r.destination)?.label ?? r.destination,
      crates: r.quantity, delivered: r.delivered, dueMinute: r.dueTick, complete: r.completedTick !== null,
      truckAssigned: Object.values(state.vehicles).some(v => v.requestId === r.id && v.cargo > 0),
    })),
    trucks: Object.values(state.vehicles).map(v => ({ name: truckNames[v.id] ?? v.id, status: v.status, cargo: v.cargo })),
    depotCrates: state.stock,
    reserveRule: `Keep at least ${state.reserveMinimum} truck idle at the depot.`,
    publicReports: state.observations.filter(o => o.audience.includes('public')).map(o => ({ minute: o.observedTick, fact: o.fact })),
  };
}

export async function commanderMove(scenario: Scenario, state: WorldState, request: CommanderRequest, env: Env): Promise<Move & { ms: number; model: string }> {
  const base = (env.MODEL_PHOTO_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
  const model = 'muse-spark-1.3';
  const started = Date.now();
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${env.MODEL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, reasoning_effort: 'low', max_completion_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: [
            'You are the incident commander in Harbor Point, a FICTIONAL flood drill. Your crew: Priya (logistics, plans dispatches), Malik (shelters), June (field, at the north bridge).',
            'You see only the public board, public reports and the crew radio. Choose exactly one move:',
            'order: radio a short plain-words order to the crew (they report, Priya plans, teammates review, a rules check runs);',
            'approve: accept the crew plan that is waiting, if it serves the shelters and you accept its risks;',
            'send_back: reject the waiting plan;',
            'wait: let the clock run until something changes.',
            'Listen to the crew: a field warning outranks a fast route. Sending a plan back cancels it: if a shelter still needs crates and no truck is assigned, give a new order that says what to change. Do not repeat an order that is already being handled. Keep the reserve rule in mind.',
          ].join(' '),
        },
        { role: 'user', content: JSON.stringify({ board: commanderView(scenario, state), crewRadio: request.radio, waitingPlan: request.pending, yourEarlierMoves: request.history }) },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'commander_move', schema: moveJsonSchema } },
    }),
  });
  if (!response.ok) throw new Error(`Model API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  const move = moveSchema.parse(JSON.parse(body.choices?.[0]?.message?.content ?? 'null'));
  // A move that cannot apply is downgraded rather than trusted.
  if (move.move === 'order' && move.order.trim().length < 2) return { move: 'wait', order: '', reason: move.reason, ms: Date.now() - started, model };
  if ((move.move === 'approve' || move.move === 'send_back') && !request.pending) return { move: 'wait', order: '', reason: move.reason, ms: Date.now() - started, model };
  return { ...move, ms: Date.now() - started, model };
}

/** Deterministic autopilot for the scripted crew: order once per open request, approve checked plans. */
export function scriptedMove(state: WorldState, request: CommanderRequest): Move {
  if (request.pending) {
    const concern = request.radio.some(l => l.verdict === 'concern');
    return concern
      ? { move: 'send_back', order: '', reason: 'A teammate raised a concern about this plan.' }
      : { move: 'approve', order: '', reason: 'The plan passed the rules and the crew agrees.' };
  }
  const open = Object.values(state.requests).find(r => r.completedTick === null && !Object.values(state.vehicles).some(v => v.requestId === r.id && v.cargo > 0));
  const order = open && `Get ${open.quantity - open.delivered} crates to the ${open.id === 'school' ? 'school' : 'east shelter'}. Keep one truck back.`;
  if (order && !request.history.some(h => h.includes(order))) return { move: 'order', order, reason: `${open.id === 'school' ? 'The school' : 'The east shelter'} still needs crates and no truck is assigned.` };
  return { move: 'wait', order: '', reason: 'Nothing new to decide; let the clock run.' };
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

/** POST {minute, commands, radio, pending, history}; returns the commander's next move. */
export function nodeCommanderHandler(env: Env) {
  const limiter = rateLimit(Number(env.CREW_RATE_LIMIT) || 60, 10 * 60_000);
  return async (req: NodeRequest, res: NodeResponse) => {
    const json = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!limiter.allow(visitor(req))) return json(429, { error: 'Autopilot is thinking too often. Try again in a few minutes.' });
    let raw = '';
    for await (const chunk of req) {
      raw += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
      if (raw.length > 64_000) return json(413, { error: 'Request too large.' });
    }
    const parsed = requestSchema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
    if (!parsed.success) return json(400, { error: 'Expected {minute, commands, radio, pending, history}.' });
    let state: WorldState;
    try {
      state = replay(harborPoint, parsed.data.commands, parsed.data.minute);
    } catch (error) {
      if (error instanceof SimulationError) return json(409, { error: error.message });
      throw error;
    }
    if (!env.MODEL_API_KEY || env.CREW_PROVIDER === 'scripted') return json(200, { ...scriptedMove(state, parsed.data), ms: 0, model: null });
    try {
      return json(200, await commanderMove(harborPoint, state, parsed.data, env));
    } catch (error) {
      return json(502, { error: error instanceof Error ? error.message : 'Autopilot failed.' });
    }
  };
}
