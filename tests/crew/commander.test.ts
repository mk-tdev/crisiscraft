import { afterEach, describe, expect, it, vi } from 'vitest';
import { commanderMove, commanderView, scriptedMove } from '@crisiscraft/crew';
import { harborPoint, replay } from '@crisiscraft/sim';

const at = (minute: number) => replay(harborPoint, [], minute);
const request = (over: Partial<Parameters<typeof scriptedMove>[1]> = {}) => ({ minute: 2, commands: [], radio: [], pending: null, history: [], ...over });

afterEach(() => vi.unstubAllGlobals());

describe('Autopilot commander', () => {
  it("sees the public board and public reports only, never a crew member's private report", () => {
    const view = JSON.stringify(commanderView(harborPoint, at(2)));
    expect(view).not.toContain('Rising water threatens the bridge');
    expect(view).toContain('School shelter');
    expect(JSON.stringify(commanderView(harborPoint, at(4)))).toContain('Bridge is closed to new entry');
  });

  it('scripted autopilot orders once per open request, approves agreed plans, sends back contested ones', () => {
    const first = scriptedMove(at(2), request());
    expect(first).toMatchObject({ move: 'order' });
    expect(scriptedMove(at(2), request({ history: [first.order] })).move).toBe('wait');
    expect(scriptedMove(at(2), request({ pending: 'Rescue 01 via hill road' })).move).toBe('approve');
    expect(scriptedMove(at(2), request({ pending: 'Rescue 01 via bridge', radio: [{ from: 'June', kind: 'review', text: 'No.', verdict: 'concern' }] })).move).toBe('send_back');
  });

  it('downgrades a live move that cannot apply, such as approving when no plan is waiting', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ move: 'approve', order: '', reason: 'Looks good.' }) } }] }))));
    const move = await commanderMove(harborPoint, at(2), request(), { MODEL_API_KEY: 'k' });
    expect(move.move).toBe('wait');
  });
});
