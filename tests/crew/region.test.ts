import { describe, expect, it } from 'vitest';
import { briefing, deliberate, handleCrew, scriptedProvider } from '@crisiscraft/crew';
import { harborRegion as region, replay } from '@crisiscraft/sim';

const at = (minute: number) => replay(region, [], minute);

describe('crew in Harbor Point Region', () => {
  it('briefs with the region\'s own road and truck names', () => {
    const b = briefing(region, at(2), 'logistics');
    expect(b.drill).toBe('Harbor Point Region');
    expect(b.board.trucks.map(t => t.name)).toEqual(['Rescue 01', 'Rescue 02', 'Rescue 03', 'Lorry 04']);
    expect(b.roadMap!.roads.find(r => r.id === 'XV')!.name).toBe('causeway');
    expect(briefing(region, at(2), 'field').observations.map(o => o.id)).toEqual(['tide-0']);
  });

  it('scripted crew plans the care home first, by the shortest road, keeping a truck in reserve', async () => {
    const d = await deliberate(region, at(2), 'Supplies to whoever needs them most.', scriptedProvider);
    expect(d.command?.actions[0]).toMatchObject({ requestId: 'care', quantity: 8, route: ['P', 'W', 'Q', 'J', 'B', 'C'] });
  });

  it("June's tide warning reaches Priya, who will not send a truck onto the causeway", async () => {
    const d = await deliberate(region, at(8), 'Get the village its crates.', scriptedProvider);
    const june = d.turns.find(t => t.kind === 'review' && t.from === 'field')!;
    expect(june).toMatchObject({ verdict: 'concern' });
    expect(june.text).toMatch(/high water will cover the causeway/);
    expect(d.command).toBeNull();
    expect(`${d.plan?.message} ${d.plan?.rationale}`).toMatch(/causeway/i);
  });

  it('the API replays the scenario the client names', async () => {
    const ok = await handleCrew({ scenarioId: 'harbor-point-region', minute: 2, order: 'Care home first.', commands: [] }, {});
    expect(ok.status).toBe(200);
    expect((ok.body as { command: { actions: { route: string[] }[] } }).command.actions[0]!.route[0]).toBe('P');
    expect((await handleCrew({ scenarioId: 'nowhere', minute: 2, order: 'Hi.', commands: [] }, {})).status).toBe(400);
    expect((await handleCrew({ minute: 2, order: 'Get six crates to the school.', commands: [] }, {})).status).toBe(200);
  });
});
