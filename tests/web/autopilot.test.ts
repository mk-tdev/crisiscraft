import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutopilot } from "../../apps/web/src/autopilot";

type Props = Parameters<typeof useAutopilot>[0];
let output: ReturnType<typeof useAutopilot>;
function Harness(props: Props) {
  output = useAutopilot(props);
  return null;
}
const move = (kind = "order") =>
  new Response(
    JSON.stringify({
      move: kind,
      order: "Deliver to school",
      reason: "Needed",
      ms: 1,
      model: "test",
    }),
  );
let renderer: ReactTestRenderer | undefined;
let resolve: (r: Response) => void;
let signals: AbortSignal[];
let props: Props;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  signals = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, init: RequestInit) => {
      signals.push(init.signal!);
      return new Promise<Response>((r) => {
        resolve = r;
      });
    }),
  );
  props = {
    enabled: true,
    minute: 2,
    revision: 0,
    runKey: "A",
    ended: false,
    playing: false,
    busy: false,
    turns: [],
    pending: null,
    commands: [],
    onOrder: vi.fn(),
    onApprove: vi.fn(),
    onSendBack: vi.fn(),
    onWait: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => {
    renderer = create(createElement(Harness, props));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}
async function update(change: Partial<Props>) {
  props = { ...props, ...change };
  await act(async () => {
    renderer!.update(createElement(Harness, props));
  });
}
describe("Autopilot request ownership", () => {
  it("applies a response once and does not cancel itself when thinking changes", async () => {
    await mount();
    expect(output.thinking).toBe(true);
    expect(signals[0]!.aborted).toBe(false);
    await act(async () => {
      resolve(move());
    });
    expect(props.onOrder).toHaveBeenCalledOnce();
    expect(output.moves).toHaveLength(1);
    expect(output.thinking).toBe(false);
  });
  it("ignores a delayed response after human takeover even when fetch ignores abort", async () => {
    await mount();
    await update({ enabled: false });
    expect(signals[0]!.aborted).toBe(true);
    await act(async () => {
      resolve(move());
    });
    expect(props.onOrder).not.toHaveBeenCalled();
    expect(output.moves).toHaveLength(0);
    expect(output.thinking).toBe(false);
  });
  it.each([
    { runKey: "new-drill" },
    { runKey: "B" },
    { minute: 4, revision: 2 },
    { busy: true },
  ])("discards stale approvals on context change %o", async (change) => {
    await mount();
    const old = resolve;
    await update(change);
    await act(async () => {
      old(move("approve"));
    });
    expect(props.onApprove).not.toHaveBeenCalled();
    expect(output.moves).toHaveLength(0);
  });
  it("does not let an old completion clear a newer request thinking state", async () => {
    await mount();
    const old = resolve;
    await update({ runKey: "B" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(signals).toHaveLength(2);
    await act(async () => {
      old(move("wait"));
    });
    expect(output.thinking).toBe(true);
    expect(props.onWait).not.toHaveBeenCalled();
    await act(async () => {
      resolve(move("wait"));
    });
    expect(props.onWait).toHaveBeenCalledOnce();
  });
  it("cancels on unmount and does not issue delayed actions", async () => {
    await mount();
    await act(async () => {
      renderer!.unmount();
    });
    renderer = undefined;
    await act(async () => {
      resolve(move());
    });
    expect(signals[0]!.aborted).toBe(true);
    expect(props.onOrder).not.toHaveBeenCalled();
  });
});
