import { SimulationError, type ApprovedCommand, type Scenario, type WorldState } from '@crisiscraft/contracts';
import { advanceTo, approveCommand, createWorld, makeSchoolCommand } from './engine';

export interface Checkpoint {
  format: 1;
  scenarioId: string;
  scenarioVersion: string;
  state: WorldState;
}

export function checkpoint(state: WorldState): Checkpoint {
  return { format: 1, scenarioId: state.scenarioId, scenarioVersion: state.scenarioVersion, state: structuredClone(state) };
}

/** Internal checkpoints are full engine records, not an untrusted import format. */
export function restore(scenario: Scenario, saved: Checkpoint): WorldState {
  if (saved.format !== 1 || saved.scenarioId !== scenario.id || saved.scenarioVersion !== scenario.version
    || saved.state.scenarioId !== scenario.id || saved.state.scenarioVersion !== scenario.version) {
    throw new SimulationError('INVALID_CHECKPOINT', 'Checkpoint belongs to a different scenario version.');
  }
  return structuredClone(saved.state);
}

export function replay(scenario: Scenario, commands: { tick: number; command: ApprovedCommand }[], until: number): WorldState {
  let state = createWorld(scenario);
  let lastTick = 0;
  for (const entry of commands) {
    if (entry.tick < lastTick) throw new SimulationError('INVALID_TICK', 'Commands must be in recorded order.');
    lastTick = entry.tick;
    if (entry.tick > until) break;
    state = advanceTo(scenario, state, entry.tick);
    state = approveCommand(scenario, state, entry.command);
  }
  return advanceTo(scenario, state, until);
}

export function compareSchoolRoutes(scenario: Scenario, tick: number) {
  const saved = checkpoint(advanceTo(scenario, createWorld(scenario), scenario.checkpointTick));
  const run = (route: string[]) => {
    const initial = restore(scenario, saved);
    const approved = approveCommand(scenario, initial, makeSchoolCommand(initial, route));
    return advanceTo(scenario, approved, tick);
  };
  return { checkpoint: saved, original: run(['D', 'J', 'S']), alternative: run(['D', 'H', 'S']) };
}
