import { SimulationError, type ApprovedCommand, type Role, type Scenario, type WorldState } from '@crisiscraft/contracts';
import { approveCommand } from '@crisiscraft/sim';
import { briefing } from './context';
import type { CrewProvider, CrewTask, TeamMessage, Usage } from './providers';
import { crew, roles, truckNames } from './roster';
import { planTools, routeMinutes, routeRoads } from './tools';
import type { Plan } from './schemas';

export interface CrewTurn {
  id: string;
  from: Role | 'commander' | 'guardrail';
  kind: 'order' | 'report' | 'alert' | 'tool' | 'plan' | 'review' | 'refused' | 'passed' | 'hold';
  /** On review turns: whether the teammate agreed with Priya's draft. */
  verdict?: 'agree' | 'concern';
  text: string;
  detail?: string;
  cites: string[];
  ms?: number;
  usage?: Usage | null;
  /** Exactly what the model received, so learners can inspect bounded context. */
  prompt?: { system: string; user: string };
}

export interface Deliberation {
  minute: number;
  revision: number;
  order: string;
  provider: { id: CrewProvider['id']; label: string; model: string | null; live: boolean };
  turns: CrewTurn[];
  /** A validated command ready for approval, or null when the crew holds or the plan was refused. */
  command: ApprovedCommand | null;
  plan: Plan | null;
  refusal: string | null;
}

export function toCommand(state: WorldState, plan: Plan, id: string): ApprovedCommand {
  return { id, expectedRevision: state.revision, reserveMinimum: state.reserveMinimum, actions: plan.actions };
}

/** Dry-run the engine. The model never mutates state; only the commander's approval does. */
export function check(scenario: Scenario, state: WorldState, command: ApprovedCommand): string | null {
  try {
    approveCommand(scenario, state, command);
    return null;
  } catch (error) {
    if (error instanceof SimulationError) return error.message;
    throw error;
  }
}

/** Plain-words description of a drafted dispatch, as teammates hear it on the radio. */
function describePlan(scenario: Scenario, state: WorldState, plan: Plan) {
  return plan.actions.map(a => {
    const dest = scenario.nodes.find(n => n.id === state.requests[a.requestId]?.destination)?.label ?? a.requestId;
    return `${truckNames[a.vehicleId] ?? a.vehicleId} with ${a.quantity} crates to the ${dest} via ${routeRoads(scenario, a.route).join(' → ')}, arriving about minute ${state.tick + routeMinutes(scenario, a.route)} if every road stays open.`;
  }).join(' ');
}

export interface DeliberateOptions {
  /** For evaluation: roles kept off the radio, so their reports never reach the planner. */
  silence?: Role[];
  /** A crew member radioing in unprompted because a new report just reached them. */
  initiative?: { role: Role; observationId: string };
  /** Teammates review a plan that passed the rules; one revision if anyone has a concern. Default on. */
  review?: boolean;
}

export async function deliberate(
  scenario: Scenario, state: WorldState, order: string, provider: CrewProvider,
  onTurn: (turn: CrewTurn) => void = () => {},
  /** Radio traffic from earlier in the run, such as June's field photo, heard by the planner. */
  earlier: TeamMessage[] = [],
  options: DeliberateOptions = {},
): Promise<Deliberation> {
  let n = 0;
  const turns: CrewTurn[] = [];
  const turn = (t: Omit<CrewTurn, 'id'>): CrewTurn => {
    const full = { id: `turn-${n++}`, ...t };
    onTurn(full);
    return full;
  };

  let team: TeamMessage[];
  const initiative = options.initiative;
  const news = initiative && state.observations.find(o => o.id === initiative.observationId && o.audience.includes(initiative.role));
  if (initiative && news) {
    // 1a. Initiative: one crew member radios in about news nobody asked for; Priya proposes a response.
    const r = await provider.report({ kind: 'report', role: initiative.role, order, briefing: briefing(scenario, state, initiative.role), news: { id: news.id, fact: news.fact } });
    turns.push(turn({ from: initiative.role, kind: 'alert', text: r.output.message, cites: r.output.cites, ms: r.ms, usage: r.usage, prompt: r.prompt }));
    team = [...earlier, { from: initiative.role, text: r.output.message, cites: r.output.cites }];
  } else {
    turns.push(turn({ from: 'commander', kind: 'order', text: order, cites: [] }));
    // 1b. Each role reports from its own briefing only, in parallel.
    // Turns are streamed as each report lands, then kept in role order for the planner.
    const reports = await Promise.all(roles.filter(role => !options.silence?.includes(role)).map(async role => {
      const r = await provider.report({ kind: 'report', role, order, briefing: briefing(scenario, state, role) });
      return { role, r, t: turn({ from: role, kind: 'report', text: r.output.message, cites: r.output.cites, ms: r.ms, usage: r.usage, prompt: r.prompt }) };
    }));
    team = [...earlier, ...reports.map(({ role, r }) => ({ from: role, text: r.output.message, cites: r.output.cites }))];
    turns.push(...reports.map(r => r.t));
  }

  // 2. Logistics plans with her tools; 3. the engine checks it; 4. teammates review a passing plan.
  // Up to one revision for a rules refusal and one for a teammate concern.
  const base = { minute: state.tick, revision: state.revision, order, provider: { id: provider.id, label: provider.label, model: provider.model, live: provider.live } };
  const reviewers = roles.filter(r => r !== 'logistics' && !options.silence?.includes(r));
  let refusal: string | undefined;
  let refusals = 0;
  let reviews: Extract<CrewTask, { kind: 'plan' }>['reviews'];
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = await provider.plan({
      kind: 'plan', role: 'logistics', order, briefing: briefing(scenario, state, 'logistics'), team, refusal, reviews,
      // A revision after teammate review answers their concerns directly; the rules check below still runs.
      tools: reviews ? undefined : planTools(scenario, state),
      onTool: call => turns.push(turn({ from: 'logistics', kind: 'tool', text: call.summary, detail: call.name, cites: [] })),
    });
    const plan = p.output;
    turns.push(turn({ from: 'logistics', kind: 'plan', text: plan.message, detail: plan.rationale, cites: plan.cites, ms: p.ms, usage: p.usage, prompt: p.prompt }));
    if (plan.hold || plan.actions.length === 0) {
      turns.push(turn({ from: 'guardrail', kind: 'hold', text: `${crew.logistics.name} recommends holding. Nothing will move unless you give a new order.`, cites: [] }));
      return { ...base, turns, command: null, plan, refusal: null };
    }
    const command = toCommand(state, plan, `cmd-m${state.tick}-r${state.revision}-${attempt}`);
    const problem = check(scenario, state, command);
    if (problem) {
      refusals++;
      turns.push(turn({ from: 'guardrail', kind: 'refused', text: `Refused: ${problem}`, detail: refusals === 1 ? `${crew.logistics.name} reads why and revises.` : undefined, cites: [] }));
      if (refusals >= 2) return { ...base, turns, command: null, plan: null, refusal: problem };
      refusal = problem;
      continue;
    }
    if (options.review !== false && !reviews && reviewers.length) {
      const proposal = describePlan(scenario, state, plan);
      const verdicts = await Promise.all(reviewers.map(async role => {
        const r = await provider.review({ kind: 'review', role, order, briefing: briefing(scenario, state, role), proposal });
        turns.push(turn({ from: role, kind: 'review', verdict: r.output.verdict, text: r.output.message, cites: r.output.cites, ms: r.ms, usage: r.usage, prompt: r.prompt }));
        return { from: role, verdict: r.output.verdict, text: r.output.message };
      }));
      if (verdicts.some(v => v.verdict === 'concern')) {
        reviews = verdicts;
        refusal = undefined;
        continue;
      }
    }
    turns.push(turn({ from: 'guardrail', kind: 'passed', text: `Plan checked against stock, capacity, roads and the reserve rule${reviews || !reviewers.length || options.review === false ? '' : ', and agreed by the crew'}. Ready for your approval.`, cites: [] }));
    return { ...base, turns, command, plan, refusal: null };
  }
  return { ...base, turns, command: null, plan: null, refusal: refusal ?? null };
}
