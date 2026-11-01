import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRadioMic, type Heard } from "../../apps/web/src/voice";
let mic: ReturnType<typeof useRadioMic>;
function Harness({ onHeard }: { onHeard: (h: Heard) => void }) {
  mic = useRadioMic(onHeard);
  return null;
}
let root: ReactTestRenderer | undefined;
let heard: ReturnType<typeof vi.fn>;
let trackStop: ReturnType<typeof vi.fn>;
let stream: MediaStream;
let record: Recorder;
let resolveFetch: (r: Response) => void;
let signal: AbortSignal;
const closeAudio = vi.fn();
class Recorder {
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(_stream: MediaStream) {
    record = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["test"]) });
    this.onstop?.();
  }
}
beforeEach(() => {
  heard = vi.fn();
  trackStop = vi.fn();
  closeAudio.mockReset();
  stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
  });
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal(
    "AudioContext",
    class {
      async decodeAudioData() {
        return { duration: 0.1 };
      }
      async close() {
        closeAudio();
      }
    },
  );
  vi.stubGlobal(
    "OfflineAudioContext",
    class {
      destination = {};
      createBufferSource() {
        return { buffer: null, connect() {}, start() {} };
      }
      async startRendering() {
        return { getChannelData: () => new Float32Array(2400).fill(0.1) };
      }
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, init: RequestInit) => {
      signal = init.signal!;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    }),
  );
});
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = undefined;
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => {
    root = create(createElement(Harness, { onHeard: heard }));
  });
}
async function unmount() {
  await act(async () => {
    root!.unmount();
  });
  root = undefined;
}
const reply = () =>
  new Response(
    JSON.stringify({ transcript: "Take the hill road", ms: 1, model: "test" }),
  );
describe("voice session ownership", () => {
  it("discards a recording on unmount rather than sending a late order", async () => {
    await mount();
    await act(async () => {
      await mic.start();
    });
    expect(mic.state).toBe("listening");
    await unmount();
    expect(trackStop).toHaveBeenCalled();
    expect(record.state).toBe("inactive");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("releases a microphone permission result arriving after reset/unmount", async () => {
    let permit: (s: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(
      () =>
        new Promise((resolve) => {
          permit = resolve;
        }),
    );
    await mount();
    let start: Promise<void>;
    await act(async () => {
      start = mic.start();
    });
    expect(mic.state).toBe("requesting");
    await unmount();
    await act(async () => {
      permit!(stream);
      await start!;
    });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("aborts upload and ignores a late transcript even if transport ignores cancellation", async () => {
    await mount();
    await act(async () => {
      await mic.start();
    });
    await act(async () => {
      mic.stop();
    });
    expect(mic.state).toBe("transcribing");
    expect(closeAudio).toHaveBeenCalledOnce();
    await unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolveFetch(reply());
    });
    expect(heard).not.toHaveBeenCalled();
  });
  it("delivers to the latest callback and returns to idle on normal stop", async () => {
    await mount();
    await act(async () => {
      await mic.start();
    });
    const latest = vi.fn();
    await act(async () => {
      root!.update(createElement(Harness, { onHeard: latest }));
    });
    await act(async () => {
      mic.stop();
    });
    await act(async () => {
      resolveFetch(reply());
    });
    expect(heard).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    expect(mic.state).toBe("idle");
  });
  it("releases tracks when browser recording setup fails", async () => {
    vi.stubGlobal(
      "MediaRecorder",
      class {
        constructor() {
          throw new Error("No encoder");
        }
      },
    );
    await mount();
    await act(async () => {
      await mic.start();
    });
    expect(trackStop).toHaveBeenCalledOnce();
    expect(mic.error).toContain("Microphone unavailable");
    expect(mic.state).toBe("idle");
  });
});
