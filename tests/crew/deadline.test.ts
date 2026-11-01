import { createServer, type Server, type RequestListener } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { streamCrew, nodePhotoHandler } from "@crisiscraft/crew";
import {
  DEADLINE_MESSAGE,
  requestBudget,
  withDeadline,
} from "../../packages/crew/src/deadline";

let upstream: Server | undefined;
afterEach(async () => {
  if (upstream) {
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream!.close(() => resolve()));
    upstream = undefined;
  }
});
async function model(handler: RequestListener) {
  upstream = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    upstream!.once("error", reject);
    upstream!.listen(0, "127.0.0.1", resolve);
  });
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}`;
}
async function lines(stream: ReadableStream<Uint8Array>) {
  const text = await new Response(stream).text();
  return text
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
}
describe("bounded model workflows", () => {
  it("caps the configured workflow below the function limit", () => {
    expect(requestBudget({})).toBe(50_000);
    expect(requestBudget({ MODEL_REQUEST_BUDGET_MS: "90000" })).toBe(50_000);
    expect(requestBudget({ MODEL_REQUEST_BUDGET_MS: "-1" })).toBe(50_000);
  });
  it("ends a workflow even if a dependency ignores cancellation", async () => {
    let signal: AbortSignal | undefined;
    await expect(
      withDeadline((s) => {
        signal = s;
        return new Promise(() => {});
      }, 10),
    ).rejects.toThrow(DEADLINE_MESSAGE);
    expect(signal!.aborted).toBe(true);
  });
  it("terminates crew NDJSON after completed reports and a stalled planning HTTP request", async () => {
    const calls: string[] = [];
    const url = await model(async (req, res) => {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      const kind = body.response_format?.json_schema?.name ?? "tools";
      calls.push(kind);
      if (kind !== "report") return; // Actual HTTP connection stays open until cancellation.
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  message: "Report received.",
                  cites: [],
                }),
              },
            },
          ],
        }),
      );
    });
    const result = await lines(
      streamCrew(
        { minute: 2, commands: [], order: "Deliver to school" },
        {
          MODEL_API_KEY: "test-only",
          MODEL_BASE_URL: url,
          MODEL_REQUEST_BUDGET_MS: "250",
        },
      ),
    );
    expect(calls.filter((c) => c === "report")).toHaveLength(3);
    expect(calls).toContain("tools");
    expect(result.filter((l) => l.turn?.kind === "report")).toHaveLength(3);
    expect(result.at(-1)).toMatchObject({
      status: 502,
      error: expect.stringContaining(DEADLINE_MESSAGE),
    });
    expect(result.some((l) => l.done)).toBe(false);
  });
  it("ends the photo stream with an actionable error if SAM stalls after the generated image", async () => {
    const calls: string[] = [];
    const url = await model(async (req, res) => {
      calls.push(req.url!);
      for await (const _chunk of req) {
        /* consume body */
      }
      if (req.url !== "/images/generations") return;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: [{ b64_json: "dGVzdA==" }] }));
    });
    const output: string[] = [];
    let ended = false;
    const req = {
      method: "POST",
      async *[Symbol.asyncIterator]() {
        yield JSON.stringify({ minute: 2, commands: [] });
      },
    };
    const res = {
      statusCode: 0,
      setHeader() {},
      write(s: string) {
        output.push(s);
      },
      end() {
        ended = true;
      },
    };
    await nodePhotoHandler({
      MODEL_API_KEY: "test-only",
      MODEL_PHOTO_BASE_URL: url,
      MODEL_REQUEST_BUDGET_MS: "250",
    })(req, res);
    const result = output.map((s) => JSON.parse(s));
    expect(calls).toContain("/images/generations");
    expect(calls.filter((c) => c === "/responses")).toHaveLength(2);
    expect(result[0].event.kind).toBe("image");
    expect(result.at(-1).error).toBe(DEADLINE_MESSAGE);
    expect(result.some((l) => l.done)).toBe(false);
    expect(ended).toBe(true);
  });
});
