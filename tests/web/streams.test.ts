import { afterEach, describe, expect, it, vi } from "vitest";
import { askCrew, askPhoto } from "../../apps/web/src/api";
afterEach(() => vi.unstubAllGlobals());
const request = { minute: 2, commands: [] };
function serve(lines: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(lines.map((l) => JSON.stringify(l)).join("\n") + "\n", {
          headers: { "Content-Type": "application/x-ndjson" },
        }),
    ),
  );
}
describe("model stream completion", () => {
  it("rejects a truncated crew stream instead of treating partial reports as a checked plan", async () => {
    serve([{ turn: { kind: "report" } }]);
    const onTurn = vi.fn();
    await expect(
      askCrew({ ...request, order: "Deliver" }, onTurn),
    ).rejects.toThrow("Nothing was approved");
    expect(onTurn).toHaveBeenCalledOnce();
  });
  it("surfaces the server deadline message after partial photo output", async () => {
    serve([
      { event: { kind: "image" } },
      {
        error:
          "The model workflow timed out. Nothing was approved. Please try again.",
      },
    ]);
    await expect(askPhoto(request, vi.fn())).rejects.toThrow("timed out");
  });
  it("rejects an incomplete photo stream even when the image arrived", async () => {
    serve([{ event: { kind: "image" } }]);
    await expect(askPhoto(request, vi.fn())).rejects.toThrow("photo stopped");
  });
  it("requires and accepts a terminal completion message", async () => {
    serve([{ done: { command: null } }]);
    await expect(
      askCrew({ ...request, order: "Hold" }, vi.fn()),
    ).resolves.toEqual({ command: null });
    serve([{ done: true }]);
    await expect(askPhoto(request, vi.fn())).resolves.toBeUndefined();
  });
});
