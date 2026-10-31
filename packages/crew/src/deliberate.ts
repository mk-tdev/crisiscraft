import { SimulationError, type ApprovedCommand, type Role, type Scenario, type WorldState } from '@crisiscraft/contracts';
import { approveCommand } from '@crisiscraft/sim';
import { briefing } from './context';
import type { CrewProvider, TeamMessage, Usage } from './providers';
import { crew, roles } from './roster';
import { planTools } from './tools';
import type { Plan } from './schemas';

export interface CrewTurn {
  id: string;
  from: Role | 'commander' | 'guardrail';
  kind: 'order' | 'report' | 'tool' | 'plan' | 'refused' | 'passed' | 'hold';
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

export async function deliberate(
  scenario: Scenario, state: WorldState, order: string, provider: CrewProvider,
  onTurn: (turn: CrewTurn) => void = () => {},
  /** Radio traffic from earlier in the run, such as June's field photo, heard by the planner. */
  earlier: TeamMessage[] = [],
): Promise<Deliberation> {
  let n = 0;
  const turns: CrewTurn[] = [];
  const turn = (t: Omit<CrewTurn, 'id'>): CrewTurn => {
    const full = { id: `turn-${n++}`, ...t };
    onTurn(full);
    return full;
  };
  turns.push(turn({ from: 'commander', kind: 'order', text: order, cites: [] }));

  // 1. Each role reports from its own briefing only, in parallel.
  // Turns are streamed as each report lands, then kept in role order for the planner.
  const reports = await Promise.all(roles.map(async role => {
    const r = await provider.report({ kind: 'report', role, order, briefing: briefing(scenario, state, role) });
    return { role, r, t: turn({ from: role, kind: 'report', text: r.output.message, cites: r.output.cites, ms: r.ms, usage: r.usage, prompt: r.prompt }) };
  }));
  const team: TeamMessage[] = [...earlier, ...reports.map(({ role, r }) => ({ from: role, text: r.output.message, cites: r.output.cites }))];
  turns.push(...reports.map(r => r.t));

  // 2. Logistics plans from its briefing plus what teammates said; 3. the engine checks it; one revision.
  const base = { minute: state.tick, revision: state.revision, order, provider: { id: provider.id, label: provider.label, model: provider.model, live: provider.live } };
  let refusal: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = await provider.plan({
      kind: 'plan', role: 'logistics', order, briefing: briefing(scenario, state, 'logistics'), team, refusal,
      tools: planTools(scenario, state),
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
    if (!problem) {
      turns.push(turn({ from: 'guardrail', kind: 'passed', text: 'Plan checked against stock, capacity, roads and the reserve rule. Ready for your approval.', cites: [] }));
      return { ...base, turns, command, plan, refusal: null };
    }
    turns.push(turn({ from: 'guardrail', kind: 'refused', text: `Refused: ${problem}`, detail: attempt === 0 ? `${crew.logistics.name} reads why and revises.` : undefined, cites: [] }));
    refusal = problem;
  }
  return { ...base, turns, command: null, plan: null, refusal: refusal ?? null };
}
