import { describe, expect, it } from 'vitest';
import { bridgeScene, handleCrew, waterOnBridge, type Segment } from '@crisiscraft/crew';
import { harborPoint, replay } from '@crisiscraft/sim';

const seg = (concept: Segment['concept'], box: Segment['box'], width: number, height: number): Segment =>
  ({ concept, box, confidence: 0.9, path: '', raster: { width, height } });

describe("June's field photo", () => {
  it('describes the water from the engine state, not from the model', () => {
    expect(bridgeScene(harborPoint, replay(harborPoint, [], 0))).toContain('below the deck');
    expect(bridgeScene(harborPoint, replay(harborPoint, [], 2))).toContain('underside of the deck');
    expect(bridgeScene(harborPoint, replay(harborPoint, [], 5))).toContain('over the bridge deck');
  });

  it("measures the share of the bridge's box covered by water pixels, through each mask's own raster", () => {
    const bridge = seg('bridge', { left: 0, top: 0, right: 100, bottom: 100 }, 10, 10);
    // Water from y=40 down at half resolution, every mask pixel wet: it covers rows 40–100 of the bridge, 60%.
    const water = seg('floodwater', { left: 0, top: 40, right: 100, bottom: 140 }, 5, 5);
    expect(waterOnBridge(bridge, water, new Uint8Array(25).fill(1))).toBeCloseTo(0.6, 5);
    expect(waterOnBridge(bridge, water, new Uint8Array(25))).toBe(0);
    const above = seg('floodwater', { left: 0, top: 200, right: 100, bottom: 300 }, 5, 5);
    expect(waterOnBridge(bridge, above, new Uint8Array(25).fill(1))).toBe(0);
  });

  it("puts the photo reading on the planner's radio, and rejects malformed photo fields", async () => {
    const ok = await handleCrew({ minute: 2, order: 'Get crates to the school.', commands: [], photo: { minute: 2, text: 'Water over the deck. Not passable.' } }, {});
    expect(ok.status).toBe(200);
    const bad = await handleCrew({ minute: 2, order: 'Get crates to the school.', commands: [], photo: { minute: 2, text: '' } }, {});
    expect(bad.status).toBe(400);
  });
});
