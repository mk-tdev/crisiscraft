import { afterEach, describe, expect, it, vi } from 'vitest';
import { debrief, runRecord } from '@crisiscraft/crew';
import { harborPoint } from '@crisiscraft/sim';

const cmd = (route: string[]) => ({ id: 'cmd-1', expectedRevision: 2, reserveMinimum: 1, actions: [{ vehicleId: 'V1', requestId: 'school', quantity: 6, route }] });
const runs = {
  timelines: [
    { label: 'A' as const, decisions: [{ tick: 2, command: cmd(['D', 'H', 'S']), order: 'Hill road to the school.' }] },
    { label: 'B' as const, decisions: [{ tick: 2, command: cmd(['D', 'J', 'S']), order: 'Bridge to the school.' }] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('after-action review', () => {
  it('gives the reviewer each run with labelled engine event ids and the outcome', () => {
    const b = runRecord(harborPoint, 'B', runs.timelines[1]!.decisions).record;
    expect(b.events.every(e => e.id.startsWith('B:'))).toBe(true);
    expect(b.events.some(e => e.what.includes('diverted'))).toBe(true);
    expect(b.outcome.schoolSuppliedAtMinute).toBe(11);
    expect(b.decisions[0]!.dispatched[0]).toContain('Harbour Road → north bridge');
  });

  it('keeps findings with real citations and removes any that cite an event that never happened', async () => {
    const a = runRecord(harborPoint, 'A', runs.timelines[0]!.decisions).record;
    const b = runRecord(harborPoint, 'B', runs.timelines[1]!.decisions).record;
    const diverted = b.events.find(e => e.what.includes('diverted'))!.id;
    const review = {
      headline: 'The bridge closed under run B.',
      findings: [
        { text: 'B was diverted after the bridge closed.', cites: [diverted] },
        { text: 'A delivered on time.', cites: [a.events.at(-1)!.id] },
        { text: 'A truck broke down in A.', cites: ['A:event-999'] },
      ],
      lesson: 'Get the field report onto the radio before choosing the road.',
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(review) } }] }))));
    const result = await debrief(harborPoint, runs, { MODEL_API_KEY: 'k' });
    expect(result.findings.map(f => f.text)).toEqual(['B was diverted after the bridge closed.', 'A delivered on time.']);
    expect(result.findings[0]!.cites[0]).toMatchObject({ id: diverted, tick: 4 });
    expect(result.removed).toEqual([{ text: 'A truck broke down in A.', badCites: ['A:event-999'] }]);
  });
});
